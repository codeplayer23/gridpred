import { AnimatePresence, motion } from 'framer-motion';
import { cx, pad2 } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';
import { useNow } from '@/hooks/useNow';
import { weekendState, relativeTime } from '@/lib/session';

/**
 * Live race-weekend status.
 *
 * Reads the real session times for the round and the current clock, so the
 * label changes by itself: a session becomes LIVE when it starts, the strip
 * advances to the next session when it ends, and the countdown targets whatever
 * is genuinely next rather than a hardcoded race time.
 */
export default function SessionStatus({ race, className = '', showSessions = true }) {
  const calm = useCalmMotion();
  const now = useNow(1000);
  const { sessions, live, next } = weekendState(race, now);

  if (!sessions.length) return null;

  const target = live ? live.end : next?.start;
  const remaining = target ? Math.max(0, target - now) : 0;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining / 60_000) % 60);
  const s = Math.floor((remaining / 1000) % 60);
  const days = Math.floor(remaining / 86_400_000);

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={live ? `live-${live.name}` : next ? `next-${next.name}` : 'done'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={springSnappy}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {live ? (
            <span className="flex items-center gap-2.5 rounded-full bg-signal px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                {!calm && (
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full bg-white"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span className="text-[0.6rem] font-semibold tracking-[0.18em] text-white uppercase">
                {live.name} live
              </span>
            </span>
          ) : next ? (
            <span className="mono-label text-[0.58rem]">
              Next session · {next.name}
            </span>
          ) : (
            <span className="mono-label text-[0.58rem]">Weekend complete</span>
          )}

          {target && (
            <span className="tabular text-[0.85rem] font-medium text-ink-dim">
              {live ? 'ends' : 'starts'} {days > 0 ? `in ${days}d ${pad2(h % 24)}h` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`}
            </span>
          )}
        </motion.div>
      </AnimatePresence>

      {showSessions && (
        <ol className="flex flex-wrap gap-x-5 gap-y-2">
          {sessions.map((session) => (
            <li key={session.name} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1 w-1 rounded-full"
                style={{
                  background:
                    session.status === 'live'
                      ? 'var(--color-signal)'
                      : session.status === 'complete'
                        ? 'var(--color-ink-faint)'
                        : 'var(--color-ink-mute)',
                }}
              />
              <span
                className={cx(
                  'text-[0.72rem]',
                  session.status === 'live'
                    ? 'font-medium text-ink'
                    : session.status === 'complete'
                      ? 'text-ink-faint line-through decoration-white/20'
                      : 'text-ink-mute',
                )}
              >
                {session.name}
              </span>
              <span className="mono-label text-[0.5rem]">
                {relativeTime(session.start, now)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
