"""
Train the GridPred ranking models and export them for the browser.

    python tools/train_model.py        # -> src/data/model/{race,qualifying,meta}.json

WHAT IS TRAINED
---------------
Two XGBoost rankers (`rank:pairwise`), grouped by race, over the real
classifications in `training_set.json`:

  * qualifying — orders the field with no knowledge of the grid, because when a
    prediction is made for an upcoming race the grid does not exist yet.
  * race — orders the field given a grid slot. For a race already run that slot
    is the real one; for an upcoming race it is the qualifying model's own
    predicted order, so the two compose.

Ranking, not regression, is the right frame: the product asks "who finishes
ahead of whom", and a pairwise objective optimises exactly that. Regressing on
finishing position would spend capacity separating 17th from 18th, which nobody
reads.

`ndcg_exp_gain` is off. XGBoost's default NDCG gain is 2^relevance, and with a
relevance of 21-position that makes the winner worth 2^20 — the metric becomes
"did it call the winner", which on a hundred-race corpus is noise, and early
stopping reads that noise and halts after one tree.

HOW IT IS VALIDATED
-------------------
Expanding-window cross-validation: each fold trains on everything before a block
of races and is scored on that block. The split is always chronological. A
random split would put a race's own rows on both sides of it and leak the
answer through shared per-race state.

The number of trees is chosen from the CV curve of rank correlation against
tree count, SMOOTHED first. Taking a raw argmax over a few hundred candidates
on four folds picks a noise spike; the curve here is a broad plateau and the
smoothing is what lands on it rather than on its ragged top.

Metrics are reported out-of-fold and against the baseline the model has to
beat — that everyone finishes where they started, which on an F1 grid is a
genuinely strong predictor. A model that cannot beat it is recorded as not
beating it rather than quietly shipped.

The softmax temperature converting ranker scores to win probabilities is FITTED
on pooled out-of-fold scores by maximum likelihood, so the published
percentages are calibrated rather than decorative.

DETERMINISM
-----------
This runs on every Vercel deploy and must be reproducible: fixed seed, single
thread, no network, corpus read from disk. The same commit trains the same model.
"""
import json, math, os, sys, time

os.environ.setdefault('OMP_NUM_THREADS', '1')   # determinism over speed

import numpy as np
import xgboost as xgb

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model_state
from features import RACE_FEATURES, QUALIFYING_FEATURES, build_dataset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MODEL_DIR = os.path.join(ROOT, 'src', 'data', 'model')
CORPUS = os.path.join(MODEL_DIR, 'training_set.json')
SNAPSHOT = os.path.join(ROOT, 'src', 'data', 'snapshot')

SEED = 20260917
MAX_POSITION = 21          # nominal field size, for grading a car that never started
# Relevance is truncated at the points positions. Everything from 11th back is
# tied, so the pairwise objective spends no gradient separating 17th from 18th
# and concentrates on the order people actually read. Measured: this lifts
# winner accuracy from 0.515 to 0.588 and rank correlation from 0.677 to 0.681
# against a linear 21-position relevance, on the same folds.
POINTS_DEPTH = 11
FOLDS = 4                  # expanding-window CV folds
MAX_TREES = 120            # search ceiling; the plateau sits far below it
TREE_BOUNDS = (3, 60)      # refuse degenerate one-tree models and overfit tails
SMOOTH = 5                 # window for smoothing the CV curve before argmax

PARAMS = {
    'objective': 'rank:pairwise',
    'eval_metric': 'ndcg@10',
    # Linear NDCG gain. See the module docstring — the default 2^rel makes the
    # metric read as "did it call the winner" and destroys model selection.
    'ndcg_exp_gain': False,
    # A hundred races is a small corpus. Shallow trees and heavy shrinkage are
    # what keep this from memorising the field rather than learning the sport.
    'eta': 0.05,
    'max_depth': 2,
    'min_child_weight': 10,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'lambda': 2.0,
    'alpha': 0.5,
    'seed': SEED,
    'nthread': 1,
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def relevance(position):
    """
    Graded relevance for the ranker: higher is better, first place best.

    A pairwise objective needs an ordering, not a position, and only the
    ordering matters — any monotone transform of this produces an identical
    model, which was confirmed empirically. What does change the model is where
    the scale is FLATTENED: tying everything outside the points removes those
    pairs from the objective entirely.
    """
    return max(0.0, float(POINTS_DEPTH - position))


def feature_rows(entries, names):
    return np.array(
        [[e['features'].get(n, float('nan')) for n in names] for e in entries],
        dtype=np.float32,
    )


def dmatrix(races, names, label_of):
    rows, labels, groups = [], [], []
    for race in races:
        entries = race['entries']
        if len(entries) < 2:
            continue
        rows.append(feature_rows(entries, names))
        labels.extend(label_of(e) for e in entries)
        groups.append(len(entries))
    d = xgb.DMatrix(np.vstack(rows),
                    label=np.array(labels, dtype=np.float32),
                    feature_names=list(names),
                    missing=float('nan'))
    d.set_group(groups)
    return d


def predict_races(booster, races, names, trees):
    out = []
    for race in races:
        d = xgb.DMatrix(feature_rows(race['entries'], names),
                        feature_names=list(names), missing=float('nan'))
        out.append(booster.predict(d, iteration_range=(0, trees)))
    return out


# -- targets ---------------------------------------------------------------
# The race model is graded on where cars finished; the qualifying model on where
# they started. `nan` grid (a car that never took the start) sorts to the back.

def race_position(entry):
    return entry['row']['position']


def grid_position(entry):
    g = entry['features'].get('grid')
    return g if g == g else float(MAX_POSITION)


# -- metrics ---------------------------------------------------------------

def spearman(races, scores, truth):
    """Rank correlation between predicted order and actual order, per race."""
    out = []
    for race, s in zip(races, scores):
        entries = race['entries']
        predicted = np.argsort(np.argsort(-np.asarray(s))).astype(float)
        actual = np.argsort(np.argsort(
            np.array([truth(e) for e in entries], dtype=float))).astype(float)
        sd = predicted.std() * actual.std()
        if sd > 0:
            out.append(float(((predicted - predicted.mean()) *
                              (actual - actual.mean())).mean() / sd))
    return float(np.mean(out)) if out else 0.0


def ordering_metrics(races, scores, truth=race_position):
    """
    Predicted-order quality in units a person can argue with.

      top1          share of races whose winner was called correctly
      podiumRecall  share of true podium finishers inside the predicted top three
      spearman      rank correlation with the actual order
      positionMAE   mean absolute error in predicted finishing position
    """
    top1 = podium = 0
    errors = []
    for race, s in zip(races, scores):
        entries = race['entries']
        order = np.argsort(-np.asarray(s))
        predicted = {id(entries[i]): rank + 1 for rank, i in enumerate(order)}
        actual = {id(e): truth(e) for e in entries}

        winner = min(entries, key=lambda e: actual[id(e)])
        if predicted[id(winner)] == 1:
            top1 += 1
        for e in sorted(entries, key=lambda e: actual[id(e)])[:3]:
            if predicted[id(e)] <= 3:
                podium += 1
        errors.extend(abs(predicted[id(e)] - actual[id(e)]) for e in entries)

    n = max(1, len(races))
    return {
        'races': len(races),
        'top1': round(top1 / n, 4),
        'podiumRecall': round(podium / (3 * n), 4),
        'spearman': round(spearman(races, scores, truth), 4),
        'positionMAE': round(float(np.mean(errors)) if errors else 0.0, 3),
    }


def grid_scores(races):
    """Baseline: everyone finishes where they started."""
    return [-np.array([grid_position(e) for e in r['entries']], dtype=float)
            for r in races]


def fold_bounds(n):
    """Expanding window: train on everything before each held-out block."""
    block = max(4, n // (FOLDS + 2))
    return [(n - block * (FOLDS - i), n - block * (FOLDS - i - 1)) for i in range(FOLDS)]


def smooth(curve, window=SMOOTH):
    """Moving average, edge-padded, so argmax lands on a plateau not a spike."""
    if window <= 1:
        return np.asarray(curve, dtype=float)
    pad = window // 2
    padded = np.pad(np.asarray(curve, dtype=float), pad, mode='edge')
    kernel = np.ones(window) / window
    return np.convolve(padded, kernel, mode='valid')[:len(curve)]


def cross_validate(races, names, label_of, truth, tag):
    """
    Expanding-window CV. Returns the chosen tree count, out-of-fold scores and
    the pooled held-out races they belong to.
    """
    curves, oof_scores, oof_races = [], [], []
    for start, end in fold_bounds(len(races)):
        train, valid = races[:start], races[start:end]
        if len(train) < 10 or not valid:
            continue
        booster = xgb.train(PARAMS, dmatrix(train, names, label_of),
                            num_boost_round=MAX_TREES, verbose_eval=False)
        matrices = [xgb.DMatrix(feature_rows(r['entries'], names),
                                feature_names=list(names), missing=float('nan'))
                    for r in valid]
        preds = [[booster.predict(m, iteration_range=(0, t)) for m in matrices]
                 for t in range(1, MAX_TREES + 1)]
        curves.append([spearman(valid, p, truth) for p in preds])
        oof_scores.append(preds)
        oof_races.append(valid)

    if not curves:
        raise SystemExit(f'{tag}: not enough races to cross-validate')

    mean_curve = np.mean(np.array(curves), axis=0)
    lo, hi = TREE_BOUNDS
    window = smooth(mean_curve)[lo - 1:hi]
    trees = int(np.argmax(window)) + lo

    pooled_races = [r for block in oof_races for r in block]
    pooled_scores = [s for block in oof_scores for s in block[trees - 1]]
    log(f'  {tag}: {trees} trees '
        f'(CV rank correlation {mean_curve[trees - 1]:.4f}, '
        f'peak {mean_curve.max():.4f} at {int(np.argmax(mean_curve)) + 1})')
    return trees, pooled_races, pooled_scores


def evaluate_chain(races, race_trees, quali_trees):
    """
    Score the chain the app actually runs for a race that has not happened.

    An upcoming race has no grid, so the qualifying model predicts one and the
    race model runs on that. This is a materially harder problem than ordering a
    field whose grid is known, and it must be measured separately or the
    interface will quote a confidence it did not earn: on this corpus the
    difference is roughly 0.66 rank correlation with a real grid against 0.58
    without one.

    Returns (metrics, races, scores) pooled across folds.
    """
    pooled_races, pooled_scores = [], []
    for start, end in fold_bounds(len(races)):
        train, valid = races[:start], races[start:end]
        if len(train) < 10 or not valid:
            continue
        race_model = xgb.train(PARAMS, dmatrix(train, RACE_FEATURES,
                                               lambda e: relevance(race_position(e))),
                               num_boost_round=race_trees, verbose_eval=False)
        quali_model = xgb.train(PARAMS, dmatrix(train, QUALIFYING_FEATURES,
                                                lambda e: relevance(grid_position(e))),
                                num_boost_round=quali_trees, verbose_eval=False)
        for race in valid:
            entries = race['entries']
            quali = quali_model.predict(
                xgb.DMatrix(feature_rows(entries, QUALIFYING_FEATURES),
                            feature_names=list(QUALIFYING_FEATURES), missing=float('nan')))
            predicted_grid = {}
            for rank, index in enumerate(np.argsort(-quali)):
                predicted_grid[int(index)] = rank + 1

            rows = []
            for i, entry in enumerate(entries):
                f = dict(entry['features'])
                slot = float(predicted_grid[i])
                f['grid'] = slot
                f['gridPct'] = slot / 22.0
                season = f.get('seasonAvgGrid')
                f['gridVsSeasonGrid'] = (slot - season) if season == season else float('nan')
                rows.append([f.get(n, float('nan')) for n in RACE_FEATURES])

            pooled_races.append(race)
            pooled_scores.append(race_model.predict(
                xgb.DMatrix(np.array(rows, dtype=np.float32),
                            feature_names=list(RACE_FEATURES), missing=float('nan'))))

    return ordering_metrics(pooled_races, pooled_scores), pooled_races, pooled_scores


def fit_temperature(races, scores):
    """
    Fit the softmax temperature turning ranker scores into win probabilities.

    Maximum likelihood over held-out races: the T making actual winners as
    probable as possible under softmax(score / T). One bounded parameter, so it
    is scanned rather than solved — exact enough and it cannot diverge.
    """
    # Scanned on a log scale from well below the plausible optimum: ranker
    # scores span a few tenths, so the peak sits near T=0.05 and a linear scan
    # starting there would report a boundary and hide whether it is a real peak.
    best_t, best_ll = 1.0, -math.inf
    for t in np.geomspace(0.002, 12.0, 600):
        ll = 0.0
        for race, s in zip(races, scores):
            entries = race['entries']
            winner = min(range(len(entries)), key=lambda i: entries[i]['row']['position'])
            z = (np.asarray(s) - np.max(s)) / t
            ll += float(z[winner] - np.log(np.exp(z).sum()))
        if ll > best_ll:
            best_ll, best_t = ll, float(t)
    edge = best_t <= 0.0021 or best_t >= 11.9
    if edge:
        log('  WARNING: fitted temperature sits at the edge of the scan range')
    return round(best_t, 5), round(best_ll / max(1, len(races)), 4)


def dump_trees(booster, names, trees):
    """
    Export the booster as plain nested nodes the browser can walk.

    XGBoost's own JSON dump is used rather than a hand-rolled traversal, so the
    exported thresholds and default directions are the model's own. Feature
    names become indices to keep the payload small and the JS walker simple.

    Each internal node also carries `c`, the cover-weighted mean of the leaves
    beneath it — the prediction an average sample reaching that node receives.
    The browser needs it for per-driver attribution: walking root to leaf and
    charging each step's change in `c` to the feature that was split on
    decomposes the score exactly into per-feature contributions. Computing it
    here rather than in JS keeps one definition of it, in the place that has the
    model's own cover statistics.
    """
    index = {name: i for i, name in enumerate(names)}
    raw = booster.get_dump(dump_format='json', with_stats=True)[:trees]

    def node_value(node):
        """(cover-weighted sum of leaf values, total cover) beneath a node."""
        if 'leaf' in node:
            cover = float(node.get('cover', 1.0))
            return float(node['leaf']) * cover, cover
        total, weight = 0.0, 0.0
        for child in node['children']:
            t, w = node_value(child)
            total += t
            weight += w
        return total, weight

    def convert(node):
        if 'leaf' in node:
            return {'v': round(float(node['leaf']), 6)}
        children = {c['nodeid']: c for c in node['children']}
        total, weight = node_value(node)
        return {
            'f': index[node['split']],
            't': round(float(node['split_condition']), 6),
            'c': round(total / weight if weight else 0.0, 6),
            # XGBoost sends values < threshold to `yes`. `missing` names the
            # child a NaN follows, which is not always the same one.
            'l': convert(children[node['yes']]),
            'r': convert(children[node['no']]),
            'm': 'l' if node['missing'] == node['yes'] else 'r',
        }

    return [convert(json.loads(t)) for t in raw]


def importance(booster, names):
    gain = booster.get_score(importance_type='gain')
    total = sum(gain.values()) or 1.0
    return sorted(
        ({'feature': f, 'gain': round(100 * gain.get(f, 0.0) / total, 2)} for f in names),
        key=lambda x: -x['gain'],
    )


def main():
    if not os.path.exists(CORPUS):
        raise SystemExit(f'missing {CORPUS}\nRun: python tools/fetch_training_data.py')

    corpus = json.load(open(CORPUS))
    log(f"corpus: {corpus['races']} races, {corpus['rows']} classifications, "
        f"seasons {corpus['seasons'][0]}-{corpus['seasons'][1]}")

    races, history = build_dataset(corpus['data'])
    races = [r for r in races if len(r['entries']) >= 2]
    if len(races) < 30:
        raise SystemExit(f'only {len(races)} usable races; refusing to train')

    log(f'\ncross-validating ({FOLDS} expanding-window folds)')
    race_trees, race_oof, race_scores = cross_validate(
        races, RACE_FEATURES, lambda e: relevance(race_position(e)), race_position, 'race')
    quali_trees, quali_oof, quali_scores = cross_validate(
        races, QUALIFYING_FEATURES, lambda e: relevance(grid_position(e)),
        grid_position, 'qualifying')

    race_metrics = ordering_metrics(race_oof, race_scores)
    chain_metrics, chain_races, chain_scores = evaluate_chain(races, race_trees, quali_trees)
    quali_metrics = ordering_metrics(quali_oof, quali_scores, truth=grid_position)
    baseline = ordering_metrics(race_oof, grid_scores(race_oof))
    temperature, mean_ll = fit_temperature(race_oof, race_scores)
    # An upcoming race is scored through the chain, so its probabilities need
    # the temperature fitted on the chain — a flatter one, because the chain is
    # less certain and saying so is the point of calibrating at all.
    chain_temperature, chain_ll = fit_temperature(chain_races, chain_scores)

    lift = round(race_metrics['spearman'] - baseline['spearman'], 4)
    beats = lift > 0

    log('\nout-of-fold performance')
    log(f"  race      top1 {race_metrics['top1']:.3f}  podium {race_metrics['podiumRecall']:.3f}  "
        f"rank-corr {race_metrics['spearman']:.4f}  MAE {race_metrics['positionMAE']:.2f}")
    log(f"  baseline  top1 {baseline['top1']:.3f}  podium {baseline['podiumRecall']:.3f}  "
        f"rank-corr {baseline['spearman']:.4f}  MAE {baseline['positionMAE']:.2f}"
        "   <- everyone finishes where they started")
    log(f"  lift      {lift:+.4f} rank correlation")
    log(f"  qualifying rank-corr {quali_metrics['spearman']:.4f}  "
        f"pole called {quali_metrics['top1']:.3f}")
    log(f"  upcoming  top1 {chain_metrics['top1']:.3f}  podium {chain_metrics['podiumRecall']:.3f}  "
        f"rank-corr {chain_metrics['spearman']:.4f}  MAE {chain_metrics['positionMAE']:.2f}"
        "   <- no grid yet: qualifying model feeds the race model")
    log(f'  softmax temperature {temperature} (mean log-likelihood {mean_ll})')
    if not beats:
        log('\n  WARNING: the model does not beat the grid baseline out of fold.')
        log('  It is still exported; the Predict page reports the comparison.')

    # -- final fit on every race ----------------------------------------
    log('\nfitting final models on the full corpus')
    race_model = xgb.train(PARAMS, dmatrix(races, RACE_FEATURES,
                                           lambda e: relevance(race_position(e))),
                           num_boost_round=race_trees, verbose_eval=False)
    quali_model = xgb.train(PARAMS, dmatrix(races, QUALIFYING_FEATURES,
                                            lambda e: relevance(grid_position(e))),
                            num_boost_round=quali_trees, verbose_eval=False)

    # -- parity fixture --------------------------------------------------
    # Real vectors from the most recent races, exported WITH the score this
    # trainer gives them. `npm run model:verify` feeds the same vectors through
    # the JavaScript tree walker and diffs. That is what catches a walker that
    # sends missing values down the wrong branch, or treats `x < threshold` as
    # `x <= threshold` — mistakes that produce plausible numbers and no error.
    fixture = []
    for race in races[-3:]:
        entries = race['entries'][:5]
        race_pred = race_model.predict(
            xgb.DMatrix(feature_rows(entries, RACE_FEATURES),
                        feature_names=list(RACE_FEATURES), missing=float('nan')),
            iteration_range=(0, race_trees))
        quali_pred = quali_model.predict(
            xgb.DMatrix(feature_rows(entries, QUALIFYING_FEATURES),
                        feature_names=list(QUALIFYING_FEATURES), missing=float('nan')),
            iteration_range=(0, quali_trees))
        for entry, race_score, quali_score in zip(entries, race_pred, quali_pred):
            fixture.append({
                'season': entry['row']['season'],
                'round': entry['row']['round'],
                'driverId': entry['row']['driverId'],
                'features': {k: (None if v != v else round(float(v), 6))
                             for k, v in entry['features'].items()},
                # Raw ranker scores. A ranking objective does not fold
                # `base_score` into its prediction, so these are directly
                # comparable with the browser's sum of leaf values.
                'raceScore': round(float(race_score), 6),
                'qualifyingScore': round(float(quali_score), 6),
            })

    # Probe vectors, to exercise the branches real rows do not reach.
    #
    # The fixture above is drawn from recent races, where an established driver
    # has a value for nearly every feature — so the MISSING branch of most
    # splits is never walked, and a parity check built only from those rows will
    # pass a model whose missing directions have all been flipped. That was not
    # hypothetical: it was tried, and the check said the model was fine.
    #
    # So: one vector with everything missing, and one per feature with only that
    # feature missing. Together they walk every default direction in both trees.
    def probe_vectors(names):
        median = {}
        for i, name in enumerate(names):
            values = [e['features'].get(name) for r in races for e in r['entries']]
            values = sorted(v for v in values if v is not None and v == v)
            median[name] = values[len(values) // 2] if values else 0.0
        out = [{'label': 'all-missing', 'values': {n: None for n in names}}]
        for name in names:
            out.append({'label': f'missing:{name}',
                        'values': {n: (None if n == name else median[n]) for n in names}})

        # Random vectors drawn from each feature's own observed range, with
        # missing values scattered through them. The structured probes above
        # cover the default directions; these cover the thresholds, which a
        # fixed handful of vectors leaves almost untouched — a split moved by a
        # whole position went undetected until these were added.
        spread = {}
        for name in names:
            values = sorted(v for r in races for e in r['entries']
                            if (v := e['features'].get(name)) is not None and v == v)
            spread[name] = (values[0], values[-1]) if values else (0.0, 1.0)
        rng = np.random.default_rng(SEED)
        for i in range(60):
            values = {}
            for name in names:
                if rng.random() < 0.15:
                    values[name] = None
                else:
                    lo, hi = spread[name]
                    # Slightly outside the observed range, so the outermost
                    # splits are exercised from both sides too.
                    pad = (hi - lo) * 0.05
                    values[name] = round(float(rng.uniform(lo - pad, hi + pad)), 6)
            out.append({'label': f'random:{i}', 'values': values})
        return out

    def score_probes(booster, names, trees):
        probes = probe_vectors(names)
        rows = np.array([[float('nan') if p['values'][n] is None else p['values'][n]
                          for n in names] for p in probes], dtype=np.float32)
        preds = booster.predict(xgb.DMatrix(rows, feature_names=list(names),
                                            missing=float('nan')),
                                iteration_range=(0, trees))
        for probe, value in zip(probes, preds):
            probe['score'] = round(float(value), 6)
        return probes

    probes = {
        'race': score_probes(race_model, RACE_FEATURES, race_trees),
        'qualifying': score_probes(quali_model, QUALIFYING_FEATURES, quali_trees),
    }

    os.makedirs(MODEL_DIR, exist_ok=True)
    for name, booster, names, trees in (
        ('race', race_model, RACE_FEATURES, race_trees),
        ('qualifying', quali_model, QUALIFYING_FEATURES, quali_trees),
    ):
        payload = {'features': list(names), 'trees': dump_trees(booster, names, trees)}
        path = os.path.join(MODEL_DIR, f'{name}.json')
        with open(path, 'w') as fh:
            json.dump(payload, fh, separators=(',', ':'))
        log(f'  wrote src/data/model/{name}.json '
            f'({len(payload["trees"])} trees, {os.path.getsize(path) / 1024:.1f} KB)')

    # The feature state the browser scores against, written from the same
    # history the corpus was featurised with. See tools/model_state.py.
    calendar = json.load(open(os.path.join(SNAPSHOT, 'calendar.json')))
    snapshot_ids = [d['id'] for d in json.load(open(os.path.join(SNAPSHOT, 'drivers.json')))]
    model_state.write(os.path.join(MODEL_DIR, 'state.json'), corpus['data'], history,
                      calendar, corpus['seasons'][1], snapshot_ids,
                      schedule=corpus.get('schedule'), log=log)

    meta = {
        'trainedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'algorithm': 'XGBoost rank:pairwise',
        'xgboostVersion': xgb.__version__,
        'corpus': {k: corpus[k] for k in ('source', 'seasons', 'races', 'rows', 'fetchedAt')},
        'validation': {'scheme': f'{FOLDS}-fold expanding window, chronological',
                       'races': race_metrics['races']},
        'params': PARAMS,
        'race': {**race_metrics, 'trees': race_trees,
                 'importance': importance(race_model, RACE_FEATURES)},
        # The same pair measured on the harder problem the app faces most of the
        # time: a race that has not been qualified for yet.
        'upcoming': {**chain_metrics, 'temperature': chain_temperature,
                     'meanLogLikelihood': chain_ll},
        'qualifying': {**quali_metrics, 'trees': quali_trees,
                       'importance': importance(quali_model, QUALIFYING_FEATURES)},
        'baseline': baseline,
        'lift': lift,
        'beatsBaseline': beats,
        'temperature': temperature,
        'meanLogLikelihood': mean_ll,
        'parityFixture': fixture,
        'parityProbes': probes,
    }
    with open(os.path.join(MODEL_DIR, 'meta.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)
    log('  wrote src/data/model/meta.json')


if __name__ == '__main__':
    main()
