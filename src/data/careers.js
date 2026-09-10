/**
 * Career history — the record before this season.
 *
 * The snapshot knows 2026. This knows where each driver came from: the race they
 * debuted in, every season since, and what those seasons added up to. It is
 * aggregated from published classifications rather than copied from a summary,
 * so a career total is the sum of races that can be pointed at.
 *
 * Nothing here is editorial. There are no biographies and no opinions about how
 * a driver drives — where this file characterises a driver at all, it does so
 * from measured figures, and shows the figure alongside the word.
 */
import raw from './snapshot/careers.json';

export const careerById = raw;
export const getCareer = (driverId) => raw[driverId] ?? null;

/** Seasons before the current one, newest first. */
export function previousSeasons(driverId, season = 2026) {
  const career = getCareer(driverId);
  if (!career) return [];
  return career.seasons.filter((s) => s.season < season).sort((a, b) => b.season - a.season);
}

/** A driver's own record in a single season. */
export const seasonOf = (driverId, season) =>
  getCareer(driverId)?.seasons.find((s) => s.season === season) ?? null;

/**
 * How a driver's career reads at a glance, as label/value pairs.
 * Every figure is a count of real classifications.
 */
export function careerHeadline(driverId) {
  const c = getCareer(driverId);
  if (!c) return null;
  return [
    { key: 'starts', label: 'Starts', value: c.starts },
    { key: 'wins', label: 'Wins', value: c.wins },
    { key: 'podiums', label: 'Podiums', value: c.podiums },
    { key: 'poles', label: 'Poles', value: c.poles },
    { key: 'points', label: 'Career points', value: c.points },
    { key: 'seasons', label: 'Seasons', value: c.seasons.length },
  ];
}

/**
 * Traits a driver's measured season actually supports.
 *
 * This is the closest the product comes to describing "how someone drives", and
 * it is deliberately not a character sketch. An earlier cut of this used fixed
 * thresholds and called nineteen of twenty-two drivers "metronomic", which is
 * worthless — a trait that describes nearly everyone distinguishes no one. So
 * each dimension is ranked across the whole grid and a trait fires only for the
 * drivers at the top of it, carrying the figure and the rank that earned it.
 *
 * The inputs are `ratings` and `ratingSamples` from `extract_season.py`, derived
 * arithmetically from grid slots, finishing positions and stint lengths. A
 * driver whose season says nothing distinctive gets no traits, which is an
 * ordinary and honest result.
 */
const DIMENSIONS = [
  {
    key: 'qualifier',
    label: 'One-lap specialist',
    blurb: 'Qualifies better than the race results alone would suggest.',
    sample: 'qualifying',
    score: (r) => (r.qualifying != null && r.racePace != null ? r.qualifying - r.racePace : null),
    figure: (r) => `rated ${Math.round(r.qualifying)} qualifying, ${Math.round(r.racePace)} race pace`,
  },
  {
    key: 'racer',
    label: 'Races better than he qualifies',
    blurb: 'Finishes ahead of where the grid slot suggests.',
    sample: 'racePace',
    score: (r) => (r.racePace != null && r.qualifying != null ? r.racePace - r.qualifying : null),
    figure: (r) => `rated ${Math.round(r.racePace)} race pace, ${Math.round(r.qualifying)} qualifying`,
  },
  {
    key: 'overtaker',
    label: 'Overtaker',
    blurb: 'Gains more places over a race than most of the grid.',
    sample: 'overtaking',
    score: (r, d) => d?.avgPositionsGained ?? null,
    figure: (r, d) =>
      `${d.avgPositionsGained > 0 ? '+' : ''}${d.avgPositionsGained} places per finish`,
  },
  {
    key: 'metronome',
    label: 'Metronomic',
    blurb: 'Finishes in much the same place week to week.',
    sample: 'consistency',
    score: (r) => r.consistency ?? null,
    figure: (r) => `rated ${Math.round(r.consistency)} for consistency`,
  },
  {
    key: 'finisher',
    label: 'Brings it home',
    blurb: 'Sees the flag more often than most of the grid.',
    sample: 'reliability',
    score: (r) => r.reliability ?? null,
    figure: (r) => `${Math.round(r.reliability)}% of starts classified`,
  },
  {
    key: 'wet',
    label: 'Strong in the wet',
    blurb: 'Rates higher on a wet track than on a dry one.',
    sample: 'wetWeather',
    score: (r) => (r.wetWeather != null && r.racePace != null ? r.wetWeather - r.racePace : null),
    figure: (r) => `rated ${Math.round(r.wetWeather)} in the wet, ${Math.round(r.racePace)} overall`,
  },
  {
    key: 'street',
    label: 'Street-circuit driver',
    blurb: 'Rates higher between the walls than on open circuits.',
    sample: 'streetCircuits',
    score: (r) => (r.streetCircuits != null && r.racePace != null ? r.streetCircuits - r.racePace : null),
    figure: (r) => `rated ${Math.round(r.streetCircuits)} on street circuits, ${Math.round(r.racePace)} overall`,
  },
  {
    key: 'highspeed',
    label: 'Quick where it is fast',
    blurb: 'Rates higher at the high-speed venues than elsewhere.',
    sample: 'highSpeedCircuits',
    score: (r) => (r.highSpeedCircuits != null && r.racePace != null ? r.highSpeedCircuits - r.racePace : null),
    figure: (r) => `rated ${Math.round(r.highSpeedCircuits)} at fast circuits, ${Math.round(r.racePace)} overall`,
  },
  {
    key: 'tyres',
    label: 'Easy on tyres',
    blurb: 'Completes the race in fewer stints than most.',
    sample: 'tyreManagement',
    score: (r) => r.tyreManagement ?? null,
    figure: (r) => `rated ${Math.round(r.tyreManagement)} for tyre management`,
  },
];

/** Rating dimensions are hidden below this many races, as elsewhere in the UI. */
const MIN_SAMPLE = 3;
/** How many drivers may hold a trait — roughly the top fifth of the grid. */
const TOP_N = 4;

/** driverId -> [{key, rank}] for every dimension it leads, computed once. */
function buildRanks(field) {
  const ranks = new Map();
  for (const dim of DIMENSIONS) {
    const scored = field
      .filter((d) => (d.ratingSamples?.[dim.sample] ?? 0) >= MIN_SAMPLE)
      .map((d) => ({ id: d.id, value: dim.score(d.ratings ?? {}, d) }))
      .filter((x) => x.value != null)
      .sort((a, b) => b.value - a.value);

    scored.slice(0, TOP_N).forEach((x, i) => {
      // A differential trait must actually be positive to mean anything: being
      // "best" at racing better than you qualify is not a trait if you do not.
      if (x.value <= 0) return;
      if (!ranks.has(x.id)) ranks.set(x.id, []);
      ranks.get(x.id).push({ key: dim.key, rank: i + 1 });
    });
  }
  return ranks;
}

let cachedField = null;
let cachedRanks = null;

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * @param {object} driver the driver to describe
 * @param {Array} field the whole grid, needed because a trait is relative
 * @returns {Array<{key,label,blurb,figure,races,rank}>} strongest first, or []
 */
export function drivingTraits(driver, field = [], limit = 4) {
  if (!driver?.ratings || !field.length) return [];
  if (field !== cachedField) {
    cachedField = field;
    cachedRanks = buildRanks(field);
  }
  const held = cachedRanks.get(driver.id) ?? [];
  const byKey = new Map(DIMENSIONS.map((d) => [d.key, d]));

  return held
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ key, rank }) => {
      const dim = byKey.get(key);
      return {
        key,
        label: dim.label,
        blurb: dim.blurb,
        figure: dim.figure(driver.ratings, driver),
        races: driver.ratingSamples?.[dim.sample] ?? null,
        rank: `${ordinal(rank)} on the grid`,
      };
    });
}
