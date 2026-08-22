"""
GridPred data extraction pipeline.

Pulls the real 2026 Formula 1 season out of FastF1 and writes normalised JSON
that the frontend service layer consumes. Nothing here is invented: every value
is either read from FastF1 or derived arithmetically from telemetry.
"""
import fastf1, warnings, math, json, os, sys, traceback
import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')
import logging
for n in ['fastf1', 'fastf1.core', 'fastf1.req', 'fastf1._api', 'fastf1.api']:
    logging.getLogger(n).setLevel(logging.ERROR)

fastf1.Cache.enable_cache('f1cache')
OUT = 'out'
os.makedirs(OUT, exist_ok=True)
SEASON = 2026
VW, VH, PAD = 1000.0, 620.0, 64.0

def log(*a): print(*a, file=sys.stderr, flush=True)

# ── geometry helpers ──────────────────────────────────────────────────────
def rotate(xy, deg):
    r = math.radians(deg); c, s = math.cos(r), math.sin(r)
    return np.column_stack([xy[:, 0]*c - xy[:, 1]*s, xy[:, 0]*s + xy[:, 1]*c])

def rdp(pts, eps):
    if len(pts) < 3: return pts
    start, end = pts[0], pts[-1]
    d = end - start; n = math.hypot(*d)
    if n == 0:
        dist = np.hypot(pts[:, 0]-start[0], pts[:, 1]-start[1])
    else:
        dist = np.abs(d[0]*(start[1]-pts[:, 1]) - (start[0]-pts[:, 0])*d[1]) / n
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return np.vstack([rdp(pts[:i+1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([start, end])

def smooth_path(pts, closed=True):
    """Catmull-Rom through the points -> cubic bezier path data."""
    n = len(pts)
    at = lambda i: pts[i % n] if closed else pts[max(0, min(n-1, i))]
    d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"
    last = n if closed else n-1
    for i in range(last):
        p0, p1, p2, p3 = at(i-1), at(i), at(i+1), at(i+2)
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        d += f" C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d + (" Z" if closed else "")

def make_transform(xy):
    minx, maxx = float(xy[:, 0].min()), float(xy[:, 0].max())
    miny, maxy = float(xy[:, 1].min()), float(xy[:, 1].max())
    scale = min((VW-2*PAD)/max(maxx-minx, 1e-6), (VH-2*PAD)/max(maxy-miny, 1e-6))
    ox = (VW - (maxx-minx)*scale)/2 - minx*scale
    oy = (VH - (maxy-miny)*scale)/2 - miny*scale
    def tf(p):
        p = np.asarray(p, dtype=float)
        return np.column_stack([p[:, 0]*scale+ox, VH - (p[:, 1]*scale+oy)])
    return tf

def contiguous(mask, dist, min_len):
    """Ranges where mask is true and the covered distance exceeds min_len."""
    out, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j+1 < n and mask[j+1]: j += 1
            if dist[j]-dist[i] >= min_len:
                out.append((i, j))
            i = j+1
        else:
            i += 1
    return out

def sub_path(P, i, j):
    seg = P[i:j+1]
    if len(seg) < 2: return None
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in seg)

# ── circuit extraction ────────────────────────────────────────────────────
def extract_circuit(year, rnd, meta):
    s = fastf1.get_session(year, rnd, 'R')
    s.load(telemetry=True, laps=True, weather=False, messages=False)
    ci = s.get_circuit_info()
    lap = s.laps.pick_fastest()
    tel = lap.get_telemetry().reset_index(drop=True)

    xy = np.column_stack([tel['X'].astype(float), tel['Y'].astype(float)])
    rot = float(ci.rotation or 0)
    xy = rotate(xy, rot)
    tf = make_transform(xy)
    P = tf(xy)

    simplified = rdp(P, 0.35)
    outline = smooth_path(simplified, closed=True)

    corners = []
    if ci.corners is not None and len(ci.corners):
        cxy = rotate(np.column_stack([ci.corners['X'].astype(float),
                                      ci.corners['Y'].astype(float)]), rot)
        C = tf(cxy)
        for i, row in enumerate(ci.corners.itertuples()):
            corners.append({
                'number': int(row.Number),
                'letter': (row.Letter or '') or None,
                'x': round(float(C[i][0]), 1),
                'y': round(float(C[i][1]), 1),
                'distance': round(float(row.Distance), 1),
                'angle': round(float(row.Angle), 1),
            })

    dist = tel['Distance'].astype(float).to_numpy()
    speed = tel['Speed'].astype(float).to_numpy()
    throttle = tel['Throttle'].astype(float).to_numpy()
    brake = tel['Brake'].astype(bool).to_numpy()
    drs = tel['DRS'].astype(float).to_numpy()

    # 2026 has no DRS; keep the field so the shape is stable and the frontend
    # can render zones the moment a season that has them is loaded.
    drs_zones = [{'startDistance': round(float(dist[i]), 1),
                  'endDistance': round(float(dist[j]), 1),
                  'path': sub_path(P, i, j)}
                 for i, j in contiguous(np.isin(drs, [10, 12, 14]), dist, 120)]

    full_throttle = [{'startDistance': round(float(dist[i]), 1),
                      'endDistance': round(float(dist[j]), 1),
                      'path': sub_path(P, i, j)}
                     for i, j in contiguous(throttle >= 98, dist, 180)]
    braking = [{'startDistance': round(float(dist[i]), 1),
                'endDistance': round(float(dist[j]), 1),
                'path': sub_path(P, i, j)}
               for i, j in contiguous(brake, dist, 25)]

    # speed trace, downsampled for the frontend chart
    step = max(1, len(tel)//160)
    trace = [{'d': round(float(dist[i]), 1),
              'speed': round(float(speed[i]), 1),
              'throttle': round(float(throttle[i]), 0),
              'brake': bool(brake[i])} for i in range(0, len(tel), step)]

    # racing-line sample points for the telemetry marker
    line = [[round(float(x), 1), round(float(y), 1)] for x, y in P[::max(1, len(P)//220)]]

    start = P[0]
    hdg = P[min(4, len(P)-1)] - P[0]

    return {
        'outline': outline,
        'points': len(simplified),
        'corners': corners,
        'drsZones': drs_zones,
        'fullThrottleZones': full_throttle,
        'brakingZones': braking,
        'speedTrace': trace,
        'racingLine': line,
        'startFinish': {'x': round(float(start[0]), 1), 'y': round(float(start[1]), 1),
                        'angle': round(math.degrees(math.atan2(float(hdg[1]), float(hdg[0]))), 1)},
        'rotation': rot,
        'lapDistance': round(float(dist[-1]), 1),
        'maxSpeed': round(float(speed.max()), 1),
        'avgSpeed': round(float(speed.mean()), 1),
        'fullThrottlePct': round(float((throttle >= 98).mean()*100), 1),
        'brakingPct': round(float(brake.mean()*100), 1),
        'geometrySource': {
            'year': year, 'round': int(rnd), 'session': 'Race',
            'event': meta, 'driver': str(lap['Driver']),
            'lapTime': str(lap['LapTime']),
        },
    }

# ── main ──────────────────────────────────────────────────────────────────
def main():
    sched = fastf1.get_event_schedule(SEASON, include_testing=False)
    sched = sched[sched['RoundNumber'] > 0].sort_values('RoundNumber')

    # index prior seasons so circuits that have not run in 2026 can borrow
    # geometry from the most recent race actually held at the same venue
    prior = {}
    for y in (2025, 2024, 2023, 2022, 2021, 2019, 2018):
        try:
            ps = fastf1.get_event_schedule(y, include_testing=False)
            prior[y] = ps[ps['RoundNumber'] > 0]
        except Exception as e:
            log(f'  ! schedule {y}: {e}')

    now = pd.Timestamp.utcnow().tz_localize(None)
    calendar, circuits = [], {}

    for ev in sched.itertuples():
        rnd = int(ev.RoundNumber)
        loc = str(ev.Location)
        cid = (str(ev.EventName).replace(' Grand Prix', '').strip().lower()
               .replace(' ', '-').replace('ã', 'a').replace('é', 'e'))
        raced = pd.Timestamp(ev.EventDate) < now

        sessions = []
        for i in range(1, 6):
            nm = getattr(ev, f'Session{i}', None)
            dt = getattr(ev, f'Session{i}DateUtc', None)
            if isinstance(nm, str) and nm and pd.notna(dt):
                # FastF1 returns naive UTC timestamps. Without the 'Z' marker
                # JavaScript parses these as LOCAL time, shifting every session
                # by the viewer's UTC offset.
                sessions.append({'name': nm, 'dateUtc': pd.Timestamp(dt).isoformat() + 'Z'})

        calendar.append({
            'round': rnd, 'id': cid,
            'eventName': str(ev.EventName),
            'officialName': str(ev.OfficialEventName),
            'country': str(ev.Country), 'location': loc,
            'circuitKey': loc,
            'eventDate': pd.Timestamp(ev.EventDate).date().isoformat(),
            'format': str(ev.EventFormat),
            'isSprint': 'sprint' in str(ev.EventFormat),
            'sessions': sessions,
            'raced': bool(raced),
        })

        # pick a geometry source: this year if run, else newest prior year here
        src = (SEASON, rnd) if raced else None
        if src is None:
            for y in (2025, 2024, 2023, 2022, 2021, 2019, 2018):
                df = prior.get(y)
                if df is None: continue
                hit = df[df['Location'] == loc]
                if len(hit):
                    src = (y, int(hit.iloc[0]['RoundNumber'])); break

        if src is None:
            log(f'R{rnd:>2} {loc:<20} NO GEOMETRY SOURCE')
            circuits[cid] = {'id': cid, 'location': loc, 'geometry': None,
                             'geometryUnavailable': 'No Formula 1 session with position telemetry has been held at this venue.'}
            continue

        try:
            g = extract_circuit(src[0], src[1], f'{ev.EventName}')
            circuits[cid] = {'id': cid, 'location': loc, 'geometry': g}
            log(f'R{rnd:>2} {loc:<20} ok  src={src[0]}R{src[1]} corners={len(g["corners"])} '
                f'pts={g["points"]} thr={len(g["fullThrottleZones"])} brk={len(g["brakingZones"])}')
        except Exception as e:
            log(f'R{rnd:>2} {loc:<20} FAIL {type(e).__name__}: {e}')
            circuits[cid] = {'id': cid, 'location': loc, 'geometry': None,
                             'geometryUnavailable': f'{type(e).__name__}'}

    json.dump(calendar, open(f'{OUT}/calendar.json', 'w'), indent=1)
    json.dump(circuits, open(f'{OUT}/circuits_geom.json', 'w'), indent=1)
    log(f'\nwrote calendar ({len(calendar)}) and circuits ({len(circuits)})')

if __name__ == '__main__':
    main()
