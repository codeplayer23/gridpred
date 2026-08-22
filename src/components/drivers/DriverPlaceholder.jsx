import { memo } from 'react';
import { cx, tint } from '@/lib/format';

/**
 * Neutral stand-in for a driver photograph.
 *
 * Shown only when no current, openly-licensed photograph of that driver exists.
 * Deliberately anonymous: an outdated photograph — one showing the driver in a
 * team they no longer race for — would be worse than showing nothing, so this
 * is what the interface displays instead.
 */
function DriverPlaceholder({ driver, team, size = 240, className = '', label = true }) {
  const accent = team?.accent ?? driver?.teamColor ?? '#6b7280';
  return (
    <div
      className={cx('relative flex flex-col items-center justify-end', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${driver?.name ?? 'Driver'} — no current photograph available`}
    >
      <span
        aria-hidden
        className="absolute inset-[12%] rounded-full blur-2xl"
        style={{ background: `radial-gradient(closest-side, ${tint(accent, 0.18)}, transparent 72%)` }}
      />
      <svg viewBox="0 0 200 200" width={size} height={size} className="relative" aria-hidden>
        <defs>
          <linearGradient id={`ph-${driver?.id ?? 'x'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tint(accent, 0.5)} />
            <stop offset="100%" stopColor={tint(accent, 0.12)} />
          </linearGradient>
        </defs>
        {/* anonymous bust */}
        <circle cx="100" cy="74" r="34" fill={`url(#ph-${driver?.id ?? 'x'})`} />
        <path
          d="M34 186 C34 142 62 118 100 118 C138 118 166 142 166 186 Z"
          fill={`url(#ph-${driver?.id ?? 'x'})`}
        />
        <circle cx="100" cy="74" r="34" fill="none" stroke={tint(accent, 0.55)} strokeWidth="1.5" strokeDasharray="4 5" />
        <path
          d="M34 186 C34 142 62 118 100 118 C138 118 166 142 166 186"
          fill="none" stroke={tint(accent, 0.55)} strokeWidth="1.5" strokeDasharray="4 5"
        />
      </svg>
      {label && (
        <span className="absolute inset-x-0 bottom-1 text-center">
          <span className="mono-label block text-[0.5rem] leading-tight">GridPred</span>
          <span className="mono-label block text-[0.46rem] leading-tight text-ink-faint">
            photo unavailable
          </span>
        </span>
      )}
    </div>
  );
}

export default memo(DriverPlaceholder);
