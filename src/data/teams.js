/**
 * Constructors for the 2026 season.
 * Names, colours and points all originate from FastF1 session results.
 */
import raw from './snapshot/teams.json';
import { normalizeTeam } from '@/services/normalize';

export const teams = raw.map(normalizeTeam);
export const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
export const getTeam = (id) => teamById[id] ?? teams[0];
export const teamStats = (id) => teamById[id] ?? null;
export const constructorStandings = [...teams].sort((a, b) => a.position - b.position);
