/**
 * Prediction engine.
 *
 * Every feature below is computed from real 2026 session data: championship
 * ratings derived from actual grid slots and classifications, recent form from
 * the last five real results, and track suitability from the circuit's own
 * telemetry-measured speed and throttle profile.
 *
 * The weighting and the softmax that turns scores into win probabilities are
 * GridPred's own model, and it is deliberately simple and legible. It is shaped
 * like a real model client: hand it a race and a weight vector, receive a ranked
 * grid plus per-driver factor attributions. Replacing the body of `predictRace`
 * with a call to a served model leaves every component untouched.
 */
import { drivers, driverById, hasRating } from './drivers';
import { getTeam } from './teams';
import { circuitById } from './circuits';
import { recentForm, resultsByRace } from './results';

/** Model feature weights, in percent. Editable from the prediction page. */
export const FACTORS = [
  { key: 'qualifyingPace', label: 'Qualifying Pace', weight: 30, hint: 'Average grid position across the season so far.' },
  { key: 'racePace', label: 'Race Pace', weight: 25, hint: 'Average finishing position across the season so far.' },
  { key: 'recentForm', label: 'Recent Form', weight: 15, hint: 'Results trend across the last five rounds.' },
  { key: 'trackSuitability', label: 'Track Suitability', weight: 15, hint: 'Driver record at circuits with this speed profile.' },
  { key: 'weather', label: 'Weather', weight: 10, hint: 'Wet-weather record weighed against the forecast.' },
  { key: 'historical', label: 'Historical Performance', weight: 5, hint: 'This driver’s prior result at this circuit.' },
];

export const defaultWeights = Object.fromEntries(FACTORS.map((f) => [f.key, f.weight]));

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/**
 * Feature vector for one driver at one circuit. Each component is 0-100 and
 * each is traceable to a real measurement.
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

  // Track suitability blends the driver's record at fast and slow venues by how
  // much of this circuit is actually taken at full throttle.
  const throttle = circuit?.measurements?.fullThrottlePct;
  const fastBias = throttle != null ? clamp((throttle - 40) / 40, 0, 1) : 0.5;
  const fast = r.highSpeedCircuits ?? r.racePace ?? 50;
  const slow = r.lowSpeedCircuits ?? r.racePace ?? 50;

  // Prior result at this exact circuit, when the season has already been here.
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

function weightedScore(vector, weights) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  return FACTORS.reduce((s, f) => s + vector[f.key] * (weights[f.key] ?? 0), 0) / total;
}

/**
 * Rank the field for a race.
 * @returns {{qualifying:object[], race:object[], confidence:number, byId:object}}
 */
export function predictRace(race, opts = {}) {
  const { weights = defaultWeights, rainChance = 0 } = opts;
  if (!race) return { qualifying: [], race: [], byId: {}, confidence: 0, factors: FACTORS, fieldAverage: {} };

  const circuit = race.circuit ?? circuitById[race.circuitId];

  const rows = drivers.map((driver) => {
    const vector = featureVector(driver, race, rainChance);
    const team = getTeam(driver.team);
    const score = weightedScore(vector, weights);
    const jitter = (hash(`${race.id}:${driver.id}`) - 0.5) * 1.2;
    return { driver, team, vector, score: score + jitter };
  });

  const fieldAverage = Object.fromEntries(
    FACTORS.map((f) => [f.key, rows.reduce((s, x) => s + x.vector[f.key], 0) / rows.length]),
  );

  const qualiOrder = [...rows]
    .map((x) => ({ ...x, qScore: x.score * 0.7 + x.vector.qualifyingPace * 0.3 }))
    .sort((a, b) => b.qScore - a.qScore)
    .map((x, i) => ({ ...x, position: i + 1 }));

  // A circuit where little of the lap is spent at full throttle offers fewer
  // passing chances, so grid position carries further into the result.
  const throttle = circuit?.measurements?.fullThrottlePct ?? 55;
  const overtakeEase = clamp((throttle - 35) / 45, 0, 1);
  const rain = rainChance / 100;
  const chaos = 2.6 + rain * 14;

  const raceOrder = [...qualiOrder]
    .map((x) => ({
      ...x,
      rScore:
        x.score * 0.72 +
        x.vector.racePace * 0.16 +
        (21 - x.position) * (1 - overtakeEase) * 0.85 +
        (hash(`race:${race.id}:${x.driver.id}:${Math.round(rain * 8)}`) - 0.5) * chaos,
    }))
    .sort((a, b) => b.rScore - a.rScore)
    .map((x, i) => ({ ...x, racePosition: i + 1 }));

  const temp = 5.2 + rain * 3;
  const exps = raceOrder.map((x) => Math.exp((x.rScore - raceOrder[0].rScore) / temp));
  const expSum = exps.reduce((s, e) => s + e, 0);
  const qualiPos = Object.fromEntries(qualiOrder.map((x) => [x.driver.id, x.position]));

  const decorate = (x, i) => ({
    driverId: x.driver.id,
    driver: x.driver,
    teamId: x.team.id,
    team: x.team,
    position: x.racePosition,
    gridPosition: qualiPos[x.driver.id],
    delta: qualiPos[x.driver.id] - x.racePosition,
    score: Number(x.score.toFixed(1)),
    vector: x.vector,
    winProbability: Number(((exps[i] / expSum) * 100).toFixed(1)),
    contributions: FACTORS.map((f) => ({
      key: f.key,
      label: f.label,
      value: Number((((x.vector[f.key] - fieldAverage[f.key]) * (weights[f.key] ?? 0)) / 100).toFixed(1)),
      raw: Math.round(x.vector[f.key]),
    })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
  });

  const raceRows = raceOrder.map(decorate);
  const byId = Object.fromEntries(raceRows.map((x) => [x.driverId, x]));
  const qualifying = qualiOrder.map((x) => ({ ...byId[x.driver.id], position: x.position }));

  const gap = raceOrder[0].rScore - raceOrder[1].rScore;
  const confidence = clamp(Math.round(61 + Math.min(gap, 6) * 3.4 + (1 - rain) * 15), 36, 94);

  return {
    raceId: race.id,
    qualifying,
    race: raceRows,
    byId,
    fieldAverage,
    confidence,
    factors: FACTORS,
    weights,
    rainChance,
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
