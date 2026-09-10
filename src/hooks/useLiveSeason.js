import { useContext, useEffect, useMemo, useState } from 'react';
import { fetchWeekendSessions } from '@/services/live';
import { LiveSeasonContext } from '@/context/liveSeasonContext';
import { drivers as snapshotDrivers } from '@/data/drivers';
import { teams as snapshotTeams } from '@/data/teams';
import { standingsById as snapshotStandings } from '@/data/results';
import { SNAPSHOT } from '@/data/races';

/**
 * Live season context, with a snapshot-backed fallback so these hooks are safe
 * to call outside the provider (tests, isolated renders).
 */
export function useLiveSeason() {
  return (
    useContext(LiveSeasonContext) ?? {
      status: 'idle',
      round: null,
      snapshotRound: SNAPSHOT.roundsCompleted,
      aheadOfSnapshot: false,
      fetchedAt: null,
      driverOverrides: null,
      constructorOverrides: null,
      driverOrder: null,
      constructorOrder: null,
      unmatchedConstructors: [],
      entry: null,
      entryTeams: {},
      freshRounds: [],
      resultsByRound: {},
      resultsByCircuit: {},
      scheduleChanges: [],
      schedule: null,
      substitutes: [],
      newcomers: [],
      absent: [],
      teamChanges: {},
      teamFor: (id, fallback) => fallback,
      isAbsent: () => false,
      isSubstitute: () => false,
      driverStats: (id) => snapshotStandings[id] ?? null,
    }
  );
}

/**
 * The field for the current race weekend.
 *
 * Contracted drivers who are not in the entry are dropped, stand-ins are moved
 * to the team they are actually driving for, and anyone the snapshot has never
 * seen is added. Championship order is unaffected — a driver who sits out keeps
 * their points and their standings place.
 */
export function useWeekendGrid() {
  const { entryTeams, newcomers, absent, entry } = useLiveSeason();
  return useMemo(() => {
    if (!entry) {
      return { drivers: snapshotDrivers, changed: false, absent: [], newcomers: [], absentDrivers: [] };
    }
    // Outside a race weekend nobody is "absent" — the roster is everyone
    // contracted plus anyone who has since appeared.
    if (!entry.current) {
      return {
        drivers: [...snapshotDrivers, ...newcomers],
        absentDrivers: [],
        absent: [],
        newcomers,
        changed: false,
      };
    }
    const racing = snapshotDrivers
      .filter((d) => !absent.includes(d.id))
      .map((d) => (entryTeams[d.id] && entryTeams[d.id] !== d.team
        ? { ...d, team: entryTeams[d.id], isSubstitute: true }
        : d));
    const absentDrivers = snapshotDrivers.filter((d) => absent.includes(d.id));
    return {
      drivers: [...racing, ...newcomers],
      absentDrivers,
      absent,
      newcomers,
      changed: absent.length > 0 || newcomers.length > 0,
    };
  }, [entryTeams, newcomers, absent, entry]);
}

/** The drivers a team is fielding this weekend, stand-ins included. */
export function useTeamDrivers(teamId) {
  const { drivers } = useWeekendGrid();
  return useMemo(() => drivers.filter((d) => d.team === teamId), [drivers, teamId]);
}

/** A driver by id, including anyone only present in this weekend's entry. */
export function useGridDriver(driverId) {
  const { drivers } = useWeekendGrid();
  return useMemo(() => drivers.find((d) => d.id === driverId) ?? null, [drivers, driverId]);
}

/** Season stats for one driver, upgraded to live figures when available. */
export function useDriverStats(driverId) {
  const { driverStats } = useLiveSeason();
  return driverStats(driverId);
}

/**
 * Drivers' championship.
 *
 * When the live feed has answered, the table IS the published order — rows are
 * built by walking that list, not by re-sorting snapshot rows. Mixing the two
 * is what lets one unresolved name sit on a stale score while everything around
 * it updates, so the fallback to the snapshot is all-or-nothing.
 */
export function useDriverStandings() {
  const { driverOrder } = useLiveSeason();
  return useMemo(() => {
    if (!driverOrder?.length) {
      return snapshotDrivers
        .map((d) => ({ ...snapshotStandings[d.id], driverId: d.id, teamId: d.team }))
        .sort((a, b) => a.position - b.position);
    }
    const byId = Object.fromEntries(snapshotDrivers.map((d) => [d.id, d]));
    return driverOrder.map((row) => {
      const known = row.driverId ? byId[row.driverId] : null;
      return {
        ...(row.driverId ? snapshotStandings[row.driverId] : null),
        driverId: row.driverId,
        teamId: known?.team ?? null,
        position: row.position,
        points: row.points,
        wins: row.wins,
        /** Present only for a driver the snapshot has never seen. */
        unknown: known
          ? null
          : { firstName: row.firstName, surname: row.surname, number: row.number },
      };
    });
  }, [driverOrder]);
}

/** Constructors' championship, built the same way. */
export function useConstructorStandings() {
  const { constructorOrder } = useLiveSeason();
  return useMemo(() => {
    if (!constructorOrder?.length) {
      return [...snapshotTeams].sort((a, b) => a.position - b.position);
    }
    const byId = Object.fromEntries(snapshotTeams.map((t) => [t.id, t]));
    return constructorOrder.map((row) => {
      const known = row.teamId ? byId[row.teamId] : null;
      return {
        ...(known ?? {}),
        id: row.teamId ?? row.name,
        name: known?.name ?? row.name,
        position: row.position,
        points: row.points,
        wins: row.wins,
        unresolved: !known,
      };
    });
  }, [constructorOrder]);
}


/**
 * Classification for a round, preferring a result that has come in since the
 * snapshot was built. Returns null for a round that has not been run.
 */
export function useRoundResult(circuitId) {
  const { resultsByCircuit } = useLiveSeason();
  return resultsByCircuit?.[circuitId] ?? null;
}

/** How many rounds are complete, counting anything run since the snapshot. */
export function useRoundsCompleted() {
  const { round, snapshotRound } = useLiveSeason();
  return Math.max(round ?? 0, snapshotRound);
}

/** Differences between the published calendar and the bundled one. */
export function useScheduleChanges() {
  const { scheduleChanges } = useLiveSeason();
  return scheduleChanges ?? [];
}

/**
 * Sessions of the most recent race weekend, with classifications.
 *
 * Fetched on demand rather than with the rest of the live data: only the race
 * page shows per-session results, and the timing API throttles hard enough that
 * asking for them on every page load costs more than it returns.
 */
export function useWeekendSessions() {
  const [weekend, setWeekend] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchWeekendSessions(Date.now()).then((w) => {
      if (!cancelled && w) setWeekend(w);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return weekend;
}

/**
 * A driver's form, extended with rounds run since the snapshot so the strip
 * keeps growing without a rebuild.
 */
export function useDriverForm(driverId, base = [], count = 10) {
  const { freshRounds } = useLiveSeason();
  return useMemo(() => {
    const byRound = new Map(base.map((f) => [f.round, f]));

    for (const r of freshRounds ?? []) {
      const row = r.results.find((x) => x.driverId === driverId);
      if (!row) continue;
      const bundled = byRound.get(r.round);
      // A round already in the snapshot still gets its published position and
      // points applied — that is how a steward's revision shows up here — but
      // the detail only the telemetry pipeline has is kept.
      byRound.set(r.round, {
        ...(bundled ?? {
          circuitId: String(r.event ?? '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12),
          pitStops: null,
          compounds: [],
          wet: null,
        }),
        round: r.round,
        event: bundled?.event ?? r.event,
        position: row.position,
        grid: row.grid,
        points: row.points,
        status: row.status,
        finished: row.finished,
        fastestLap: row.fastestLap,
      });
    }

    return [...byRound.values()].sort((a, b) => a.round - b.round).slice(-count);
  }, [driverId, base, freshRounds, count]);
}
