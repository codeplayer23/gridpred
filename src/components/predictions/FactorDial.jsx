import { motion } from 'framer-motion';
import { tint } from '@/lib/format';
import { easeOut, viewport } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';

/**
 * Factor weights as a segmented ring.
 *
 * Each factor owns an arc proportional to its weight, separated by real gaps —
 * a composition, not six unrelated progress bars. Hovering a slice raises it out
 * of the ring so the mapping to the legend is unambiguous.
 */
export default function FactorDial({
  factors,
  weights,
  size = 260,
  active,
  onHover,
}) {
  const calm = useCalmMotion();
  const total = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  const r = size / 2 - 26;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = 5;

  const palette = ['#e10600', '#00d7b6', '#ff8000', '#3671ff', '#ff2d2d', '#a78bfa'];

  // Arcs are laid end to end, so each slice needs the running offset of the
  // ones before it.
  const slices = factors.reduce((acc, f, i) => {
    const share = (weights[f.key] ?? 0) / total;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].span : 0;
    acc.push({
      ...f,
      share,
      span: circumference * share,
      length: Math.max(0, circumference * share - gap),
      offset,
      color: palette[i % palette.length],
    });
    return acc;
  }, []);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
        {slices.map((s) => {
          const on = active === s.key;
          return (
            <motion.circle
              key={s.key}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={on ? 22 : 16}
              strokeLinecap="butt"
              strokeDasharray={`${s.length} ${circumference - s.length}`}
              strokeDashoffset={-s.offset}
              opacity={active && !on ? 0.32 : 1}
              onMouseEnter={() => onHover?.(s.key)}
              onMouseLeave={() => onHover?.(null)}
              className="cursor-pointer transition-[stroke-width,opacity] duration-300"
              style={{ filter: on ? `drop-shadow(0 0 12px ${tint(s.color, 0.6)})` : 'none' }}
              initial={calm ? false : { strokeDasharray: `0 ${circumference}` }}
              whileInView={{ strokeDasharray: `${s.length} ${circumference - s.length}` }}
              viewport={viewport}
              transition={{ duration: calm ? 0.2 : 1.1, ease: easeOut }}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        {active ? (
          <>
            <span className="tabular font-display text-[2.2rem] leading-none font-medium tracking-[-0.05em]">
              {weights[active]}%
            </span>
            <span className="mono-label mt-2.5 text-[0.55rem]">
              {factors.find((f) => f.key === active)?.label}
            </span>
          </>
        ) : (
          <>
            <span className="mono-label text-[0.55rem]">Model</span>
            <span className="mt-1.5 font-display text-[1.15rem] leading-tight font-medium tracking-[-0.03em]">
              Feature
              <br />
              weights
            </span>
          </>
        )}
      </div>
    </div>
  );
}
