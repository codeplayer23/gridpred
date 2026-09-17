"""
Feature engineering for the GridPred ranker.

THE CONTRACT
------------
Every feature here is computed a second time, in JavaScript, by
`src/lib/modelFeatures.js`. The two implementations must agree exactly: the
model is trained on the Python side and evaluated on the JS side, so any
divergence is train/serve skew — the model would be scored on features that do
not mean what it learned them to mean, and nothing would visibly break.

To make that checkable rather than hoped-for, `train_model.py` exports a
fixture of real feature vectors and `npm run model:verify` recomputes them in
JS and diffs. Change a definition here and that check fails until the mirror is
updated.

NO LEAKAGE
----------
A feature for race R may read only races strictly before R. The corpus is walked
in chronological order and each race is featurised against the state
accumulated so far, then folded into that state. A driver's first race
therefore has no history and its features are missing — which is honest, and
which XGBoost handles natively by learning a default direction per split.

MISSING VALUES
--------------
Absent history is NaN, never an imputed number. Filling an unknown average with
"10.5" teaches the model that a debutant is a midfield car; leaving it missing
teaches it that it does not know.
"""

# Feature order is part of the model artifact. The JS mirror emits vectors in
# this order and the booster's split indices refer to it, so it must not be
# reordered without retraining.
RACE_FEATURES = [
    'grid',
    'gridPct',
    'seasonAvgGrid',
    'seasonAvgFinish',
    'last5Finish',
    'last5Grid',
    'careerAvgFinish',
    'dnfRate',
    'starts',
    'teamSeasonAvgFinish',
    'teamSeasonAvgGrid',
    'teamLast5Finish',
    'circuitAvgFinish',
    'gridVsSeasonGrid',
    'avgGained',
    'last5Gained',
    'circuitAvgGained',
    'teamAvgGained',
]

# Qualifying is predicted before a grid exists, so every grid-derived feature of
# the current race is withheld. What remains is the driver's and the team's
# record going in.
QUALIFYING_FEATURES = [
    'seasonAvgGrid',
    'seasonAvgFinish',
    'last5Finish',
    'last5Grid',
    'careerAvgFinish',
    'dnfRate',
    'starts',
    'teamSeasonAvgFinish',
    'teamSeasonAvgGrid',
    'teamLast5Finish',
    'circuitAvgGrid',
    'circuitAvgFinish',
    'avgGained',
    'teamAvgGained',
]

NAN = float('nan')

# How many races the rolling "recent form" window spans, and how far back the
# reliability rate looks. Both are model hyperparameters mirrored in JS.
FORM_WINDOW = 5
DNF_WINDOW = 20
TEAM_FORM_WINDOW = 10      # two cars, so five rounds of a constructor is ten rows
CIRCUIT_FIELD = 22.0       # nominal field size, for expressing a grid slot as a share


def mean(values):
    """Mean of a list, or NaN when there is nothing to average."""
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else NAN


class History:
    """
    Running record of everything that has already happened.

    One instance is advanced through the corpus in date order. `features_for`
    reads it; `record_race` advances it. Keeping those separate is what makes
    the no-leakage property inspectable rather than incidental.
    """

    def __init__(self):
        self.driver_finishes = {}        # driverId -> [position, ...] oldest first
        self.driver_grids = {}           # driverId -> [grid, ...]
        self.driver_finished = {}        # driverId -> [bool, ...]
        self.season_driver = {}          # (season, driverId) -> {'finish': [], 'grid': []}
        self.season_team = {}            # (season, constructorId) -> {'finish': [], 'grid': []}
        self.team_finishes = {}          # constructorId -> [position, ...]
        self.circuit_driver = {}         # (circuitId, driverId) -> {'finish': [], 'grid': []}
        self.driver_gained = {}          # driverId -> [grid - position, ...]
        self.circuit_gained = {}         # (circuitId, driverId) -> [grid - position, ...]
        self.team_gained = {}            # constructorId -> [grid - position, ...]

    # -- read ---------------------------------------------------------------

    def features_for(self, row):
        """The full feature dictionary for one classification, before it happens."""
        driver = row['driverId']
        team = row['constructorId']
        season = row['season']
        circuit = row['circuitId']

        season_d = self.season_driver.get((season, driver), {'finish': [], 'grid': []})
        season_t = self.season_team.get((season, team), {'finish': [], 'grid': []})
        circuit_d = self.circuit_driver.get((circuit, driver), {'finish': [], 'grid': []})

        gained = self.driver_gained.get(driver, [])
        circuit_gained = self.circuit_gained.get((circuit, driver), [])
        team_gained = self.team_gained.get(team, [])

        finishes = self.driver_finishes.get(driver, [])
        grids = self.driver_grids.get(driver, [])
        finished = self.driver_finished.get(driver, [])
        team_finishes = self.team_finishes.get(team, [])

        season_avg_grid = mean(season_d['grid'])
        grid = row.get('grid')

        return {
            'grid': float(grid) if grid is not None else NAN,
            # The same slot expressed as a share of the field, so a 19-car grid
            # and a 22-car grid describe "near the back" the same way.
            'gridPct': float(grid) / CIRCUIT_FIELD if grid is not None else NAN,
            'seasonAvgGrid': season_avg_grid,
            'seasonAvgFinish': mean(season_d['finish']),
            'last5Finish': mean(finishes[-FORM_WINDOW:]),
            'last5Grid': mean(grids[-FORM_WINDOW:]),
            'careerAvgFinish': mean(finishes),
            # Share of the recent window that did not reach the flag. With no
            # history at all this is unknown, not zero.
            'dnfRate': (
                1.0 - (sum(1 for f in finished[-DNF_WINDOW:] if f) / len(finished[-DNF_WINDOW:]))
                if finished else NAN
            ),
            'starts': float(len(finishes)),
            'teamSeasonAvgFinish': mean(season_t['finish']),
            'teamSeasonAvgGrid': mean(season_t['grid']),
            'teamLast5Finish': mean(team_finishes[-TEAM_FORM_WINDOW:]),
            'circuitAvgFinish': mean(circuit_d['finish']),
            'circuitAvgGrid': mean(circuit_d['grid']),
            # How this weekend's grid slot compares with the driver's own norm:
            # a front row for a backmarker means something different from a
            # front row for a leader. NaN propagates when either side is absent.
            'gridVsSeasonGrid': (
                float(grid) - season_avg_grid
                if grid is not None and season_avg_grid == season_avg_grid
                else NAN
            ),
            # Positions gained from grid to flag. The grid slot already tells the
            # model where a car starts; these tell it who actually moves, which
            # is the whole of what a prediction can add over reading the grid.
            'avgGained': mean(gained),
            'last5Gained': mean(gained[-FORM_WINDOW:]),
            'circuitAvgGained': mean(circuit_gained),
            'teamAvgGained': mean(team_gained[-TEAM_FORM_WINDOW:]),
        }

    # -- write --------------------------------------------------------------

    def record_race(self, rows):
        """Fold one race's classifications into the running state."""
        for row in rows:
            driver = row['driverId']
            team = row['constructorId']
            season = row['season']
            circuit = row['circuitId']
            position = row['position']
            grid = row.get('grid')

            self.driver_finishes.setdefault(driver, []).append(position)
            self.driver_finished.setdefault(driver, []).append(bool(row['finished']))
            if grid is not None:
                self.driver_grids.setdefault(driver, []).append(grid)

            sd = self.season_driver.setdefault((season, driver), {'finish': [], 'grid': []})
            sd['finish'].append(position)
            if grid is not None:
                sd['grid'].append(grid)

            st = self.season_team.setdefault((season, team), {'finish': [], 'grid': []})
            st['finish'].append(position)
            if grid is not None:
                st['grid'].append(grid)

            self.team_finishes.setdefault(team, []).append(position)

            cd = self.circuit_driver.setdefault((circuit, driver), {'finish': [], 'grid': []})
            cd['finish'].append(position)
            if grid is not None:
                cd['grid'].append(grid)

            if grid is not None:
                delta = grid - position
                self.driver_gained.setdefault(driver, []).append(delta)
                self.circuit_gained.setdefault((circuit, driver), []).append(delta)
                self.team_gained.setdefault(team, []).append(delta)


def group_races(rows):
    """Split a flat, date-sorted corpus into races, preserving order."""
    races, current, key = [], [], None
    for row in rows:
        k = (row['season'], row['round'])
        if k != key:
            if current:
                races.append(current)
            current, key = [], k
        current.append(row)
    if current:
        races.append(current)
    return races


def build_dataset(rows):
    """
    Walk the corpus once and featurise every race against its own past.

    Returns (races, history) where each race carries its rows, their feature
    dictionaries and the target ordering.
    """
    history = History()
    out = []
    for race_rows in group_races(rows):
        featurised = [
            {'row': r, 'features': history.features_for(r)}
            for r in race_rows
        ]
        out.append({
            'season': race_rows[0]['season'],
            'round': race_rows[0]['round'],
            'date': race_rows[0]['date'],
            'circuitId': race_rows[0]['circuitId'],
            'entries': featurised,
        })
        history.record_race(race_rows)
    return out, history
