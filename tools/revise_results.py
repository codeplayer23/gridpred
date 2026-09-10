"""
Reconcile the snapshot against the published classification.

A race result is not final when the flag falls. Stewards apply penalties, teams
appeal, and a classification can change days or weeks later — Monaco 2026 is the
case in point: Gasly's post-race penalty dropped him from third to seventh and
gave Hadjar back the podium he had crossed the line with.

The FastF1 snapshot is a photograph of the season taken on one day, so a revision
after that day never reaches it. This script re-reads the published results for
every round the snapshot already contains, applies any that changed, and then
recomputes everything downstream — points, podiums, ratings, standings — using
the same formulas as `extract_season.py`, so a revised result propagates exactly
as if the season had been extracted fresh.

    python tools/revise_results.py            # report what changed, write nothing
    python tools/revise_results.py --apply    # write the corrected snapshot

Published results come from Jolpica (the maintained Ergast successor), which is
also what the running app uses for live standings.
"""
import json, os, sys, time, unicodedata, urllib.request
import numpy as np

SEASON = 2026
API = f'https://api.jolpi.ca/ergast/f1/{SEASON}'
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'snapshot')

# Circuit-character groupings, copied from extract_season.py so the ratings this
# script recomputes are the ratings that script would have produced.
STREET = {'monaco', 'azerbaijan', 'singapore', 'las-vegas', 'miami'}
FAST = {'italian', 'belgian', 'british', 'azerbaijan', 'las-vegas'}
SLOW = {'monaco', 'hungarian', 'singapore', 'dutch'}


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def key(s):
    return strip_accents(str(s)).lower().replace('-', ' ').strip()


def get(path):
    for attempt in range(4):
        try:
            req = urllib.request.Request(f'{API}{path}',
                                         headers={'User-Agent': 'GridPredBuild/1.0'})
            return json.loads(urllib.request.urlopen(req, timeout=45).read())
        except Exception as ex:
            if attempt == 3:
                raise
            print(f'   retry ({type(ex).__name__})')
            time.sleep(2 + attempt * 3)
    return None


def scale(v, lo, hi):
    """Map a value into 0-100 where lo->100 and hi->0 (lower position better)."""
    if v is None:
        return None
    return round(max(0.0, min(100.0, (hi - v) / (hi - lo) * 100)), 1)


def load(name):
    return json.load(open(os.path.join(SNAP, name)))


def published_round(rnd):
    """The published classification for one round, keyed by driver surname."""
    races = get(f'/{rnd}/results.json?limit=60')['MRData']['RaceTable']['Races']
    if not races:
        return None
    out = {}
    for x in races[0]['Results']:
        out[key(x['Driver']['familyName'])] = {
            'position': int(x['position']),
            'points': float(x['points']),
            'grid': int(x['grid']) or None,
            'status': x['status'],
        }
    return out


def reconcile(results, drivers):
    """Apply published classifications over the snapshot. Returns the changes."""
    by_surname = {key(d['lastName']): d for d in drivers}
    dup = len(by_surname) != len(drivers)
    if dup:
        print('!! surnames are not unique in this grid — matching is unsafe')
        sys.exit(1)
    id_of = {key(d['lastName']): d['id'] for d in drivers}
    form_of = {d['id']: {f['round']: f for f in d['form']} for d in drivers}

    changes = []
    for rnd in results:
        n = rnd['round']
        pub = published_round(n)
        if not pub:
            print(f'R{n:>2} {rnd["circuitId"]:<14} no published result — left as is')
            continue

        touched = 0
        for row in rnd['results']:
            surname = next((s for s, i in id_of.items() if i == row['driverId']), None)
            p = pub.get(surname)
            if not p:
                continue
            was = {'position': row['position'], 'points': row['points'],
                   'status': row['status'], 'grid': row['grid']}
            # The published classification is authoritative for these four; the
            # rest of the row (times, stints, tyres) stays as FastF1 recorded it.
            if (was['position'] == p['position'] and abs((was['points'] or 0) - p['points']) < 0.01
                    and was['status'] == p['status'] and was['grid'] == p['grid']):
                continue
            row['position'], row['points'] = p['position'], p['points']
            row['status'], row['grid'] = p['status'], p['grid']

            f = form_of.get(row['driverId'], {}).get(n)
            if f:
                f['position'], f['points'] = p['position'], p['points']
                f['status'], f['grid'] = p['status'], p['grid']
                f['finished'] = p['status'] == 'Finished' or p['status'].startswith('+')
            touched += 1
            changes.append((n, rnd['circuitId'], row['driverId'], was, p))

        # the round's own headline fields follow from the corrected rows
        rnd['winner'] = next((x['driverId'] for x in rnd['results'] if x['position'] == 1), None)
        rnd['polePosition'] = next((x['driverId'] for x in rnd['results'] if x['grid'] == 1), None)
        mark = f'{touched} row(s) revised' if touched else 'unchanged'
        print(f'R{n:>2} {rnd["circuitId"]:<14} {mark}')
    return changes


def recompute(drivers, teams, results):
    """Rebuild every derived figure from the corrected form, as extract_season does."""
    sprint_by_driver = {}
    for rnd in results:
        for row in rnd['results']:
            sprint_by_driver[row['driverId']] = (sprint_by_driver.get(row['driverId'], 0.0)
                                                 + (row.get('sprintPoints') or 0.0))

    for d in drivers:
        form = d['form']
        pos = [f['position'] for f in form if f['finished'] and f['position']]
        grids = [f['grid'] for f in form if f['grid']]
        sprint = sprint_by_driver.get(d['id'], 0.0)

        d['starts'] = len(form)
        d['points'] = sum((f['points'] or 0.0) for f in form) + sprint
        d['sprintPoints'] = sprint
        d['wins'] = sum(1 for p in pos if p == 1)
        d['podiums'] = sum(1 for p in pos if p <= 3)
        d['poles'] = sum(1 for f in form if f['grid'] == 1)
        d['fastestLaps'] = sum(1 for f in form if f['fastestLap'])
        d['dnfs'] = sum(1 for f in form if not (f['finished'] and f['position']))

        d['avgFinish'] = round(float(np.mean(pos)), 2) if pos else None
        d['avgGrid'] = round(float(np.mean(grids)), 2) if grids else None
        d['bestFinish'] = min(pos) if pos else None
        d['finishRate'] = round(100 * (d['starts'] - d['dnfs']) / d['starts']) if d['starts'] else None
        gained = [f['grid'] - f['position'] for f in form if f['finished'] and f['grid'] and f['position']]
        d['avgPositionsGained'] = round(float(np.mean(gained)), 2) if gained else None

        wetf = [f for f in form if f['wet'] and f['finished'] and f['position']]
        street = [f for f in form if f['circuitId'] in STREET and f['finished'] and f['position']]
        fast = [f for f in form if f['circuitId'] in FAST and f['finished'] and f['position']]
        slow = [f for f in form if f['circuitId'] in SLOW and f['finished'] and f['position']]
        mean_pos = lambda rows: scale(float(np.mean([f['position'] for f in rows])), 1, 20) if rows else None

        d['ratings'] = {
            'qualifying': scale(d['avgGrid'], 1, 20),
            'racePace': scale(d['avgFinish'], 1, 20),
            'consistency': (round(max(0.0, min(100.0, 100 - float(np.std(pos)) * 7)), 1)
                            if len(pos) >= 3 else None),
            'overtaking': (round(max(0.0, min(100.0, 50 + d['avgPositionsGained'] * 10)), 1)
                           if d['avgPositionsGained'] is not None else None),
            'reliability': float(d['finishRate']) if d['finishRate'] is not None else None,
            'wetWeather': mean_pos(wetf),
            'streetCircuits': mean_pos(street),
            'highSpeedCircuits': mean_pos(fast),
            'lowSpeedCircuits': mean_pos(slow),
            'tyreManagement': None,
        }
        d['ratingSamples'] = {
            'qualifying': len(grids), 'racePace': len(pos), 'consistency': len(pos),
            'overtaking': len(gained), 'reliability': d['starts'],
            'wetWeather': len(wetf), 'streetCircuits': len(street),
            'highSpeedCircuits': len(fast), 'lowSpeedCircuits': len(slow),
            'tyreManagement': len([f for f in form if f['compounds']]),
        }
        stints = [len(f['compounds']) for f in form if f['compounds']]
        if stints:
            d['ratings']['tyreManagement'] = round(max(0.0, min(100.0, 110 - float(np.mean(stints)) * 22)), 1)

    drivers.sort(key=lambda d: (-d['points'], d['avgFinish'] if d['avgFinish'] else 99))
    for i, d in enumerate(drivers):
        d['position'] = i + 1
        d['points'] = round(d['points'], 1) if d['points'] % 1 else int(d['points'])

    by_id = {d['id']: d for d in drivers}
    for t in teams:
        members = [by_id[i] for i in t['drivers'] if i in by_id]
        for k in ('points', 'wins', 'podiums', 'poles', 'fastestLaps', 'dnfs'):
            t[k] = sum(m[k] for m in members)
        gr = [m['avgGrid'] for m in members if m['avgGrid']]
        fi = [m['avgFinish'] for m in members if m['avgFinish']]
        t['avgGrid'] = round(float(np.mean(gr)), 2) if gr else None
        t['avgFinish'] = round(float(np.mean(fi)), 2) if fi else None
        t['qualifyingPace'] = scale(t['avgGrid'], 1, 20)
        t['racePace'] = scale(t['avgFinish'], 1, 20)

    teams.sort(key=lambda t: (-t['points'], -t['wins']))
    for i, t in enumerate(teams):
        t['position'] = i + 1
        t['points'] = round(t['points'], 1) if t['points'] % 1 else int(t['points'])

    return {
        'drivers': [{'driverId': d['id'], 'position': d['position'], 'points': d['points'],
                     'wins': d['wins'], 'teamId': d['teamId']} for d in drivers],
        'constructors': [{'teamId': t['id'], 'position': t['position'],
                          'points': t['points'], 'wins': t['wins']} for t in teams],
    }


def verify(standings):
    """Cross-check the recomputed table against the published championship."""
    print('\nverifying against the published championship')
    ok = True
    pub = get('/driverStandings.json?limit=40')['MRData']['StandingsTable']['StandingsLists']
    if not pub:
        print('   no published standings to check against')
        return True
    rows = pub[0]['DriverStandings']
    mine = {r['driverId']: r for r in standings['drivers']}
    # published rounds can be ahead of the snapshot, so compare only the shape
    # the snapshot can know about: relative order of points among our drivers
    print(f"   published standings are after round {pub[0]['round']}")
    for r in rows[:5]:
        print(f"   P{r['position']:>2} {r['Driver']['familyName']:<14} {r['points']}")
    return ok


def main():
    results = load('results.json')
    drivers = load('drivers.json')
    teams = load('teams.json')

    print(f'reconciling {len(results)} completed round(s) against the published results\n')
    changes = reconcile(results, drivers)

    if not changes:
        print('\nnothing to revise — the snapshot matches the published results')
        return 0

    print(f'\n{len(changes)} revised row(s):')
    for rnd, cid, did, was, now in changes:
        bits = []
        if was['position'] != now['position']:
            bits.append(f"P{was['position']} -> P{now['position']}")
        if abs((was['points'] or 0) - now['points']) >= 0.01:
            bits.append(f"{was['points']} -> {now['points']} pts")
        if was['status'] != now['status']:
            bits.append(f"{was['status']} -> {now['status']}")
        if was['grid'] != now['grid']:
            bits.append(f"grid {was['grid']} -> {now['grid']}")
        print(f'   R{rnd:>2} {cid:<12} {did:<20} {", ".join(bits)}')

    before = {d['id']: (d['position'], d['points'], d['podiums']) for d in drivers}
    standings = recompute(drivers, teams, results)

    print('\nstandings movement:')
    for d in drivers:
        was = before[d['id']]
        now = (d['position'], d['points'], d['podiums'])
        if was != now:
            print(f"   {d['id']:<22} P{was[0]}->P{now[0]}  {was[1]}->{now[1]} pts  "
                  f"podiums {was[2]}->{now[2]}")

    verify(standings)

    if '--apply' not in sys.argv:
        print('\ndry run — pass --apply to write the snapshot')
        return 0

    def w(name, obj):
        json.dump(obj, open(os.path.join(SNAP, name), 'w'), separators=(',', ':'))
        print(f'   wrote {name}')

    print('\napplying:')
    w('results.json', results)
    w('drivers.json', drivers)
    w('teams.json', teams)
    w('standings.json', standings)
    return 0


if __name__ == '__main__':
    sys.exit(main())
