import { useContext, useMemo } from 'react';
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
