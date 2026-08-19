import { useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ChartFrame from './ChartFrame';
import ChartTooltip from './ChartTooltip';
import { axis, cursorProps, gridProps } from './chartTheme';
import { tint } from '@/lib/format';
import { paceTrace } from '@/data/results';

const TABS = [
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'race', label: 'Race' },
  { id: 'delta', label: 'Grid → Flag' },
];

/**
 * Season pace trace.
 *
 * Plots real grid slots and real finishing positions per round. A full timing
 * feed would let this show lap-time deltas in seconds; that data is not in this
 * snapshot, so the chart shows the positions that were actually recorded rather
 * than inventing gaps.
 */
export default function PaceChart({ driverId, accent = '#e10600', className = '' }) {
  const [tab, setTab] = useState('qualifying');
  const data = paceTrace(driverId).map((d) => ({
    ...d,
    name: d.name.slice(0, 3).toUpperCase(),
  }));

  const shared = { data, margin: { top: 8, right: 8, bottom: 4, left: -14 } };

  return (
    <ChartFrame
      title="Season trace"
      subtitle="Grid position and race result for every round contested."
      tabs={TABS}
      active={tab}
      onTab={setTab}
      className={className}
      layoutId={`pace-tab-${driverId}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {tab === 'delta' ? (
          <LineChart {...shared} key="delta">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} interval="preserveStartEnd" />
            <YAxis {...axis} width={54} />
            <Tooltip
              cursor={cursorProps}
              content={<ChartTooltip formatter={(v) => (v > 0 ? `+${v} gained` : v < 0 ? `${v} lost` : 'held')} />}
            />
            <Line
              type="monotone"
              dataKey="gained"
              name="Positions gained"
              stroke={accent}
              strokeWidth={2.4}
              dot={{ r: 3, fill: accent, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              animationDuration={700}
            />
          </LineChart>
        ) : (
          <AreaChart {...shared} key={tab}>
            <defs>
              <linearGradient id={`pace-${driverId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.34} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} interval="preserveStartEnd" />
            <YAxis {...axis} reversed width={54} domain={[1, 22]} allowDecimals={false} />
            <Tooltip cursor={cursorProps} content={<ChartTooltip formatter={(v) => `P${v}`} />} />
            <Area
              type="monotone"
              dataKey={tab === 'qualifying' ? 'grid' : 'position'}
              name={tab === 'qualifying' ? 'Grid' : 'Finish'}
              stroke={accent}
              strokeWidth={2.4}
              fill={`url(#pace-${driverId})`}
              connectNulls
              dot={{ r: 2.5, fill: accent, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: tint(accent, 0.4) }}
              animationDuration={800}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </ChartFrame>
  );
}
