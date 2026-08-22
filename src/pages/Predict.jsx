import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Sparkles } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Button from '@/components/ui/Button';
import RadialGauge from '@/components/ui/RadialGauge';
import SectionHeader from '@/components/ui/SectionHeader';
import CircuitMap from '@/components/circuits/CircuitMap';
import PredictionGrid from '@/components/predictions/PredictionGrid';
import FactorDial from '@/components/predictions/FactorDial';
import ModelReasoning from '@/components/predictions/ModelReasoning';
import { cx, dateParts } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { useLiveValue } from '@/hooks';
import { races, nextRace } from '@/data/races';
import { useWeekendGrid } from '@/hooks/useLiveSeason';
import LineupChanges from '@/components/drivers/LineupChanges';
import { FACTORS, defaultWeights, explain, predictRace } from '@/data/predictions';

/** Sprint only appears on sprint weekends — there is nothing to predict otherwise. */
const MODES = [
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'sprint', label: 'Sprint', sprintOnly: true },
  { id: 'race', label: 'Race' },
];

/**
 * Prediction workspace.
 *
 * The model is genuinely re-run on every control change — weights, weather and
 * venue are all inputs to `predictRace`, and the ranked grid animates between
 * the old and new order rather than being replaced.
 */
export default function Predict() {
  const upcoming = nextRace();
  const [raceId, setRaceId] = useState(upcoming.id);
  const [weights, setWeights] = useState(defaultWeights);
  const [rain, setRain] = useState(null);
  const [mode, setMode] = useState('race');
  const [hoverFactor, setHoverFactor] = useState(null);
  const [selected, setSelected] = useState(null);

  const race = races.find((r) => r.id === raceId) ?? upcoming;
  const rainChance = rain ?? 0;

  // Predict the field that is actually entered, so a stand-in is ranked and an
  // absent driver is not.
  const { drivers: grid } = useWeekendGrid();
  const prediction = useMemo(
    () => predictRace(race, { weights, rainChance, grid }),
    [race, weights, rainChance, grid],
  );

  const modes = MODES.filter((m) => !m.sprintOnly || prediction.isSprint);
  // Fall back to the race if the user was on the sprint tab and switched to a
  // weekend that has none.
  const activeMode = modes.some((m) => m.id === mode) ? mode : 'race';
  const rows =
    activeMode === 'race'
      ? prediction.race
      : activeMode === 'sprint'
        ? (prediction.sprint ?? [])
        : prediction.qualifying;
  const focusId = selected ?? prediction.race[0]?.driverId;
  const explanation = useMemo(() => explain(prediction, focusId), [prediction, focusId]);
  const accent = prediction.byId?.[focusId]?.team.accent ?? '#e10600';

  const liveConfidence = useLiveValue(prediction.confidence, { spread: 0.5, decimals: 1, interval: 2200 });
  const dirty =
    FACTORS.some((f) => weights[f.key] !== defaultWeights[f.key]) || rain !== null;

  const setWeight = (key, value) =>
    setWeights((w) => ({ ...w, [key]: Number(value) }));

  const reset = () => {
    setWeights(defaultWeights);
    setRain(null);
  };

  const date = dateParts(race.startsAt);

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <Reveal>
          <p className="mono-label mb-6 flex items-center gap-2.5">
            <Sparkles size={13} className="text-signal" aria-hidden />
            Prediction engine
          </p>
          <h1 className="font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.05em]">
            PREDICT
            <br />
            THE GRID.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-dim">
            Let the data make the call. Change what the model cares about and the
            grid reorders in front of you.
          </p>
        </Reveal>

        {/* ── Race selector ──────────────────────────────────── */}
        <div className="mt-14 flex flex-col gap-6 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-center gap-6">
            <div className="hidden w-28 shrink-0 sm:block">
              <CircuitMap circuit={race.circuit} accent="#e10600" strokeWidth={11} showStartFinish={false} animated={false} />
            </div>
            <div>
              <p className="mono-label mb-2 flex items-center gap-2.5">
                Round {race.round}
                {race.isSprint && (
                  <span className="rounded-full bg-signal px-2 py-0.5 text-[0.5rem] font-semibold tracking-[0.14em] text-white uppercase">
                    Sprint
                  </span>
                )}
              </p>
              <h2 className="font-display text-[1.6rem] leading-tight font-medium tracking-[-0.035em] md:text-[2.1rem]">
                {race.name}
              </h2>
              <p className="mt-1.5 text-[0.85rem] text-ink-mute">
                {race.circuitName} · {date.full}
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="mono-label text-[0.55rem]">Change race</span>
            <select
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className="h-11 min-w-[13rem] rounded-full border border-white/[0.1] bg-[#0d1016] px-5 text-sm text-ink focus:border-white/30 focus:outline-none"
            >
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  R{r.round} · {r.shortName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ── Grid + controls ────────────────────────────────── */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:gap-10">
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex rounded-full border border-white/[0.08] p-1">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={cx(
                      'relative rounded-full px-4 py-2 text-[0.76rem] font-medium whitespace-nowrap transition-colors',
                      activeMode === m.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
                    )}
                  >
                    {activeMode === m.id && (
                      <motion.span layoutId="predict-mode" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
                    )}
                    <span className="relative">{m.label}</span>
                  </button>
                ))}
              </div>
              <p className="mono-label text-[0.55rem]">Select a driver to see the reasoning</p>
            </div>

            <LineupChanges className="mb-5" compact />

            <PredictionGrid
              rows={rows}
              mode={activeMode}
              onSelect={(id) => setSelected(id === selected ? null : id)}
              selectedId={selected}
              limit={12}
            />
          </div>

          {/* controls */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mono-label mb-2">Prediction confidence</p>
                  <p className="tabular font-display text-[3rem] leading-none font-medium tracking-[-0.05em]">
                    {liveConfidence.toFixed(1)}
                    <span className="text-[1.4rem] text-ink-mute">%</span>
                  </p>
                </div>
                <RadialGauge
                  value={prediction.confidence}
                  size={96}
                  stroke={5}
                  accent="#e10600"
                  ticks={26}
                  suffix="%"
                />
              </div>
              <p className="mt-5 border-t border-white/[0.06] pt-4 text-[0.8rem] leading-relaxed text-ink-mute">
                Confidence rises with the projected gap at the front and falls
                as rain probability rises, because wet running widens the range
                of plausible outcomes.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="mono-label">Conditions</p>
                <span className="tabular text-[0.85rem] font-medium">{rainChance}% rain</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={rainChance}
                onChange={(e) => setRain(Number(e.target.value))}
                aria-label="Rain probability"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-signal"
              />
              <p className="mt-4 text-[0.78rem] leading-relaxed text-ink-mute">
                Wet running compresses the field: pace matters less, judgement
                matters more.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between gap-3">
                <p className="mono-label">Feature weights</p>
                {dirty && (
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 text-[0.72rem] text-ink-mute transition-colors hover:text-ink"
                  >
                    <RotateCcw size={12} aria-hidden />
                    Reset
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-5">
                {FACTORS.map((f) => (
                  <li
                    key={f.key}
                    onMouseEnter={() => setHoverFactor(f.key)}
                    onMouseLeave={() => setHoverFactor(null)}
                  >
                    <label className="flex flex-col gap-2">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[0.84rem] text-ink-dim">{f.label}</span>
                        <span className="tabular text-[0.82rem] font-medium">{weights[f.key]}%</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={weights[f.key]}
                        onChange={(e) => setWeight(f.key, e.target.value)}
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-signal"
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {/* ── Factor breakdown ───────────────────────────────── */}
        <section className="mt-28">
          <SectionHeader
            eyebrow="Prediction confidence"
            title="What the model weighs"
            lede="Six features, one composition. Hover a slice or a row to isolate it."
          />

          <div className="mt-14 grid items-center gap-12 lg:grid-cols-[auto_1fr] lg:gap-20">
            <div className="flex justify-center">
              <FactorDial
                factors={FACTORS}
                weights={weights}
                active={hoverFactor}
                onHover={setHoverFactor}
                size={280}
              />
            </div>

            <ul className="flex flex-col gap-1">
              {FACTORS.map((f, i) => {
                const palette = ['#e10600', '#00d7b6', '#ff8000', '#3671ff', '#ff2d2d', '#a78bfa'];
                const on = hoverFactor === f.key;
                return (
                  <li
                    key={f.key}
                    onMouseEnter={() => setHoverFactor(f.key)}
                    onMouseLeave={() => setHoverFactor(null)}
                    className={cx(
                      'flex items-start gap-4 rounded-xl px-4 py-3.5 transition-colors duration-300',
                      on ? 'bg-white/[0.055]' : '',
                    )}
                  >
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: palette[i % palette.length] }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-4">
                        <span className="text-[0.95rem] font-medium">{f.label}</span>
                        <span className="tabular text-[1.05rem] font-medium">{weights[f.key]}%</span>
                      </span>
                      <span className="mt-1 block text-[0.8rem] leading-relaxed text-ink-mute">
                        {f.hint}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── Reasoning ──────────────────────────────────────── */}
        <section className="mt-28 rounded-[28px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl md:p-12">
          <ModelReasoning explanation={explanation} accent={accent} />
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button to={`/races/${race.id}`} variant="ghost">
            Circuit detail
          </Button>
          <Button to="/analytics">Season analytics</Button>
        </div>
      </div>
    </div>
  );
}
