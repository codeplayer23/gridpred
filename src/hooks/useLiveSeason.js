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
    if (!entry) return { drivers: snapshotDrivers, changed: false, absent: [], newcomers: [] };
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

/** Championship table ordered by the freshest data available. */
export function useDriverStandings() {
  const { driverOverrides } = useLiveSeason();
  return useMemo(() => {
    const rows = snapshotDrivers.map((d) => ({
      ...snapshotStandings[d.id],
      ...(driverOverrides?.[d.id] ?? {}),
      driverId: d.id,
      teamId: d.team,
    }));
    return rows.sort((a, b) => a.position - b.position);
  }, [driverOverrides]);
}

/** Constructor table ordered by the freshest data available. */
export function useConstructorStandings() {
  const { constructorOverrides } = useLiveSeason();
  return useMemo(() => {
    const rows = snapshotTeams.map((t) => ({ ...t, ...(constructorOverrides?.[t.id] ?? {}) }));
    return rows.sort((a, b) => a.position - b.position);
  }, [constructorOverrides]);
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
    const known = new Set(base.map((f) => f.round));
    const extra = (freshRounds ?? [])
      .filter((r) => !known.has(r.round))
      .map((r) => {
        const row = r.results.find((x) => x.driverId === driverId);
        if (!row) return null;
        return {
          round: r.round,
          circuitId: String(r.event ?? '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12),
          event: r.event,
          position: row.position,
          grid: row.grid,
          points: row.points,
          status: row.status,
          finished: row.finished,
          fastestLap: row.fastestLap,
          pitStops: null,
          compounds: [],
          wet: null,
        };
      })
      .filter(Boolean);
    return [...base, ...extra].sort((a, b) => a.round - b.round).slice(-count);
  }, [driverId, base, freshRounds, count]);
}
