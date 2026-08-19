import { motion } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { easeOut, viewport } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';

/**
 * Segmented tick meter.
 *
 * Deliberately not a progress bar: the value is quantised into discrete
 * telemetry ticks that light up in sequence, which reads as an instrument
 * rather than a loading state.
 */
export default function Meter({
  value = 0,
  max = 100,
  segments = 24,
  accent = '#e10600',
  label,
  readout,
  className = '',
  height = 26,
}) {
  const calm = useCalmMotion();
  const ratio = Math.max(0, Math.min(1, value / max));
  const lit = Math.round(ratio * segments);

  return (
    <div className={cx('w-full', className)}>
      {(label || readout != null) && (
        <div className="mb-2.5 flex items-baseline justify-between gap-4">
          {label && <span className="mono-label">{label}</span>}
          {readout != null && (
            <span className="tabular text-sm font-medium text-ink">{readout}</span>
          )}
        </div>
      )}
      <div
        className="flex items-end gap-[3px]"
        style={{ height }}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        {Array.from({ length: segments }, (_, i) => {
          const on = i < lit;
          const edge = on && i >= lit - 2;
          return (
            <motion.span
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                background: on ? (edge ? accent : tint(accent, 0.55)) : 'rgba(255,255,255,0.07)',
                boxShadow: edge ? `0 0 12px ${tint(accent, 0.55)}` : 'none',
              }}
              initial={calm ? { height: `${40 + (i / segments) * 60}%` } : { height: '18%', opacity: 0.2 }}
              whileInView={{
                height: `${38 + (i / segments) * 62}%`,
                opacity: 1,
              }}
              viewport={viewport}
              transition={{
                duration: calm ? 0.2 : 0.5,
                ease: easeOut,
                delay: calm ? 0 : i * 0.018,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
