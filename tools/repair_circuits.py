"""
Repair pass for circuits whose first extraction was poor.

Two failure modes showed up in the batch run:
  * the fastest lap's telemetry can be truncated or missing entirely, and
  * venue matching by `Location` breaks when FastF1 renames it between seasons
    (Abu Dhabi is 'Yas Marina' in 2026 but 'Yas Island' in 2025, which silently
    fell back to the pre-2021 layout).
Both are fixed here by scoring candidate laps on telemetry completeness and by
naming the source event explicitly.
"""
import fastf1, warnings, json, sys, math
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
import logging
for n in ['fastf1','fastf1.core','fastf1.req','fastf1._api','fastf1.events']:
    logging.getLogger(n).setLevel(logging.ERROR)
fastf1.Cache.enable_cache('f1cache')
sys.path.insert(0,'.')
from extract import (rotate, rdp, smooth_path, make_transform, contiguous, sub_path, log)

TARGETS = {
    # circuitId : (year, round)   explicit, verified source events.
    # Monaco 2026 is unusable — get_telemetry() raises for every lap in that
    # session — so the geometry comes from the 2025 race at the same circuit.
    'monaco':      (2025, 8),  # 2026 session telemetry unreadable
    # 2026 Hungary position data is noisy — the outline comes out with spikes and
    # corner markers land off the track. The 2025 race at the same circuit is clean.
    'hungarian':   (2025, 14),
    'italian':     (2025, 16),
    'abu-dhabi':   (2025, 24),
}

def best_lap(session, expected_km=None):
    """Pick the lap with the most complete position telemetry, not just the fastest."""
    laps = session.laps.pick_quicklaps(1.08) if len(session.laps) else session.laps
    if laps is None or not len(laps):
        laps = session.laps
    try:
        laps = laps.sort_values('LapTime').head(12)
    except Exception:
        laps = laps.head(12)
    cands = []
    for _, lap in laps.iterrows():
        try:
            tel = lap.get_telemetry().reset_index(drop=True)
        except Exception:
            continue
        if tel is None or len(tel) < 60 or 'X' not in tel:
            continue
        cands.append((lap, tel, float(tel['Distance'].max()), len(tel)))
    if not cands:
        return None
    # A lap whose distance is far from the group is anomalous (pit excursion,
    # bad stitch) and distorts the bounding box, so judge against the median
    # first and only then prefer the densest sampling.
    med = float(np.median([c[2] for c in cands]))
    inliers = [c for c in cands if abs(c[2] - med) <= med * 0.06] or cands
    lap, tel, _, _ = max(inliers, key=lambda c: c[3])
    return lap, tel

def extract(year, rnd):
    s = fastf1.get_session(year, rnd, 'R')
    s.load(telemetry=True, laps=True, weather=False, messages=False)
    ci = s.get_circuit_info()
    picked = best_lap(s)
    if picked is None:
        raise RuntimeError('no lap with usable telemetry')
    lap, tel = picked

    xy = np.column_stack([tel['X'].astype(float), tel['Y'].astype(float)])
    rot = float(ci.rotation or 0)
    xy = rotate(xy, rot)
    tf = make_transform(xy)
    P = tf(xy)
    simplified = rdp(P, 0.35)
    outline = smooth_path(simplified, closed=True)

    corners = []
    if ci.corners is not None and len(ci.corners):
        C = tf(rotate(np.column_stack([ci.corners['X'].astype(float), ci.corners['Y'].astype(float)]), rot))
        for i, row in enumerate(ci.corners.itertuples()):
            corners.append({'number':int(row.Number),'letter':(row.Letter or '') or None,
                            'x':round(float(C[i][0]),1),'y':round(float(C[i][1]),1),
                            'distance':round(float(row.Distance),1),'angle':round(float(row.Angle),1)})

    dist=tel['Distance'].astype(float).to_numpy(); speed=tel['Speed'].astype(float).to_numpy()
    thr=tel['Throttle'].astype(float).to_numpy(); brk=tel['Brake'].astype(bool).to_numpy()
    drs=tel['DRS'].astype(float).to_numpy()
    step=max(1,len(tel)//160)
    start=P[0]; hdg=P[min(4,len(P)-1)]-P[0]
    return {
        'outline':outline,'points':len(simplified),'corners':corners,
        'drsZones':[{'startDistance':round(float(dist[i]),1),'endDistance':round(float(dist[j]),1),'path':sub_path(P,i,j)}
                    for i,j in contiguous(np.isin(drs,[10,12,14]),dist,120)],
        'fullThrottleZones':[{'startDistance':round(float(dist[i]),1),'endDistance':round(float(dist[j]),1),'path':sub_path(P,i,j)}
                    for i,j in contiguous(thr>=98,dist,180)],
        'brakingZones':[{'startDistance':round(float(dist[i]),1),'endDistance':round(float(dist[j]),1),'path':sub_path(P,i,j)}
                    for i,j in contiguous(brk,dist,25)],
        'speedTrace':[{'d':round(float(dist[i]),1),'speed':round(float(speed[i]),1),
                       'throttle':round(float(thr[i]),0),'brake':bool(brk[i])} for i in range(0,len(tel),step)],
        'racingLine':[[round(float(x),1),round(float(y),1)] for x,y in P[::max(1,len(P)//220)]],
        'startFinish':{'x':round(float(start[0]),1),'y':round(float(start[1]),1),
                       'angle':round(math.degrees(math.atan2(float(hdg[1]),float(hdg[0]))),1)},
        'rotation':rot,'lapDistance':round(float(dist[-1]),1),
        'maxSpeed':round(float(speed.max()),1),'avgSpeed':round(float(speed.mean()),1),
        'fullThrottlePct':round(float((thr>=98).mean()*100),1),'brakingPct':round(float(brk.mean()*100),1),
        'geometrySource':{'year':year,'round':int(rnd),'session':'Race','driver':str(lap['Driver']),
                          'lapTime':str(lap['LapTime'])},
    }

circuits = json.load(open('out/circuits_geom.json'))
for cid,(year,rnd) in TARGETS.items():
    if cid not in circuits:
        log(f'{cid}: not in snapshot, skipping'); continue
    try:
        g = extract(year, rnd)
        circuits[cid]['geometry'] = g
        circuits[cid].pop('geometryUnavailable', None)
        log(f'{cid:<12} repaired  src={year}R{rnd} corners={len(g["corners"])} pts={g["points"]} lapDist={g["lapDistance"]}')
    except Exception as e:
        log(f'{cid:<12} STILL FAILING: {type(e).__name__}: {e}')
json.dump(circuits, open('out/circuits_geom.json','w'), indent=1)
log('saved')
