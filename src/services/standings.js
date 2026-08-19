import { request } from './fastf1';

export async function getDriverStandings() {
  return (await request('standings')).drivers;
}

export async function getConstructorStandings() {
  return (await request('standings')).constructors;
}

/** Season metadata: source, generation time, rounds completed. */
export async function getMeta() {
  return request('meta');
}
