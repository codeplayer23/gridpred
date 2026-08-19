import { memo, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { useCalmMotion } from '@/hooks';
import DriverHelmet from './DriverHelmet';

/**
 * Driver portrait.
 *
 * Uses the official headshot that FastF1 publishes for each driver, served from
 * the F1 media CDN by reference — nothing is copied into this repository. The
 * build step verifies each URL actually returns a photograph rather than the
 * CDN's generic silhouette; drivers without one (currently Arvid Lindblad) fall
 * back to the drawn helmet, and so does any image that fails to load at runtime.
 *
 * The racing number sits behind the portrait at display scale, per the brand's
 * treatment of the number as an identity element rather than a caption.
 */
function DriverHeadshot({
  driver,
  team,
  size = 260,
  className = '',
  showNumber = true,
  tilt = true,
  glow = true,
  priority = false,
}) {
  const calm = useCalmMotion();
  const [failed, setFailed] = useState(false);
  const accent = team?.accent ?? team?.color ?? driver.teamColor ?? '#e10600';
  const shot = driver.headshot ?? null;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 210, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-11, 11]), { stiffness: 210, damping: 20 });
  const px = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 180, damping: 22 });

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

  if (!shot || failed) {
    return (
      <DriverHelmet
        driver={driver}
        team={team ?? { accent }}
        size={size}
        className={className}
        tilt={tilt}
        glow={glow}
      />
    );
  }

  return (
    <motion.div
      className={cx('relative select-none', className)}
      style={{
        width: size,
        height: size,
        perspective: 800,
        rotateX: interactive ? rx : 0,
        rotateY: interactive ? ry : 0,
      }}
      {...handlers}
    >
      {glow && (
        <span
          aria-hidden
          className="absolute inset-[-14%] rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${tint(accent, 0.32)}, transparent 72%)` }}
        />
      )}

      {showNumber && (
        <span
          aria-hidden
          className="tabular absolute inset-0 flex items-center justify-center font-display leading-none font-semibold"
          style={{
            fontSize: size * 0.72,
            color: tint(accent, 0.2),
            letterSpacing: '-0.06em',
            transform: 'translateY(-6%)',
          }}
        >
          {driver.number}
        </span>
      )}

      <motion.img
        src={shot.md}
        srcSet={`${shot.sm} 206w, ${shot.md} 432w, ${shot.lg} 658w`}
        sizes={`${Math.round(size)}px`}
        alt={`${driver.name}, ${team?.name ?? driver.teamName}`}
        width={size}
        height={size}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className="relative h-full w-full object-contain object-bottom"
        style={{ x: interactive ? px : 0, filter: 'drop-shadow(0 18px 26px rgba(0,0,0,0.55))' }}
      />
    </motion.div>
  );
}

export default memo(DriverHeadshot);
