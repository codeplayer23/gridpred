import { memo } from 'react';
import { cx } from '@/lib/format';

/**
 * GridPred identity.
 *
 * The mark is a starting grid seen from above — four staggered boxes with the
 * pole slot picked out in red. It reads as "grid" at 20px, is drawn entirely in
 * vector so it stays crisp at any size, and borrows no Formula 1 trade dress.
 */
export const GridMark = memo(function GridMark({ size = 26, className = '', animated = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cx(animated && 'transition-transform duration-500 group-hover:rotate-[-8deg]', className)}
      aria-hidden
    >
      <rect x="2" y="7" width="12" height="7" rx="1.6" fill="currentColor" opacity="0.32" />
      <rect x="18" y="2" width="12" height="7" rx="1.6" fill="var(--color-signal)" />
      <rect x="2" y="18" width="12" height="7" rx="1.6" fill="currentColor" opacity="0.2" />
      <rect x="18" y="13" width="12" height="7" rx="1.6" fill="currentColor" opacity="0.26" />
      <rect x="18" y="24" width="12" height="6" rx="1.6" fill="currentColor" opacity="0.12" />
    </svg>
  );
});

/**
 * Full lockup. `GRID` sits in regular weight against `PRED` in semibold so the
 * two halves read as one word with an internal hinge.
 */
function Wordmark({ size = 'md', className = '', showMark = true }) {
  const scale = {
    sm: { text: 'text-[0.92rem]', mark: 20 },
    md: { text: 'text-[1.05rem]', mark: 25 },
    lg: { text: 'text-[1.5rem]', mark: 34 },
  }[size];

  return (
    <span className={cx('flex items-center gap-2.5 text-ink', className)}>
      {showMark && <GridMark size={scale.mark} />}
      <span
        className={cx(
          'font-display leading-none tracking-[-0.045em] whitespace-nowrap',
          scale.text,
        )}
      >
        <span className="font-normal text-ink-dim">GRID</span>
        <span className="font-semibold">PRED</span>
      </span>
    </span>
  );
}

export default memo(Wordmark);
