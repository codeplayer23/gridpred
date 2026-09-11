import { useEffect, useMemo, useState } from 'react';
import {
  fetchStandings,
  fetchEntryList,
  fetchResultsSince,
  fetchSeasonResults,
  fetchSchedule,
} from '@/services/live';
import { drivers as snapshotDrivers } from '@/data/drivers';
import { teams as snapshotTeams } from '@/data/teams';
import { standingsById as snapshotStandings } from '@/data/results';
import { SNAPSHOT, races as snapshotRaces } from '@/data/races';
import { deriveDriverCode } from '@/data/driverAssets';
import { LiveSeasonContext } from './liveSeasonContext';
import { useNow } from '@/hooks/useNow';

/**
 * Live season overlay.
 *
 * GridPred renders the bundled snapshot immediately — no spinner, no layout
 * shift — then upgrades it from two independent feeds:
 *
 *   standings  who has scored what, so the championship stays correct as
 *              rounds are run;
 *   entry list who is actually driving this weekend, which the standings
 *              cannot tell you. A driver stood down through injury keeps their
 *              points and their standings place, and their stand-in appears in
 *              no standings table at all, so substitutions are only visible in
 *              the session entry.
 *
 * Both fail soft. If either request fails the snapshot simply stands.
 */
const REFRESH_MS = 5 * 60_000;

const norm = (x) => String(x ?? '').toLowerCase().replace(/[^a-z]/g, '');

/** Words that appear in half the circuit names on the calendar and identify nothing. */
const GENERIC_VENUE_WORDS = new Set([
  'circuit', 'international', 'grand', 'prix', 'raceway', 'autodromo', 'autodrome',
  'racing', 'course', 'park', 'street', 'speedway', 'motorsport', 'the', 'de', 'du',
  'city', 'national', 'ring', 'auto', 'club',
]);

const venueTokens = (...parts) =>
  new Set(
    parts
      .flatMap((p) =>
        String(p ?? '')
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .split(/[^a-z]+/),
      )
      .filter((w) => w.length > 3 && !GENERIC_VENUE_WORDS.has(w)),
  );

/** Do two calendar entries describe the same venue? */
function sameVenue(race, published) {
  const a = venueTokens(race.circuit?.name, race.circuitName, race.shortName, race.city);
  const b = venueTokens(published.circuitName, published.locality);
  if (!a.size || !b.size) return true; // not enough to judge — assume unchanged
  for (const token of a) if (b.has(token)) return true;
  return false;
}
const slugify = (x) =>
  String(x ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function LiveSeasonProvider({ children }) {
  const [live, setLive] = useState(null);
  const [entry, setEntry] = useState(null);
  const [rounds, setRounds] = useState(null); // published rounds, newest data wins
  const [schedule, setSchedule] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | syncing | live | offline
  // A minute-resolution clock, so "is this weekend still live" re-evaluates as
  // time passes rather than being frozen at first render.
  const now = useNow(60_000);

  useEffect(() => {
    let cancelled = false;

    /** Fold newly fetched rounds in, letting the fresher copy of a round win. */
    const mergeRounds = (incoming) => {
      setRounds((prev) => {
        const byRound = new Map((prev ?? []).map((r) => [r.round, r]));
        for (const r of incoming) byRound.set(r.round, r);
        return [...byRound.values()].sort((a, b) => a.round - b.round);
      });
    };

    const sync = async () => {
      if (!cancelled) setStatus((s) => (s === 'live' ? 'live' : 'syncing'));

      const [standings, entryList, published] = await Promise.all([
        fetchStandings(snapshotDrivers, snapshotTeams),
        fetchEntryList(Date.now()),
        fetchSchedule(),
      ]);
      if (cancelled) return;

      if (standings) setLive(standings);
      if (entryList) setEntry(entryList);
      if (published) setSchedule(published);
      setStatus(standings || entryList || published ? 'live' : 'offline');

      // The cheap path: only the rounds run since the snapshot was built.
      if (standings?.round > SNAPSHOT.roundsCompleted) {
        const fresh = await fetchResultsSince(
          SNAPSHOT.roundsCompleted,
          standings.round,
          snapshotDrivers,
        );
        if (!cancelled && fresh.length) mergeRounds(fresh);
      }
    };

    /**
     * Re-read the whole season once, so a revised classification reaches the UI.
     *
     * The incremental sync above cannot: it only asks for rounds after the
     * snapshot, and a steward's decision rewrites a round that is already in it.
     * This costs a few requests, so it runs once rather than on the interval.
     */
    const revise = async () => {
      const season = await fetchSeasonResults(snapshotDrivers);
      if (!cancelled && season?.length) mergeRounds(season);
    };

    sync();
    revise();
    const timer = setInterval(sync, REFRESH_MS);
    const onFocus = () => sync();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const value = useMemo(() => {
    const snapshotRound = SNAPSHOT.roundsCompleted;
    const liveRound = live?.round ?? null;

    const teamByName = new Map(snapshotTeams.map((t) => [norm(t.name), t.id]));
    const resolveTeam = (name) => {
      if (!name) return null;
      const n = norm(name);
      return (
        teamByName.get(n) ??
        snapshotTeams.find((t) => norm(t.name).includes(n) || n.includes(norm(t.name)))?.id ??
        null
      );
    };

    // ── who is driving this weekend ───────────────────────────────────────
    const byNumber = new Map(snapshotDrivers.map((d) => [d.number, d]));
    const entryTeams = {}; // driverId -> teamId for this weekend
    const substitutes = []; // driverId, racing for a team that is not theirs
    const newcomers = []; // in the entry but absent from the snapshot entirely
    const entered = new Set();

    // A driver the snapshot has never seen may still have scored. The standings
    // feed lists them as unmatched, keyed by racing number, so their
    // championship row is recovered here rather than left at zero.
    const unknownStandings = new Map(
      (live?.unknownDrivers ?? []).filter((u) => u.number != null).map((u) => [u.number, u]),
    );

    (entry?.drivers ?? []).forEach((row) => {
      const teamId = resolveTeam(row.teamName);
      const known = byNumber.get(row.number);
      if (known) {
        entered.add(known.id);
        if (teamId) {
          entryTeams[known.id] = teamId;
          if (teamId !== known.team) substitutes.push(known.id);
        }
        return;
      }
      if (!teamId) return;
      const id = slugify(row.fullName || `${row.firstName} ${row.lastName}`);
      const standing = unknownStandings.get(row.number) ?? null;
      newcomers.push({
        id,
        name: `${row.firstName} ${row.lastName}`.trim() || row.fullName,
        firstName: row.firstName,
        lastName: row.lastName,
        abbreviation: row.abbreviation,
        number: row.number,
        team: teamId,
        teamName: row.teamName,
        teamColor: row.teamColour,
        nationality: null,
        flag: null,
        // no races for this team yet, so no derived ratings exist
        ratings: {},
        ratingSamples: {},
        points: standing?.points ?? 0,
        wins: standing?.wins ?? 0,
        podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0,
        starts: 0, sprintPoints: 0, form: [],
        avgFinish: null, avgGrid: null, bestFinish: null, finishRate: null,
        position: standing?.position ?? null,
        assetCode: deriveDriverCode(row.firstName, row.lastName),
        assetSource: 'formula1',
        isSubstitute: true,
      });
    });

    // An entry list only describes the weekend it belongs to. Between races the
    // most recent one is history, not a forecast: treating it as current would
    // hide a driver who sat out the last round but is racing the next. So
    // absences only apply while that weekend is still the live one.
    // The weekend is live until its final session has run (plus enough time for
    // that session to finish). After that the entry is a record of a race that
    // has happened, not a description of who is racing next.
    const RACE_LENGTH_MS = 3 * 3_600_000;
    const weekendEnds = entry?.meetingEndsAt
      ? new Date(entry.meetingEndsAt).getTime() + RACE_LENGTH_MS
      : null;
    const entryIsCurrent = weekendEnds != null && now < weekendEnds;

    const absent = entryIsCurrent
      ? snapshotDrivers.filter((d) => !entered.has(d.id)).map((d) => d.id)
      : [];

    // ── championship team moves (permanent, from standings) ───────────────
    const teamChanges = {};
    if (live?.drivers) {
      snapshotDrivers.forEach((d) => {
        const teamId = resolveTeam(live.drivers[d.id]?.constructorName);
        if (teamId && teamId !== d.team) teamChanges[d.id] = teamId;
      });
    }

    // ── calendar drift ────────────────────────────────────────────────────
    // A round can be cancelled, moved, or relocated to a different circuit.
    // Comparing the published schedule against the bundled one is what lets the
    // interface say so rather than counting down to a race that is not running.
    const scheduleChanges = [];
    if (schedule) {
      const publishedByRound = new Map(schedule.map((r) => [r.round, r]));
      snapshotRaces.forEach((race) => {
        const pub = publishedByRound.get(race.round);
        if (!pub) {
          scheduleChanges.push({ type: 'removed', round: race.round, name: race.name });
          return;
        }
        // A one-day difference is a timezone artefact, not a reschedule: a late
        // night race such as Las Vegas has a local date one day behind its UTC
        // date, and the two feeds disagree about which to publish. A genuine
        // move is measured in weeks.
        const drift = Math.round(
          Math.abs(new Date(`${pub.date}T12:00:00Z`) - new Date(`${race.date}T12:00:00Z`)) / 86_400_000,
        );
        if (drift >= 2) {
          scheduleChanges.push({
            type: 'rescheduled', round: race.round, name: race.name,
            from: race.date, to: pub.date, startsAt: pub.startsAt,
          });
        }
        // Venue names differ harmlessly between sources — "Albert Park Circuit"
        // against "Albert Park Grand Prix Circuit" is the same track. Only treat
        // it as a relocation when neither the circuit names nor the towns share
        // a meaningful word.
        if (!sameVenue(race, pub)) {
          scheduleChanges.push({
            type: 'relocated', round: race.round, name: race.name,
            from: race.circuitName, to: pub.circuitName, locality: pub.locality,
          });
        }
      });
      const knownRounds = new Set(snapshotRaces.map((r) => r.round));
      schedule.forEach((pub) => {
        if (!knownRounds.has(pub.round)) {
          scheduleChanges.push({ type: 'added', round: pub.round, name: pub.name, startsAt: pub.startsAt });
        }
      });
    }

    // ── rounds run since the snapshot ─────────────────────────────────────
    const freshRounds = rounds ?? [];
    const resultsByRound = Object.fromEntries(freshRounds.map((r) => [r.round, r]));
    const roundByCircuit = Object.fromEntries(
      snapshotRaces.map((r) => [r.round, r.circuitId ?? r.id]),
    );
    /**
     * Season counts recomputed from the rounds actually run.
     *
     * The snapshot's per-driver aggregates are frozen at the round it was built
     * on, and the standings feed only corrects points, position and wins. That
     * left everything else — podiums, starts, poles, retirements — two rounds
     * behind, so a driver who stood on the podium last Sunday still showed the
     * count from a fortnight ago. These are counted from each driver's bundled
     * form with the published rounds laid over it, so they move with the season
     * instead of with the build.
     */
    const seasonCounts = {};
    for (const d of snapshotDrivers) {
      const byRound = new Map((d.form ?? []).map((f) => [f.round, f]));
      for (const r of freshRounds) {
        const row = r.results.find((x) => x.driverId === d.id);
        if (!row) continue;
        byRound.set(r.round, {
          round: r.round,
          position: row.position,
          grid: row.grid,
          points: row.points,
          finished: row.finished,
          fastestLap: row.fastestLap,
        });
      }

      const rounds = [...byRound.values()];
      const scored = rounds.filter((f) => f.finished && f.position);
      const positions = scored.map((f) => f.position);
      const grids = rounds.map((f) => f.grid).filter(Boolean);
      const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      const gained = rounds
        .filter((f) => f.finished && f.grid && f.position)
        .map((f) => f.grid - f.position);

      seasonCounts[d.id] = {
        starts: rounds.length,
        wins: positions.filter((p) => p === 1).length,
        podiums: positions.filter((p) => p <= 3).length,
        poles: rounds.filter((f) => f.grid === 1).length,
        fastestLaps: rounds.filter((f) => f.fastestLap).length,
        dnfs: rounds.filter((f) => !(f.finished && f.position)).length,
        bestFinish: positions.length ? Math.min(...positions) : null,
        avgFinish: positions.length ? Number(mean(positions).toFixed(2)) : null,
        avgGrid: grids.length ? Number(mean(grids).toFixed(2)) : null,
        finishRate: rounds.length
          ? Math.round((100 * scored.length) / rounds.length)
          : null,
        avgPositionsGained: gained.length ? Number(mean(gained).toFixed(2)) : null,
      };
    }

    const resultsByCircuit = Object.fromEntries(
      freshRounds.map((r) => [roundByCircuit[r.round] ?? String(r.round), r]),
    );

    return {
      status,
      round: liveRound,
      snapshotRound,
      aheadOfSnapshot: liveRound != null && liveRound > snapshotRound,
      fetchedAt: live?.fetchedAt ?? entry?.fetchedAt ?? null,
      driverOverrides: live?.drivers ?? null,
      constructorOverrides: live?.constructors ?? null,
      /** The published order, authoritative when present. */
      driverOrder: live?.driverOrder ?? null,
      constructorOrder: live?.constructorOrder ?? null,
      unmatchedConstructors: live?.unmatchedConstructors ?? [],

      /** This weekend's confirmed entry, or null before any session has run. */
      entry: entry
        ? {
            sessionName: entry.sessionName,
            location: entry.location,
            startedAt: entry.startedAt,
            count: entry.drivers.length,
            /** False once the weekend it describes has passed. */
            current: entryIsCurrent,
          }
        : null,
      entryTeams,
      substitutes,
      newcomers,
      absent,
      teamChanges,

      /** Rounds completed since the snapshot was built, keyed both ways. */
      freshRounds,
      resultsByRound,
      resultsByCircuit,
      /** Per-driver season counts, recomputed from the rounds actually run. */
      seasonCounts,
      /** Published-schedule differences against the bundled calendar. */
      scheduleChanges,
      schedule,

      /**
       * The team a driver is racing for right now. The weekend entry wins over
       * a permanent championship move, which in turn wins over the snapshot.
       */
      teamFor(driverId, fallback) {
        return entryTeams[driverId] ?? teamChanges[driverId] ?? fallback;
      },
      isAbsent: (driverId) => absent.includes(driverId),
      isSubstitute: (driverId) => substitutes.includes(driverId),

      driverStats(driverId) {
        const base = snapshotStandings[driverId] ?? null;
        const over = live?.drivers?.[driverId];
        // Counted stats come from the rounds run; the championship feed stays
        // authoritative for points, position and wins.
        const counted = seasonCounts[driverId] ?? null;
        if (base) return { ...base, ...counted, ...over };
        if (over) return { driverId, ...over };
        // someone only the live feed knows about
        const fresh = newcomers.find((n) => n.id === driverId);
        return fresh
          ? {
              driverId, position: fresh.position, points: fresh.points, wins: fresh.wins,
              podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, starts: 0,
              avgFinish: null, avgGrid: null, bestFinish: null, finishRate: null,
            }
          : null;
      },
    };
  }, [live, entry, rounds, schedule, status, now]);

  return <LiveSeasonContext.Provider value={value}>{children}</LiveSeasonContext.Provider>;
}
