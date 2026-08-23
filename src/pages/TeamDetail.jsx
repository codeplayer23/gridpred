import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import SectionHeader from '@/components/ui/SectionHeader';
import RadialGauge from '@/components/ui/RadialGauge';
import DriverCard from '@/components/drivers/DriverCard';
import TeamLogo from '@/components/teams/TeamLogo';
import TeamComparison from '@/components/teams/TeamComparison';
import { teamById } from '@/data/teams';
import { getDriver } from '@/data/drivers';
import { useTeamDrivers } from '@/hooks/useLiveSeason';
import { constructorById } from '@/data/results';
import NotFound from './NotFound';
import Bloom from '@/components/ui/Bloom';

export default function TeamDetail() {
  const { id } = useParams();
  const team = teamById[id];
  const entered = useTeamDrivers(id);
  if (!team) return <NotFound label="Team not found" />;

  const stats = constructorById[team.id];
  const drivers = entered.length ? entered : team.drivers.map(getDriver);
  const accent = team.accent;

  return (
    <article>
      <header className="relative overflow-hidden px-6 pt-32 pb-16 md:px-10 md:pt-40 md:pb-24">
        <Bloom
          accent={accent}
          intensity={0.26}
          className="-top-56 left-1/2 h-[38rem] w-[66rem] -translate-x-1/2"
        />
        <div className="relative mx-auto max-w-7xl">
          <Reveal y={10}>
            <Link to="/teams" className="mono-label inline-flex items-center gap-2 transition-colors hover:text-ink">
              <ArrowLeft size={13} aria-hidden />
              All teams
            </Link>
          </Reveal>

          <div className="mt-10 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div>
              <motion.h1
                className="font-display text-[clamp(2.6rem,9vw,7.5rem)] leading-[0.86] font-medium tracking-[-0.05em]"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                {team.name.toUpperCase()}
              </motion.h1>
              <p className="mt-6 max-w-md text-[0.98rem] leading-relaxed text-ink-dim">
                {team.fullName}
              </p>
            </div>
            <TeamLogo team={team} size={92} animated className="shrink-0" />
          </div>

          <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-9 border-t border-white/[0.07] pt-10 sm:grid-cols-4">
            {[
              { label: 'Constructors', value: stats.position, prefix: 'P' },
              { label: 'Points', value: stats.points },
              { label: 'Wins', value: stats.wins },
              { label: 'Podiums', value: stats.podiums },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.06}>
                <p className="mono-label">{s.label}</p>
                <p className="tabular mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-none font-medium tracking-[-0.05em]">
                  {s.prefix}
                  <Counter value={s.value} />
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </header>

      <section className="px-6 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="The garage" title="Two cars, one programme" />
          <div className="mt-12 grid gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
            <ul className="flex flex-wrap justify-center gap-5 lg:flex-nowrap">
              {drivers.map((d, i) => (
                <li key={d.id}>
                  <DriverCard driver={d} index={i} compact />
                </li>
              ))}
            </ul>
            <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl md:p-9">
              <p className="mono-label mb-7">Head to head</p>
              <TeamComparison team={team} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10 md:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Car performance"
            title="Where the package stands"
            lede="Derived from where this team\u2019s cars actually start and finish, averaged across both drivers."
          />
          <div className="mt-14 grid grid-cols-2 justify-items-center gap-8 md:grid-cols-3 lg:grid-cols-5">
            {[
              ['Qualifying', team.qualifyingPace],
              ['Race pace', team.racePace],
            ]
              .filter(([, v]) => v != null)
              .map(([label, value]) => (
                <RadialGauge key={label} value={Math.round(value)} accent={accent} label={label} size={148} />
              ))}
          </div>

          <div className="mt-16 grid gap-x-10 gap-y-8 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl sm:grid-cols-2 md:p-10 lg:grid-cols-4">
            {[
              ['Power unit', team.powerUnit ?? '—'],
              ['Pole positions', stats.poles],
              ['Fastest laps', stats.fastestLaps],
              ['Retirements', stats.dnfs],
              ['Average grid', team.avgGrid ?? '—'],
              ['Average finish', team.avgFinish ?? '—'],
              ['Wins', stats.wins],
              ['Podiums', stats.podiums],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="mono-label">{k}</p>
                <p className="tabular mt-2.5 text-[1.35rem] font-medium tracking-[-0.03em]">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
