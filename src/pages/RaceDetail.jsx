import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Gauge, MapPin, Radio } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import Button from '@/components/ui/Button';
import Meter from '@/components/ui/Meter';
import SectionHeader from '@/components/ui/SectionHeader';
import PositionBadge from '@/components/ui/PositionBadge';
import CircuitDetail from '@/components/circuits/CircuitDetail';
import { countdownParts, cx, dateParts, pad2, tint } from '@/lib/format';
import { parseUtc } from '@/lib/session';
import { spring, springSnappy } from '@/lib/motion';
import { useCountdown } from '@/hooks';
import { raceById } from '@/data/races';
import { circuitCharacter } from '@/data/circuits';
import { circuitPerformance, getResult } from '@/data/results';
import { useRoundResult } from '@/hooks/useLiveSeason';
import SessionResults from '@/components/races/SessionResults';
import ScheduleNotice from '@/components/races/ScheduleNotice';
import { driverById, fullName } from '@/data/drivers';
import { getTeam } from '@/data/teams';
import { predictRace } from '@/data/predictions';
import NotFound from './NotFound';
import Bloom from '@/components/ui/Bloom';

const VIEW_MODES = [
  { id: 'track', label: 'Track' },
  { id: 'telemetry', label: 'Telemetry' },
];

export default function RaceDetail() {
  const { id } = useParams();
  const race = raceById[id];
  const [now] = useState(() => Date.now());
  // A round run since the snapshot was built has its result fetched live.
  const liveResult = useRoundResult(id);
  const [view, setView] = useState('track');
  const [activeCorner, setActiveCorner] = useState(null);
  const ms = useCountdown(race?.startsAt ?? new Date().toISOString());

  const performance = useMemo(() => (race ? circuitPerformance(race.circuitId) : []), [race]);
  const prediction = useMemo(() => (race ? predictRace(race) : null), [race]);

  if (!race) return <NotFound label="Circuit not found" />;

  const circuit = race.circuit;
  const done = parseUtc(race.startsAt) <= now;
  const snapshotResult = done ? getResult(race.circuitId) : null;
  const result = liveResult ?? snapshotResult;
  const hasResult = Boolean(result?.results?.length);
  const date = dateParts(race.startsAt);
  const { days, hours, minutes } = countdownParts(ms);
  const character = circuitCharacter(circuit);
  const layout = circuit?.layout;

  const headline = [
    ['Track length', circuit?.trackLength, ' km', 3],
    ['Laps', circuit?.laps, '', 0],
    ['Race distance', circuit?.raceDistance, ' km', 1],
    ['Corners', layout?.corners?.length ?? circuit?.corners, '', 0],
  ];

  return (
    <article>
      {/* ── Hero: the circuit is the page ──────────────────── */}
      <header className="relative overflow-hidden px-6 pt-32 pb-16 md:px-10 md:pt-40 md:pb-20">
        <Bloom
          accent="#e10600"
          intensity={0.17}
          className="-top-52 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2"
        />
        <div className="relative mx-auto max-w-7xl">
          <Reveal y={10}>
            <Link to="/races" className="mono-label inline-flex items-center gap-2 transition-colors hover:text-ink">
              <ArrowLeft size={13} aria-hidden />
              Calendar
            </Link>
          </Reveal>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <motion.p
                className="mono-label mb-6 flex flex-wrap items-center gap-x-4 gap-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <span>Round {race.round}</span>
                <span className="h-3 w-px bg-white/15" />
                <span>{race.country}</span>
                <span className="h-3 w-px bg-white/15" />
                <span>{date.full}</span>
                {race.isSprint && (
                  <span className="rounded-full bg-signal px-2.5 py-0.5 text-[0.55rem] font-semibold tracking-[0.14em] text-white uppercase">
                    Sprint
                  </span>
                )}
              </motion.p>

              <motion.h1
                className="font-display text-[clamp(2.6rem,9vw,7rem)] leading-[0.85] font-medium tracking-[-0.055em]"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              >
                {race.shortName.toUpperCase()}
              </motion.h1>
              <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-ink-dim">{race.name}</p>
              <p className="mt-2 flex items-center gap-2 text-[0.88rem] text-ink-mute">
                <MapPin size={14} className="text-ink-faint" aria-hidden />
                {circuit?.name}
              </p>

              {!done && (
                <div className="mt-10 flex items-end gap-8">
                  {[[days, 'Days'], [hours, 'Hours'], [minutes, 'Minutes']].map(([v, l]) => (
                    <div key={l}>
                      <p className="tabular font-display text-[2.6rem] leading-none font-medium tracking-[-0.05em]">
                        {pad2(v)}
                      </p>
                      <p className="mono-label mt-2 text-[0.55rem]">{l}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-10 flex flex-wrap gap-3">
                <Button to="/predict">Prediction for this race</Button>
              </div>

              <ScheduleNotice className="mt-8" round={race.round} />
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              {layout && (
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex rounded-full border border-white/[0.08] p-1">
                    {VIEW_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setView(m.id)}
                        className={cx(
                          'relative rounded-full px-4 py-1.5 text-[0.72rem] font-medium tracking-[0.06em] uppercase transition-colors',
                          view === m.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
                        )}
                      >
                        {view === m.id && (
                          <motion.span layoutId="track-view" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
                        )}
                        <span className="relative">{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <span className="mono-label hidden text-[0.55rem] sm:block">
                    Hover the track
                  </span>
                </div>
              )}

              <CircuitDetail
                circuit={circuit}
                corner={activeCorner}
                onCornerChange={setActiveCorner}
                telemetry={view === 'telemetry'}
              />
            </motion.div>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-9 border-t border-white/[0.07] pt-10 sm:grid-cols-4">
            {headline.map(([label, value, suffix, dp], i) => (
              <Reveal key={label} delay={i * 0.06} as="div">
                <dt className="mono-label">{label}</dt>
                <dd className="tabular mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-none font-medium tracking-[-0.05em]">
                  {value == null ? '—' : <Counter value={value} decimals={dp} />}
                  {value != null && <span className="text-[0.9rem] text-ink-mute">{suffix}</span>}
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </header>

      {/* ── Measured character ─────────────────────────────── */}
      {character && (
        <section className="px-6 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Track characteristics"
              title="Measured, not estimated"
              lede={`Every figure below was read from the telemetry of a real lap here — ${layout.source?.driver ?? 'a race lap'} at the ${layout.source?.year} race.`}
            />
            <div className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div className="flex flex-col gap-8">
                {character.map((c) => (
                  <Meter
                    key={c.key}
                    label={c.label}
                    value={c.value}
                    max={c.max}
                    accent="#e10600"
                    readout={`${c.value}${c.suffix}`}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-6">
                <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
                  <p className="mono-label mb-6 flex items-center gap-2">
                    <Radio size={13} aria-hidden />
                    Geometry source
                  </p>
                  <dl className="flex flex-col gap-3.5 text-[0.9rem]">
                    {[
                      ['Session', `${layout.source?.year} ${layout.source?.session ?? 'Race'}`],
                      ['Reference lap', layout.source?.driver ?? '—'],
                      ['Lap time', layout.source?.lapTime?.replace('0 days ', '') ?? '—'],
                      ['Corners marked', layout.corners.length],
                      ['Measured lap', `${(layout.lapDistance / 1000).toFixed(3)} km`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] pb-3.5">
                        <dt className="text-ink-mute">{k}</dt>
                        <dd className="tabular font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-5 text-[0.76rem] leading-relaxed text-ink-faint">
                    The outline is the path the car actually took, not an
                    illustration. Corner positions come from FastF1's circuit data.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
                  <p className="mono-label mb-4 flex items-center gap-2">
                    <Gauge size={13} aria-hidden />
                    No DRS in 2026
                  </p>
                  <p className="text-[0.85rem] leading-relaxed text-ink-mute">
                    The 2026 regulations replaced DRS with active aerodynamics and
                    an overtake boost. The DRS channel reads zero at every circuit
                    this season, so GridPred shows measured full-throttle and
                    braking zones instead of inventing zones that no longer exist.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Driver performance here ────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Driver performance at this circuit"
            title="Who suits this place"
            lede="Ranked on season race pace, with each driver's actual result here when the season has already visited."
          />
          <ol className="mt-12 flex flex-col gap-2.5">
            {performance.slice(0, 10).map((row, i) => {
              const driver = driverById[row.driverId];
              const team = getTeam(row.teamId);
              const value = row.racePace ?? 0;
              return (
                <motion.li
                  key={row.driverId}
                  layout
                  transition={spring}
                  className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 md:gap-6 md:px-6"
                >
                  <motion.span
                    aria-hidden
                    className="absolute inset-y-0 left-0"
                    style={{ background: tint(team.accent, 0.13) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <span className="tabular relative w-6 shrink-0 text-[0.8rem] text-ink-faint">{i + 1}</span>
                  <span className="relative h-8 w-0.5 shrink-0 rounded-full" style={{ background: team.accent }} aria-hidden />
                  <Link to={`/drivers/${driver.id}`} className="relative min-w-0 flex-1 transition-opacity hover:opacity-75">
                    <span className="block truncate text-[0.95rem] font-medium">{fullName(driver)}</span>
                    <span className="block truncate text-[0.75rem] text-ink-mute">{team.name}</span>
                  </Link>
                  {row.thisYear && (
                    <span className="relative hidden text-right text-[0.78rem] text-ink-mute sm:block">
                      Finished P{row.thisYear.position}
                    </span>
                  )}
                  <span className="tabular relative w-12 shrink-0 text-right text-[1.1rem] font-medium" style={{ color: team.accent }}>
                    {Math.round(value)}
                  </span>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Result or projection ───────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={hasResult ? 'Classification' : 'Model projection'}
            title={hasResult ? 'How it finished' : 'How it should finish'}
            lede={
              hasResult
                ? liveResult
                  ? 'Result fetched live — this round was run after the bundled data was built.'
                  : `Pole went to ${driverById[result?.polePosition]?.lastName ?? '—'}.`
                : `The model's projected top ten, at ${prediction.confidence}% confidence.`
            }
          />
          <ol className="mt-12 grid gap-2.5 md:grid-cols-2">
            {(hasResult
              ? [...result.results].filter((r) => r.position).sort((a, b) => a.position - b.position).slice(0, 10)
              : prediction.race.slice(0, 10)
            ).map((row, i) => {
              const driver = driverById[row.driverId];
              if (!driver) return null;
              const team = getTeam(driver.team);
              return (
                <li key={row.driverId} className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <PositionBadge position={i + 1} size="sm" />
                  <span className="h-7 w-0.5 shrink-0 rounded-full" style={{ background: team.accent }} aria-hidden />
                  <Link to={`/drivers/${driver.id}`} className="min-w-0 flex-1 truncate text-[0.92rem] font-medium hover:opacity-75">
                    {fullName(driver)}
                  </Link>
                  <span className="tabular shrink-0 text-[0.8rem] text-ink-mute">
                    {hasResult ? `${row.points} pts` : `${row.winProbability}%`}
                  </span>
                </li>
              );
            })}
          </ol>

          <SessionResults className="mt-10" />
        </div>
      </section>
    </article>
  );
}
