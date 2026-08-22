/**
 * Live season client.
 *
 * The bundled snapshot is generated at build time and goes stale the moment
 * another Grand Prix is run. This module pulls the current championship from a
 * public, CORS-enabled mirror of the F1 results API so a deployed GridPred stays
 * accurate without a rebuild.
 *
 * It is strictly an *upgrade path*: every call fails soft. If the network is
 * unavailable, slow, or the response is malformed, callers keep the snapshot
 * they already rendered. Nothing here is on the critical path for first paint.
 */

const BASE = import.meta.env?.VITE_LIVE_API ?? 'https://api.jolpi.ca/ergast/f1';
const SEASON = 2026;
const TIMEOUT_MS = 8000;

/**
 * Short-lived response cache, persisted for the tab.
 *
 * These are public, shared, rate-limited endpoints and the answers change at
 * most a few times a day. Without this, every full page load re-asks for the
 * same session list and the upstream starts returning 429 — which degrades
 * correctly, but pointlessly.
 */
const CACHE_TTL_MS = 10 * 60_000;

function cacheRead(key) {
  try {
    const raw = sessionStorage.getItem(`gridpred:${key}`);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

function cacheWrite(key, value) {
  try {
    sessionStorage.setItem(`gridpred:${key}`, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* private mode or quota — the network path still works */
  }
}

/**
 * In-flight request cache. React invokes effects twice in development, and a
 * focus event can land while a scheduled refresh is still running; without this
 * the same endpoint is fetched more than once for no benefit.
 */
const inFlight = new Map();

/** Fetch JSON with a hard timeout; resolves to null rather than throwing. */
function get(path) {
  if (inFlight.has(path)) return inFlight.get(path);
  const promise = doGet(path).finally(() => inFlight.delete(path));
  inFlight.set(path, promise);
  return promise;
}

async function doGet(path) {
  const cached = cacheRead(path);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${SEASON}/${path}?format=json`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    cacheWrite(path, json);
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The API identifies drivers by its own id and by surname. GridPred keys on a
 * slug of the full name, so matching is done on the permanent car number first
 * — which is stable and unique — then on surname as a fallback.
 */
function indexDrivers(drivers) {
  const byNumber = new Map();
  const bySurname = new Map();
  drivers.forEach((d) => {
    if (d.number != null) byNumber.set(String(d.number), d.id);
    bySurname.set(d.lastName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), d.id);
  });
  return { byNumber, bySurname };
}

function resolveDriver(entry, index) {
  const num = entry.Driver?.permanentNumber;
  if (num && index.byNumber.has(String(num))) return index.byNumber.get(String(num));
  const surname = (entry.Driver?.familyName ?? '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return index.bySurname.get(surname) ?? null;
}

/**
 * Current driver + constructor standings.
 * @param {Array} drivers snapshot drivers, used to map API rows onto our ids
 * @param {Array} teams   snapshot teams, matched on name
 * @returns {Promise<{round:number, drivers:object, constructors:object, fetchedAt:string}|null>}
 */
export async function fetchStandings(drivers, teams) {
  const [ds, cs] = await Promise.all([
    get('driverstandings/'),
    get('constructorstandings/'),
  ]);
  const dList = ds?.MRData?.StandingsTable?.StandingsLists?.[0];
  if (!dList) return null;

  const index = indexDrivers(drivers);
  const driverMap = {};
  dList.DriverStandings.forEach((row) => {
    const id = resolveDriver(row, index);
    if (!id) return;
    driverMap[id] = {
      position: Number(row.position),
      points: Number(row.points),
      wins: Number(row.wins),
      // The constructor a driver is scoring for *now*. This is what makes a
      // mid-season move visible: their portrait and logo resolve from it.
      constructorName: row.Constructors?.[row.Constructors.length - 1]?.name ?? null,
    };
  });

  const cList = cs?.MRData?.StandingsTable?.StandingsLists?.[0];
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const teamByName = new Map(teams.map((t) => [norm(t.name), t.id]));
  const constructorMap = {};
  (cList?.ConstructorStandings ?? []).forEach((row) => {
    const name = norm(row.Constructor?.name ?? '');
    // the API uses short constructor names; match on containment both ways
    const id =
      teamByName.get(name) ??
      teams.find((t) => norm(t.name).includes(name) || name.includes(norm(t.name)))?.id;
    if (!id) return;
    constructorMap[id] = {
      position: Number(row.position),
      points: Number(row.points),
      wins: Number(row.wins),
    };
  });

  // Anyone the feed knows about who is not in the bundled snapshot — a
  // late signing, a reserve stepping in — so the grid can grow without a rebuild.
  const known = new Set(drivers.map((d) => d.id));
  const unknown = dList.DriverStandings
    .filter((row) => !resolveDriver(row, index))
    .map((row) => ({
      firstName: row.Driver?.givenName ?? '',
      lastName: row.Driver?.familyName ?? '',
      number: row.Driver?.permanentNumber ? Number(row.Driver.permanentNumber) : null,
      code: row.Driver?.code ?? null,
      nationality: row.Driver?.nationality ?? null,
      constructorName: row.Constructors?.[row.Constructors.length - 1]?.name ?? null,
      position: Number(row.position),
      points: Number(row.points),
      wins: Number(row.wins),
    }));

  return {
    round: Number(dList.round),
    drivers: driverMap,
    constructors: constructorMap,
    unknownDrivers: unknown,
    knownCount: known.size,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * The entry list for the race weekend in progress.
 *
 * Championship standings say who has scored what; they do NOT say who is
 * actually driving this weekend. A driver stood down through injury keeps their
 * points and their standings position, and their replacement appears in no
 * standings table at all — so substitutions are invisible to the standings feed
 * and have to come from the session entry.
 *
 * The most recently *started* session is used, because that is the last point at
 * which the field was actually confirmed.
 */
const TIMING_BASE = import.meta.env?.VITE_TIMING_API ?? 'https://api.openf1.org/v1';

const timingInFlight = new Map();

function getTiming(path) {
  if (timingInFlight.has(path)) return timingInFlight.get(path);
  const promise = doGetTiming(path).finally(() => timingInFlight.delete(path));
  timingInFlight.set(path, promise);
  return promise;
}

async function doGetTiming(path) {
  const cached = cacheRead(`timing:${path}`);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${TIMING_BASE}/${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    cacheWrite(`timing:${path}`, json);
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchEntryList(now = Date.now()) {
  // Narrow the window before asking for the whole season: the full session list
  // is a large payload to fetch on a page that is already loading a grid's
  // worth of portraits, and only the most recent weekend matters here.
  const since = new Date(now - 45 * 86_400_000).toISOString().slice(0, 10);
  let sessions = await getTiming(
    `sessions?year=${SEASON}&${encodeURIComponent('date_start>=')}${since}`,
  );
  if (!Array.isArray(sessions) || !sessions.length) {
    sessions = await getTiming(`sessions?year=${SEASON}`);
  }
  if (!Array.isArray(sessions) || !sessions.length) return null;

  const started = sessions
    .filter((s) => s.date_start && new Date(s.date_start).getTime() <= now)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  const target = started.length
    ? started[started.length - 1]
    : sessions.reduce((a, b) => (new Date(a.date_start) < new Date(b.date_start) ? a : b));
  if (!target?.session_key) return null;

  const rows = await getTiming(`drivers?session_key=${target.session_key}`);
  if (!Array.isArray(rows) || !rows.length) return null;

  // one row per car; the feed can repeat a driver across a session
  const byNumber = new Map();
  rows.forEach((r) => {
    if (r.driver_number == null) return;
    byNumber.set(Number(r.driver_number), {
      number: Number(r.driver_number),
      firstName: r.first_name ?? '',
      lastName: r.last_name ?? '',
      fullName: r.full_name ?? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      abbreviation: r.name_acronym ?? null,
      teamName: r.team_name ?? null,
      teamColour: r.team_colour ? `#${r.team_colour}` : null,
    });
  });

  return {
    sessionKey: target.session_key,
    sessionName: target.session_name ?? null,
    location: target.location ?? null,
    startedAt: target.date_start ?? null,
    drivers: [...byNumber.values()],
    fetchedAt: new Date().toISOString(),
  };
}

/** Result of the most recently completed round. */
export async function fetchLastResult() {
  const data = await get('last/results/');
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return null;
  return {
    round: Number(race.round),
    name: race.raceName,
    date: race.date,
    podium: (race.Results ?? []).slice(0, 3).map((r) => ({
      position: Number(r.position),
      surname: r.Driver?.familyName,
      number: r.Driver?.permanentNumber,
      constructor: r.Constructor?.name,
    })),
  };
}
