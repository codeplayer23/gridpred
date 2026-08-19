import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check } from 'lucide-react';
import CircuitMap from '@/components/circuits/CircuitMap';
import Counter from '@/components/ui/Counter';
import { dateParts } from '@/lib/format';
import { easeOut, spring } from '@/lib/motion';
import { getResult } from '@/data/results';
import { driverById } from '@/data/drivers';
import { getTeam } from '@/data/teams';

/**
 * Calendar row.
 *
 * Collapsed it is a single line of the season. On hover the row grows, the
 * circuit outline draws itself in, and the track's numbers count up — so the
 * calendar can be skimmed as a list or explored as a set of venues.
 */
export default function RaceRow({ race, isNext = false, index = 0 }) {
  const [hover, setHover] = useState(false);
  const [now] = useState(() => Date.now());
  const date = dateParts(race.startsAt);
  const done = new Date(race.startsAt).getTime() < now;
  const result = done ? getResult(race.circuitId) : null;
  const winner = result ? driverById[result.winner] : null;
  const accent = winner ? getTeam(winner.team).accent : '#e10600';

  return (
    <motion.li
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.03, 0.3), ease: easeOut }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative border-b border-white/[0.06]"
    >
      <Link
        to={`/races/${race.id}`}
        className="block focus-visible:outline-none"
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <motion.div
          className="relative overflow-hidden rounded-2xl px-3 py-5 md:px-5"
          animate={{ backgroundColor: hover ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0)' }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex items-center gap-4 md:gap-7">
            <span className="tabular w-8 shrink-0 text-[0.78rem] text-ink-faint md:w-10">
              {String(race.round).padStart(2, '0')}
            </span>

            <span className="w-16 shrink-0 md:w-24">
              <span className="mono-label block text-[0.55rem]">{date.month}</span>
              <span className="tabular block text-[1.05rem] leading-tight font-medium">{date.day}</span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <motion.span
                  className="truncate font-display text-[1.15rem] leading-tight font-medium tracking-[-0.03em] md:text-[1.5rem]"
                  animate={{ x: hover ? 4 : 0 }}
                  transition={spring}
                >
                  {race.shortName}
                </motion.span>
                <AnimatePresence>
                  {hover && (
                    <motion.span
                      className="mono-label text-[0.55rem]"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={spring}
                    >
                      {race.country}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isNext && (
                  <span className="rounded-full bg-signal px-2.5 py-0.5 text-[0.58rem] font-semibold tracking-[0.14em] text-void uppercase">
                    Next
                  </span>
                )}
              </span>
              <span className="mt-1 block truncate text-[0.78rem] text-ink-mute">
                {race.circuitName}
              </span>
            </span>

            <span className="hidden w-32 shrink-0 text-[0.8rem] text-ink-mute lg:block">
              {race.country}
            </span>

            <span className="hidden w-36 shrink-0 md:block">
              {winner ? (
                <span className="flex items-center gap-2.5">
                  <span className="h-6 w-0.5 rounded-full" style={{ background: accent }} aria-hidden />
                  <span className="min-w-0">
                    <span className="mono-label block text-[0.5rem]">Winner</span>
                    <span className="block truncate text-[0.84rem] font-medium">{winner.lastName}</span>
                  </span>
                </span>
              ) : (
                <span className="mono-label text-[0.55rem]">Upcoming</span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-3">
              {done && (
                <span className="hidden h-6 w-6 items-center justify-center rounded-full bg-white/[0.07] text-ink-faint sm:flex">
                  <Check size={12} aria-hidden />
                </span>
              )}
              <motion.span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                animate={{
                  backgroundColor: hover ? accent : 'rgba(255,255,255,0.06)',
                  color: hover ? '#06070a' : '#6b7280',
                  scale: hover ? 1.08 : 1,
                }}
                transition={spring}
              >
                <ArrowUpRight size={16} strokeWidth={2.2} aria-hidden />
              </motion.span>
            </span>
          </div>

          {/* expanding detail */}
          <AnimatePresence initial={false}>
            {hover && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.42, ease: easeOut }}
                className="overflow-hidden"
              >
                <div className="mt-6 grid items-center gap-8 border-t border-white/[0.06] pt-6 md:grid-cols-[200px_1fr]">
                  <div className="mx-auto w-full max-w-[200px]">
                    <CircuitMap
                      circuit={race.circuit}
                      accent={accent}
                      strokeWidth={13}
                      showStartFinish={false}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ['Laps', race.laps, ''],
                      ['Distance', race.raceDistance, ' km'],
                      ['Length', race.trackLength, ' km'],
                      ['Corners', race.cornerCount, ''],
                      ['Top speed', race.circuit?.measurements?.maxSpeed, ' km/h'],
                      ['Full throttle', race.circuit?.measurements?.fullThrottlePct, '%'],
                    ].map(([label, value, suffix]) => (
                      <div key={label}>
                        <dt className="mono-label text-[0.5rem]">{label}</dt>
                        <dd className="tabular mt-1.5 text-[1.05rem] font-medium">
                          {value == null ? (
                            '—'
                          ) : (
                            <>
                              <Counter value={value} decimals={String(value).includes('.') ? 1 : 0} duration={0.8} />
                              <span className="text-[0.72rem] text-ink-mute">{suffix}</span>
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Link>
    </motion.li>
  );
}
