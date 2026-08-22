"""Fallback geometry from OpenStreetMap (ODbL) for venues FastF1 cannot cover."""
import json, math, urllib.request, urllib.parse, sys
import numpy as np
sys.path.insert(0,'.')
from extract import rdp, smooth_path, make_transform

TARGETS = {
    # id : (name, bbox south,west,north,east)
    'kuala-lumpur': ('Sepang International Circuit', (2.750, 101.725, 2.775, 101.750)),
    'spanish':      ('Madring / IFEMA Madrid',       (40.455, -3.640, 40.480, -3.595)),
}
ENDPOINTS = ["https://overpass.kumi.systems/api/interpreter",
             "https://overpass-api.de/api/interpreter",
             "https://overpass.private.coffee/api/interpreter"]

def fetch(bbox):
    s,w,n,e = bbox
    q = f'[out:json][timeout:60];(way["highway"="raceway"]({s},{w},{n},{e}););out geom;'
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep, data=urllib.parse.urlencode({'data':q}).encode(),
                                         headers={'User-Agent':'GridPredBuild/1.0'})
            raw = urllib.request.urlopen(req, timeout=75).read()
            if raw[:1] != b'{':
                print(f'   {ep}: non-json'); continue
            return json.loads(raw)
        except Exception as ex:
            print(f'   {ep}: {type(ex).__name__}')
    return None

def merge_ways(els):
    """Stitch raceway ways into the longest continuous ring."""
    segs = [[(p['lon'], p['lat']) for p in e['geometry']] for e in els if e.get('geometry')]
    segs = [s for s in segs if len(s) > 4]
    if not segs: return None
    best = max(segs, key=len)
    if best[0] == best[-1] and len(best) > 40:
        return best
    # greedy stitch from the longest segment
    used=[best]; chain=list(best); pool=[s for s in segs if s is not best]
    def d(a,b): return math.hypot(a[0]-b[0], a[1]-b[1])
    changed=True
    while changed and pool:
        changed=False
        for s in list(pool):
            for cand in (s, s[::-1]):
                if d(chain[-1], cand[0]) < 0.0006:
                    chain += cand[1:]; pool.remove(s); changed=True; break
            if changed: break
    return chain

for cid,(name,bbox) in TARGETS.items():
    print(f'{cid}: {name}')
    data = fetch(bbox)
    if not data:
        print('   no response'); continue
    ring = merge_ways(data.get('elements', []))
    if not ring or len(ring) < 40:
        print(f'   insufficient geometry ({0 if not ring else len(ring)} pts)'); continue
    lon = np.array([p[0] for p in ring]); lat = np.array([p[1] for p in ring])
    x = lon * math.cos(math.radians(float(lat.mean()))) * 111320.0
    y = lat * 110540.0
    P = make_transform(np.column_stack([x,y]))(np.column_stack([x,y]))
    simp = rdp(P, 0.35)
    outline = smooth_path(simp, closed=True)
    out = {'outline':outline,'points':len(simp),'corners':[],'drsZones':[],
           'fullThrottleZones':[],'brakingZones':[],'speedTrace':[],
           'racingLine':[[round(float(a),1),round(float(b),1)] for a,b in P[::max(1,len(P)//220)]],
           'startFinish':{'x':round(float(P[0][0]),1),'y':round(float(P[0][1]),1),'angle':0.0},
           'rotation':0.0,'lapDistance':None,'maxSpeed':None,'avgSpeed':None,
           'fullThrottlePct':None,'brakingPct':None,
           'geometrySource':{'provider':'OpenStreetMap','licence':'ODbL 1.0',
                             'note':'Track centreline from OSM; no F1 session telemetry exists for this venue.'}}
    print(f'   OK ring={len(ring)} simplified={len(simp)}')
    json.dump(out, open(f'osm_{cid}.json','w'))
