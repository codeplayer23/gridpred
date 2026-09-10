"""Assemble the frontend snapshot from the extracted FastF1 data."""
import json, math, os, shutil, unicodedata, re

DEST = '/Users/niteshnirranjan/Downloads/F1/src/data/snapshot'
os.makedirs(f'{DEST}/telemetry', exist_ok=True)

cal      = json.load(open('out/calendar.json'))
geom     = json.load(open('out/circuits_geom.json'))
specs    = json.load(open('out/specs.json'))
drivers  = json.load(open('out/drivers.json'))
teams    = json.load(open('out/teams.json'))
results  = json.load(open('out/results.json'))
standing = json.load(open('out/standings.json'))
meta     = json.load(open('out/meta.json'))
# Career history is optional: the pipeline still builds without it, the driver
# pages just fall back to this season only.
careers  = json.load(open('out/careers.json')) if os.path.exists('out/careers.json') else {}

# Race length follows the sporting regulations: the fewest laps exceeding 305 km.
# Monaco is the codified exception at ~260 km.
LAPS_OVERRIDE = {'monaco': 78}
actual_laps = {}
for r in results:
    # winner's completed laps, when we have them
    actual_laps.setdefault(r['circuitId'], None)

circuits = {}
for ev in cal:
    cid = ev['id']
    sp  = specs.get(cid, {})
    length = sp.get('trackLength')
    laps = LAPS_OVERRIDE.get(cid)
    if laps is None and length:
        laps = math.ceil(305.0 / length)
    g = geom.get(cid, {}).get('geometry')

    circuits[cid] = {
        'id': cid,
        'name': sp.get('wikiTitle') or ev['location'],
        'shortName': ev['location'],
        'location': ev['location'],
        'country': ev['country'],
        'trackLength': length,
        'laps': laps,
        'raceDistance': round(length * laps, 3) if (length and laps) else None,
        'cornerCount': sp.get('turnsWiki'),
        'geometry': None if not g else {
            'outline': g['outline'],
            'corners': g['corners'],
            'startFinish': g['startFinish'],
            'rotation': g['rotation'],
            'maxSpeed': g['maxSpeed'],
            'avgSpeed': g['avgSpeed'],
            'fullThrottlePct': g['fullThrottlePct'],
            'brakingPct': g['brakingPct'],
            'lapDistance': g['lapDistance'],
            'geometrySource': g['geometrySource'],
        },
        'geometryUnavailable': geom.get(cid, {}).get('geometryUnavailable'),
    }

    # heavy channels live in their own lazily-loaded file
    if g and (g.get('speedTrace') or g.get('racingLine')):
        json.dump({'speedTrace': g.get('speedTrace', []),
                   'racingLine': g.get('racingLine', []),
                   'drsZones': g.get('drsZones', []),
                   'fullThrottleZones': g.get('fullThrottleZones', []),
                   'brakingZones': g.get('brakingZones', []),
                   'source': g.get('geometrySource')},
                  open(f'{DEST}/telemetry/{cid}.json', 'w'), separators=(',', ':'))

for ev in cal:
    ev['circuitId'] = ev['id']
    race = [s for s in ev['sessions'] if s['name'] in ('Race',)]
    ev['raceSessionUtc'] = race[0]['dateUtc'] if race else f"{ev['eventDate']}T13:00:00Z"

# Constructor metadata from the published 2026 entry list. FastF1 carries the
# short team name only, so full entrant names and power units come from the
# season's official entry list.
ENTRY_LIST = {
 'mercedes':        ('Mercedes-AMG Petronas F1 Team',   'Mercedes-AMG F1 M17', 'MER'),
 'ferrari':         ('Scuderia Ferrari HP',             'Ferrari 067/6',       'FER'),
 'mclaren':         ('McLaren Mastercard F1 Team',      'Mercedes-AMG F1 M17', 'MCL'),
 'red-bull-racing': ('Oracle Red Bull Racing',          'Red Bull Ford DM01',  'RBR'),
 'racing-bulls':    ('Visa Cash App Racing Bulls F1 Team','Red Bull Ford DM01','RB'),
 'alpine':          ('BWT Alpine F1 Team',              'Mercedes-AMG F1 M17', 'ALP'),
 'haas-f1-team':    ('TGR Haas F1 Team',                'Ferrari 067/6',       'HAA'),
 'audi':            ('Audi Revolut F1 Team',            'Audi AFR 26 Hybrid',  'AUD'),
 'williams':        ('Atlassian Williams F1 Team',      'Mercedes-AMG F1 M17', 'WIL'),
 'aston-martin':    ('Aston Martin Aramco F1 Team',     'Honda RA626H',        'AMR'),
 'cadillac':        ('Cadillac Formula 1 Team',         'Ferrari 067/6',       'CAD'),
}
for t in teams:
    full, pu, abbr = ENTRY_LIST.get(t['id'], (t['name'], None, t['name'][:3].upper()))
    t['fullName'] = full
    t['powerUnit'] = pu
    t['abbreviation'] = abbr

# link teams -> driver ids, and drivers -> team id
tid_of = {}
for t in teams:
    for d in t['drivers']:
        tid_of[d] = t['id']
for d in drivers:
    d['teamId'] = tid_of.get(d['id'])

meta['circuitsWithGeometry'] = sum(1 for c in circuits.values() if c['geometry'])
meta['circuitsTotal'] = len(circuits)

# Resolve driver headshots as part of the build. Doing this as a separate pass
# meant a later rebuild silently dropped it and every card fell back to the
# helmet, so it belongs inside the snapshot step.
def resolve_headshots(drivers):
    import urllib.request
    MIN_REAL_BYTES = 12000
    for d in drivers:
        url = d.get('headshotUrl')
        if not url:
            d['headshot'] = None
            continue
        base = url.replace('/d_driver_fallback_image.png', '')
        variants = {k: base.replace('/1col/', f'/{k}/') for k in ('2col', '4col', '6col')}
        try:
            req = urllib.request.Request(variants['4col'], headers={'User-Agent': 'GridPredBuild/1.0'})
            size = len(urllib.request.urlopen(req, timeout=30).read())
        except Exception:
            size = 0
        real = size >= MIN_REAL_BYTES
        d['headshot'] = {'sm': variants['2col'], 'md': variants['4col'], 'lg': variants['6col']} if real else None
        d['headshotUrl'] = variants['4col'] if real else None
    got = sum(1 for d in drivers if d['headshot'])
    print(f'  headshots verified: {got}/{len(drivers)} real photographs')
    return drivers

drivers = resolve_headshots(drivers)


def w(name, obj, compact=True):
    json.dump(obj, open(f'{DEST}/{name}', 'w'), separators=(',', ':') if compact else None)
    print(f'  {name:<18} {os.path.getsize(f"{DEST}/{name}")/1024:8.1f} KB')

print('snapshot ->', DEST)
w('calendar.json', cal)
w('circuits.json', circuits)
w('drivers.json', drivers)
w('teams.json', teams)
w('results.json', results)
w('standings.json', standing)
if careers:
    w('careers.json', careers)
w('meta.json', meta)
tel_size = sum(os.path.getsize(f'{DEST}/telemetry/{f}') for f in os.listdir(f'{DEST}/telemetry'))
print(f'  telemetry/         {tel_size/1024:8.1f} KB across {len(os.listdir(f"{DEST}/telemetry"))} files (lazy)')
print(f"\ngeometry: {meta['circuitsWithGeometry']}/{meta['circuitsTotal']}")
