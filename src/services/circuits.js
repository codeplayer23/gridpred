import { request } from './fastf1';
import { normalizeCircuit } from './normalize';

export async function getCircuits() {
  const raw = await request('circuits');
  return Object.values(raw).map(normalizeCircuit);
}

export async function getCircuit(id) {
  const raw = await request('circuits');
  return raw[id] ? normalizeCircuit(raw[id]) : null;
}
