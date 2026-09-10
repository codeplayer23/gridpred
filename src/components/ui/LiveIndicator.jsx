import { motion } from 'framer-motion';
import { cx } from '@/lib/format';
import { useCalmMotion } from '@/hooks';
import { useLiveSeason } from '@/hooks/useLiveSeason';
import { relativeTime, weekendIsLive, weekendState } from '@/lib/session';
import { useNow } from '@/hooks/useNow';
import { nextRace } from '@/data/races';

/**
 * Data freshness badge.
 *
 * Two different things could be called "live" here, and conflating them is
 * misleading: whether the results feed is answering, and whether cars are on
 * track. A pulsing green LIVE beside a round number reads as the second, so it
 * is reserved for it — the badge only goes live once free practice 1 has begun,
 * and between weekends it reports the far less dramatic truth, which is that the
 * championship figures are synced.
 */
export default function LiveIndicator({ className = '', compact = false }) {
  const { status, fetchedAt, round, snapshotRound, aheadOfSnapshot } = useLiveSeason();
  const calm = useCalmMotion();
  const now = useNow(30_000);

  const race = nextRace(now);
  const onTrack = weekendIsLive(race, now);
  const running = onTrack ? weekendState(race, now).live : null;

  const synced = status === 'live';
  const live = synced && onTrack;
  const dotColour = live
    ? 'var(--color-positive)'
    : status === 'offline'
      ? '#6b7280'
      : synced
        ? 'var(--color-ink-faint)'
        : 'var(--color-signal)';

  const label = live
    ? `Live · ${running ? running.name : `round ${race.round}`}`
    : status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? 'Snapshot'
        : synced
          ? `Synced · round ${round ?? snapshotRound}`
          : 'Snapshot';

  const detail = synced && fetchedAt ? relativeTime(new Date(fetchedAt).getTime(), now) : null;

  return (
    <span
      className={cx('inline-flex items-center gap-2 whitespace-nowrap', className)}
      title={
        live
          ? `${running ? `${running.name} is running now. ` : 'Race weekend under way. '}Championship synced from the live results feed`
          : synced
            ? `Championship synced from the live results feed${aheadOfSnapshot ? ` — newer than the bundled snapshot (round ${snapshotRound})` : ''}. No session is running.`
            : 'Showing the championship as bundled at build time'
      }
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {live && !calm && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ background: dotColour }}
            animate={{ opacity: [1, 0.25, 1], scale: [1, 1.9, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: dotColour }} />
      </span>
      <span className="mono-label text-[0.55rem]" style={{ color: live ? undefined : 'var(--color-ink-faint)' }}>
        {label}
        {!compact && detail && <span className="text-ink-faint"> · {detail}</span>}
      </span>
    </span>
  );
}
