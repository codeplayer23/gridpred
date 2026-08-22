import { request } from './fastf1';
import { normalizeRace } from './normalize';
import { parseUtc } from '@/lib/session';

export async function getRaces() {
  const raw = await request('calendar');
  return raw.map(normalizeRace);
}

export async function getRace(id) {
  const all = await getRaces();
  return all.find((r) => r.id === id) ?? null;
}

/** The next race is always computed from the schedule, never configured. */
export async function getNextRace(now = Date.now()) {
  const all = await getRaces();
  return all.find((r) => parseUtc(r.startsAt) > now) ?? all[all.length - 1];
}
