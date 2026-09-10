import { memo, useEffect, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { easeOut, viewport } from '@/lib/motion';
import { useCalmMotion, useReducedEffects } from '@/hooks';
import { getTelemetry } from '@/services/telemetry';
import CircuitCorner from './CircuitCorner';
import DRSZone from './DRSZone';
import TrackTelemetry from './TrackTelemetry';

const VIEW_BOX = '0 0 1000 620';

/**
 * Stand-in for the blurred kerb halo, as [extra stroke width, opacity].
 *
 * Three progressively wider and fainter strokes read as a glow at a glance, and
 * unlike `feGaussianBlur` they are ordinary stroke paint — no offscreen buffer
 * to allocate and re-rasterise. Widest first so the falloff builds inward.
 */
const HALO_STACK = [
  [34, 0.1],
  [24, 0.15],
  [15, 0.3],
];

/**
 * The one circuit renderer in GridPred.
 *
 * Every circuit on every page goes through this component, so the geometry a
 * user sees on the home page is byte-for-byte the geometry on the race page.
 * The outline is a real racing line reconstructed from position telemetry; the
 * corner markers are FastF1's real corner coordinates.
 *
 * When a circuit has no geometry at all, this renders an explicit unavailable
 * state instead of inventing a shape. A circuit can also have an outline but no
 * corner markers or start/finish line — the Madring is drawn from a surveyed
 * centreline because no session has run there — so both are drawn only when the
 * layout actually carries them.
 */
function CircuitMap({
  circuit,
  accent = 'var(--color-signal)',
  className = '',
  strokeWidth = 9,
  showCorners = false,
  showStartFinish = true,
  showTelemetry = false,
  showBraking = false,
  showFullThrottle = false,
  animated = true,
  interactive = false,
  lapSeconds = 14,
  onCornerChange,
}) {
  const calm = useCalmMotion();
  // An SVG filter is rasterised into an offscreen buffer sized to its region,
  // and this one covers 160% of a 1000x620 canvas. On a phone that buffer is
  // rebuilt whenever anything in the SVG invalidates — including the pace car
  // that runs continuously — so touch devices get a plain wide stroke instead.
  const lean = useReducedEffects();
  const uid = useId().replace(/:/g, '');
  const [activeCorner, setActiveCorner] = useState(null);
  const [pointer, setPointer] = useState(null);
  // Zone overlays live in the lazy telemetry payload, so they are fetched only
  // when a caller actually asks to draw them.
  const [zones, setZones] = useState(null);
  const wantsZones = showBraking || showFullThrottle;

  useEffect(() => {
    if (!wantsZones || !circuit?.id || zones) return undefined;
    let alive = true;
    getTelemetry(circuit.id).then((t) => {
      if (alive && t) setZones(t);
    });
    return () => {
      alive = false;
    };
  }, [wantsZones, circuit?.id, zones]);

  const layout = circuit?.layout ?? null;
  const resolvedAccent = accent === 'var(--color-signal)' ? '#e10600' : accent;

  const corners = useMemo(() => layout?.corners ?? [], [layout]);

  const setCorner = (corner) => {
    setActiveCorner(corner);
    onCornerChange?.(corner);
  };

  if (!layout) {
    return (
      <div
        className={cx(
          'flex min-h-[180px] w-full items-center justify-center rounded-2xl border border-dashed border-white/10 p-8 text-center',
          className,
        )}
      >
        <div className="max-w-xs">
          <p className="mono-label mb-3">Layout unavailable</p>
          <p className="text-[0.82rem] leading-relaxed text-ink-mute">
            {circuit?.unavailableReason ??
              'No Formula 1 session telemetry exists for this circuit yet.'}
          </p>
        </div>
      </div>
    );
  }

  const handleMove = (e) => {
    if (!interactive || calm) return;
    const r = e.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((e.clientX - r.left) / r.width) * 1000,
      y: ((e.clientY - r.top) / r.height) * 620,
    });
  };

  return (
    <div className={cx('relative w-full', className)}>
      <svg
        viewBox={VIEW_BOX}
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={`${circuit.name} circuit layout, ${circuit.corners ?? corners.length} corners`}
        onMouseMove={handleMove}
        onMouseLeave={() => {
          setPointer(null);
          setCorner(null);
        }}
      >
        <defs>
          {!lean && (
            <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="11" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          <radialGradient id={`${uid}-cursor`}>
            <stop offset="0%" stopColor={resolvedAccent} stopOpacity="0.5" />
            <stop offset="100%" stopColor={resolvedAccent} stopOpacity="0" />
          </radialGradient>
          <path id={`${uid}-track`} d={layout.outline} />
        </defs>

        {/* cursor bloom, clipped to the track by drawing it beneath the asphalt */}
        {interactive && pointer && !calm && (
          <circle cx={pointer.x} cy={pointer.y} r="150" fill={`url(#${uid}-cursor)`} />
        )}

        {/* kerb halo — one filtered stroke, or three plain ones stacked */}
        {lean ? (
          HALO_STACK.map(([extra, opacity]) => (
            <use
              key={extra}
              href={`#${uid}-track`}
              fill="none"
              stroke={tint(resolvedAccent, 0.3)}
              strokeWidth={strokeWidth + extra}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={opacity}
            />
          ))
        ) : (
          <use
            href={`#${uid}-track`}
            fill="none"
            stroke={tint(resolvedAccent, 0.3)}
            strokeWidth={strokeWidth + 15}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${uid}-glow)`}
            opacity="0.4"
          />
        )}
        {/* asphalt */}
        <use
          href={`#${uid}-track`}
          fill="none"
          stroke="#171c23"
          strokeWidth={strokeWidth + 7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* the track itself, drawn on entry */}
        <motion.path
          d={layout.outline}
          fill="none"
          stroke={resolvedAccent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={calm || !animated ? { pathLength: 1 } : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={viewport}
          transition={{ duration: calm || !animated ? 0 : 2.4, ease: easeOut }}
        />

        {showFullThrottle && zones && (
          <DRSZone zones={zones.fullThrottleZones} accent={resolvedAccent} kind="throttle" width={strokeWidth * 0.8} animated={!calm} />
        )}
        {showBraking && zones && (
          <DRSZone zones={zones.brakingZones} accent={resolvedAccent} kind="braking" width={strokeWidth * 0.8} animated={!calm} />
        )}
        {/* rendered only if a season actually has DRS; 2026 does not */}
        {zones && (
          <DRSZone zones={zones.drsZones} accent="#35d67f" kind="drs" width={strokeWidth * 0.8} animated={!calm} />
        )}

        {showTelemetry && (
          <TrackTelemetry circuit={circuit} accent={resolvedAccent} lapSeconds={lapSeconds} />
        )}

        {showStartFinish && layout.startFinish && (
          <StartFinish point={layout.startFinish} width={strokeWidth} calm={calm} animated={animated} />
        )}

        {showCorners &&
          corners.map((corner) => (
            <CircuitCorner
              key={`${corner.number}${corner.letter ?? ''}-${corner.distance}`}
              corner={corner}
              accent={resolvedAccent}
              active={
                activeCorner?.number === corner.number &&
                activeCorner?.letter === corner.letter
              }
              onEnter={() => setCorner(corner)}
              onLeave={() => setCorner(null)}
            />
          ))}
      </svg>
    </div>
  );
}

/**
 * Checkered start/finish marker, drawn across the track at the real line.
 *
 * The placement transform lives on a plain <g>: putting it on the animated
 * element lets Framer Motion's own transform replace it, which parks the marker
 * at the SVG origin instead of on the track.
 */
function StartFinish({ point, width, calm, animated }) {
  const w = width + 13;
  const squares = 5;
  const cell = w / squares;
  return (
    <g transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}>
      <motion.g
        initial={calm || !animated ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={viewport}
        transition={{ delay: calm || !animated ? 0 : 1.9, duration: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
      >
        {Array.from({ length: squares * 2 }, (_, i) => {
          const row = i % 2;
          const col = Math.floor(i / 2);
          return (
            <rect
              key={i}
              x={row * cell - cell}
              y={col * cell - w / 2}
              width={cell}
              height={cell}
              fill={(row + col) % 2 === 0 ? '#ffffff' : '#0b0e13'}
            />
          );
          })}
      </motion.g>
    </g>
  );
}

export default memo(CircuitMap);
