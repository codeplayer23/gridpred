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
from geometry import VIEW, rotate, rdp, smooth_path, make_transform, best_orientation

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
    },
    'bahrain': {
        'name': 'Sepang International Circuit',
        'relation': 284496,
        'exclude': set(),
        'officialLength': 5543,
    },
}

# Members that are part of the venue but not part of a lap.
EXCLUDED_ROLES = {'pit_lane', 'pitlane', 'paddock'}

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


def to_geometry(ring, target, start=None):
    """Project the ring into the shared 1000x620 viewBox."""
    lat0 = sum(p[1] for p in ring) / len(ring)
    project = lambda p: [p[0] * 111320 * math.cos(math.radians(lat0)), p[1] * 110540]
    xy = np.array([project(p) for p in ring])

    # Telemetry layouts are oriented by FastF1's circuit rotation. There is no
    # such value here, so the orientation that fills the frame is used instead.
    rot = best_orientation(xy)
    tf = make_transform(rotate(xy, rot))
    P = tf(rotate(xy, rot))
    simp = rdp(P, 0.35)

    # Only if the relation actually marks the line. Placing it by eye would put
    # a checkered marker on a guess, so no start node means no marker.
    start_finish = None
    if start is not None:
        S = tf(rotate(np.array([project(start)]), rot))[0]
        i = int(np.argmin(np.hypot(P[:, 0] - S[0], P[:, 1] - S[1])))
        # heading a few points along the ring, matching the telemetry convention
        hdg = P[(i + 4) % len(P)] - P[i]
        start_finish = {
            'x': round(float(P[i][0]), 1),
            'y': round(float(P[i][1]), 1),
            'angle': round(math.degrees(math.atan2(float(hdg[1]), float(hdg[0]))), 1),
        }

    return {
        'outline': smooth_path(simp, closed=True),
        # Corner numbering comes from session.get_circuit_info(); OSM has none.
        'corners': [],
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
            'note': ('Track centreline from the circuit’s OpenStreetMap route '
                     'relation. No Formula 1 session has run here, so there is no '
                     'position telemetry: corner positions, speeds and the '
                     'start/finish line arrive with the first session.'),
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

        geometry, simp = to_geometry(ring, target, start_node(rel))
        print(f'   simplified to {len(simp)} points, path {len(geometry["outline"])} chars, '
              f'start/finish {"from relation" if geometry["startFinish"] else "not mapped"}')
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
