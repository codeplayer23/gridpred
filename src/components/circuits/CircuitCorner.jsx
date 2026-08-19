import { memo } from 'react';
import { motion } from 'framer-motion';
import { tint } from '@/lib/format';

/**
 * A single corner marker.
 *
 * Position comes from FastF1's circuit information — the real coordinate of
 * that corner on the track — so markers sit exactly where the corner is rather
 * than being spaced along the path.
 */
function CircuitCorner({ corner, accent, active, onEnter, onLeave, scale = 1 }) {
  const label = `${corner.number}${corner.letter ?? ''}`;
  const r = active ? 12 * scale : 5.5 * scale;

  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      tabIndex={0}
      role="button"
      aria-label={`Turn ${label}`}
      className="cursor-pointer focus:outline-none"
      style={{ pointerEvents: 'all' }}
    >
      <circle cx={corner.x} cy={corner.y} r={22 * scale} fill="transparent" />
      <motion.circle
        cx={corner.x}
        cy={corner.y}
        r={r}
        fill={active ? accent : '#ffffff'}
        stroke={active ? '#ffffff' : 'rgba(5,7,10,0.65)'}
        strokeWidth={active ? 2.4 * scale : 1.6 * scale}
        animate={{ r }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        style={{ filter: active ? `drop-shadow(0 0 12px ${tint(accent, 0.9)})` : 'none' }}
      />
      {active && (
        <motion.text
          x={corner.x}
          y={corner.y - 22 * scale}
          textAnchor="middle"
          initial={{ opacity: 0, y: corner.y - 12 * scale }}
          animate={{ opacity: 1, y: corner.y - 22 * scale }}
          style={{
            fontSize: 22 * scale,
            fontWeight: 600,
            fill: '#ffffff',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            paintOrder: 'stroke',
            stroke: '#05070a',
            strokeWidth: 5 * scale,
          }}
        >
          T{label}
        </motion.text>
      )}
    </g>
  );
}

export default memo(CircuitCorner);
