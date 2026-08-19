import { request } from './fastf1';
import { normalizeResult } from './normalize';

export async function getRounds() {
  const raw = await request('results');
  return raw.map((r) => ({ ...r, results: r.results.map(normalizeResult) }));
}

export async function getRoundResult(circuitId) {
  const rounds = await getRounds();
  return rounds.find((r) => r.circuitId === circuitId) ?? null;
}

export async function getDriverForm(driverId, count = 10) {
  const rounds = await getRounds();
  return rounds
    .flatMap((r) => r.results.filter((x) => x.driverId === driverId).map((x) => ({ ...x, round: r.round, circuitId: r.circuitId, event: r.event })))
    .slice(-count);
}
