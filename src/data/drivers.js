/**
 * The 2026 driver grid.
 *
 * Identity, racing number, team, colour and headshot come straight from FastF1
 * session results. Championship figures are summed from real classifications,
 * sprint points included.
 *
 * `ratings` are DERIVED from those same results (average grid slot, average
 * finish, spread of finishes, positions gained, stint counts) — they are not
 * opinions. `ratingSamples` records how many races each rating rests on so the
 * interface can decline to show a number that only one race supports.
 */
import raw from './snapshot/drivers.json';
import { normalizeDriver } from '@/services/normalize';

export const drivers = raw.map((d) => ({
  ...normalizeDriver(d),
  ratingSamples: d.ratingSamples ?? {},
  sprintPoints: d.sprintPoints ?? 0,
  avgPositionsGained: d.avgPositionsGained ?? null,
}));

export const driverById = Object.fromEntries(drivers.map((d) => [d.id, d]));
export const getDriver = (id) => driverById[id] ?? null;
export const fullName = (d) => d?.name ?? '';
export const driversByTeam = (teamId) => drivers.filter((d) => d.team === teamId);

/** Human labels for the derived capability vocabulary. */
export const ratingLabels = {
  qualifying: 'Qualifying Pace',
  racePace: 'Race Pace',
  consistency: 'Consistency',
  overtaking: 'Overtaking',
  tyreManagement: 'Tyre Management',
  reliability: 'Finish Rate',
  wetWeather: 'Wet Weather',
  streetCircuits: 'Street Circuits',
  highSpeedCircuits: 'High-Speed Circuits',
  lowSpeedCircuits: 'Low-Speed Circuits',
};

export const ratingKeys = Object.keys(ratingLabels);

/** How each rating is computed, shown in the UI so no number is unexplained. */
export const ratingBasis = {
  qualifying: 'Average grid position across the season',
  racePace: 'Average finishing position',
  consistency: 'Spread of finishing positions',
  overtaking: 'Average positions gained from grid to flag',
  tyreManagement: 'Average number of stints per race',
  reliability: 'Share of races reaching the flag',
  wetWeather: 'Average finish in races with recorded rainfall',
  streetCircuits: 'Average finish at street circuits',
  highSpeedCircuits: 'Average finish at low-downforce circuits',
  lowSpeedCircuits: 'Average finish at high-downforce circuits',
};

/**
 * A rating is only meaningful with enough races behind it.
 * Below the threshold the UI shows the sample size instead of a score.
 */
export const MIN_SAMPLES = 3;
export const hasRating = (driver, key) =>
  driver?.ratings?.[key] != null && (driver.ratingSamples?.[key] ?? 0) >= MIN_SAMPLES;

/** Single headline number for a driver, derived from their season so far. */
export function predictionScore(driver) {
  const r = driver?.ratings ?? {};
  const parts = [r.qualifying, r.racePace, r.consistency, r.reliability].filter((v) => v != null);
  if (!parts.length) return null;
  return Math.round(parts.reduce((s, v) => s + v, 0) / parts.length);
}
