import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import Reveal from '@/components/ui/Reveal';
import ChartFrame from '@/components/charts/ChartFrame';
import ChartTooltip from '@/components/charts/ChartTooltip';
import { axis, cursorProps, gridProps } from '@/components/charts/chartTheme';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { drivers, driverById } from '@/data/drivers';
import { teams, getTeam } from '@/data/teams';
import { races } from '@/data/races';
import {
  completedRounds, constructorStandings, standings, standingsById, standingsHistory,
  circuitPerformance,
} from '@/data/results';

const SCOPES = [
  { id: 'drivers', label: 'Drivers' },
  { id: 'teams', label: 'Teams' },
  { id: 'circuits', label: 'Circuits' },
  { id: 'season', label: 'Season' },
];

const DRIVER_METRICS = [
  { id: 'points', label: 'Points', get: (s) => s.points },
  { id: 'avgFinish', label: 'Avg finish', get: (s) => s.avgFinish ?? 20, invert: true },
  { id: 'avgGrid', label: 'Avg grid', get: (s) => s.avgGrid, invert: true },
  { id: 'finishRate', label: 'Finish rate', get: (s) => s.finishRate },
];

const TEAM_METRICS = [
  { id: 'points', label: 'Points', get: (t) => t.stats.points },
  { id: 'racePace', label: 'Race pace', get: (t) => t.racePace ?? 0 },
  { id: 'qualiPace', label: 'Qualifying pace', get: (t) => t.qualifyingPace ?? 0 },
  { id: 'dnfs', label: 'Retirements', get: (t) => t.stats.dnfs, invert: true },
];

/**
 * Season analytics.
 *
 * Four scopes over one dataset. Every chart reads the same real 2026 results
 * as the rest of the app, so nothing here can contradict a driver page.
 */
export default function Analytics() {
  const [scope, setScope] = useState('drivers');

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mono-label mb-6">Analytics · 2026</p>
          <h1 className="font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.05em]">
            THE WHOLE
            <br />
            SEASON.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-dim">
            {completedRounds} rounds of real results, cut four ways. Hover any
            point for the detail behind it.
          </p>
        </Reveal>

        <div
          className="no-scrollbar mt-12 -mx-6 flex gap-1 overflow-x-auto px-6 md:mx-0 md:w-fit md:rounded-full md:border md:border-white/[0.08] md:p-1 md:px-1"
          role="tablist"
          aria-label="Analytics scope"
        >
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              onClick={() => setScope(s.id)}
              className={cx(
                'relative shrink-0 rounded-full px-5 py-2.5 text-[0.82rem] font-medium tracking-[0.02em] whitespace-nowrap uppercase transition-colors',
                scope === s.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
              )}
            >
              {scope === s.id && (
                <motion.span layoutId="analytics-scope" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
              )}
              <span className="relative">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-6">
          {scope === 'drivers' && <DriverAnalytics />}
          {scope === 'teams' && <TeamAnalytics />}
          {scope === 'circuits' && <CircuitAnalytics />}
          {scope === 'season' && <SeasonAnalytics />}
        </div>
      </div>
    </div>
  );
}

/* ── Drivers ──────────────────────────────────────────────── */
function DriverAnalytics() {
  const [metric, setMetric] = useState('points');
  const active = DRIVER_METRICS.find((m) => m.id === metric);

  const data = useMemo(
    () =>
      standings
        .map((s) => ({
          name: driverById[s.driverId].lastName,
          value: active.get(s),
          accent: getTeam(s.teamId).accent,
          driverId: s.driverId,
        }))
        .sort((a, b) => (active.invert ? a.value - b.value : b.value - a.value)),
    [active],
  );

  const scatter = useMemo(
    () =>
      drivers.map((d) => {
        const s = standingsById[d.id];
        return {
          name: d.lastName,
          quali: d.ratings.qualifying ?? 0,
          race: d.ratings.racePace ?? 0,
          points: s.points,
          accent: getTeam(d.team).accent,
        };
      }),
    [],
  );

  return (
    <>
      <ChartFrame
        title="Driver performance"
        subtitle="Every driver ranked on the metric you choose."
        tabs={DRIVER_METRICS.map((m) => ({ id: m.id, label: m.label }))}
        active={metric}
        onTab={setMetric}
        height={400}
        layoutId="driver-metric"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 20, left: -18 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} angle={-45} textAnchor="end" interval={0} height={78} />
            <YAxis {...axis} width={52} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={<ChartTooltip formatter={(v) => (active.decimals ? v.toFixed(active.decimals) : v)} />}
            />
            <Bar dataKey="value" name={active.label} radius={[5, 5, 0, 0]} animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.driverId} fill={d.accent} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Qualifying pace vs race pace"
        subtitle="Bubble size is championship points. Drivers above the diagonal convert Saturday into Sunday."
        height={420}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 20, left: -12 }}>
            <CartesianGrid {...gridProps} vertical />
            <XAxis
              type="number"
              dataKey="quali"
              name="Qualifying"
              domain={[60, 100]}
              {...axis}
              label={{ value: 'Qualifying', position: 'insideBottom', offset: -12, fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis type="number" dataKey="race" name="Race pace" domain={[60, 100]} {...axis} width={52} />
            <ZAxis type="number" dataKey="points" range={[60, 620]} />
            <Tooltip
              cursor={cursorProps}
              content={({ active: on, payload }) =>
                on && payload?.length ? (
                  <div className="rounded-2xl border border-white/10 bg-[#0d1016]/96 px-4 py-3 backdrop-blur-xl">
                    <p className="mb-2 text-[0.9rem] font-medium">{payload[0].payload.name}</p>
                    <p className="tabular text-[0.8rem] text-ink-dim">
                      Qualifying {payload[0].payload.quali} · Race {payload[0].payload.race}
                    </p>
                    <p className="tabular text-[0.8rem] text-ink-dim">{payload[0].payload.points} points</p>
                  </div>
                ) : null
              }
            />
            <Scatter data={scatter} animationDuration={700}>
              {scatter.map((d) => (
                <Cell key={d.name} fill={d.accent} fillOpacity={0.72} stroke={d.accent} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}

/* ── Teams ────────────────────────────────────────────────── */
function TeamAnalytics() {
  const [metric, setMetric] = useState('points');
  const active = TEAM_METRICS.find((m) => m.id === metric);

  const enriched = useMemo(
    () => teams.map((t) => ({ ...t, stats: t })),
    [],
  );

  const data = useMemo(
    () =>
      enriched
        .map((t) => ({ name: t.abbreviation, full: t.name, value: active.get(t), accent: t.accent }))
        .sort((a, b) => (active.invert ? a.value - b.value : b.value - a.value)),
    [enriched, active],
  );

  const radar = useMemo(
    () =>
      ['qualifyingPace', 'racePace'].map((k) => {
        const row = { metric: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) };
        enriched.slice(0, 5).forEach((t) => {
          row[t.abbreviation] = t[k] ?? 0;
        });
        return row;
      }),
    [enriched],
  );

  return (
    <>
      <ChartFrame
        title="Constructor performance"
        subtitle="All ten teams on a single measure."
        tabs={TEAM_METRICS.map((m) => ({ id: m.id, label: m.label }))}
        active={metric}
        onTab={setMetric}
        height={380}
        layoutId="team-metric"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} interval={0} />
            <YAxis {...axis} width={52} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={<ChartTooltip formatter={(v) => (active.decimals ? `${v.toFixed(active.decimals)}s` : v)} />}
            />
            <Bar dataKey="value" name={active.label} radius={[5, 5, 0, 0]} animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.accent} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Package profile — top five"
        subtitle="Where each leading car earns its lap time."
        height={420}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radar} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={(v) => <span style={{ color: '#a2a9b4' }}>{v}</span>}
            />
            {enriched.slice(0, 5).map((t) => (
              <Radar
                key={t.id}
                name={t.abbreviation}
                dataKey={t.abbreviation}
                stroke={t.accent}
                fill={t.accent}
                fillOpacity={0.1}
                strokeWidth={2}
                animationDuration={700}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}

/* ── Circuits ─────────────────────────────────────────────── */
function CircuitAnalytics() {
  const [circuit, setCircuit] = useState(races[12]?.id ?? races[0].id);
  const race = races.find((r) => r.id === circuit);

  const data = useMemo(
    () =>
      circuitPerformance(circuit)
        .slice(0, 10)
        .map((row) => ({
          name: driverById[row.driverId].lastName,
          racePace: Math.round(row.racePace ?? 0),
          qualifying: Math.round(row.qualifying ?? 0),
          fit: Math.round(row.fit ?? 0),
          accent: getTeam(row.teamId).accent,
        })),
    [circuit],
  );

  const traits = useMemo(
    () =>
      races
        .filter((r) => r.circuit?.measurements)
        .map((r) => ({
          name: r.shortName,
          topSpeed: r.circuit.measurements.maxSpeed,
          avgSpeed: r.circuit.measurements.avgSpeed,
          fullThrottle: r.circuit.measurements.fullThrottlePct,
        })),
    [],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono-label">Circuit</span>
        <select
          value={circuit}
          onChange={(e) => setCircuit(e.target.value)}
          className="h-10 rounded-full border border-white/[0.1] bg-[#0d1016] px-4 text-sm text-ink focus:border-white/30 focus:outline-none"
        >
          {races.map((r) => (
            <option key={r.id} value={r.id}>
              R{r.round} · {r.short}
            </option>
          ))}
        </select>
      </div>

      <ChartFrame
        title={`Driver suitability — ${race.shortName}`}
        subtitle="Projected qualifying, race pace and historical strength at this venue."
        height={400}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: -18 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} angle={-40} textAnchor="end" interval={0} height={58} />
            <YAxis {...axis} width={52} domain={[50, 100]} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: '#a2a9b4' }}>{v}</span>} />
            <Bar dataKey="qualifying" name="Qualifying" fill="#00d7b6" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
            <Bar dataKey="racePace" name="Race pace" fill="#e10600" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
            <Bar dataKey="fit" name="Track fit" fill="#ff8000" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Circuit character across the calendar"
        subtitle="Measured from a real lap at each circuit — top speed, average speed and share of the lap at full throttle."
        height={380}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={traits} margin={{ top: 8, right: 8, bottom: 40, left: -18 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} angle={-45} textAnchor="end" interval={0} height={64} />
            <YAxis {...axis} width={52} />
            <Tooltip cursor={cursorProps} content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: '#a2a9b4' }}>{v}</span>} />
            <Line type="monotone" dataKey="topSpeed" name="Top speed" stroke="#e10600" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="avgSpeed" name="Avg speed" stroke="#ff8000" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fullThrottle" name="Full throttle %" stroke="#00d7b6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}

/* ── Season ───────────────────────────────────────────────── */
function SeasonAnalytics() {
  const top = standings.slice(0, 6);

  return (
    <>
      <ChartFrame
        title="Championship progression"
        subtitle="Cumulative points across every completed round."
        height={440}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={standingsHistory} margin={{ top: 8, right: 12, bottom: 8, left: -14 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axis} interval="preserveStartEnd" />
            <YAxis {...axis} width={52} />
            <Tooltip cursor={cursorProps} content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: '#a2a9b4' }}>{v}</span>} />
            {top.map((s) => (
              <Line
                key={s.driverId}
                type="monotone"
                dataKey={s.driverId}
                name={driverById[s.driverId].lastName}
                stroke={getTeam(s.teamId).accent}
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={900}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartFrame title="Retirements" subtitle="Mechanical and incident losses per driver." height={340}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={standings
                .filter((s) => s.dnfs > 0)
                .map((s) => ({ name: driverById[s.driverId].lastName, dnfs: s.dnfs, accent: getTeam(s.teamId).accent }))}
              margin={{ top: 8, right: 8, bottom: 40, left: -22 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="name" {...axis} angle={-45} textAnchor="end" interval={0} height={58} />
              <YAxis {...axis} width={46} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
              <Bar dataKey="dnfs" name="Retirements" radius={[5, 5, 0, 0]}>
                {standings
                  .filter((s) => s.dnfs > 0)
                  .map((s) => (
                    <Cell key={s.driverId} fill={getTeam(s.teamId).accent} fillOpacity={0.8} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Grid vs finish" subtitle="Average starting slot against average classification." height={340}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 20, left: -14 }}>
              <CartesianGrid {...gridProps} vertical />
              <XAxis type="number" dataKey="avgGrid" name="Avg grid" domain={[1, 20]} {...axis} />
              <YAxis type="number" dataKey="avgFinish" name="Avg finish" domain={[1, 20]} reversed {...axis} width={46} />
              <Tooltip
                cursor={cursorProps}
                content={({ active: on, payload }) =>
                  on && payload?.length ? (
                    <div className="rounded-2xl border border-white/10 bg-[#0d1016]/96 px-4 py-3 backdrop-blur-xl">
                      <p className="mb-1.5 text-[0.9rem] font-medium">{payload[0].payload.name}</p>
                      <p className="tabular text-[0.8rem] text-ink-dim">
                        Grid {payload[0].payload.avgGrid} → Finish {payload[0].payload.avgFinish}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Scatter
                data={standings
                  .filter((s) => s.avgFinish != null)
                  .map((s) => ({
                    name: driverById[s.driverId].lastName,
                    avgGrid: s.avgGrid,
                    avgFinish: s.avgFinish,
                    accent: getTeam(s.teamId).accent,
                  }))}
              >
                {standings
                  .filter((s) => s.avgFinish != null)
                  .map((s) => (
                    <Cell key={s.driverId} fill={getTeam(s.teamId).accent} fillOpacity={0.8} />
                  ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </>
  );
}
