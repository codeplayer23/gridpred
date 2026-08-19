import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Minus } from 'lucide-react';
import DriverHeadshot from '@/components/drivers/DriverHeadshot';
import { cx, tint } from '@/lib/format';
import { spring } from '@/lib/motion';

/**
 * Animated ranked grid.
 *
 * Rows are keyed by driver and laid out with `layout`, so when the model
 * re-ranks the field the cards physically travel to their new positions rather
 * than the list redrawing — the movement is the explanation.
 */
export default function PredictionGrid({
  rows,
  mode = 'race',
  onSelect,
  selectedId,
  limit = 10,
}) {
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.slice(0, limit).map((row) => {
        const { driver, team } = row;
        const position = mode === 'race' ? row.position : row.gridPosition;
        const delta = row.delta;
        const selected = selectedId === row.driverId;
        const podium = position <= 3;

        return (
          <motion.li
            key={row.driverId}
            layout
            transition={spring}
            style={{ zIndex: 30 - position }}
          >
            <button
              type="button"
              onClick={() => onSelect?.(row.driverId)}
              aria-pressed={selected}
              className={cx(
                'group relative flex w-full items-center gap-4 overflow-hidden rounded-[18px] border px-4 py-3 text-left transition-colors duration-300 md:gap-6 md:px-5 md:py-3.5',
                selected
                  ? 'border-white/25 bg-white/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.022] hover:border-white/[0.16] hover:bg-white/[0.045]',
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-70"
                style={{
                  background: `linear-gradient(90deg, ${tint(team.accent, podium ? 0.2 : 0.11)}, transparent)`,
                }}
              />

              {/* position */}
              <span className="relative flex w-11 shrink-0 items-baseline gap-1 md:w-14">
                <span className="mono-label text-[0.68rem] text-ink-faint">P</span>
                <motion.span
                  key={position}
                  className="tabular font-display text-[1.6rem] leading-none font-medium tracking-[-0.05em] md:text-[2rem]"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {position}
                </motion.span>
              </span>

              <span className="relative hidden shrink-0 sm:block">
                <DriverHeadshot driver={driver} team={team} size={46} showNumber={false} glow={false} tilt={false} />
              </span>

              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-[0.98rem] font-medium tracking-[-0.01em]">
                  {driver.firstName} <span className="font-semibold">{driver.lastName}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[0.74rem] text-ink-mute">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: team.accent }} aria-hidden />
                  <span className="truncate">{team.name}</span>
                </span>
              </span>

              {/* grid → race movement */}
              {mode === 'race' && (
                <span
                  className={cx(
                    'relative hidden w-16 shrink-0 items-center justify-end gap-1 text-[0.8rem] font-medium sm:flex',
                  )}
                  style={{ color: delta > 0 ? '#35d67f' : delta < 0 ? '#ff5a5a' : '#454b55' }}
                  title={`Grid P${row.gridPosition}`}
                >
                  {delta > 0 ? <ChevronUp size={14} aria-hidden /> : delta < 0 ? <ChevronDown size={14} aria-hidden /> : <Minus size={12} aria-hidden />}
                  {delta !== 0 && Math.abs(delta)}
                </span>
              )}

              {/* win probability */}
              <span className="relative w-[4.5rem] shrink-0 text-right md:w-24">
                <span className="mono-label block text-[0.5rem]">
                  {mode === 'race' ? 'Win' : 'Score'}
                </span>
                <span
                  className="tabular mt-1 block text-[1.05rem] font-medium"
                  style={{ color: team.accent }}
                >
                  {mode === 'race' ? `${row.winProbability}%` : row.score}
                </span>
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}
