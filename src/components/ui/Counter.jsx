import { cx } from '@/lib/format';
import { useCountUp } from '@/hooks';

/** Number that counts up when scrolled into view. */
export default function Counter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.4,
  className = '',
}) {
  const [ref, display] = useCountUp(value, { decimals, prefix, suffix, duration });
  return (
    <span ref={ref} className={cx('tabular', className)}>
      {display}
    </span>
  );
}
