/**
 * Shape definitions.
 *
 * These normalisers are the single place in GridPred where the structure of a
 * driver, team, race, circuit or result is decided. Both the bundled FastF1
 * snapshot and a future live GridPred API pass through them, so a component can
 * never depend on where its data came from.
 */

export const slug = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** @returns {{id,name,abbreviation,number,team,teamName,teamColor,...}} */
export function normalizeDriver(raw) {
  return {
    id: raw.id,
    name: raw.fullName,
    firstName: raw.firstName,
    lastName: raw.lastName,
    abbreviation: raw.abbreviation,
    number: raw.number,
    team: raw.teamId,
    teamName: raw.teamName,
    teamColor: raw.teamColor,
    nationality: raw.nationality ?? null,
    countryCode: raw.countryCode ?? null,
    flag: raw.flag ?? null,
    /**
     * Imagery is NOT taken from the snapshot. It is resolved from the canonical
     * asset registry in data/driverAssets.js, which is the only place in the
     * app that holds an image URL. See data/drivers.js.
     */
    position: raw.position,
    points: raw.points,
    wins: raw.wins,
    podiums: raw.podiums,
    poles: raw.poles,
    fastestLaps: raw.fastestLaps,
    dnfs: raw.dnfs,
    starts: raw.starts,
    bestFinish: raw.bestFinish ?? null,
    avgFinish: raw.avgFinish ?? null,
    avgGrid: raw.avgGrid ?? null,
    finishRate: raw.finishRate ?? null,
    form: raw.form ?? [],
    /** 0-100 model-facing capability scores. Derived, see services/ratings.js */
    ratings: raw.ratings ?? {},
    isSubstitute: raw.isSubstitute ?? false,
    note: raw.note ?? null,
  };
}

export function normalizeTeam(raw) {
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.fullName ?? raw.name,
    abbreviation: raw.abbreviation,
    color: raw.color,
    accent: raw.color,
    drivers: raw.drivers ?? [],
    position: raw.position,
    points: raw.points,
    wins: raw.wins,
    podiums: raw.podiums,
    poles: raw.poles,
    fastestLaps: raw.fastestLaps ?? 0,
    dnfs: raw.dnfs ?? 0,
    powerUnit: raw.powerUnit ?? null,
    avgGridRaw: raw.avgGrid ?? null,
    qualifyingPace: raw.qualifyingPace ?? null,
    racePace: raw.racePace ?? null,
    avgGrid: raw.avgGrid ?? null,
    avgFinish: raw.avgFinish ?? null,
  };
}

export function normalizeRace(raw) {
  return {
    id: raw.id,
    round: raw.round,
    name: raw.eventName,
    officialName: raw.officialName,
    shortName: raw.location,
    country: raw.country,
    city: raw.location,
    date: raw.eventDate,
    startsAt: raw.raceSessionUtc ?? `${raw.eventDate}T13:00:00Z`,
    format: raw.format,
    isSprint: raw.isSprint,
    sessions: raw.sessions ?? [],
    circuitId: raw.circuitId ?? raw.id,
    completed: raw.raced,
  };
}

export function normalizeCircuit(raw) {
  const g = raw.geometry ?? null;
  const measured =
    g != null &&
    [g.maxSpeed, g.avgSpeed, g.fullThrottlePct, g.brakingPct].some((v) => v != null);
  return {
    id: raw.id,
    name: raw.name ?? raw.location,
    shortName: raw.shortName ?? raw.location,
    location: raw.location,
    country: raw.country ?? null,
    trackLength: raw.trackLength ?? null,
    laps: raw.laps ?? null,
    raceDistance: raw.raceDistance ?? null,
    // Marked corners when the geometry carries them, otherwise the official
    // count. A layout can have an outline and an empty corner list — the
    // Madring's centreline comes from OpenStreetMap, which has no corner
    // numbering — so an empty array must not read as "zero corners".
    corners: g?.corners?.length || raw.cornerCount || null,
    /** The published turn count, kept separate so it can corroborate the markers. */
    officialCorners: raw.cornerCount ?? null,
    /**
     * Real geometry, or null. Usually reconstructed from car position
     * telemetry; where no session has ever run, a surveyed centreline.
     * Zone overlays (full throttle, braking, DRS) are NOT here — they ship with
     * the lazily-loaded telemetry payload, see services/telemetry.js.
     */
    layout: g
      ? {
          outline: g.outline,
          corners: g.corners,
          startFinish: g.startFinish,
          rotation: g.rotation,
          lapDistance: g.lapDistance,
          source: g.geometrySource,
        }
      : null,
    unavailableReason: raw.geometryUnavailable ?? null,
    /**
     * Speed and throttle figures, which only telemetry can supply. Having an
     * outline does not imply having these: a circuit drawn from a centreline
     * has every figure null, and null here is what makes the UI say "not
     * measured" instead of showing a confident zero.
     */
    measurements: measured
      ? {
          maxSpeed: g.maxSpeed,
          avgSpeed: g.avgSpeed,
          fullThrottlePct: g.fullThrottlePct,
          brakingPct: g.brakingPct,
          lapDistance: g.lapDistance,
        }
      : null,
  };
}

export function normalizeResult(raw) {
  return {
    driverId: raw.driverId,
    teamId: raw.teamId,
    position: raw.position,
    gridPosition: raw.grid,
    points: raw.points,
    status: raw.status,
    classified: raw.status === 'Finished' || String(raw.status ?? '').startsWith('+'),
    time: raw.time ?? null,
    fastestLap: raw.fastestLap ?? false,
  };
}
