/**
 * Telemetry service.
 *
 * This is the one genuinely lazy data path in GridPred: speed traces and racing
 * lines are large and only needed once a specific circuit is on screen, so they
 * are fetched per circuit rather than bundled into the initial payload.
 *
 * The returned shape is what `<TrackTelemetry />` consumes, and is the shape a
 * live FastF1 backend should serve for real lap telemetry.
 */
import { requestTelemetry } from './fastf1';

/**
 * @param {string} circuitId
 * @returns {Promise<{speedTrace: Array, racingLine: Array, source: object}|null>}
 */
export async function getTelemetry(circuitId) {
  if (!circuitId) return null;
  const raw = await requestTelemetry(circuitId);
  if (!raw) return null;
  return {
    circuitId,
    speedTrace: raw.speedTrace ?? [],
    racingLine: raw.racingLine ?? [],
    source: raw.source ?? null,
  };
}
