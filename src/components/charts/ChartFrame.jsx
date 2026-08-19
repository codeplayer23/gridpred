import { motion } from 'framer-motion';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';

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

      <div style={{ height }} className="w-full">
        {children}
      </div>

      {legend && <footer className="mt-5 border-t border-white/[0.06] pt-4">{legend}</footer>}
    </section>
  );
}
