import { cx } from '@/lib/format';

/** Team colour marker + label. The one place team colour is always allowed. */
export default function TeamBadge({ team, size = 'md', showName = true, className = '' }) {
  if (!team) return null;
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className={cx('block rounded-full', size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5')}
        style={{ background: team.accent, boxShadow: `0 0 10px ${team.accent}80` }}
      />
      {showName && (
        <span
          className={cx(
            'font-medium tracking-[-0.01em] text-ink-dim',
            size === 'sm' ? 'text-[0.78rem]' : 'text-sm',
          )}
        >
          {team.name}
        </span>
      )}
    </span>
  );
}
