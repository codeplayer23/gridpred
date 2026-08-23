import { useEffect, useMemo, useState } from 'react';
import { getTelemetry } from '@/services/telemetry';
import { useCalmMotion } from '@/hooks';
import { tint } from '@/lib/format';

/** Speed bands the racing line is drawn in, fastest first. */
const BANDS = [
  { id: 'fast', min: 0.78, stroke: (accent) => accent },
  { id: 'mid', min: 0.5, stroke: (accent) => tint(accent, 0.6) },
  { id: 'slow', min: -Infinity, stroke: () => '#4b5563' },
];

function bandFor(ratio) {
  const i = BANDS.findIndex((b) => ratio > b.min);
  // A missing or non-numeric sample falls through to the slowest band rather
  // than off the end of the array.
  return i === -1 ? BANDS.length - 1 : i;
}

/**
 * Build one path string per speed band.
 *
 * A recorded lap is 200–320 samples, and colouring it segment-by-segment used
 * to mean one <path> element per sample. That is ~300 nodes for a decoration,
 * and the hero scales its map on scroll — so every scroll frame re-rasterised
 * all of them. Consecutive samples that fall in the same band are the common
 * case, so they collapse into a single polyline; the result is three paths with
 * the same pixels. Runs share their boundary point, so the bands still meet.
 */
function bandPaths(line, trace, accent) {
  if (line.length < 2) return [];

  const maxSpeed = trace.length ? Math.max(...trace.map((t) => t.speed)) : 1;
  const sampleAt = (i) => {
    if (!trace.length) return 0.6;
    const frac = i / Math.max(1, line.length - 1);
    const s = trace[Math.floor(frac * (trace.length - 1))];
    return (s ? s.speed : maxSpeed * 0.6) / maxSpeed;
  };

  const runs = BANDS.map(() => []);
  let current = bandFor(sampleAt(0));
  let run = [line[0]];

  for (let i = 0; i < line.length - 1; i += 1) {
    const band = bandFor(sampleAt(i));
    if (band !== current) {
      runs[current].push(run);
      // The new run restarts at the shared point so the bands butt together.
      run = [line[i]];
      current = band;
    }
    run.push(line[i + 1]);
  }
  runs[current].push(run);

  return runs
    .map((groups, i) => ({
      id: BANDS[i].id,
      stroke: BANDS[i].stroke(accent),
      d: groups
        .filter((g) => g.length > 1)
        .map((g) => `M ${g.map(([x, y]) => `${x} ${y}`).join(' L ')}`)
        .join(' '),
    }))
    .filter((p) => p.d)
    // Slowest first, so where the circuit crosses itself the accent stays on
    // top — the same reading the per-segment version gave.
    .reverse();
}

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

  const line = useMemo(() => telemetry?.racingLine ?? [], [telemetry]);

  // Colour the racing line by speed so the fast and slow parts of the lap read
  // at a glance. Both channels come from the same recorded lap.
  const paths = useMemo(
    () => bandPaths(line, telemetry?.speedTrace ?? [], accent),
    [line, telemetry, accent],
  );

  const pathData = useMemo(
    () => (line.length ? `M ${line.map(([x, y]) => `${x} ${y}`).join(' L ')}` : ''),
    [line],
  );

  if (!line.length) return null;

  return (
    <g>
      <g aria-hidden>
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.95}
          />
        ))}
      </g>

      {!calm && (
        /* One animateMotion drives both the marker and its halo — two of them
           on the same path is twice the work for identical pixels. */
        <g aria-hidden>
          <animateMotion dur={`${lapSeconds}s`} repeatCount="indefinite" path={pathData} />
          <circle r="11" fill={accent} opacity="0.25" />
          <circle r="5.5" fill="#ffffff" />
        </g>
      )}
    </g>
  );
}
