import { request } from './fastf1';
import { normalizeTeam } from './normalize';

export async function getTeams() {
  const raw = await request('teams');
  return raw.map(normalizeTeam);
}

export async function getTeam(id) {
  const all = await getTeams();
  return all.find((t) => t.id === id) ?? null;
}
