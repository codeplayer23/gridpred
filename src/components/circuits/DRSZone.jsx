import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * Overlay for a measured zone along the lap.
 *
 * The 2026 technical regulations abolished DRS, and the DRS channel in this
 * season's telemetry reads zero at every circuit — so no DRS zones are drawn.
 * What *is* real for 2026 is where the car is at full throttle and where it is
 * braking, both taken from the same lap the outline came from. This component
 * renders whichever of those a caller asks for, and renders nothing at all when
 * there is no data to show.
 */
function DRSZone({ zones = [], accent, kind = 'throttle', width = 13, animated = true }) {
  if (!zones.length) return null;
  const stroke = kind === 'braking' ? '#ff5a5a' : accent;

  return (
    <g aria-hidden>
      {zones.map((zone, i) =>
        zone.path ? (
          <motion.path
            key={`${kind}-${i}`}
            d={zone.path}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeLinecap="round"
            strokeOpacity={kind === 'braking' ? 0.9 : 0.85}
            style={{ filter: `drop-shadow(0 0 9px ${stroke}aa)` }}
            initial={animated ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: animated ? 0.7 : 0, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
          />
        ) : null,
      )}
    </g>
  );
}

export default memo(DRSZone);
