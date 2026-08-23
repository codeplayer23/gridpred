import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import Meter from '@/components/ui/Meter';
import Button from '@/components/ui/Button';
import TeamLogo from '@/components/teams/TeamLogo';
import TeamComparison from '@/components/teams/TeamComparison';
import { cx } from '@/lib/format';
import { easeOut, spring } from '@/lib/motion';
import { getTeam } from '@/data/teams';
import { constructorStandings } from '@/data/results';
import Bloom from '@/components/ui/Bloom';

/**
 * Team explorer.
 *
 * A persistent rail of constructors on the left, an expanding detail stage on
 * the right. Selecting a team cross-fades the stage and re-runs its counters,
 * so the page reads as one continuous surface rather than ten separate cards.
 */
// Rail order follows the live constructors' table, not the order the teams
// happen to be declared in.
const ordered = constructorStandings.map((c) => getTeam(c.id));

export default function Teams() {
  const [selected, setSelected] = useState(ordered[0].id);
  const team = getTeam(selected);
  const stats = team;

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mono-label mb-6">Constructors · 2026</p>
          <h1 className="font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.05em]">
            TEN
            <br />
            TEAMS.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-dim">
            Pick a constructor to read its 2026 season — the package, the
            garage, and how its two drivers stack up against each other.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(220px,300px)_1fr] lg:gap-12">
          {/* selector rail */}
          <nav aria-label="Constructors" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:px-0">
              {ordered.map((t) => {
                const active = t.id === selected;
                const ts = t;
                return (
                  <li key={t.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => setSelected(t.id)}
                      aria-pressed={active}
                      className={cx(
                        'relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors duration-300',
                        active ? 'text-ink' : 'text-ink-mute hover:text-ink-dim',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="team-rail"
                          className="absolute inset-0 rounded-xl border border-white/[0.1] bg-white/[0.05]"
                          transition={spring}
                        />
                      )}
                      <span
                        className="relative h-8 w-1 shrink-0 rounded-full transition-all duration-300"
                        style={{
                          background: t.accent,
                          opacity: active ? 1 : 0.45,
                          boxShadow: active ? `0 0 12px ${t.accent}` : 'none',
                        }}
                        aria-hidden
                      />
                      <span className="relative min-w-0 flex-1">
                        <span className="block truncate text-[0.92rem] font-medium">{t.name}</span>
                        <span className="tabular block text-[0.7rem] text-ink-faint">
                          P{ts.position} · {ts.points} pts
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* detail stage */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: easeOut }}
                className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl"
              >
                <Bloom
                  accent={team.accent}
                  intensity={0.3}
                  className="-top-40 left-1/3 h-80 w-[70%]"
                />

                <header className="relative flex flex-col gap-7 border-b border-white/[0.07] p-7 md:flex-row md:items-center md:justify-between md:p-10">
                  <div className="flex items-center gap-6">
                    <TeamLogo team={team} size={54} animated className="shrink-0" />
                    <div>
                      <p className="mono-label mb-2.5">P{stats.position} · Constructors</p>
                      <h2 className="font-display text-[clamp(1.9rem,4.5vw,3.2rem)] leading-[0.95] font-medium tracking-[-0.045em]">
                        {team.name}
                      </h2>
                      <p className="mt-2.5 text-[0.85rem] text-ink-mute">{team.fullName}</p>
                    </div>
                  </div>
                  <Link
                    to={`/teams/${team.id}`}
                    className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/[0.1] px-5 py-2.5 text-[0.82rem] font-medium transition-colors hover:border-white/25 md:self-auto"
                  >
                    Full profile
                    <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                  </Link>
                </header>

                <div className="relative grid gap-x-8 gap-y-9 border-b border-white/[0.07] p-7 sm:grid-cols-2 md:p-10 lg:grid-cols-4">
                  {[
                    { label: 'Points', value: stats.points },
                    { label: 'Wins', value: stats.wins },
                    { label: 'Podiums', value: stats.podiums },
                    { label: 'Pole positions', value: stats.poles },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="mono-label">{s.label}</p>
                      <p className="tabular mt-3 text-[clamp(2rem,4vw,2.9rem)] leading-none font-medium tracking-[-0.05em]">
                        <Counter value={s.value} />
                      </p>
                    </div>
                  ))}
                </div>

                <div className="relative grid gap-10 p-7 md:p-10 lg:grid-cols-2 lg:gap-14">
                  <div className="flex flex-col gap-8">
                    <div>
                      <p className="mono-label mb-5">Machinery</p>
                      <dl className="flex flex-col gap-3.5 text-[0.9rem]">
                        {[
                          ['Power unit', team.powerUnit ?? '—'],
                          ['Fastest laps', stats.fastestLaps],
                          ['Retirements', stats.dnfs],
                          ['Average grid', team.avgGrid ?? '—'],
                          ['Average finish', team.avgFinish ?? '—'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] pb-3.5">
                            <dt className="text-ink-mute">{k}</dt>
                            <dd className="tabular font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="flex flex-col gap-6">
                      <Meter
                        label="Qualifying pace"
                        value={team.qualifyingPace ?? 0}
                        accent={team.accent}
                        readout={Math.round(team.qualifyingPace ?? 0)}
                      />
                      <Meter
                        label="Race pace"
                        value={team.racePace ?? 0}
                        accent={team.accent}
                        readout={Math.round(team.racePace ?? 0)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mono-label mb-6">Driver comparison</p>
                    <TeamComparison team={team} />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/compare" variant="ghost">
                Compare drivers
              </Button>
              <Button to="/analytics">Team analytics</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
