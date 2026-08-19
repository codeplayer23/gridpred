import { cx } from '@/lib/format';

/** Shared Recharts tooltip surface so every chart speaks the same language. */
export default function ChartTooltip({ active, payload, label, formatter, title, className = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cx(
        'rounded-2xl border border-white/10 bg-[#0d1016]/96 px-4 py-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl',
        className,
      )}
    >
      <p className="mono-label mb-2.5 text-[0.58rem]">{title ?? label}</p>
      <ul className="flex flex-col gap-1.5">
        {payload.map((entry) => (
          <li key={entry.dataKey ?? entry.name} className="flex items-center gap-3 text-[0.82rem]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color ?? entry.stroke ?? entry.fill }}
              aria-hidden
            />
            <span className="text-ink-dim">{entry.name}</span>
            <span className="tabular ml-auto font-medium text-ink">
              {formatter ? formatter(entry.value, entry) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
