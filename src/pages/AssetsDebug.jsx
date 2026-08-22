import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import DriverHeadshot from '@/components/drivers/DriverHeadshot';
import TeamLogo from '@/components/teams/TeamLogo';
import { cx } from '@/lib/format';
import { drivers } from '@/data/drivers';
import { teams, getTeam } from '@/data/teams';
import { getDriverAsset } from '@/data/driverAssets';
import { getTeamLogo } from '@/data/teamAssets';
import { sourcesFor } from '@/data/assetSources';
import { validateDriverAssets } from '@/utils/validateAssets';

/**
 * Development-only asset audit.
 *
 * Every driver on one page with their photograph, number, team and
 * team logo, so a mismatched or missing asset is obvious at a glance. Not linked
 * from the navigation.
 */
function Flag({ ok, children, expectedGap = false }) {
  return (
    <span
      className={cx(
        'flex items-center gap-1.5 text-[0.68rem]',
        ok ? 'text-positive' : expectedGap ? 'text-ink-mute' : 'text-negative',
      )}
    >
      {ok ? <Check size={11} /> : <X size={11} />}
      {children}
    </span>
  );
}

export default function AssetsDebug() {
  const report = useMemo(() => validateDriverAssets(), []);

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <p className="mono-label mb-6">Development · asset audit</p>
        <h1 className="font-display text-[clamp(2.2rem,6vw,4rem)] leading-[0.9] font-medium tracking-[-0.05em]">
          EVERY ASSET,
          <br />
          ONE PAGE.
        </h1>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Drivers', report.counts.drivers],
            ['With photograph', `${report.counts.withPhoto}/${report.counts.drivers}`],
            ['Teams', report.counts.teams],
            ['With logo', `${report.counts.teamsWithLogo}/${report.counts.teams}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="mono-label text-[0.5rem]">{k}</p>
              <p className="tabular mt-2 text-[1.6rem] font-medium">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className={cx('text-[0.9rem] font-medium', report.ok ? 'text-positive' : 'text-negative')}>
            {report.ok ? '✓ No asset errors' : `✗ ${report.errors.length} asset error(s)`}
          </p>
          {report.errors.map((e) => (
            <p key={e} className="mt-1 text-[0.8rem] text-negative">{e}</p>
          ))}
          {report.notices.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[0.8rem] text-ink-mute">
                {report.notices.length} expected gap(s) — neutral fallbacks in use
              </summary>
              {report.notices.map((n) => (
                <p key={n} className="mt-1 text-[0.76rem] text-ink-faint">· {n}</p>
              ))}
            </details>
          )}
        </div>

        {/* ── Teams ─────────────────────────────────────────── */}
        <h2 className="mono-label mt-14 mb-5">Team logos</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {teams.map((t) => {
            const logo = getTeamLogo(t.id);
            return (
              <li key={t.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="flex h-14 items-center">
                  <TeamLogo team={t} size={30} />
                </div>
                <p className="mt-3 text-[0.85rem] font-medium">{t.name}</p>
                <p className="tabular text-[0.7rem] text-ink-faint">{t.id}</p>
                <div className="mt-2.5 flex flex-col gap-1">
                  <Flag ok={!!logo} expectedGap>
                    {logo ? 'official logo' : 'no official logo — neutral plate'}
                  </Flag>
                  <Flag ok={!!t.accent}>colour {t.accent}</Flag>
                  <Flag ok={t.drivers?.length === 2}>{t.drivers?.length ?? 0} drivers</Flag>
                </div>
              </li>
            );
          })}
        </ul>

        {/* ── Drivers ───────────────────────────────────────── */}
        <h2 className="mono-label mt-16 mb-5">Drivers</h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drivers.map((d) => {
            const team = getTeam(d.team);
            const asset = getDriverAsset(d.id);
            const src = sourcesFor(d.id).find((s) => s.type === 'driver-headshot');
            return (
              <li key={d.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="flex items-start gap-4">
                  <DriverHeadshot driver={d} team={team} size={104} tilt={false} showNumber={false} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="tabular text-[1.5rem] leading-none font-semibold"
                      style={{ color: team.accent }}
                    >
                      {d.number}
                    </p>
                    <p className="mt-1 truncate text-[0.95rem] font-medium">{d.name}</p>
                    <p className="truncate text-[0.75rem] text-ink-mute">{team.name}</p>
                    <TeamLogo team={team} size={16} className="mt-2" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3">
                  <Flag ok={!!asset.code} expectedGap={!asset.code}>
                    photo {asset.source ? `(${asset.source})` : '— none'}
                  </Flag>
                  <Flag ok={d.number != null}>number</Flag>
                  <Flag ok={!!d.team}>team {d.abbreviation}</Flag>
                </div>
                {src?.note && (
                  <p className="mt-2.5 text-[0.68rem] leading-relaxed text-ink-faint">{src.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
