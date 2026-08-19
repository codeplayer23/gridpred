import { useState } from 'react';
import { motion } from 'framer-motion';
import { cx, band, tint } from '@/lib/format';
import { easeOut, viewport } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';
import { ratingLabels, ratingBasis, drivers, hasRating, MIN_SAMPLES } from '@/data/drivers';

/**
 * Driver profile as a radial spoke diagram.
 *
 * Each attribute is a spoke whose length is the driver's score and whose faint
 * outer ring is the field average — so a strength is legible as *distance from
 * the rest of the grid*, which a row of progress bars can never show.
 */
export default function AttributeProfile({ driver, accent = '#e10600', size = 420 }) {
  const calm = useCalmMotion();
  const [hover, setHover] = useState(null);
  // Only show a dimension the season actually supports; a score built on one
  // race would read exactly like one built on eleven.
  const keys = Object.keys(ratingLabels).filter((k) => hasRating(driver, k));
  const n = keys.length;
  const cx0 = size / 2;
  const cy0 = size / 2;
  const rMax = size / 2 - 74;
  const rMin = rMax * 0.24;

  const fieldAvg = Object.fromEntries(
    keys.map((k) => [
      k,
      drivers.filter((d) => hasRating(d, k)).reduce((s, d, _, a) => s + d.ratings[k] / a.length, 0),
    ]),
  );

  const angle = (i) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const radius = (v) => rMin + (v / 100) * (rMax - rMin);
  const point = (i, v) => ({
    x: cx0 + Math.cos(angle(i)) * radius(v),
    y: cy0 + Math.sin(angle(i)) * radius(v),
  });

  const shape = keys.map((k, i) => point(i, driver.ratings[k]));
  const avgShape = keys.map((k, i) => point(i, fieldAvg[k]));
  const toPath = (pts) => `${pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} Z`;

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
      <div className="relative shrink-0" style={{ width: size, maxWidth: '100%' }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full overflow-visible" role="img"
          aria-label={`${driver.lastName} performance profile across nine dimensions`}>
          {/* rings */}
          {[0.25, 0.5, 0.75, 1].map((t) => (
            <circle
              key={t}
              cx={cx0}
              cy={cy0}
              r={rMin + t * (rMax - rMin)}
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="1"
            />
          ))}
          {/* spokes */}
          {keys.map((k, i) => {
            const outer = point(i, 104);
            return (
              <line
                key={k}
                x1={cx0}
                y1={cy0}
                x2={outer.x}
                y2={outer.y}
                stroke={hover === k ? tint(accent, 0.55) : 'rgba(255,255,255,0.07)'}
                strokeWidth="1"
              />
            );
          })}

          {/* field average */}
          <path d={toPath(avgShape)} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeDasharray="3 5" />

          {/* driver shape */}
          <motion.path
            d={toPath(shape)}
            fill={tint(accent, 0.16)}
            stroke={accent}
            strokeWidth="2"
            strokeLinejoin="round"
            initial={calm ? { opacity: 1 } : { opacity: 0, scale: 0.72 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewport}
            transition={{ duration: calm ? 0.2 : 0.9, ease: easeOut }}
            style={{ transformOrigin: `${cx0}px ${cy0}px` }}
          />

          {/* nodes + labels */}
          {keys.map((k, i) => {
            const p = point(i, driver.ratings[k]);
            const l = point(i, 118);
            const a = angle(i);
            const anchor = Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle';
            return (
              <g
                key={k}
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default"
              >
                <circle cx={p.x} cy={p.y} r={hover === k ? 5.5 : 3.5} fill={accent} />
                <circle cx={l.x} cy={l.y} r="26" fill="transparent" />
                <text
                  x={l.x}
                  y={l.y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="fill-current"
                  style={{
                    fontSize: 10.5,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    fill: hover === k ? '#f4f5f7' : '#6b7280',
                  }}
                >
                  {ratingLabels[k].split(' ')[0]}
                </text>
                <text
                  x={l.x}
                  y={l.y + 14}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  style={{ fontSize: 12, fontWeight: 600, fill: hover === k ? accent : '#a2a9b4' }}
                >
                  {Math.round(driver.ratings[k])}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="grid w-full flex-1 grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-1">
        {keys.map((k) => {
          const v = driver.ratings[k];
          const delta = v - fieldAvg[k];
          return (
            <li
              key={k}
              onMouseEnter={() => setHover(k)}
              onMouseLeave={() => setHover(null)}
              className={cx(
                'flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors duration-300',
                hover === k ? 'bg-white/[0.05]' : '',
              )}
            >
              <span className="text-[0.88rem] text-ink-dim" title={ratingBasis[k]}>
                {ratingLabels[k]}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[0.72rem] text-ink-faint">{band(v)}</span>
                <span
                  className="tabular w-11 text-right text-[0.72rem]"
                  style={{ color: delta >= 0 ? '#35d67f' : '#ff5a5a' }}
                >
                  {delta >= 0 ? '+' : '−'}
                  {Math.abs(delta).toFixed(0)}
                </span>
                <span className="tabular w-7 text-right font-medium">{Math.round(v)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
