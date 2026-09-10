"""
Fallback circuit geometry from OpenStreetMap, for venues FastF1 cannot cover.

A circuit that has never hosted a Formula 1 session has no position telemetry,
so there is no racing line to reconstruct. Where the venue exists as a mapped
road layout, OpenStreetMap's centreline is a real measurement of the same track
and stands in until the first session runs.

What this does NOT do is invent the parts OSM cannot supply. No corner numbering,
no start/finish line, no speed or throttle figures — those come from telemetry
and are emitted as empty or null so the UI can say they are missing.

Data (c) OpenStreetMap contributors, ODbL 1.0.

    python tools/osm_fallback.py            # write out/circuits_geom.json entry
    python tools/osm_fallback.py --snapshot # also patch src/data/snapshot/circuits.json
"""
import json, math, os, sys, urllib.request, urllib.parse
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geometry import (VIEW, rotate, rdp, smooth_path, make_transform, best_orientation,
                      resample, smooth_ring, detect_corners)

SNAPSHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..',
                        'src', 'data', 'snapshot', 'circuits.json')

# Venues without F1 telemetry, keyed by GridPred circuit id.
#
# `relation` is the OSM route relation for the lap. A route relation is used in
# preference to `highway=raceway` ways because a street circuit is mostly public
# road: the Madring's raceway-tagged ways add up to 2.7 km of a 5.4 km lap, while
# the relation lists every way of the circuit in running order.
TARGETS = {
    'spanish': {
        'name': 'Madring',
        'relation': 18813472,
        # This relation carries the pit lane as an ordinary member with no role,
        # so it has to be named outright. It is not part of the lap.
        'exclude': {1552567031},
        'officialLength': 5416,
        'officialCorners': 22,
    },
    'bahrain': {
        'name': 'Sepang International Circuit',
        'relation': 284496,
        'exclude': set(),
        'officialLength': 5543,
        'officialCorners': 15,
    },
}

# Members that are part of the venue but not part of a lap.
EXCLUDED_ROLES = {'pit_lane', 'pitlane', 'paddock'}

# Corner detection. The centreline is resampled at SPACING metres; curvature is
# read from a copy smoothed over DETECT_SMOOTH_M so that how densely a mapper
# happened to place vertices does not decide where the corners are.
#
# These are not tuned to one circuit: the same values recover 22 corners at the
# Madring and 15 at Sepang, each matching that circuit's official count.
SPACING = 5.0
DETECT_SMOOTH_M = 30.0
TURN_RATE = 0.35       # degrees per metre before it counts as turning
MERGE_WITHIN_M = 70.0  # closer than this and it is one corner described twice
MIN_TOTAL_TURN = 20.0  # a lesser bend is a kink in the road, not a corner

ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]


def fetch_relation(rel_id):
    """Relation with full member geometry, cached so reruns don't hit Overpass."""
    cache = f'out/osm_rel_{rel_id}.json'
    if os.path.exists(cache):
        print(f'   cached {cache}')
        return json.load(open(cache))
    q = f'[out:json][timeout:90];rel({rel_id});out geom;'
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(
                ep, data=urllib.parse.urlencode({'data': q}).encode(),
                headers={'User-Agent': 'GridPredBuild/1.0 (+circuit geometry)'})
            raw = urllib.request.urlopen(req, timeout=120).read()
            if raw[:1] != b'{':
                print(f'   {ep}: non-json response')
                continue
            data = json.loads(raw)
            os.makedirs('out', exist_ok=True)
            json.dump(data, open(cache, 'w'))
            return data
        except Exception as ex:
            print(f'   {ep}: {type(ex).__name__}')
    return None


def metres(a, b):
    """Distance between two lon/lat pairs, flat-earth at this latitude."""
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((b[0] - a[0]) * 111320 * math.cos(lat), (b[1] - a[1]) * 110540)


def lap_length(ring):
    """Length of a closed ring, including the leg back to the start."""
    return (sum(metres(p, q) for p, q in zip(ring, ring[1:]))
            + metres(ring[-1], ring[0]))


def start_node(rel):
    """The relation's start/finish node, when a mapper has marked one."""
    for m in rel['members']:
        if m['type'] == 'node' and m.get('role') == 'start':
            if m.get('lon') is not None:
                return (m['lon'], m['lat'])
    return None


def stitch(rel, exclude):
    """
    Walk the relation's ways into one closed ring.

    Each member carries a role saying which way round it is driven, so the ring
    comes out in the circuit's own direction of travel. Relation order is not
    guaranteed contiguous, so members are joined by nearest endpoint.
    """
    segments = []
    for m in rel['members']:
        if m.get('ref') in exclude or m.get('role') in EXCLUDED_ROLES:
            continue
        if not m.get('geometry'):
            continue
        pts = [(p['lon'], p['lat']) for p in m['geometry']]
        if m.get('role') == 'backward':
            pts.reverse()
        segments.append(pts)
    if not segments:
        return None, []

    chain = segments.pop(0)[:]
    gaps = []
    while segments:
        tail = chain[-1]
        best, bestd, flip = None, float('inf'), False
        for i, s in enumerate(segments):
            d0, d1 = metres(tail, s[0]), metres(tail, s[-1])
            if d0 < bestd:
                best, bestd, flip = i, d0, False
            if d1 < bestd:
                best, bestd, flip = i, d1, True
        seg = segments.pop(best)
        pts = seg[::-1] if flip else seg
        gaps.append(bestd)
        # a shared node is the same point twice; a real gap keeps both ends
        chain.extend(pts[1:] if bestd < 12 else pts)

    # the ring is closed by the path being drawn closed, so drop a duplicated
    # final point rather than emitting a zero-length bezier segment
    if len(chain) > 2 and metres(chain[-1], chain[0]) < 1:
        chain.pop()
    return chain, gaps


def pit_lane_geometry(rel, exclude):
    """Points of the way that carries the pit lane, if the relation has one."""
    for m in rel['members']:
        if m.get('role') in EXCLUDED_ROLES or m.get('ref') in exclude:
            if m.get('geometry'):
                return [(p['lon'], p['lat']) for p in m['geometry']]
    return None


def to_geometry(ring, target, start=None, pit_lane=None):
    """Project the ring into the shared viewBox and read its corners off it."""
    lat0 = sum(p[1] for p in ring) / len(ring)
    project = lambda pts: np.array([[p[0] * 111320 * math.cos(math.radians(lat0)),
                                     p[1] * 110540] for p in pts])

    # Resampling only inserts points along the existing segments, so the shape is
    # unchanged — it just gives corners enough samples to be measured.
    R = resample(project(ring), SPACING)
    n = len(R)

    # Telemetry layouts are oriented by FastF1's circuit rotation. There is no
    # such value here, so the orientation that fills the frame is used instead.
    rot = best_orientation(R)
    tf = make_transform(rotate(R, rot))
    P = tf(rotate(R, rot))
    simp = rdp(P, 0.35)

    # ── where the lap begins ──────────────────────────────────────────────
    # Best case the relation marks the line with a node. Failing that, the pit
    # lane locates the main straight: it runs alongside it by definition, so the
    # point of track nearest the middle of the pit lane is on that straight.
    # That is an inference, and it is recorded as one.
    start_index, start_from = None, None
    if start is not None:
        S = tf(rotate(project([start]), rot))[0]
        start_index = int(np.argmin(np.hypot(P[:, 0] - S[0], P[:, 1] - S[1])))
        start_from = 'relation start node'
    elif pit_lane:
        # The middle *vertex* of the pit lane is not its middle: OSM ways carry
        # whatever vertices a mapper placed, unevenly. Walk it by distance.
        pit = project(pit_lane)
        step = np.hypot(*np.diff(pit, axis=0).T)
        along = np.concatenate([[0.0], np.cumsum(step)])
        half = along[-1] / 2
        mid = np.array([np.interp(half, along, pit[:, 0]),
                        np.interp(half, along, pit[:, 1])])
        d = np.hypot(R[:, 0] - mid[0], R[:, 1] - mid[1])
        start_index = int(np.argmin(d))
        start_from = 'inferred from the pit lane'

    start_finish = None
    if start_index is not None:
        ahead = P[(start_index + 4) % n] - P[start_index]
        start_finish = {
            'x': round(float(P[start_index][0]), 1),
            'y': round(float(P[start_index][1]), 1),
            'angle': round(math.degrees(math.atan2(float(ahead[1]), float(ahead[0]))), 1),
        }

    # ── corners, measured from the centreline's own curvature ─────────────
    smoothed = smooth_ring(R, max(1, int(round(DETECT_SMOOTH_M / SPACING))))
    found = detect_corners(smoothed, SPACING, TURN_RATE, MERGE_WITHIN_M, MIN_TOTAL_TURN)

    corners = []
    if found:
        # numbered from the start/finish, in the direction the lap is driven
        origin = start_index if start_index is not None else 0
        ordered = sorted(found, key=lambda c: (c['index'] - origin) % n)
        for i, c in enumerate(ordered):
            j = c['index']
            ahead = P[(j + 4) % n] - P[j]
            corners.append({
                'number': i + 1,
                'letter': None,
                'x': round(float(P[j][0]), 1),
                'y': round(float(P[j][1]), 1),
                'distance': round(((j - origin) % n) * SPACING, 1),
                'angle': round(math.degrees(math.atan2(float(ahead[1]), float(ahead[0]))), 1),
            })

    note = ('Track centreline from the circuit\u2019s OpenStreetMap route relation. '
            'No Formula 1 session has run here, so there is no position telemetry: '
            'corner positions are measured from the centreline\u2019s curvature rather '
            'than read from FastF1, and speeds are unavailable until a car runs.')
    if start_from == 'inferred from the pit lane':
        note += (' The start/finish line is not mapped; it is placed on the main '
                 'straight, which the pit lane identifies by running alongside it.')

    return {
        'outline': smooth_path(simp, closed=True),
        'corners': corners,
        'startFinish': start_finish,
        'rotation': float(rot),
        # Every figure below is read from telemetry channels that do not exist
        # until a car runs here.
        'maxSpeed': None,
        'avgSpeed': None,
        'fullThrottlePct': None,
        'brakingPct': None,
        'lapDistance': round(lap_length(ring), 1),
        'geometrySource': {
            'provider': 'OpenStreetMap',
            'licence': 'ODbL 1.0',
            'relation': target['relation'],
            'url': f"https://www.openstreetmap.org/relation/{target['relation']}",
            'cornerSource': 'centreline curvature',
            'startFinishSource': start_from,
            'note': note,
        },
    }, simp


def main():
    os.makedirs('out', exist_ok=True)
    built = {}

    for cid, target in TARGETS.items():
        print(f"{cid}: {target['name']}  (relation {target['relation']})")
        data = fetch_relation(target['relation'])
        if not data:
            print('   no response from any Overpass mirror')
            continue
        rel = next((e for e in data.get('elements', [])
                    if e['type'] == 'relation' and e['id'] == target['relation']), None)
        if not rel:
            print('   relation not in response')
            continue

        ring, gaps = stitch(rel, target.get('exclude', set()))
        if not ring or len(ring) < 40:
            print(f'   insufficient geometry ({0 if not ring else len(ring)} pts)')
            continue

        length = lap_length(ring)
        official = target['officialLength']
        drift = abs(length - official) / official
        print(f'   ways {len(rel["members"])}  points {len(ring)}  '
              f'lap {length:.0f} m vs {official} m official  '
              f'({drift * 100:.1f}%)  worst join {max(gaps or [0]):.1f} m  '
              f'closing {metres(ring[-1], ring[0]):.1f} m')
        if drift > 0.05:
            print('   REJECTED: lap length disagrees with the official figure by '
                  'more than 5% — the ring is probably wrong')
            continue

        geometry, simp = to_geometry(ring, target, start_node(rel),
                                     pit_lane_geometry(rel, target.get('exclude', set())))
        got, want = len(geometry['corners']), target.get('officialCorners')
        agree = 'matches official' if got == want else f'official says {want}'
        print(f'   simplified to {len(simp)} points, path {len(geometry["outline"])} chars')
        print(f'   corners detected {got} ({agree}); start/finish '
              f'{geometry["geometrySource"]["startFinishSource"] or "not placed"}')
        built[cid] = geometry

    if not built:
        print('nothing built')
        return 1

    # merge into the pipeline intermediate build_snapshot.py reads
    path = 'out/circuits_geom.json'
    geom = json.load(open(path)) if os.path.exists(path) else {}
    for cid, g in built.items():
        entry = geom.setdefault(cid, {})
        entry['geometry'] = g
        entry['geometryUnavailable'] = None
        json.dump(geom, open(path, 'w'), indent=1)
    print(f'-> {path}')

    if '--snapshot' in sys.argv:
        snap = json.load(open(SNAPSHOT))
        for cid, g in built.items():
            snap[cid]['geometry'] = g
            snap[cid]['geometryUnavailable'] = None
        json.dump(snap, open(SNAPSHOT, 'w'), separators=(',', ':'))
        print(f'-> {SNAPSHOT} ({len(built)} circuit(s) patched)')

        # meta carries the geometry count as a factual claim about the snapshot,
        # so patching circuits without it would leave the count lying
        meta_path = os.path.join(os.path.dirname(SNAPSHOT), 'meta.json')
        meta = json.load(open(meta_path))
        meta['circuitsWithGeometry'] = sum(1 for c in snap.values() if c['geometry'])
        meta['circuitsTotal'] = len(snap)
        json.dump(meta, open(meta_path, 'w'), separators=(',', ':'))
        print(f"-> {meta_path} (geometry "
              f"{meta['circuitsWithGeometry']}/{meta['circuitsTotal']})")
    return 0


if __name__ == '__main__':
    sys.exit(main())
