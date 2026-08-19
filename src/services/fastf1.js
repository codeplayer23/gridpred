/**
 * FastF1 transport layer.
 *
 * Every piece of Formula 1 data in GridPred enters through this module. Today it
 * resolves against a snapshot generated from FastF1 at build time (see
 * `tools/extract_fastf1.py`); pointing `VITE_GRIDPRED_API` at a running GridPred
 * API switches the whole app to live data without touching a component.
 *
 *     GridPred UI  ->  services/*  ->  services/fastf1.js  ->  snapshot | API
 *
 * The snapshot and the API deliberately return the *same* shapes, so the
 * normalisers in the sibling service modules are the single definition of what
 * a driver, a circuit or a result looks like anywhere in the product.
 */

const API_BASE = import.meta.env?.VITE_GRIDPRED_API ?? '';
export const MODE = API_BASE ? 'live' : 'snapshot';

/** Resources the snapshot bundles. Kept small; telemetry is fetched per circuit. */
const loaders = {
  calendar: () => import('@/data/snapshot/calendar.json'),
  circuits: () => import('@/data/snapshot/circuits.json'),
  drivers: () => import('@/data/snapshot/drivers.json'),
  teams: () => import('@/data/snapshot/teams.json'),
  results: () => import('@/data/snapshot/results.json'),
  standings: () => import('@/data/snapshot/standings.json'),
  meta: () => import('@/data/snapshot/meta.json'),
};

const cache = new Map();

/**
 * Fetch a resource.
 * @param {keyof loaders} resource
 * @returns {Promise<any>}
 */
export async function request(resource) {
  if (cache.has(resource)) return cache.get(resource);

  const promise = (async () => {
    if (MODE === 'live') {
      const res = await fetch(`${API_BASE}/${resource}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`GridPred API ${resource}: ${res.status}`);
      return res.json();
    }
    const mod = await loaders[resource]();
    return mod.default ?? mod;
  })();

  cache.set(resource, promise);
  return promise;
}

/**
 * Per-circuit telemetry: speed trace and racing line.
 * Held out of the main payload because it is by far the heaviest data in the
 * product and only ever needed once a specific circuit is on screen.
 */
export async function requestTelemetry(circuitId) {
  const key = `telemetry:${circuitId}`;
  if (cache.has(key)) return cache.get(key);

  const promise = (async () => {
    if (MODE === 'live') {
      const res = await fetch(`${API_BASE}/telemetry/${circuitId}`);
      if (!res.ok) throw new Error(`GridPred API telemetry: ${res.status}`);
      return res.json();
    }
    try {
      const mod = await import(`../data/snapshot/telemetry/${circuitId}.json`);
      return mod.default ?? mod;
    } catch {
      return null;
    }
  })();

  cache.set(key, promise);
  return promise;
}

/** Drop cached responses — used when switching data sources. */
export function invalidate() {
  cache.clear();
}
