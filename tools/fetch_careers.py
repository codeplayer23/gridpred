"""
Career history for the current grid, from the published record.

The snapshot describes this season. A driver is more than one season: when they
started, who they started with, how many seasons they have run and what each one
came to. None of that is in FastF1's session data, and none of it should be
written by hand — it is a matter of record, so it is fetched from the record.

Source: Jolpica (the maintained Ergast successor), which carries every Formula 1
result since 1950. Everything here is aggregated from actual race classifications
rather than copied from a summary, so the totals can be checked against the races
they came from.

    python tools/fetch_careers.py          # -> out/careers.json

Responses are cached under out/cache/ so reruns cost nothing.
"""
import json, os, sys, time, unicodedata, urllib.request

API = 'https://api.jolpi.ca/ergast/f1'
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'snapshot')
CACHE = 'out/cache'
SEASON = 2026
PAGE = 100


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s))
                   if unicodedata.category(c) != 'Mn')


def key(s):
    return strip_accents(s).lower().replace('-', ' ').replace("'", '').strip()


def get(path):
    """Fetch a path, caching the response on disk."""
    os.makedirs(CACHE, exist_ok=True)
    name = os.path.join(CACHE, path.replace('/', '_').replace('?', '_').replace('&', '_') + '.json')
    if os.path.exists(name):
        return json.load(open(name))
    for attempt in range(5):
        try:
            req = urllib.request.Request(f'{API}/{path}',
                                         headers={'User-Agent': 'GridPredBuild/1.0'})
            data = json.loads(urllib.request.urlopen(req, timeout=45).read())
            json.dump(data, open(name, 'w'))
            time.sleep(0.6)          # the API is free and shared; do not hammer it
            return data
        except Exception as ex:
            wait = 3 + attempt * 4
            print(f'   {type(ex).__name__} on {path}; retrying in {wait}s')
            time.sleep(wait)
    raise SystemExit(f'giving up on {path}')


def ergast_index():
    """Map surname -> Ergast driver id, from this season's entry list."""
    out = {}
    for page in range(3):
        data = get(f'{SEASON}/drivers.json?limit={PAGE}&offset={page * PAGE}')
        table = data['MRData']['DriverTable']['Drivers']
        for d in table:
            out.setdefault(key(d['familyName']), d)
        if (page + 1) * PAGE >= int(data['MRData']['total']):
            break
    return out


def all_results(driver_id):
    """Every race this driver has ever been classified in, oldest first."""
    races, offset = [], 0
    while True:
        data = get(f'drivers/{driver_id}/results.json?limit={PAGE}&offset={offset}')
        table = data['MRData']['RaceTable']['Races']
        races.extend(table)
        total = int(data['MRData']['total'])
        offset += PAGE
        if offset >= total:
            break
    return races


def all_sprints(driver_id):
    """Sprint classifications, which Ergast keeps apart from the race results."""
    races, offset = [], 0
    while True:
        data = get(f'drivers/{driver_id}/sprint.json?limit={PAGE}&offset={offset}')
        table = data['MRData']['RaceTable']['Races']
        races.extend(table)
        total = int(data['MRData']['total'])
        offset += PAGE
        if offset >= total or not table:
            break
    return races


def summarise(races, sprints=()):
    """Aggregate a career, and each season of it, from the classifications."""
    seasons = {}
    starts = wins = podiums = poles = 0
    points = 0.0
    best = None

    for r in races:
        res = r['Results'][0]
        year = int(r['season'])
        pos = int(res['position'])
        grid = int(res.get('grid') or 0)
        pts = float(res.get('points') or 0)
        status = res.get('status', '')
        finished = status == 'Finished' or status.startswith('+')

        s = seasons.setdefault(year, {
            'season': year, 'races': 0, 'points': 0.0, 'wins': 0, 'podiums': 0,
            'poles': 0, 'bestFinish': None, 'teams': [], 'retirements': 0,
        })
        s['races'] += 1
        s['points'] += pts
        starts += 1
        points += pts

        team = res['Constructor']['name']
        if team not in s['teams']:
            s['teams'].append(team)

        if grid == 1:
            s['poles'] += 1
            poles += 1
        if finished:
            if pos == 1:
                s['wins'] += 1
                wins += 1
            if pos <= 3:
                s['podiums'] += 1
                podiums += 1
            if s['bestFinish'] is None or pos < s['bestFinish']:
                s['bestFinish'] = pos
            if best is None or pos < best:
                best = pos
        else:
            s['retirements'] += 1

    # Sprint points count towards a championship but live at their own endpoint,
    # so a career total built from race results alone silently understates every
    # season since 2021. They are added as points only — a sprint win is not a
    # grand prix win and is not counted as one.
    sprint_points = 0.0
    for r in sprints:
        pts = float(r['SprintResults'][0].get('points') or 0)
        if not pts:
            continue
        sprint_points += pts
        year = int(r['season'])
        if year in seasons:
            seasons[year]['points'] += pts
            seasons[year]['sprintPoints'] = seasons[year].get('sprintPoints', 0.0) + pts
    points += sprint_points

    for s in seasons.values():
        s['points'] = round(s['points'], 1) if s['points'] % 1 else int(s['points'])
        if 'sprintPoints' in s:
            s['sprintPoints'] = round(s['sprintPoints'], 1) if s['sprintPoints'] % 1 else int(s['sprintPoints'])

    return {
        'starts': starts, 'wins': wins, 'podiums': podiums, 'poles': poles,
        'points': round(points, 1) if points % 1 else int(points),
        'bestFinish': best,
        'seasons': [seasons[y] for y in sorted(seasons)],
    }


def debut_of(races, born):
    """The first race, described the way a record book would."""
    if not races:
        return None
    r = races[0]
    res = r['Results'][0]
    age = None
    if born:
        y1, m1, d1 = (int(x) for x in born.split('-'))
        y2, m2, d2 = (int(x) for x in r['date'].split('-'))
        age = y2 - y1 - ((m2, d2) < (m1, d1))
    return {
        'season': int(r['season']),
        'round': int(r['round']),
        'race': r['raceName'],
        'date': r['date'],
        'circuit': r['Circuit']['circuitName'],
        'country': r['Circuit']['Location'].get('country'),
        'team': res['Constructor']['name'],
        'grid': int(res.get('grid') or 0) or None,
        'position': int(res['position']),
        'status': res.get('status'),
        'ageYears': age,
    }


def main():
    drivers = json.load(open(os.path.join(SNAP, 'drivers.json')))
    print(f'resolving {len(drivers)} drivers against the published record\n')
    index = ergast_index()

    careers, missing = {}, []
    for d in drivers:
        entry = index.get(key(d['lastName']))
        if not entry:
            missing.append(d['id'])
            print(f"  {d['id']:<22} NOT FOUND in the {SEASON} entry list")
            continue

        races = all_results(entry['driverId'])
        summary = summarise(races, all_sprints(entry['driverId']))
        debut = debut_of(races, entry.get('dateOfBirth'))
        careers[d['id']] = {
            'driverId': d['id'],
            'ergastId': entry['driverId'],
            'dateOfBirth': entry.get('dateOfBirth'),
            'nationality': entry.get('nationality'),
            'wikipedia': entry.get('url'),
            'debut': debut,
            **summary,
        }
        first = f"{debut['season']} {debut['race']}" if debut else 'no race yet'
        print(f"  {d['id']:<22} {summary['starts']:>3} starts  "
              f"{len(summary['seasons'])} season(s)  debut {first}")

    os.makedirs('out', exist_ok=True)
    json.dump(careers, open('out/careers.json', 'w'), indent=1)
    print(f'\n-> out/careers.json  ({len(careers)}/{len(drivers)} drivers)')
    if missing:
        print(f'   unresolved: {", ".join(missing)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
