import { motion } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { easeOut, viewport } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';
import Counter from './Counter';

/**
 * Open-ended radial gauge with a tick bezel.
 * Sweeps 260° so the gap at the bottom reads as an instrument dial.
 */
export default function RadialGauge({
  value = 0,
  max = 100,
  size = 160,
  stroke = 6,
  accent = '#e10600',
  label,
  sublabel,
  suffix = '',
  decimals = 0,
  ticks = 40,
  className = '',
}) {
  const calm = useCalmMotion();
  const r = (size - stroke * 2 - 14) / 2;
  const c = size / 2;
  const sweep = 260;
  const circumference = 2 * Math.PI * r;
  const arc = (sweep / 360) * circumference;
  const ratio = Math.max(0, Math.min(1, value / max));

  return (
    <div className={cx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-[220deg]"
        aria-hidden
      >
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 10px ${tint(accent, 0.45)})` }}
          initial={{ strokeDashoffset: arc }}
          whileInView={{ strokeDashoffset: arc * (1 - ratio) }}
          viewport={viewport}
          transition={{ duration: calm ? 0.25 : 1.5, ease: easeOut }}
        />
      </svg>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => {
          const a = (-220 + (i / (ticks - 1)) * sweep) * (Math.PI / 180);
          const inner = r + stroke / 2 + 4;
          const outer = inner + (i % 5 === 0 ? 6 : 3);
          const on = i / (ticks - 1) <= ratio;
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * inner}
              y1={c + Math.sin(a) * inner}
              x2={c + Math.cos(a) * outer}
              y2={c + Math.sin(a) * outer}
              stroke={on ? tint(accent, 0.5) : 'rgba(255,255,255,0.1)'}
              strokeWidth={1}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[1.7rem] leading-none font-medium tracking-[-0.04em]">
          <Counter value={value} decimals={decimals} suffix={suffix} />
        </span>
        {label && <span className="mono-label mt-2 text-[0.6rem]">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[0.7rem] text-ink-mute">{sublabel}</span>}
      </div>
    </div>
  );
}
