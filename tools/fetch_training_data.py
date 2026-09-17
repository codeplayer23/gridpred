"""
Training corpus for the GridPred prediction model.

The snapshot describes one season. A gradient-boosted ranker needs more races
than one season contains, so the corpus is drawn from the ground-effect
regulation era (2022 onwards) — the period whose cars resemble what is racing
now closely enough for a learned ordering to transfer.

Source: Jolpica (the maintained Ergast successor), the same published record
`fetch_careers.py` reads. Every row is an actual classification: a real starting
slot and a real finishing position. Nothing is simulated and nothing is
interpolated — a race that was not run contributes no rows.

    python tools/fetch_training_data.py        # -> src/data/model/training_set.json

Unlike the rest of the pipeline this writes into `src/data/`, not `out/`,
because the corpus is an input to the Vercel build rather than an intermediate:
`train_model.py` runs on every deploy and must not depend on the network.

Responses are cached under out/cache/ so reruns cost nothing.
"""
import json, os, sys, time, urllib.request

API = 'https://api.jolpi.ca/ergast/f1'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'data', 'model', 'training_set.json')
CACHE = 'out/cache'
PAGE = 100

# The ground-effect era. 2022 is the regulation reset; 2026 is the current
# season, whose completed rounds are as real as any other and belong in the
# corpus. A season with no completed races simply yields nothing.
FIRST_SEASON = 2022
LAST_SEASON = 2026


def log(*a):
    print(*a, file=sys.stderr, flush=True)


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
            log(f'   {type(ex).__name__} on {path}; retrying in {wait}s')
            time.sleep(wait)
    raise SystemExit(f'giving up on {path}')


def season_results(season):
    """Every classification of one season, paged, oldest race first."""
    races, offset = {}, 0
    while True:
        data = get(f'{season}/results.json?limit={PAGE}&offset={offset}')
        table = data['MRData']['RaceTable']['Races']
        for race in table:
            key = int(race['round'])
            if key not in races:
                races[key] = {**{k: v for k, v in race.items() if k != 'Results'}, 'Results': []}
            races[key]['Results'].extend(race['Results'])
        total = int(data['MRData']['total'])
        offset += PAGE
        if offset >= total:
            break
    return [races[k] for k in sorted(races)]


def season_schedule(season):
    """
    Every round of a season, run or not.

    The corpus holds only completed races, but the app predicts races that have
    not happened. Without the full schedule a round later in the year has no
    circuit mapping, and a driver's real record at that circuit would read as
    missing. So the schedule is fetched separately and carried alongside.
    """
    data = get(f'{season}/races.json?limit={PAGE}')
    return {int(r['round']): r['Circuit']['circuitId']
            for r in data['MRData']['RaceTable']['Races']}


def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def finished(status, position_text):
    """
    A classification reached the flag if its status says so.

    Jolpica reports '+1 Lap', '+2 Laps' and so on for cars that were running at
    the flag but lapped; those finished the race. 'Finished' is the unlapped
    case. Everything else — accidents, mechanical retirements, disqualification,
    withdrawal — did not.
    """
    if not position_text or not position_text.isdigit():
        return False
    return status == 'Finished' or status.startswith('+')


def main():
    rows = []
    races = 0
    for season in range(FIRST_SEASON, LAST_SEASON + 1):
        try:
            table = season_results(season)
        except SystemExit:
            raise
        except Exception as ex:
            log(f'{season}: {type(ex).__name__}, skipping')
            continue
        if not table:
            log(f'{season}: no completed races')
            continue
        for race in table:
            grid_rows = []
            for entry in race['Results']:
                grid = to_int(entry.get('grid'))
                position = to_int(entry.get('positionText')) or to_int(entry.get('position'))
                if position is None:
                    continue
                # A pit-lane start is recorded as grid 0. It is a real start,
                # but position 0 would read as the front row to any model that
                # treats grid as ordinal, so it is moved behind the last slot.
                if grid is not None and grid < 1:
                    grid = len(race['Results'])
                grid_rows.append({
                    'season': int(race['season']),
                    'round': int(race['round']),
                    'date': race['date'],
                    'circuitId': race['Circuit']['circuitId'],
                    'driverId': entry['Driver']['driverId'],
                    # Carried so the model-state export can map these rows onto
                    # GridPred's own driver ids without going back to the
                    # network: the Vercel build trains offline.
                    'driverName': f"{entry['Driver']['givenName']} {entry['Driver']['familyName']}",
                    'familyName': entry['Driver']['familyName'],
                    'constructorId': entry['Constructor']['constructorId'],
                    'grid': grid,
                    'position': position,
                    'status': entry.get('status', ''),
                    'finished': finished(entry.get('status', ''), entry.get('positionText', '')),
                })
            # A race needs a field to rank. Anything smaller is a data fault.
            if len(grid_rows) < 10:
                log(f'{season} r{race["round"]}: only {len(grid_rows)} rows, skipping race')
                continue
            rows.extend(grid_rows)
            races += 1
        log(f'{season}: {len(table)} races')

    if not rows:
        raise SystemExit('no training rows fetched; refusing to write an empty corpus')

    rows.sort(key=lambda r: (r['date'], r['season'], r['round'], r['position']))
    try:
        schedule = season_schedule(LAST_SEASON)
        log(f'{LAST_SEASON} schedule: {len(schedule)} rounds')
    except Exception as ex:
        log(f'schedule fetch failed ({type(ex).__name__}); '
            'circuit history will cover completed rounds only')
        schedule = {}

    payload = {
        'source': 'Jolpica (Ergast successor)',
        'schedule': schedule,
        'seasons': [FIRST_SEASON, LAST_SEASON],
        'races': races,
        'rows': len(rows),
        'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'data': rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as fh:
        json.dump(payload, fh, separators=(',', ':'))
    log(f'\nwrote {OUT}: {races} races, {len(rows)} classifications')


if __name__ == '__main__':
    main()
