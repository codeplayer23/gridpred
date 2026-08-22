import { useEffect, useState } from 'react';
import { getTelemetry } from '@/services/telemetry';
import { useCalmMotion } from '@/hooks';
import { tint } from '@/lib/format';

/**
 * Telemetry overlay for a circuit.
 *
 * Loads the lap's speed trace and racing line lazily — this is the heaviest
 * data in the product and is only fetched once a circuit is actually on screen
 * in telemetry mode. The component is deliberately shaped around a real lap:
 * hand it live FastF1 telemetry with the same fields and nothing else changes.
 *
 * @param {{circuit: object, telemetry?: object, accent: string}} props
 */
export default function TrackTelemetry({ circuit, telemetry: provided, accent, lapSeconds = 14 }) {
  const calm = useCalmMotion();
  const [telemetry, setTelemetry] = useState(provided ?? null);

  useEffect(() => {
    if (provided || !circuit?.id) return undefined;
    let alive = true;
    getTelemetry(circuit.id).then((t) => {
      if (alive) setTelemetry(t);
    });
    return () => {
      alive = false;
    };
  }, [circuit?.id, provided]);

  const line = telemetry?.racingLine ?? [];
  if (!line.length) return null;

  // Colour the racing line by speed so the fast and slow parts of the lap read
  // at a glance. Both channels come from the same recorded lap.
  const trace = telemetry.speedTrace ?? [];
  const maxSpeed = trace.length ? Math.max(...trace.map((t) => t.speed)) : 1;

  const segments = line.slice(0, -1).map((p, i) => {
    const q = line[i + 1];
    const frac = i / Math.max(1, line.length - 1);
    const sample = trace[Math.floor(frac * (trace.length - 1))] ?? { speed: maxSpeed * 0.6 };
    return { d: `M ${p[0]} ${p[1]} L ${q[0]} ${q[1]}`, ratio: sample.speed / maxSpeed };
  });

  const pathData = `M ${line.map(([x, y]) => `${x} ${y}`).join(' L ')}`;

  return (
    <g>
      <g aria-hidden>
        {segments.map((s, i) => (
          <path
            key={i}
            d={s.d}
            stroke={s.ratio > 0.78 ? accent : s.ratio > 0.5 ? tint(accent, 0.6) : '#4b5563'}
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
        ))}
      </g>

      {!calm && (
        <g aria-hidden>
          <path id={`tel-${circuit.id}`} d={pathData} fill="none" stroke="none" />
          <circle r="11" fill={accent} opacity="0.25">
            <animateMotion dur={`${lapSeconds}s`} repeatCount="indefinite" path={pathData} />
          </circle>
          <circle r="5.5" fill="#ffffff">
            <animateMotion dur={`${lapSeconds}s`} repeatCount="indefinite" path={pathData} />
          </circle>
        </g>
      )}
    </g>
  );
}
