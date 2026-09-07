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
 * Constructor names differ between the results feed and the timing data — the
 * feed calls Racing Bulls "RB F1 Team" and Red Bull Racing simply "Red Bull".
 * A containment test is not safe here ("Red Bull" is a substring of nothing
 * useful, and "Bulls" appears in two different teams), so known divergences are
 * mapped explicitly and anything else falls back to distinctive-word matching.
 */
const CONSTRUCTOR_ALIASES = {
  rbfteam: 'racing-bulls',
  rb: 'racing-bulls',
  racingbulls: 'racing-bulls',
  redbull: 'red-bull-racing',
  redbullracing: 'red-bull-racing',
  alpinefteam: 'alpine',
  cadillacfteam: 'cadillac',
  haasfteam: 'haas-f1-team',
  astonmartin: 'aston-martin',
  kicksauber: 'audi',
  sauber: 'audi',
};

const GENERIC_TEAM_WORDS = new Set(['team', 'racing', 'f1', 'formula', 'one', 'the']);

const teamWords = (name) =>
  String(name ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !GENERIC_TEAM_WORDS.has(w));

/** Resolve a feed constructor name onto a GridPred team id. */
export function resolveConstructorId(name, teams) {
  const flat = String(name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!flat) return null;

  const exact = teams.find((t) => t.name.toLowerCase().replace(/[^a-z]/g, '') === flat);
  if (exact) return exact.id;

  if (CONSTRUCTOR_ALIASES[flat] && teams.some((t) => t.id === CONSTRUCTOR_ALIASES[flat])) {
    return CONSTRUCTOR_ALIASES[flat];
  }

  // distinctive-word overlap, ignoring "F1 Team" style filler
  const words = teamWords(name);
  let best = null;
  let bestScore = 0;
  teams.forEach((t) => {
    const own = teamWords(t.name);
    const score = words.filter((w) => own.includes(w)).length;
    if (score > bestScore) {
      best = t.id;
      bestScore = score;
    }
  });
  return bestScore > 0 ? best : null;
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
  const constructorMap = {};
  const constructorOrder = [];
  const unmatchedConstructors = [];
  (cList?.ConstructorStandings ?? []).forEach((row) => {
    const name = row.Constructor?.name ?? '';
    const id = resolveConstructorId(name, teams);
    const entry = {
      teamId: id,
      name,
      position: Number(row.position),
      points: Number(row.points),
      wins: Number(row.wins),
    };
    constructorOrder.push(entry);
    if (id) constructorMap[id] = entry;
    else unmatchedConstructors.push(name);
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

  // The published order, kept as a list. Building the table from this rather
  // than re-sorting snapshot rows means a single unmatched name can no longer
  // leave one row stale and scramble the standings around it.
  const driverOrder = dList.DriverStandings.map((row) => ({
    driverId: resolveDriver(row, index),
    surname: row.Driver?.familyName ?? null,
    firstName: row.Driver?.givenName ?? null,
    number: row.Driver?.permanentNumber ? Number(row.Driver.permanentNumber) : null,
    position: Number(row.position),
    points: Number(row.points),
    wins: Number(row.wins),
    constructorName: row.Constructors?.[row.Constructors.length - 1]?.name ?? null,
  }));

  return {
    round: Number(dList.round),
    drivers: driverMap,
    constructors: constructorMap,
    driverOrder,
    constructorOrder,
    unmatchedConstructors,
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

async function doGetTiming(path, attempt = 0) {
  const cached = cacheRead(`timing:${path}`);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${TIMING_BASE}/${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    // The timing API throttles aggressively. One backed-off retry recovers the
    // odd rejected request without hammering it further.
    if (res.status === 429 && attempt < 2) {
      clearTimeout(timer);
      await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
      return doGetTiming(path, attempt + 1);
    }
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

  // The last session of the meeting this entry belongs to. An entry list only
  // describes its own weekend, so knowing when that weekend ends is what lets a
  // caller tell a current field from a historical one.
  const meetingSessions = sessions.filter((s) => s.meeting_key === target.meeting_key);
  const lastSessionStart = meetingSessions
    .map((s) => new Date(s.date_start).getTime())
    .reduce((a, b) => Math.max(a, b), 0);

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
    meetingKey: target.meeting_key ?? null,
    /** When the final session of this weekend begins. */
    meetingEndsAt: lastSessionStart ? new Date(lastSessionStart).toISOString() : null,
    drivers: [...byNumber.values()],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Classification for one round.
 *
 * Used to fill in rounds run since the snapshot was generated, so form strips
 * and race pages show the real result rather than a projection.
 */
export async function fetchRoundResult(round, drivers) {
  const data = await get(`${round}/results/`);
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race?.Results?.length) return null;

  const index = indexDrivers(drivers);
  return {
    round: Number(race.round),
    event: race.raceName,
    date: race.date,
    circuitName: race.Circuit?.circuitName ?? null,
    results: race.Results.map((r) => {
      const status = r.status ?? '';
      const finished = status === 'Finished' || /^\+\d+ Lap/.test(status);
      return {
        driverId: resolveDriver(r, index),
        number: r.Driver?.permanentNumber ? Number(r.Driver.permanentNumber) : null,
        surname: r.Driver?.familyName ?? null,
        constructorName: r.Constructor?.name ?? null,
        position: Number(r.position),
        grid: r.grid != null ? Number(r.grid) : null,
        points: Number(r.points ?? 0),
        status,
        finished,
        laps: r.laps != null ? Number(r.laps) : null,
        time: r.Time?.time ?? null,
        fastestLap: r.FastestLap?.rank === '1',
      };
    }),
  };
}

/**
 * Every round run since `after`.
 *
 * Kept deliberately small: the snapshot already holds the season up to the
 * point it was built, so this only ever asks for the handful of rounds that
 * have happened since.
 */
export async function fetchResultsSince(after, latestRound, drivers, cap = 6) {
  const rounds = [];
  for (let r = after + 1; r <= latestRound && rounds.length < cap; r += 1) rounds.push(r);
  if (!rounds.length) return [];
  const settled = await Promise.all(rounds.map((r) => fetchRoundResult(r, drivers)));
  return settled.filter(Boolean);
}

/**
 * The published schedule.
 *
 * Calendars move: a round can be cancelled, rescheduled or relocated to another
 * circuit entirely. Comparing this against the bundled calendar is what lets the
 * interface say so instead of counting down to a race that is not happening.
 */
export async function fetchSchedule() {
  const data = await get('');
  const races = data?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races) || !races.length) return null;
  return races.map((r) => ({
    round: Number(r.round),
    name: r.raceName,
    date: r.date,
    time: r.time ?? null,
    startsAt: r.time ? `${r.date}T${r.time}` : `${r.date}T13:00:00Z`,
    circuitId: r.Circuit?.circuitId ?? null,
    circuitName: r.Circuit?.circuitName ?? null,
    locality: r.Circuit?.Location?.locality ?? null,
    country: r.Circuit?.Location?.country ?? null,
  }));
}

/**
 * Classification for a single timed session — practice, qualifying or sprint.
 * The results feed only publishes the Grand Prix, so this is the only way to
 * show what happened on a Friday.
 */
export async function fetchSessionResult(sessionKey) {
  const rows = await getTiming(`session_result?session_key=${sessionKey}`);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows
    .map((r) => ({
      position: r.position != null ? Number(r.position) : null,
      number: r.driver_number != null ? Number(r.driver_number) : null,
      laps: r.number_of_laps ?? null,
      duration: Array.isArray(r.duration) ? r.duration.at(-1) : r.duration,
      gap: Array.isArray(r.gap_to_leader) ? r.gap_to_leader.at(-1) : r.gap_to_leader,
      dnf: Boolean(r.dnf),
      dns: Boolean(r.dns),
      dsq: Boolean(r.dsq),
    }))
    .filter((r) => r.position != null)
    .sort((a, b) => a.position - b.position);
}

/** Every session of the most recent race weekend, with its classification. */
export async function fetchWeekendSessions(now = Date.now()) {
  const since = new Date(now - 45 * 86_400_000).toISOString().slice(0, 10);
  let sessions = await getTiming(
    `sessions?year=${SEASON}&${encodeURIComponent('date_start>=')}${since}`,
  );
  if (!Array.isArray(sessions) || !sessions.length) return null;

  const started = sessions
    .filter((s) => s.date_start && new Date(s.date_start).getTime() <= now)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
  if (!started.length) return null;

  const meetingKey = started[started.length - 1].meeting_key;
  const weekend = started
    .filter((s) => s.meeting_key === meetingKey)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

  // Sequential on purpose: firing a session's worth of requests at once earns a
  // 429 from the timing API, and a weekend is only ever a handful of sessions.
  const withResults = [];
  for (const s of weekend) {
    withResults.push({
      sessionKey: s.session_key,
      name: s.session_name,
      type: s.session_type ?? null,
      startedAt: s.date_start,
      location: s.location ?? null,
      // eslint-disable-next-line no-await-in-loop
      results: await fetchSessionResult(s.session_key),
    });
  }
  return { meetingKey, location: weekend[0]?.location ?? null, sessions: withResults };
}
