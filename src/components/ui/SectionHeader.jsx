import { cx } from '@/lib/format';
import Reveal from './Reveal';

/** Eyebrow + oversized title + optional lede. The spine of every section. */
export default function SectionHeader({
  eyebrow,
  title,
  lede,
  align = 'left',
  action,
  className = '',
}) {
  return (
    <div
      className={cx(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center text-center',
        className,
      )}
    >
      <div className={cx('max-w-3xl', align === 'center' && 'mx-auto')}>
        {eyebrow && (
          <Reveal y={12}>
            <p className="mono-label mb-5 flex items-center gap-3">
              <span className="inline-block h-px w-8 bg-white/25" aria-hidden />
              {eyebrow}
            </p>
          </Reveal>
        )}
        <Reveal delay={0.06}>
          <h2 className="text-[clamp(2rem,5.2vw,4.25rem)] leading-[0.92] font-medium tracking-[-0.04em]">
            {title}
          </h2>
        </Reveal>
        {lede && (
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-dim md:text-lg">{lede}</p>
          </Reveal>
        )}
      </div>
      {action && (
        <Reveal delay={0.18} className="shrink-0">
          {action}
        </Reveal>
      )}
    </div>
  );
}
