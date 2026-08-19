import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import Button from '@/components/ui/Button';
import PositionBadge from '@/components/ui/PositionBadge';
import { tint } from '@/lib/format';
import { easeOut, viewport } from '@/lib/motion';
import { driverById, fullName } from '@/data/drivers';
import { getTeam } from '@/data/teams';
import { completedRounds, constructorStandings, standings } from '@/data/results';

/** Championship snapshot — drivers and constructors side by side. */
export default function StandingsSnapshot() {
  const topDrivers = standings.slice(0, 6);
  const leadPoints = topDrivers[0]?.points || 1;
  const topTeams = constructorStandings.slice(0, 6);
  const leadTeamPoints = topTeams[0]?.points || 1;

  return (
    <section className="relative px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Standings"
          title={`${completedRounds} rounds in.`}
          lede="The official championship as it stands, summed from every classification this season — sprint points included."
          action={<Button to="/analytics" variant="ghost">Full analytics</Button>}
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mono-label mb-7">Drivers</p>
            <ol className="flex flex-col gap-2">
              {topDrivers.map((s, i) => {
                const driver = driverById[s.driverId];
                const team = getTeam(s.teamId);
                return (
                  <li key={s.driverId}>
                    <Link
                      to={`/drivers/${driver.id}`}
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06] px-4 py-3 transition-colors hover:border-white/[0.14]"
                    >
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0"
                        style={{ background: tint(team.accent, 0.14) }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(s.points / leadPoints) * 100}%` }}
                        viewport={viewport}
                        transition={{ duration: 1, delay: i * 0.07, ease: easeOut }}
                      />
                      <PositionBadge position={s.position} size="sm" className="relative" />
                      <span className="relative min-w-0 flex-1">
                        <span className="block truncate text-[0.94rem] font-medium">{fullName(driver)}</span>
                        <span className="block truncate text-[0.74rem] text-ink-mute">{team.name}</span>
                      </span>
                      <span className="tabular relative shrink-0 text-[1.05rem] font-medium">{s.points}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>

          <div>
            <p className="mono-label mb-7">Constructors</p>
            <ol className="flex flex-col gap-2">
              {topTeams.map((c, i) => {
                const team = getTeam(c.id ?? c.teamId);
                return (
                  <li key={team.id}>
                    <Link
                      to={`/teams/${team.id}`}
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06] px-4 py-3 transition-colors hover:border-white/[0.14]"
                    >
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0"
                        style={{ background: tint(team.accent, 0.14) }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(c.points / leadTeamPoints) * 100}%` }}
                        viewport={viewport}
                        transition={{ duration: 1, delay: i * 0.07, ease: easeOut }}
                      />
                      <PositionBadge position={c.position} size="sm" className="relative" />
                      <span className="relative min-w-0 flex-1 truncate text-[0.94rem] font-medium">
                        {team.name}
                      </span>
                      <span className="tabular relative shrink-0 text-[1.05rem] font-medium">{c.points}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
