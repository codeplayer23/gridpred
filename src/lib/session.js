/**
 * Race-weekend session state, derived from the real session times in the
 * calendar and the current clock.
 *
 * FastF1 gives every session a UTC start. Durations are not published, so each
 * session is treated as live for a conventional window from its start — long
 * enough to cover the session, short enough not to overlap the next one. That
 * assumption is stated here rather than buried in a component.
 */
const DURATION_MINUTES = {
  'Practice 1': 70,
  'Practice 2': 70,
  'Practice 3': 70,
  'Sprint Qualifying': 55,
  'Sprint': 45,
  Qualifying: 65,
  Race: 135,
};

const DEFAULT_DURATION = 70;

/**
 * Parse a session timestamp as UTC.
 *
 * The upstream feed emits naive timestamps that are UTC by definition. A bare
 * `2026-08-22T10:00:00` is parsed by JavaScript as *local* time, which silently
 * shifts every session by the viewer's offset — so the marker is enforced here
 * rather than trusted.
 */
export function parseUtc(value) {
  if (!value) return NaN;
  const hasZone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`).getTime();
}

export function sessionWindow(session) {
  const start = parseUtc(session.dateUtc);
  const minutes = DURATION_MINUTES[session.name] ?? DEFAULT_DURATION;
  return { start, end: start + minutes * 60_000 };
}

/**
 * Classify every session of a race weekend against `now`.
 * @returns {{sessions:Array, live:object|null, next:object|null, allComplete:boolean}}
 */
export function weekendState(race, now = Date.now()) {
  const sessions = (race?.sessions ?? []).map((s) => {
    const { start, end } = sessionWindow(s);
    return {
      ...s,
      start,
      end,
      status: now < start ? 'upcoming' : now < end ? 'live' : 'complete',
    };
  });
  return {
    sessions,
    live: sessions.find((s) => s.status === 'live') ?? null,
    next: sessions.find((s) => s.status === 'upcoming') ?? null,
    allComplete: sessions.length > 0 && sessions.every((s) => s.status === 'complete'),
  };
}

/**
 * The window in which a race weekend is actually happening.
 *
 * Runs from the first session on track — free practice 1 — to the end of the
 * last, so "this weekend is under way" means a car could be running, not merely
 * that the results feed answered. Everything outside it is between weekends.
 */
export function weekendWindow(race) {
  const sessions = race?.sessions ?? [];
  if (!sessions.length) return null;
  const windows = sessions.map(sessionWindow).filter((w) => Number.isFinite(w.start));
  if (!windows.length) return null;
  return {
    start: Math.min(...windows.map((w) => w.start)),
    end: Math.max(...windows.map((w) => w.end)),
  };
}

/** True once free practice 1 has started and until the last session ends. */
export function weekendIsLive(race, now = Date.now()) {
  const w = weekendWindow(race);
  return Boolean(w) && now >= w.start && now <= w.end;
}

/** Short human label for how far away an instant is. */
export function relativeTime(target, now = Date.now()) {
  const diff = target - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return 'just now';
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const unit = mins < 60 ? `${mins}m` : hours < 48 ? `${hours}h` : `${days}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
}
