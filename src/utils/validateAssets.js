/**
 * Asset validation.
 *
 * Runs in development and reports anything that would make a driver render
 * wrongly: a missing number, a missing team, a photograph shared between two
 * drivers, a team with no logo. A missing photograph is a notice rather than an
 * error — the interface handles it with a neutral placeholder by design.
 */
import { drivers } from '@/data/drivers';
import { teams, getTeam } from '@/data/teams';
import { getDriverAsset, buildHeadshotUrl } from '@/data/driverAssets';
import { getTeamAsset, getTeamLogo } from '@/data/teamAssets';

export function validateDriverAssets(list = drivers) {
  const errors = [];
  const notices = [];
  const seen = new Map();

  list.forEach((d) => {
    const asset = getDriverAsset(d.id);
    const team = getTeam(d.team);
    const headshot = buildHeadshotUrl(getTeamAsset(d.team).slug ?? asset.teamSlug, asset.code);

    if (d.number == null) errors.push(`${d.name}: missing racing number`);
    if (!d.team) errors.push(`${d.name}: missing teamId`);
    if (!team) errors.push(`${d.name}: teamId "${d.team}" does not resolve to a team`);

    if (headshot) {
      const prior = seen.get(headshot);
      if (prior) errors.push(`${d.name} and ${prior} share the same headshot URL`);
      seen.set(headshot, d.name);
    } else {
      notices.push(`${d.name}: no current photograph available — neutral placeholder shown`);
    }

    if (team && !getTeamLogo(team.id)) {
      notices.push(`${team.name}: no openly-licensed logo — neutral team plate shown`);
    }
  });

  const numbers = list.map((d) => d.number);
  numbers.forEach((n, i) => {
    if (n != null && numbers.indexOf(n) !== i) errors.push(`Duplicate racing number: ${n}`);
  });

  teams.forEach((t) => {
    if (!t.drivers?.length) errors.push(`${t.name}: no drivers linked`);
  });

  return {
    ok: errors.length === 0,
    errors,
    notices: [...new Set(notices)],
    counts: {
      drivers: list.length,
      withPhoto: list.filter((d) => getDriverAsset(d.id).code).length,
      teams: teams.length,
      teamsWithLogo: teams.filter((t) => getTeamLogo(t.id)).length,
    },
  };
}

/** Log a readable report once, in development only. */
export function reportAssetValidation() {
  if (!import.meta.env?.DEV) return;
  const r = validateDriverAssets();
  const { counts } = r;
  const style = 'color:#e10600;font-weight:600';
  /* eslint-disable no-console */
  console.groupCollapsed(
    `%c[GridPred Assets]%c ${counts.withPhoto}/${counts.drivers} photos · ` +
      `${counts.teamsWithLogo}/${counts.teams} logos`,
    style,
    'color:inherit',
  );
  if (r.errors.length) {
    console.error('Errors:');
    r.errors.forEach((e) => console.error('  ✗', e));
  } else {
    console.log('✓ No asset errors — every driver has a number, a team and a unique image.');
  }
  if (r.notices.length) {
    console.info('Expected gaps (neutral fallbacks in use):');
    r.notices.forEach((n) => console.info('  ·', n));
  }
  console.groupEnd();
  /* eslint-enable no-console */
}
