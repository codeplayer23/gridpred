import { useState } from 'react';
import { motion } from 'framer-motion';
import Tooltip from '@/components/ui/Tooltip';
import { cx, tint } from '@/lib/format';
import { spring } from '@/lib/motion';
import { recentForm } from '@/data/results';

/**
 * Last ten rounds as an interactive bar strip.
 *
 * Bar height encodes finishing position (taller = better), so the shape of a
 * season is readable before any number is. Hovering a round opens the full
 * result: grid slot, positions gained, stops, weather.
 */
export default function FormStrip({ driverId, accent = '#e10600', count = 10 }) {
  const form = recentForm(driverId, count);
  const [open, setOpen] = useState(null);

  return (
    <div className="relative">
      <ol className="flex items-end gap-1.5 sm:gap-2.5" role="list">
        {form.map((entry, i) => {
          const dnf = !entry.finished;
          const height = dnf ? 14 : Math.max(16, 100 - (entry.position - 1) * 4.6);
          const active = open === i;
          const gained = entry.grid - entry.position;

          return (
            <li key={entry.round} className="relative flex-1">
              <button
                type="button"
                className="group flex w-full flex-col items-center gap-2.5 focus-visible:outline-none"
                onMouseEnter={() => setOpen(i)}
                onMouseLeave={() => setOpen(null)}
                onFocus={() => setOpen(i)}
                onBlur={() => setOpen(null)}
                aria-label={`${entry.event}: ${dnf ? 'did not finish' : `finished P${entry.position}`}`}
              >
                <span className="tabular text-[0.72rem] font-medium text-ink-mute transition-colors group-hover:text-ink">
                  {dnf ? 'DNF' : `P${entry.position}`}
                </span>
                <span className="relative flex h-[132px] w-full items-end justify-center sm:h-[168px]">
                  <motion.span
                    className="w-full max-w-[46px] rounded-[5px]"
                    style={{
                      background: dnf
                        ? 'rgba(255,90,90,0.28)'
                        : `linear-gradient(180deg, ${accent}, ${tint(accent, 0.28)})`,
                      boxShadow: active ? `0 0 22px ${tint(accent, 0.5)}` : 'none',
                    }}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${height}%` }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ ...spring, delay: i * 0.05 }}
                    animate={{ scaleX: active ? 1.06 : 1 }}
                  />
                  {entry.position === 1 && !dnf && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-1 h-1.5 w-1.5 rounded-full"
                      style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
                    />
                  )}
                </span>
                <span
                  className={cx(
                    'mono-label text-[0.52rem] transition-colors',
                    active ? 'text-ink' : '',
                  )}
                >
                  {entry.circuitId.slice(0, 3).toUpperCase()}
                </span>
              </button>

              <Tooltip
                open={active}
                className={cx(
                  i < 2 ? 'left-0' : i > form.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                )}
              >
                <p className="text-[0.95rem] font-medium">{entry.event}</p>
                <p className="mono-label mt-1 text-[0.55rem]">
                  Round {entry.round}
                </p>
                <dl className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-2.5 text-[0.8rem]">
                  <Row label="Started" value={entry.grid ? `P${entry.grid}` : '—'} />
                  <Row label="Finished" value={dnf ? entry.status : `P${entry.position}`} />
                  <Row
                    label="Positions"
                    value={gained === 0 ? '—' : `${gained > 0 ? '+' : ''}${gained}`}
                    accent={gained > 0 ? '#35d67f' : gained < 0 ? '#ff5a5a' : undefined}
                  />
                  <Row label="Points" value={entry.points} />
                  <Row label="Fastest lap" value={entry.fastestLap ? 'Yes' : '—'} />
                  <Row label="Pit stops" value={entry.pitStops ?? '—'} />
                  <Row label="Weather" value={entry.wet ? 'Wet' : 'Dry'} />
                  <Row
                    label="Tyres"
                    value={entry.compounds?.length ? entry.compounds.map((c) => c[0]).join(' → ') : '—'}
                  />
                </dl>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="mono-label text-[0.5rem]">{label}</dt>
      <dd className="tabular font-medium" style={accent ? { color: accent } : undefined}>
        {value}
      </dd>
    </div>
  );
}
