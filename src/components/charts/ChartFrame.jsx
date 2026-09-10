import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { queueMount } from '@/lib/mountQueue';

/**
 * Chart container with an optional segmented control.
 * Keeping the chrome here means individual charts stay pure presentation.
 */
export default function ChartFrame({
  title,
  subtitle,
  tabs,
  active,
  onTab,
  legend,
  children,
  height = 320,
  className = '',
  layoutId = 'chart-tab',
}) {
  /**
   * Charts mount one frame after their frame does.
   *
   * A Recharts tree measures its container and then builds a few hundred nodes,
   * and doing that in the same commit as the click that asked for it meant the
   * whole tab switch waited on every chart on the panel — the pill would not
   * even move until the last plot was ready. The queue hands out one mount per
   * frame, so the same total work stops landing on the interaction.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => queueMount(() => setReady(true)), []);

  return (
    <section className={cx('rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-xl md:p-7', className)}>
      <header className="mb-7 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          {title && (
            <h3 className="font-display text-[1.35rem] leading-tight font-medium tracking-[-0.03em]">
              {title}
            </h3>
          )}
          {subtitle && <p className="mt-2 max-w-md text-[0.86rem] leading-relaxed text-ink-mute">{subtitle}</p>}
        </div>

        {tabs?.length > 0 && (
          <div
            className="no-scrollbar -mx-1 flex shrink-0 gap-1 overflow-x-auto rounded-full border border-white/[0.08] p-1"
            role="tablist"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === t.id}
                onClick={() => onTab?.(t.id)}
                className={cx(
                  'relative rounded-full px-3.5 py-1.5 text-[0.73rem] font-medium tracking-[0.04em] whitespace-nowrap uppercase transition-colors',
                  active === t.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
                )}
              >
                {active === t.id && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={springSnappy}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* The plot area is reserved at its final height before the chart exists,
          so mounting it later costs no layout shift — see `ready` above. */}
      <div style={{ height }} className="w-full">
        {ready ? children : null}
      </div>

      {legend && <footer className="mt-5 border-t border-white/[0.06] pt-4">{legend}</footer>}
    </section>
  );
}
