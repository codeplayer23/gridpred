"""
Export the model's "as of now" feature state for the browser.

WHY THIS EXISTS
---------------
The features the model was trained on span five seasons — career finishing
average, starts, a driver's record at a given circuit. The browser holds only
this season's snapshot, so recomputing those in JavaScript would compute
something different from what the model learned, silently. That is train/serve
skew, and it is the failure mode this whole file exists to remove.

So the browser does not recompute them. Python walks the corpus once, with the
same `History` the training set was built from, and writes out the feature
vector each current driver would carry into their next race. The browser looks
that up and fills in only what it alone knows: the grid slot, which is the
feature that changes per prediction and which the qualifying model supplies.

Because training reruns on every deploy, this state is never staler than the
deploy that shipped it.

IDENTIFIERS
-----------
The corpus speaks Jolpica's ids and the app speaks its own. Drivers are matched
on a slug of the full name, falling back to a unique surname match — which is
what reconciles Jolpica's "Andrea Kimi Antonelli" with the app's
`kimi-antonelli` without a hand-maintained table of special cases. Circuits are
matched by ROUND NUMBER against the season calendar, not by name: the two
sources disagree about what to call Interlagos and Sepang, but they cannot
disagree about which round is which.
"""
import json, os, re, unicodedata

# Features that do not depend on this weekend's grid. Everything else is
# computed in the browser, where the grid is known.
STATE_FEATURES = [
    'seasonAvgGrid', 'seasonAvgFinish', 'last5Finish', 'last5Grid',
    'careerAvgFinish', 'dnfRate', 'starts',
    'teamSeasonAvgFinish', 'teamSeasonAvgGrid', 'teamLast5Finish',
    'avgGained', 'last5Gained', 'teamAvgGained',
]

# Per-circuit features, keyed by the circuit a race is held at.
CIRCUIT_FEATURES = ['circuitAvgFinish', 'circuitAvgGrid', 'circuitAvgGained']


def slug(value):
    text = unicodedata.normalize('NFD', str(value))
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def driver_map(rows, snapshot_ids):
    """
    Jolpica driver id -> GridPred driver id.

    Exact full-name slug first. Where that fails — a driver the record lists
    under more given names than the app does — fall back to the snapshot id
    ending in that surname, but only when exactly one does, so an ambiguous
    surname is left unmapped rather than guessed.
    """
    names, families = {}, {}
    for row in rows:
        names.setdefault(row['driverId'], row.get('driverName', ''))
        families.setdefault(row['driverId'], row.get('familyName', ''))

    mapping, unmatched = {}, []
    for jolpica, name in names.items():
        full = slug(name)
        if full in snapshot_ids:
            mapping[jolpica] = full
            continue
        suffix = '-' + slug(families.get(jolpica, ''))
        candidates = [i for i in snapshot_ids if i.endswith(suffix)]
        if len(candidates) == 1:
            mapping[jolpica] = candidates[0]
        else:
            unmatched.append(jolpica)
    return mapping, unmatched


def circuit_map(rows, calendar, season, schedule=None):
    """
    Jolpica circuit id -> GridPred circuit id, matched on round number.

    The published schedule is used where available so that rounds still to come
    map too — a driver's record at a circuit must be available BEFORE the race
    there, which is the only time a prediction for it is worth anything.
    Completed rounds in the corpus fill in anything the schedule missed.

    A circuit neither source places on this season's calendar is absent, and a
    driver's record there is then missing rather than wrong.
    """
    by_round = {int(e['round']): e['circuitId'] for e in calendar if e.get('circuitId')}
    mapping = {}
    for rnd, jolpica_circuit in (schedule or {}).items():
        target = by_round.get(int(rnd))
        if target:
            mapping[jolpica_circuit] = target
    for row in rows:
        if row['season'] != season:
            continue
        target = by_round.get(int(row['round']))
        if target:
            mapping[row['circuitId']] = target
    return mapping


def clean(value):
    """NaN is not JSON. Absent history travels as null and stays missing in JS."""
    return None if value is None or value != value else round(float(value), 6)


def build(rows, history, calendar, season, snapshot_ids, schedule=None):
    """
    The feature state each current driver carries into their next race.

    `history` must be the state AFTER the whole corpus has been folded in — the
    same object `build_dataset` finished with — so this is what the next race
    would be featurised against.
    """
    drivers, unmatched = driver_map(rows, snapshot_ids)
    circuits = circuit_map(rows, calendar, season, schedule)

    # The team a driver is with now, from their most recent classification.
    latest_team, latest_round = {}, {}
    for row in rows:
        key = (row['season'], row['round'])
        if row['season'] == season and key >= latest_round.get(row['driverId'], (0, 0)):
            latest_round[row['driverId']] = key
            latest_team[row['driverId']] = row['constructorId']

    out = {}
    for jolpica, app_id in drivers.items():
        team = latest_team.get(jolpica)
        if team is None:
            continue                      # not racing this season; nothing to serve
        probe = {
            'driverId': jolpica, 'constructorId': team,
            'season': season, 'circuitId': None, 'grid': None,
        }
        base = history.features_for(probe)
        entry = {k: clean(base.get(k)) for k in STATE_FEATURES}

        per_circuit = {}
        for jolpica_circuit, app_circuit in circuits.items():
            probe['circuitId'] = jolpica_circuit
            here = history.features_for(probe)
            values = {k: clean(here.get(k)) for k in CIRCUIT_FEATURES}
            if any(v is not None for v in values.values()):
                per_circuit[app_circuit] = values
        entry['circuits'] = per_circuit
        out[app_id] = entry

    return out, unmatched


def write(path, rows, history, calendar, season, snapshot_ids, schedule=None, log=print):
    state, unmatched = build(rows, history, calendar, season, snapshot_ids, schedule)
    missing = sorted(set(snapshot_ids) - set(state))
    payload = {
        'season': season,
        'stateFeatures': STATE_FEATURES,
        'circuitFeatures': CIRCUIT_FEATURES,
        'drivers': state,
        # Recorded so the app can say which drivers it has no history for
        # rather than quietly scoring them off a vector of nulls.
        'withoutHistory': missing,
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh:
        json.dump(payload, fh, separators=(',', ':'))
    log(f'  wrote src/data/model/state.json '
        f'({len(state)} drivers, {os.path.getsize(path) / 1024:.1f} KB)')
    if missing:
        log(f'  no corpus history for: {", ".join(missing)}')
    return payload
