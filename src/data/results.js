/**
 * Real 2026 results.
 *
 * Every classification, grid slot, pit-stop count, tyre compound and weather
 * flag below was recorded in an actual Formula 1 session and read out through
 * FastF1. The championship tables are sums of those results, sprint points
 * included, and match the official standings.
 */
import rounds from './snapshot/results.json';
import standingsRaw from './snapshot/standings.json';
import { drivers, driverById } from './drivers';
import { teams } from './teams';
import { circuitById } from './circuits';

export const results = rounds.map((r) => ({
  ...r,
  circuit: circuitById[r.circuitId] ?? null,
}));

export const resultsByRace = Object.fromEntries(results.map((r) => [r.circuitId, r]));
export const getResult = (circuitId) => resultsByRace[circuitId] ?? null;
export const completedRounds = results.length;

/** Every result for one driver, oldest first. */
export const driverHistory = (driverId) => driverById[driverId]?.form ?? [];

/** Last N rounds, for the form strip. */
export const recentForm = (driverId, n = 10) => driverHistory(driverId).slice(-n);

/** Championship table, straight from the season totals. */
export const standings = drivers
  .map((d) => ({
    driverId: d.id,
    teamId: d.team,
    position: d.position,
    points: d.points,
    wins: d.wins,
    podiums: d.podiums,
    poles: d.poles,
    fastestLaps: d.fastestLaps,
    dnfs: d.dnfs,
    starts: d.starts,
    avgFinish: d.avgFinish,
    avgGrid: d.avgGrid,
    bestFinish: d.bestFinish,
    finishRate: d.finishRate,
  }))
  .sort((a, b) => a.position - b.position);

export const standingsById = Object.fromEntries(standings.map((s) => [s.driverId, s]));
export const seasonStats = (driverId) => standingsById[driverId] ?? null;

export const constructorStandings = [...teams].sort((a, b) => a.position - b.position);
export const constructorById = Object.fromEntries(constructorStandings.map((t) => [t.id, t]));

/** Cumulative points per round — the championship progression chart. */
export const standingsHistory = (() => {
  const running = Object.fromEntries(drivers.map((d) => [d.id, 0]));
  return results.map((r) => {
    r.results.forEach((row) => {
      running[row.driverId] = (running[row.driverId] ?? 0) + (row.points ?? 0);
    });
    (r.sprint ?? []).forEach((row) => {
      const d = drivers.find((x) => x.abbreviation === row.abbreviation);
      if (d) running[d.id] += row.points ?? 0;
    });
    return { round: r.round, name: r.circuit?.shortName ?? r.circuitId, ...running };
  });
})();

/**
 * How well a driver's measured profile fits a circuit's measured character.
 * Both sides are real: the driver's averages at comparable venues, and the
 * circuit's speed and throttle profile taken from telemetry.
 */
export function circuitFit(driver, circuit) {
  const r = driver?.ratings ?? {};
  const m = circuit?.measurements;
  if (!m) return r.racePace ?? 50;
  const fastBias = Math.min(1, Math.max(0, (m.fullThrottlePct - 40) / 40));
  const fast = r.highSpeedCircuits ?? r.racePace ?? 50;
  const slow = r.lowSpeedCircuits ?? r.racePace ?? 50;
  return Math.round(fast * fastBias + slow * (1 - fastBias));
}

/** Driver strength at a specific circuit, for the race-detail comparison. */
export function circuitPerformance(circuitId) {
  const circuit = circuitById[circuitId];
  const prior = resultsByRace[circuitId];
  return drivers
    .map((d) => {
      const here = prior?.results.find((x) => x.driverId === d.id) ?? null;
      return {
        driverId: d.id,
        teamId: d.team,
        qualifying: d.ratings.qualifying ?? null,
        racePace: d.ratings.racePace ?? null,
        fit: circuitFit(d, circuit),
        thisYear: here ? { position: here.position, grid: here.grid, points: here.points } : null,
      };
    })
    .sort((a, b) => (b.racePace ?? 0) - (a.racePace ?? 0));
}

/**
 * Per-round pace trace. Grid and finishing position are real; the second-based
 * gaps a full timing feed would provide are not fabricated here.
 */
export function paceTrace(driverId) {
  return driverHistory(driverId).map((f) => ({
    round: f.round,
    name: f.circuitId,
    grid: f.grid,
    position: f.position,
    points: f.points,
    gained: f.grid != null && f.position != null ? f.grid - f.position : null,
    finished: f.finished,
  }));
}

export const POINTS_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
