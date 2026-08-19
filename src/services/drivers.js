/**
 * Driver service. Async surface over the FastF1 transport.
 * Pages currently read the bundled snapshot synchronously via `@/data/drivers`
 * for instant first paint; these functions are the path a live GridPred API
 * takes, and both run through the same normalisers.
 */
import { request } from './fastf1';
import { normalizeDriver } from './normalize';

export async function getDrivers() {
  const raw = await request('drivers');
  return raw.map(normalizeDriver);
}

export async function getDriver(id) {
  const all = await getDrivers();
  return all.find((d) => d.id === id) ?? null;
}

export async function getDriversByTeam(teamId) {
  const all = await getDrivers();
  return all.filter((d) => d.team === teamId);
}
