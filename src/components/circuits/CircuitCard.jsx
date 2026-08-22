import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check } from 'lucide-react';
import CircuitMap from './CircuitMap';
import { dateParts, tint } from '@/lib/format';
import { easeOut } from '@/lib/motion';

/**
 * Circuit tile for the calendar grid.
 * Shows the real layout at rest; hovering lifts the card and turns the racing
 * line on so the tile previews the same thing the race page will show.
 */
function CircuitCard({ race, index = 0, isNext = false, accent = '#e10600' }) {
  const [hover, setHover] = useState(false);
  const date = dateParts(race.startsAt);
  const done = race.completed;
  const circuit = race.circuit;

  return (
    <motion.li
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.04, 0.4), ease: easeOut }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        to={`/races/${race.id}`}
        className="group block focus-visible:outline-none"
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <motion.article
          className="relative overflow-hidden rounded-[22px] border border-white/[0.07] p-5"
          style={{
            background: `linear-gradient(165deg, ${tint(accent, hover ? 0.14 : 0.05)}, rgba(10,12,16,0.94) 58%)`,
          }}
          animate={{ y: hover ? -5 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        >
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mono-label text-[0.55rem]">
                R{String(race.round).padStart(2, '0')} · {date.month} {date.day}
              </p>
              <h3 className="mt-2 truncate font-display text-[1.25rem] leading-tight font-medium tracking-[-0.035em]">
                {race.shortName}
              </h3>
              <p className="mt-1 truncate text-[0.75rem] text-ink-mute">{race.country}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              {isNext && (
                <span className="rounded-full bg-signal px-2 py-0.5 text-[0.5rem] font-semibold tracking-[0.14em] text-white uppercase">
                  Next
                </span>
              )}
              {done && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] text-ink-faint">
                  <Check size={11} aria-hidden />
                </span>
              )}
            </span>
          </header>

          <div className="my-4 h-[132px]">
            <CircuitMap
              circuit={circuit}
              accent={accent}
              strokeWidth={14}
              showStartFinish={false}
              showTelemetry={hover}
              animated
            />
          </div>

          <footer className="flex items-end justify-between gap-3">
            <dl className="flex gap-5">
              {[
                ['Laps', circuit?.laps],
                ['Corners', circuit?.corners],
                ['Km', circuit?.trackLength],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="mono-label text-[0.45rem]">{k}</dt>
                  <dd className="tabular mt-0.5 text-[0.9rem] font-medium">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
            <motion.span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              animate={{
                backgroundColor: hover ? accent : 'rgba(255,255,255,0.06)',
                color: hover ? '#ffffff' : '#6b7280',
              }}
            >
              <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
            </motion.span>
          </footer>
        </motion.article>
      </Link>
    </motion.li>
  );
}

export default memo(CircuitCard);
