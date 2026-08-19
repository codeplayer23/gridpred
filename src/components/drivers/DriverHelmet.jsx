import { memo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { useCalmMotion } from '@/hooks';

/**
 * Drawn racing helmet in team livery.
 *
 * Real helmet designs are copyrighted artwork and are not distributed under a
 * licence that allows reuse here, so GridPred draws its own: the shell takes the
 * constructor's real colour and the livery stripe is angled from the driver's
 * real racing number. It is used as the portrait fallback for any driver the F1
 * media CDN has no photograph for, and as a secondary visual on driver pages.
 */
const SHELL =
  'M100 12 C154 12 181 50 181 98 C181 124 177 143 169 157 C161 171 144 180 120 181 L80 181 C56 180 39 171 31 157 C23 143 19 124 19 98 C19 50 46 12 100 12 Z';
const VISOR =
  'M34 94 C42 70 70 58 100 58 C130 58 158 70 166 94 L164 114 C152 130 128 138 100 138 C72 138 48 130 36 114 Z';
const CHIN =
  'M38 141 C60 154 140 154 162 141 L166 158 C158 172 142 180 120 181 L80 181 C58 180 42 172 34 158 Z';
const FIN = 'M96 10 C118 10 134 17 143 26 L126 31 C117 24 107 21 96 21 Z';

function DriverHelmet({
  driver,
  team,
  size = 200,
  className = '',
  tilt = true,
  glow = true,
}) {
  const calm = useCalmMotion();
  const accent = team?.accent ?? team?.color ?? '#e10600';
  const soft = team?.accentSoft ?? accent;
  const uid = `hlm-${driver.id}`;
  const number = driver.number ?? 0;
  const skew = (number % 5) * 6 - 12;
  const bandY = 26 + (number % 3) * 6;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 220, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-16, 16]), { stiffness: 220, damping: 20 });

  const interactive = tilt && !calm;
  const handlers = interactive
    ? {
        onPointerMove: (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
        },
        onPointerLeave: () => {
          mx.set(0);
          my.set(0);
        },
      }
    : {};

  return (
    <motion.div
      className={cx('relative select-none', className)}
      style={{
        width: size,
        height: size,
        perspective: 700,
        transformStyle: 'preserve-3d',
        rotateX: interactive ? rx : 0,
        rotateY: interactive ? ry : 0,
      }}
      {...handlers}
    >
      {glow && (
        <span
          aria-hidden
          className="absolute inset-[-16%] rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${tint(accent, 0.36)}, transparent 72%)` }}
        />
      )}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label={`${driver.name ?? driver.lastName} helmet in ${team?.name ?? ''} colours`}
      >
        <defs>
          <linearGradient id={`${uid}-shell`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={soft} />
            <stop offset="52%" stopColor={accent} />
            <stop offset="100%" stopColor="#0b0d11" />
          </linearGradient>
          <linearGradient id={`${uid}-visor`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#05070a" />
            <stop offset="46%" stopColor="#12161d" />
            <stop offset="100%" stopColor="#05070a" />
          </linearGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}>
            <path d={SHELL} />
          </clipPath>
        </defs>

        <ellipse cx="100" cy="190" rx="60" ry="7" fill="#000" opacity="0.55" />
        <path d={FIN} fill={accent} opacity="0.9" />
        <path d={SHELL} fill={`url(#${uid}-shell)`} />
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x="-60" y={bandY} width="320" height="14" fill="#05070a" opacity="0.8" transform={`rotate(${skew} 100 100)`} />
          <rect x="-60" y={bandY + 16} width="320" height="4.5" fill={soft} opacity="0.95" transform={`rotate(${skew} 100 100)`} />
          <path d={SHELL} fill={`url(#${uid}-sheen)`} />
        </g>
        <path d={CHIN} fill="#0a0d12" />
        <path d={CHIN} fill="none" stroke={tint(accent, 0.5)} strokeWidth="1.6" />
        <path d={VISOR} fill={`url(#${uid}-visor)`} />
        <path d={VISOR} fill="none" stroke={tint(accent, 0.9)} strokeWidth="2.4" />
        <path d="M48 92 C58 76 76 66 98 64" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="6" strokeLinecap="round" />
        <path d={SHELL} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="1.5" />
      </svg>
    </motion.div>
  );
}

export default memo(DriverHelmet);
