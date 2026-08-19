/**
 * Circuits — real geometry, real corner positions.
 *
 * Layouts are not drawn by hand and not generated. Each outline is the path a
 * Formula 1 car actually took, reconstructed from the position telemetry of a
 * representative fast lap, and each corner marker sits where FastF1's circuit
 * information places that corner. `geometrySource` on every layout records the
 * exact session and driver the geometry came from.
 *
 * One circuit has no layout: the Madring is new for 2026 and has never hosted a
 * session, so there is nothing real to draw. It is surfaced as unavailable
 * rather than filled in with an invented shape.
 */
import raw from './snapshot/circuits.json';
import { normalizeCircuit } from '@/services/normalize';

export const circuits = Object.values(raw).map(normalizeCircuit);
export const circuitById = Object.fromEntries(circuits.map((c) => [c.id, c]));
export const getCircuit = (id) => circuitById[id] ?? null;

/** Circuits whose geometry we actually have. */
export const circuitsWithLayout = circuits.filter((c) => c.layout);

/** Real, telemetry-measured character of a circuit. Never estimated. */
export function circuitCharacter(circuit) {
  const m = circuit?.measurements;
  if (!m) return null;
  return [
    { key: 'maxSpeed', label: 'Top speed', value: m.maxSpeed, suffix: ' km/h', max: 380 },
    { key: 'avgSpeed', label: 'Average speed', value: m.avgSpeed, suffix: ' km/h', max: 280 },
    { key: 'fullThrottlePct', label: 'Full throttle', value: m.fullThrottlePct, suffix: '%', max: 100 },
    { key: 'brakingPct', label: 'Braking', value: m.brakingPct, suffix: '%', max: 40 },
  ];
}
