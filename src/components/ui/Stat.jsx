import { cx } from '@/lib/format';
import Counter from './Counter';

/** Label-over-number stat block. Size drives hierarchy, not colour. */
export default function Stat({
  label,
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  hint,
  size = 'md',
  accent,
  animate = true,
  className = '',
}) {
  const sizes = {
    sm: 'text-[1.35rem]',
    md: 'text-[clamp(1.75rem,3vw,2.5rem)]',
    lg: 'text-[clamp(2.5rem,5.5vw,4.5rem)]',
  };

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <span className="mono-label">{label}</span>
      <span
        className={cx('tabular leading-none font-medium tracking-[-0.045em]', sizes[size])}
        style={accent ? { color: accent } : undefined}
      >
        {prefix}
        {animate && typeof value === 'number' ? (
          <Counter value={value} decimals={decimals} />
        ) : (
          value
        )}
        {suffix && <span className="text-ink-mute">{suffix}</span>}
      </span>
      {hint && <span className="text-[0.78rem] text-ink-mute">{hint}</span>}
    </div>
  );
}
