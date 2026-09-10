/**
 * Circuits — real geometry, real corner positions.
 *
 * Layouts are not drawn by hand and not generated. Each outline is the path a
 * Formula 1 car actually took, reconstructed from the position telemetry of a
 * representative fast lap, and each corner marker sits where FastF1's circuit
 * information places that corner. `geometrySource` on every layout records the
 * exact session and driver the geometry came from.
 *
 * One circuit is drawn from a different real source. The Madring is new for
 * 2026 and has never hosted a session, so there is no telemetry to reconstruct;
 * its outline is the surveyed centreline from the circuit's OpenStreetMap route
 * relation (ODbL 1.0). Everything telemetry alone can give — corner numbering,
 * the start/finish line, speed and throttle figures — is absent rather than
 * invented, and stays absent until a car runs there.
 */
import raw from './snapshot/circuits.json';
import { normalizeCircuit } from '@/services/normalize';

export const circuits = Object.values(raw).map(normalizeCircuit);
export const circuitById = Object.fromEntries(circuits.map((c) => [c.id, c]));
export const getCircuit = (id) => circuitById[id] ?? null;

/** Circuits whose geometry we actually have. */
export const circuitsWithLayout = circuits.filter((c) => c.layout);

/** True when the outline came from telemetry rather than a surveyed centreline. */
export const isTelemetryLayout = (circuit) =>
  Boolean(circuit?.layout) && circuit.layout.source?.provider !== 'OpenStreetMap';

/**
 * One line naming where a circuit's outline actually came from.
 *
 * Every layout in GridPred is real, but they are not all real in the same way,
 * and the difference is worth stating rather than papering over.
 */
export function layoutProvenance(circuit) {
  const source = circuit?.layout?.source;
  if (!source) return 'Circuit layout not yet available';
  if (source.provider === 'OpenStreetMap') {
    return 'Centreline from OpenStreetMap — no session has run here yet';
  }
  return `Layout measured from ${source.driver ?? 'a race lap'} at the ${source.year} race`;
}

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
