/**
 * Prediction engine.
 *
 * The ordering is produced by two gradient-boosted rankers (XGBoost,
 * `rank:pairwise`) trained in `tools/train_model.py` on every real Formula 1
 * classification since the 2022 regulation reset — 106 races, 2,146 starts,
 * fetched from the published record. The qualifying model predicts a grid; the
 * race model orders the field from it. Neither was hand-weighted: every
 * threshold in them was learned, and `src/data/model/meta.json` records how
 * they were validated and against what.
 *
 * What is NOT learned, and is not pretended to be:
 *
 *  - Weather. The corpus carries no weather, so rain is applied on top of the
 *    model: it flattens the probability distribution and tilts toward drivers
 *    with a measured wet record. The interface labels it as an adjustment.
 *  - The factor weights on the Predict page. The model has its own weights and
 *    they are fixed. The sliders are a what-if tilt applied AFTER it, scaling
 *    each factor's own attributed contribution. Left alone they sit at neutral
 *    and the page shows the model untouched.
 *
 * The six factors below are the vocabulary the interface speaks. Each one maps
 * onto the model features that carry that meaning, so a contribution shown
 * against "Recent Form" is the sum of what the model actually attributed to the
 * recent-form features for this driver — not a restatement of an input.
 */
import { drivers, driverById, hasRating } from './drivers';
import { getTeam } from './teams';
import { circuitById } from './circuits';
import { recentForm, resultsByRace } from './results';
import {
  CIRCUIT_FIELD, beatsBaseline, meta, runModel, unmodelled, validatedFor, winProbabilities,
} from './model';

/**
 * Display factors, and the model features each one speaks for.
 *
 * `weight` is the slider's neutral position, not a model coefficient — the
 * model's own weighting is in meta.race.importance, which the Predict page
 * shows separately.
 */
export const FACTORS = [
  {
    key: 'qualifyingPace',
    label: 'Qualifying Pace',
    weight: 30,
    hint: 'Where this driver starts, and where they usually start.',
    features: ['grid', 'gridPct', 'seasonAvgGrid', 'last5Grid', 'teamSeasonAvgGrid', 'gridVsSeasonGrid'],
  },
  {
    key: 'racePace',
    label: 'Race Pace',
    weight: 25,
    hint: 'Finishing positions across the season and the career.',
    features: ['seasonAvgFinish', 'careerAvgFinish', 'teamSeasonAvgFinish'],
  },
  {
    key: 'recentForm',
    label: 'Recent Form',
    weight: 15,
    hint: 'The last five rounds, for the driver and the team.',
    features: ['last5Finish', 'last5Gained', 'teamLast5Finish'],
  },
  {
    key: 'trackSuitability',
    label: 'Track Record',
    weight: 15,
    hint: 'What this driver has done at this circuit before.',
    features: ['circuitAvgFinish', 'circuitAvgGrid', 'circuitAvgGained'],
  },
  {
    key: 'weather',
    label: 'Weather',
    weight: 10,
    hint: 'Wet-weather record against the forecast. Applied on top of the model.',
    features: [],
  },
  {
    key: 'historical',
    label: 'Racecraft',
    weight: 5,
    hint: 'Places gained from grid to flag, reliability and experience.',
    features: ['avgGained', 'teamAvgGained', 'dnfRate', 'starts'],
  },
];

export const defaultWeights = Object.fromEntries(FACTORS.map((f) => [f.key, f.weight]));

/** Sprint scoring: the top eight only. */
export const SPRINT_POINTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

/** model feature name -> display factor key */
const FEATURE_FACTOR = Object.fromEntries(
  FACTORS.flatMap((f) => f.features.map((name) => [name, f.key])),
);

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/**
 * Weather is applied outside the model, so it needs a scale comparable to one.
 * Model scores span a few tenths across a field; a fully wet race moves a
 * driver by at most this much, which is a few places and not a reordering.
 */
const WEATHER_SCALE = 0.09;

/**
 * The driver's measured profile, 0-100 per display factor.
 *
 * This is what the radar shows. It is a description of the driver, taken from
 * the season's own derived ratings — not the model's internal features, which
 * are raw positions and averages and do not share a scale.
 */
export function featureVector(driver, race, rainChance) {
  const r = driver.ratings ?? {};
  const circuit = race?.circuit ?? circuitById[race?.circuitId];
  const rain = (rainChance ?? 0) / 100;

  const form = recentForm(driver.id, 5);
  const finished = form.filter((f) => f.finished && f.position != null);
  const avgRecent = finished.length
    ? finished.reduce((s, f) => s + f.position, 0) / finished.length
    : 11;

  const throttle = circuit?.measurements?.fullThrottlePct;
  const fastBias = throttle != null ? clamp((throttle - 40) / 40, 0, 1) : 0.5;
  const fast = r.highSpeedCircuits ?? r.racePace ?? 50;
  const slow = r.lowSpeedCircuits ?? r.racePace ?? 50;

  const prior = resultsByRace[race?.circuitId]?.results.find((x) => x.driverId === driver.id);

  return {
    qualifyingPace: r.qualifying ?? 50,
    racePace: r.racePace ?? 50,
    recentForm: clamp(105 - (avgRecent - 1) * 5.4),
    trackSuitability: fast * fastBias + slow * (1 - fastBias),
    weather: rain > 0.15 && hasRating(driver, 'wetWeather')
      ? r.wetWeather
      : (r.consistency ?? r.racePace ?? 50),
    historical: prior?.position ? clamp(104 - prior.position * 5) : (r.racePace ?? 50),
  };
}

/**
 * How far a driver's wet record sits from the field's, as a score adjustment.
 * Zero unless it is actually forecast to rain and the driver has enough wet
 * races behind them to have a record worth using.
 */
function weatherTerm(driver, rain, fieldWetAverage) {
  if (rain <= 0 || !hasRating(driver, 'wetWeather')) return 0;
  return ((driver.ratings.wetWeather - fieldWetAverage) / 100) * rain * WEATHER_SCALE;
}

/**
 * Rank the field for a race.
 *
 * @param {object} race
 * @param {object} [opts]
 * @param {Record<string,number>} [opts.weights]    what-if tilt, neutral at defaults
 * @param {number} [opts.rainChance]                0-100
 * @param {object[]} [opts.grid]                    the field actually entered
 * @returns {{qualifying:object[], race:object[], confidence:number, byId:object}}
 */
export function predictRace(race, opts = {}) {
  const { weights = defaultWeights, rainChance = 0, grid = drivers } = opts;
  if (!race) {
    return {
      qualifying: [], race: [], byId: {}, confidence: 0,
      factors: FACTORS, fieldAverage: {}, model: meta,
    };
  }

  const circuit = race.circuit ?? circuitById[race.circuitId];
  const rain = clamp(rainChance, 0, 100) / 100;

  // A race already run has a real grid; the model was validated both ways.
  const run = resultsByRace[race.circuitId];
  const knownGrid = run
    ? Object.fromEntries(run.results.filter((r) => r.grid != null).map((r) => [r.driverId, r.grid]))
    : null;

  const model = runModel(grid, race.circuitId, { knownGrid });
  const { rows, attribution, featureNames } = model;

  const wetRated = grid.filter((d) => hasRating(d, 'wetWeather'));
  const fieldWetAverage = wetRated.length
    ? wetRated.reduce((s, d) => s + d.ratings.wetWeather, 0) / wetRated.length
    : 50;

  // -- the what-if tilt ---------------------------------------------------
  // Each slider scales its factor's own attributed contribution. At the neutral
  // position every multiplier is 1 and the adjusted score is the model's.
  const multiplier = Object.fromEntries(
    FACTORS.map((f) => [f.key, (weights[f.key] ?? f.weight) / (f.weight || 1)]),
  );

  const scored = rows.map((row, i) => {
    const attributed = attribution[i];
    const byFactor = Object.fromEntries(FACTORS.map((f) => [f.key, 0]));

    let tilt = 0;
    attributed.contributions.forEach((value, featureIndex) => {
      const factor = FEATURE_FACTOR[featureNames[featureIndex]];
      if (!factor) return;
      byFactor[factor] += value;
      tilt += value * (multiplier[factor] - 1);
    });

    const weather = weatherTerm(row.driver, rain, fieldWetAverage) * multiplier.weather;
    byFactor.weather += weather;

    return {
      ...row,
      contributionsByFactor: byFactor,
      score: attributed.total + tilt + weather,
      vector: featureVector(row.driver, race, rainChance),
    };
  });

  // -- ordering -----------------------------------------------------------
  const raceOrder = [...scored]
    .sort((a, b) => b.score - a.score)
    .map((x, i) => ({ ...x, racePosition: i + 1 }));

  const qualiPos = {};
  model.qualifyingOrder.forEach((rowIndex, i) => {
    qualiPos[rows[rowIndex].driver.id] = i + 1;
  });
  // Where the grid is already known, it is the grid — not a prediction of one.
  if (knownGrid) Object.assign(qualiPos, knownGrid);

  const probabilities = winProbabilities(
    raceOrder.map((x) => x.score), rainChance, Boolean(knownGrid),
  );

  const fieldAverage = Object.fromEntries(
    FACTORS.map((f) => [
      f.key,
      scored.reduce((s, x) => s + x.vector[f.key], 0) / (scored.length || 1),
    ]),
  );

  const decorate = (x, i) => ({
    driverId: x.driver.id,
    driver: x.driver,
    teamId: getTeam(x.driver.team).id,
    team: getTeam(x.driver.team),
    position: x.racePosition,
    gridPosition: qualiPos[x.driver.id],
    delta: qualiPos[x.driver.id] - x.racePosition,
    score: Number((x.score * 100).toFixed(1)),
    vector: x.vector,
    winProbability: Number((probabilities[i] * 100).toFixed(1)),
    /** True when the corpus holds no history for this driver. */
    unmodelled: unmodelled.has(x.driver.id) || model.missing.includes(x.driver.id),
    /**
     * What the model attributed to each factor, in points of score. These come
     * from walking the trees this driver's features actually fell through, so
     * they sum to the score rather than describing it.
     */
    contributions: FACTORS.map((f) => ({
      key: f.key,
      label: f.label,
      value: Number((x.contributionsByFactor[f.key] * 100).toFixed(1)),
      raw: Math.round(x.vector[f.key]),
    })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
  });

  const raceRows = raceOrder.map(decorate);
  const byId = Object.fromEntries(raceRows.map((x) => [x.driverId, x]));

  const qualifying = [...raceRows]
    .sort((a, b) => a.gridPosition - b.gridPosition)
    .map((x, i) => ({ ...x, position: i + 1 }));

  /*
   * Sprint.
   *
   * A sprint is about a third of a Grand Prix with no mandatory stop, so there
   * is far less time to recover from a poor start slot. There is no separate
   * sprint model — the corpus does not hold enough sprints to train one
   * honestly — so the race model's own score is re-weighted toward the grid,
   * which is why a sprint order sits closer to the grid than the race order.
   */
  const throttle = circuit?.measurements?.fullThrottlePct ?? 55;
  const overtakeEase = clamp((throttle - 35) / 45, 0, 1);

  const sprint = race.isSprint
    ? (() => {
        const ordered = [...scored]
          .map((x) => ({
            ...x,
            sScore: x.score + (CIRCUIT_FIELD - qualiPos[x.driver.id])
              * (1 - overtakeEase) * 0.012,
          }))
          .sort((a, b) => b.sScore - a.sScore)
          .map((x, i) => ({ ...x, sprintPosition: i + 1 }));

        const sprintProbabilities = winProbabilities(
          ordered.map((x) => x.sScore), rainChance, Boolean(knownGrid),
        );

        return ordered.map((x, i) => ({
          ...byId[x.driver.id],
          position: x.sprintPosition,
          gridPosition: qualiPos[x.driver.id],
          delta: qualiPos[x.driver.id] - x.sprintPosition,
          winProbability: Number((sprintProbabilities[i] * 100).toFixed(1)),
          /** Sprint scores the top eight only. */
          points: SPRINT_POINTS[x.sprintPosition] ?? 0,
        }));
      })()
    : null;

  /*
   * Confidence.
   *
   * Anchored on the model's measured out-of-fold rank correlation — how much of
   * a field's order it actually got right on races it had never seen — then
   * moved by how clear-cut this particular race looks and how wet it is.
   *
   * Which record applies depends on the question. Ordering a field that has
   * already qualified is a different and easier problem than ordering one whose
   * grid is itself a prediction, so an upcoming race is anchored on the lower,
   * chained figure. Quoting the qualified-race number for a race nobody has
   * qualified for would be claiming an accuracy this model does not have.
   */
  const validated = validatedFor(Boolean(knownGrid));
  const margin = raceOrder.length > 1 ? raceOrder[0].score - raceOrder[1].score : 0;
  const confidence = clamp(
    Math.round(100 * validated.spearman + Math.min(margin * 100, 6) * 1.6 - rain * 18),
    35, 92,
  );

  return {
    raceId: race.id,
    qualifying,
    race: raceRows,
    sprint,
    isSprint: Boolean(race.isSprint),
    byId,
    fieldAverage,
    confidence,
    factors: FACTORS,
    weights,
    rainChance,
    /** Provenance for the interface: what this model is and how it did. */
    model: meta,
    /** The out-of-fold record for this kind of prediction specifically. */
    validated,
    beatsBaseline,
    gridIsKnown: Boolean(knownGrid),
    tilted: FACTORS.some((f) => (weights[f.key] ?? f.weight) !== f.weight),
    generatedAt: new Date().toISOString(),
  };
}

/** Narrative for the "what the model sees" panel. */
export function explain(prediction, driverId) {
  const row = prediction.byId?.[driverId];
  if (!row) return null;
  const driver = driverById[driverId];
  return {
    driver,
    row,
    positives: row.contributions.filter((c) => c.value > 0).slice(0, 4),
    negatives: row.contributions.filter((c) => c.value < 0).slice(0, 3),
    summary: `${driver.lastName} projects P${row.position} from P${row.gridPosition} with a ${row.winProbability}% win share.`,
  };
}
