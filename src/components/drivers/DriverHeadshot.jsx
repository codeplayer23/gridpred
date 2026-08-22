import { memo, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { useCalmMotion } from '@/hooks';
import DriverPlaceholder from './DriverPlaceholder';
import { useDriverAssets } from '@/hooks/useDriverAssets';

/**
 * Driver portrait — the one component that renders a driver's photograph.
 *
 * The image is resolved by `useDriverAssets`, which builds the URL from the
 * team the driver is racing for *right now*. Those are Formula 1's official
 * 2026 portraits, namespaced by constructor, so a driver who changes team shows
 * their new kit as soon as the live feed reports the move.
 *
 * The official assets are tall full-body figures (roughly 1:2.9). Two framings
 * are supported:
 *   'portrait'  head and torso, cropped from the top — for cards and rows
 *   'full'      the complete figure — for the driver detail hero
 *
 * If an image fails to load, a neutral GridPred placeholder is shown. An
 * outdated photograph is never used as a fallback.
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
  variant = 'portrait',
}) {
  const calm = useCalmMotion();
  const [failed, setFailed] = useState(false);
  // Resolved against the driver's current team, so a mid-season move updates
  // the photograph without any rebuild.
  const resolved = useDriverAssets(driver);
  // The resolved team reflects a live lineup change and therefore wins over a
  // team passed down from snapshot data.
  const liveTeam = resolved.team ?? team;
  const accent = liveTeam?.accent ?? liveTeam?.color ?? driver?.teamColor ?? '#e10600';
  const src = failed ? null : resolved.headshot;
  const full = variant === 'full';

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 210, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 210, damping: 20 });
  const px = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 180, damping: 22 });

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

  if (!src) {
    return <DriverPlaceholder driver={driver} team={liveTeam} size={size} className={className} />;
  }

  // The full-body asset is ~1:2.9; the detail hero gives it room, everything
  // else crops to head and torso.
  const boxHeight = full ? size * 1.55 : size;

  return (
    <motion.div
      className={cx('relative select-none', className)}
      style={{
        width: size,
        height: boxHeight,
        perspective: 800,
        rotateX: interactive ? rx : 0,
        rotateY: interactive ? ry : 0,
      }}
      {...handlers}
    >
      {glow && (
        <span
          aria-hidden
          className="absolute inset-[-12%] rounded-full blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${tint(accent, 0.3)}, transparent 72%)` }}
        />
      )}

      {showNumber && (
        <span
          aria-hidden
          className="tabular absolute inset-0 flex items-start justify-center font-display leading-none font-semibold"
          style={{
            fontSize: size * (full ? 0.5 : 0.7),
            color: tint(accent, 0.18),
            letterSpacing: '-0.06em',
            paddingTop: full ? '4%' : '6%',
          }}
        >
          {driver.number}
        </span>
      )}

      <motion.img
        src={src}
        srcSet={resolved.headshotSet ?? undefined}
        sizes={`${Math.round(size)}px`}
        alt={`${driver.name}, ${liveTeam?.name ?? driver.teamName}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={cx(
          'relative h-full w-full',
          full ? 'object-contain object-bottom' : 'object-cover',
        )}
        style={{
          x: interactive ? px : 0,
          // crop from the top so the face is kept, not the boots
          objectPosition: full ? undefined : '50% 0%',
          filter: 'drop-shadow(0 16px 26px rgba(0,0,0,0.55))',
        }}
      />
    </motion.div>
  );
}

export default memo(DriverHeadshot);
