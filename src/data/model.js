/**
 * The trained prediction model, as the app sees it.
 *
 * `tools/train_model.py` produces four artifacts, all rebuilt on every deploy:
 *
 *   qualifying.json  ranker that orders the field with no grid to look at
 *   race.json        ranker that orders the field given a grid slot
 *   state.json       each driver's feature vector as of the last race run
 *   meta.json        how it was validated, and the fitted softmax temperature
 *
 * The two rankers COMPOSE. A race that has not happened has no grid, so the
 * qualifying model predicts one and the race model runs on that prediction.
 * That is also how the pair was validated, so the numbers on the Predict page
 * describe the same chain the page actually runs.
 *
 * Nothing here recomputes a driver's history. The features span five seasons
 * and the app holds one, so the history comes precomputed in `state.json` from
 * the same code that built the training set — see tools/model_state.py for why
 * that is the difference between a model and a model-shaped number.
 */
import raceModel from './model/race.json';
import qualifyingModel from './model/qualifying.json';
import modelState from './model/state.json';
import modelMeta from './model/meta.json';
import { attribute, rankOrder, score, softmax } from '@/lib/xgboost';

export const meta = modelMeta;
export const CIRCUIT_FIELD = 22;          // mirrors features.py

/** True when the model was measured to order a field better than its grid does. */
export const beatsBaseline = Boolean(modelMeta.beatsBaseline);

/**
 * Feature vector for one driver, with the grid-dependent slots left empty.
 *
 * Absent history stays absent: `undefined` reaches the tree walker as a missing
 * value and follows the branch the model learned for not knowing, which is a
 * different and better answer than a made-up average.
 */
function baseFeatures(driverId, circuitId) {
  const entry = modelState.drivers[driverId];
  if (!entry) return null;
  const circuit = (circuitId && entry.circuits?.[circuitId]) || {};
  const vector = {};
  for (const key of modelState.stateFeatures) {
    if (entry[key] != null) vector[key] = entry[key];
  }
  for (const key of modelState.circuitFeatures) {
    if (circuit[key] != null) vector[key] = circuit[key];
  }
  return vector;
}

/** Lay a named feature map out in the order a given model expects. */
function ordered(model, values) {
  return model.features.map((name) => {
    const v = values[name];
    return v == null ? NaN : v;
  });
}

/**
 * Fill in the three features that depend on where a car starts.
 * Mirrors the definitions in tools/features.py.
 */
function withGrid(values, grid) {
  const seasonAvgGrid = values.seasonAvgGrid;
  return {
    ...values,
    grid,
    gridPct: grid / CIRCUIT_FIELD,
    gridVsSeasonGrid: seasonAvgGrid == null ? undefined : grid - seasonAvgGrid,
  };
}

/** Drivers the corpus has no history for — scored, but flagged as unmodelled. */
export const unmodelled = new Set(modelState.withoutHistory ?? []);

/**
 * Run both models over a field.
 *
 * @param {object[]} grid      drivers to rank
 * @param {string} circuitId   circuit, for the per-circuit features
 * @param {object} [opts]
 * @param {Record<string,number>} [opts.knownGrid]  real grid slots, when the
 *        race has already qualified; otherwise the predicted order is used
 * @returns {{order:object[], missing:string[]}}
 */
export function runModel(grid, circuitId, opts = {}) {
  const { knownGrid = null } = opts;

  const rows = grid.map((driver) => ({
    driver,
    base: baseFeatures(driver.id, circuitId),
  }));

  // A driver with no corpus history at all still has to be placed. They are
  // scored on an all-missing vector, which the model handles natively, and
  // recorded so the interface can say so rather than implying knowledge.
  const missing = rows.filter((r) => !r.base).map((r) => r.driver.id);
  rows.forEach((r) => { if (!r.base) r.base = {}; });

  // 1. Qualifying — no grid exists yet, so none is supplied.
  const qualiScores = rows.map((r) => score(qualifyingModel, ordered(qualifyingModel, r.base)));
  const qualiOrder = rankOrder(qualiScores);
  const predictedGrid = {};
  qualiOrder.forEach((rowIndex, i) => { predictedGrid[rows[rowIndex].driver.id] = i + 1; });

  // 2. Race — on the real grid where there is one, otherwise on the predicted
  //    one, which is the chain the model was validated as.
  rows.forEach((r) => {
    const slot = knownGrid?.[r.driver.id] ?? predictedGrid[r.driver.id];
    r.gridSlot = slot;
    r.features = ordered(raceModel, withGrid(r.base, slot));
  });

  const raceAttribution = rows.map((r) => attribute(raceModel, r.features));

  return {
    rows,
    missing,
    qualifyingScore: qualiScores,
    qualifyingOrder: qualiOrder,
    predictedGrid,
    raceScore: raceAttribution.map((a) => a.total),
    attribution: raceAttribution,
    featureNames: raceModel.features,
  };
}

/**
 * Win probabilities from ranker scores.
 *
 * Two temperatures were fitted in training, because there are two problems. A
 * race that has already qualified is ordered from a real grid; one that has not
 * is ordered from a predicted grid, which is measurably harder — 0.60 rank
 * correlation against 0.68 — and deserves flatter, less certain probabilities.
 * Using the confident one for both would publish a number the model never
 * earned.
 *
 * Rain raises whichever applies, because a wet race is a less predictable race
 * and the honest response is a flatter distribution rather than a reordered
 * one. The model has no weather feature — the corpus carries none — so this is
 * an adjustment layered on top, and the interface says so.
 */
export function winProbabilities(scores, rainChance = 0, gridIsKnown = false) {
  const rain = Math.min(1, Math.max(0, rainChance / 100));
  const fitted = gridIsKnown
    ? meta.temperature
    : (meta.upcoming?.temperature ?? meta.temperature);
  return softmax(scores, fitted * (1 + rain * 1.6));
}

/**
 * How the model scored out of fold on the problem this prediction actually is.
 * `gridIsKnown` picks between ordering a qualified field and ordering one whose
 * grid is itself a prediction.
 */
export function validatedFor(gridIsKnown) {
  return gridIsKnown ? meta.race : (meta.upcoming ?? meta.race);
}

export { score, attribute, softmax, rankOrder };
