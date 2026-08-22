import { useMemo } from 'react';
import {
  getDriverAsset,
  buildHeadshotUrl,
  buildHeadshotSrcSet,
  deriveDriverCode,
} from '@/data/driverAssets';
import { getTeamAsset } from '@/data/teamAssets';
import { getTeam } from '@/data/teams';
import { useLiveSeason } from './useLiveSeason';

/**
 * Resolve a driver's imagery against the team they are racing for *now*.
 *
 * F1's portrait URLs are namespaced by constructor, so this is what makes a
 * lineup change self-healing: when the live feed reports a driver scoring for a
 * different team, the portrait rebuilds under that team's slug and the card
 * picks up the new photograph, colour and logo without a rebuild.
 *
 * @returns {{team, headshot, headshotSet, teamChanged, code}}
 */
export function useDriverAssets(driver) {
  const { teamFor } = useLiveSeason();

  return useMemo(() => {
    if (!driver) {
      return { team: null, headshot: null, headshotSet: null, teamChanged: false, code: null };
    }
    const snapshotTeamId = driver.team;
    const currentTeamId = teamFor ? teamFor(driver.id, snapshotTeamId) : snapshotTeamId;
    const team = getTeam(currentTeamId);

    const registry = getDriverAsset(driver.id);
    // A known code always beats a derived one; derivation only covers drivers
    // the snapshot has never seen.
    const code = registry.code ?? deriveDriverCode(driver.firstName, driver.lastName);
    const slug = getTeamAsset(currentTeamId).slug ?? registry.teamSlug;

    return {
      team,
      teamId: currentTeamId,
      code,
      teamChanged: currentTeamId !== snapshotTeamId,
      headshot: buildHeadshotUrl(slug, code),
      headshotSet: buildHeadshotSrcSet(slug, code),
    };
  }, [driver, teamFor]);
}

/**
 * The constructor a driver is racing for right now — the live feed's answer
 * where it has one, the snapshot's otherwise.
 */
export function useCurrentTeam(driver) {
  return useDriverAssets(driver).team;
}
