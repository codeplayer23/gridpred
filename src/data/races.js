/**
 * The 2026 Formula 1 calendar, as published through FastF1.
 *
 * Nothing here is hand-maintained: rounds, session times, formats and the
 * sprint flag all come from the schedule FastF1 serves, so re-running the
 * extraction picks up calendar changes automatically.
 */
import calendar from './snapshot/calendar.json';
import meta from './snapshot/meta.json';
import { normalizeRace } from '@/services/normalize';
import { circuitById } from './circuits';

export const SEASON = meta.season;
export const SNAPSHOT = meta;

export const races = calendar
  .map(normalizeRace)
  .map((race) => {
    const circuit = circuitById[race.circuitId] ?? null;
    return {
      ...race,
      circuit,
      circuitName: circuit?.name ?? race.shortName,
      laps: circuit?.laps ?? null,
      trackLength: circuit?.trackLength ?? null,
      raceDistance: circuit?.raceDistance ?? null,
      cornerCount: circuit?.corners ?? circuit?.cornerCount ?? null,
    };
  })
  .sort((a, b) => a.round - b.round);

export const raceById = Object.fromEntries(races.map((r) => [r.id, r]));
export const getRace = (id) => raceById[id] ?? null;

/** The next race is derived from the schedule — never configured by hand. */
export function nextRace(now = Date.now()) {
  return races.find((r) => new Date(r.startsAt).getTime() > now) ?? races[races.length - 1];
}

export function completedRaces(now = Date.now()) {
  return races.filter((r) => new Date(r.startsAt).getTime() <= now);
}

export const sessionsFor = (race) => race?.sessions ?? [];
