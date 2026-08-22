import { useEffect, useMemo, useState } from 'react';
import { fetchStandings, fetchEntryList } from '@/services/live';
import { drivers as snapshotDrivers } from '@/data/drivers';
import { teams as snapshotTeams } from '@/data/teams';
import { standingsById as snapshotStandings } from '@/data/results';
import { SNAPSHOT } from '@/data/races';
import { deriveDriverCode } from '@/data/driverAssets';
import { LiveSeasonContext } from './liveSeasonContext';

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
  const [status, setStatus] = useState('idle'); // idle | syncing | live | offline

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (!cancelled) setStatus((s) => (s === 'live' ? 'live' : 'syncing'));
      const [standings, entryList] = await Promise.all([
        fetchStandings(snapshotDrivers, snapshotTeams),
        fetchEntryList(Date.now()),
      ]);
      if (cancelled) return;
      if (standings) setLive(standings);
      if (entryList) setEntry(entryList);
      setStatus(standings || entryList ? 'live' : 'offline');
    };

    sync();
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
        points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0,
        starts: 0, sprintPoints: 0, form: [],
        avgFinish: null, avgGrid: null, bestFinish: null, finishRate: null,
        position: null,
        assetCode: deriveDriverCode(row.firstName, row.lastName),
        assetSource: 'formula1',
        isSubstitute: true,
      });
    });

    // Contracted drivers the entry does not list — stood down for this round.
    const absent = entry
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

    return {
      status,
      round: liveRound,
      snapshotRound,
      aheadOfSnapshot: liveRound != null && liveRound > snapshotRound,
      fetchedAt: live?.fetchedAt ?? entry?.fetchedAt ?? null,
      driverOverrides: live?.drivers ?? null,
      constructorOverrides: live?.constructors ?? null,

      /** This weekend's confirmed entry, or null before any session has run. */
      entry: entry
        ? {
            sessionName: entry.sessionName,
            location: entry.location,
            startedAt: entry.startedAt,
            count: entry.drivers.length,
          }
        : null,
      entryTeams,
      substitutes,
      newcomers,
      absent,
      teamChanges,

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
        if (!base) return over ? { driverId, ...over } : null;
        return over ? { ...base, ...over } : base;
      },
    };
  }, [live, entry, status]);

  return <LiveSeasonContext.Provider value={value}>{children}</LiveSeasonContext.Provider>;
}
