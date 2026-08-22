import { motion } from 'framer-motion';
import { cx } from '@/lib/format';
import { useCalmMotion } from '@/hooks';
import { useLiveSeason } from '@/hooks/useLiveSeason';
import { relativeTime } from '@/lib/session';
import { useNow } from '@/hooks/useNow';

/**
 * Data freshness badge.
 *
 * States the honest position at a glance: whether the championship figures on
 * screen came from the live results feed or the bundled snapshot, and when they
 * were last confirmed.
 */
export default function LiveIndicator({ className = '', compact = false }) {
  const { status, fetchedAt, round, snapshotRound, aheadOfSnapshot } = useLiveSeason();
  const calm = useCalmMotion();
  const now = useNow(30_000);

  const live = status === 'live';
  const dotColour = live ? 'var(--color-positive)' : status === 'offline' ? '#6b7280' : 'var(--color-signal)';

  const label = live
    ? `Live · round ${round ?? snapshotRound}`
    : status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? 'Snapshot'
        : 'Snapshot';

  const detail = live && fetchedAt ? relativeTime(new Date(fetchedAt).getTime(), now) : null;

  return (
    <span
      className={cx('inline-flex items-center gap-2 whitespace-nowrap', className)}
      title={
        live
          ? `Championship synced from the live results feed${aheadOfSnapshot ? ` — newer than the bundled snapshot (round ${snapshotRound})` : ''}`
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
