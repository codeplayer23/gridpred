import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PositionBadge from '@/components/ui/PositionBadge';
import TeamLogo from '@/components/teams/TeamLogo';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { drivers } from '@/data/drivers';
import { getTeam } from '@/data/teams';
import { useWeekendSessions, useWeekendGrid } from '@/hooks/useLiveSeason';

/**
 * Session-by-session classification for the latest race weekend.
 *
 * The results feed publishes the Grand Prix only, so practice, sprint and
 * qualifying come from the timing API instead. Renders nothing until at least
 * one session of the weekend has been timed.
 */
function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
}

export default function SessionResults({ className = '' }) {
  const weekend = useWeekendSessions();
  const { drivers: grid } = useWeekendGrid();
  const [active, setActive] = useState(null);

  const timed = weekend?.sessions?.filter((s) => s.results?.length) ?? [];
  if (!timed.length) return null;

  const current = timed.find((s) => s.name === active) ?? timed[timed.length - 1];
  const pool = grid.length ? grid : drivers;
  const byNumber = new Map(pool.map((d) => [d.number, d]));

  return (
    <section className={cx('rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-xl md:p-7', className)}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-display text-[1.3rem] leading-tight font-medium tracking-[-0.03em]">
            Session results
          </h3>
          <p className="mt-1.5 text-[0.82rem] text-ink-mute">
            Timed classification for {weekend.location ?? 'the latest weekend'}.
          </p>
        </div>
        <div className="no-scrollbar -mx-1 flex shrink-0 gap-1 overflow-x-auto rounded-full border border-white/[0.08] p-1">
          {timed.map((s) => (
            <button
              key={s.sessionKey}
              type="button"
              onClick={() => setActive(s.name)}
              className={cx(
                'relative rounded-full px-3.5 py-1.5 text-[0.72rem] font-medium whitespace-nowrap transition-colors',
                current.sessionKey === s.sessionKey ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
              )}
            >
              {current.sessionKey === s.sessionKey && (
                <motion.span layoutId="session-tab" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
              )}
              <span className="relative">{s.name}</span>
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.ol
          key={current.sessionKey}
          className="flex flex-col gap-1.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {current.results.slice(0, 12).map((row) => {
            const driver = byNumber.get(row.number);
            const team = driver ? getTeam(driver.team) : null;
            return (
              <li
                key={row.number ?? row.position}
                className="flex items-center gap-3.5 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5"
              >
                <PositionBadge position={row.position} size="sm" />
                {team && <TeamLogo team={team} size={15} showFallbackLabel={false} />}
                <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium">
                  {driver ? driver.name : `Car #${row.number}`}
                </span>
                <span className="tabular hidden w-14 shrink-0 text-right text-[0.75rem] text-ink-faint sm:block">
                  {row.laps != null ? `${row.laps} laps` : ''}
                </span>
                <span className="tabular w-24 shrink-0 text-right text-[0.82rem]">
                  {row.dnf ? (
                    <span className="text-negative">DNF</span>
                  ) : row.dns ? (
                    <span className="text-ink-faint">DNS</span>
                  ) : row.position === 1 ? (
                    formatDuration(row.duration)
                  ) : row.gap != null ? (
                    <span className="text-ink-mute">+{Number(row.gap).toFixed(3)}</span>
                  ) : (
                    formatDuration(row.duration)
                  )}
                </span>
              </li>
            );
          })}
        </motion.ol>
      </AnimatePresence>
    </section>
  );
}
