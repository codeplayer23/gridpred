import { cx } from '@/lib/format';

const PODIUM = {
  1: 'text-void bg-[#f4d97a]',
  2: 'text-void bg-[#d5dae2]',
  3: 'text-void bg-[#d09a63]',
};

/** Finishing / grid position chip. Podium slots get metal, everyone else glass. */
export default function PositionBadge({ position, size = 'md', className = '' }) {
  const podium = PODIUM[position];
  return (
    <span
      className={cx(
        'tabular inline-flex items-center justify-center rounded-lg font-medium tracking-[-0.02em]',
        size === 'lg' ? 'h-11 w-11 text-lg' : size === 'sm' ? 'h-6 w-6 text-[0.72rem]' : 'h-8 w-8 text-sm',
        podium ?? 'bg-white/[0.06] text-ink-dim hairline',
        className,
      )}
    >
      {position}
    </span>
  );
}
