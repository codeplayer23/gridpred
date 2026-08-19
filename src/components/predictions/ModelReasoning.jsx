import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import DriverHeadshot from '@/components/drivers/DriverHeadshot';
import { tint } from '@/lib/format';
import { spring, viewport } from '@/lib/motion';

/**
 * "What the model sees".
 *
 * Each factor's contribution is shown relative to the field average, positive
 * and negative alike — a prediction that only ever lists reasons to be
 * optimistic is not an explanation.
 */
export default function ModelReasoning({ explanation, accent }) {
  if (!explanation) return null;
  const { driver, row, positives, negatives } = explanation;
  const all = [...positives, ...negatives];
  const peak = Math.max(...all.map((c) => Math.abs(c.value)), 1);

  return (
    <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
      <div>
        <p className="mono-label mb-5">The model's case</p>
        <h3 className="font-display text-[clamp(2rem,5vw,3.6rem)] leading-[0.94] font-medium tracking-[-0.045em]">
          WHY
          <br />
          {driver.lastName.toUpperCase()}?
        </h3>
        <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-ink-mute">
          Every figure below is this driver measured against the field average for
          that factor, scaled by how much the model weighs it.
        </p>

        <div className="mt-9 flex items-center gap-5">
          <DriverHeadshot driver={driver} team={row.team} size={104} showNumber={false} />
          <div>
            <p className="tabular text-[2.4rem] leading-none font-medium tracking-[-0.05em]" style={{ color: accent }}>
              {row.winProbability}%
            </p>
            <p className="mono-label mt-2 text-[0.55rem]">Win share</p>
          </div>
        </div>

        <Link
          to={`/drivers/${driver.id}`}
          className="mono-label mt-8 inline-block transition-colors hover:text-ink"
        >
          Open driver profile →
        </Link>
      </div>

      <ul className="grid content-start gap-3 sm:grid-cols-2">
        {all.map((c, i) => {
          const positive = c.value >= 0;
          const colour = positive ? '#35d67f' : '#ff5a5a';
          return (
            <motion.li
              key={c.key}
              className="relative overflow-hidden rounded-[18px] border border-white/[0.07] bg-white/[0.022] p-5"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              transition={{ ...spring, delay: i * 0.06 }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{
                  width: `${(Math.abs(c.value) / peak) * 100}%`,
                  background: `linear-gradient(90deg, ${tint(colour, 0.16)}, transparent)`,
                }}
              />
              <div className="relative flex items-start justify-between gap-3">
                <span className="mono-label text-[0.55rem] leading-relaxed">{c.label}</span>
                {positive ? (
                  <TrendingUp size={14} style={{ color: colour }} aria-hidden />
                ) : (
                  <TrendingDown size={14} style={{ color: colour }} aria-hidden />
                )}
              </div>
              <p
                className="tabular relative mt-3 text-[1.9rem] leading-none font-medium tracking-[-0.05em]"
                style={{ color: colour }}
              >
                {positive ? '+' : '−'}
                {Math.abs(c.value).toFixed(1)}%
              </p>
              <p className="relative mt-2.5 text-[0.75rem] text-ink-faint">
                Raw score {c.raw} / 100
              </p>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
