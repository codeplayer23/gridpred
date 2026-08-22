import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import DriverHeadshot from '@/components/drivers/DriverHeadshot';
import TeamLogo from '@/components/teams/TeamLogo';
import SectionHeader from '@/components/ui/SectionHeader';
import { cx, tint } from '@/lib/format';
import { easeOut, spring, viewport } from '@/lib/motion';
import { drivers, driverById, fullName, ratingLabels, ratingBasis, hasRating } from '@/data/drivers';
import { getTeam } from '@/data/teams';
import { standingsById } from '@/data/results';

const SEASON_ROWS = [
  { key: 'points', label: 'Points' },
  { key: 'wins', label: 'Race wins' },
  { key: 'podiums', label: 'Podiums' },
  { key: 'poles', label: 'Pole positions' },
  { key: 'fastestLaps', label: 'Fastest laps' },
  { key: 'avgFinish', label: 'Average finish', lowerBetter: true },
  { key: 'avgGrid', label: 'Average grid', lowerBetter: true },
  { key: 'dnfs', label: 'Retirements', lowerBetter: true },
];

/**
 * Head-to-head comparison.
 *
 * The two drivers are laid out as opposing forces: every metric is a single bar
 * pushing out from the centre line, so advantage is read as asymmetry rather
 * than by comparing two numbers in separate columns.
 */
export default function Compare() {
  const [params, setParams] = useSearchParams();
  const [a, setA] = useState(() => params.get('a') ?? 'norris');
  const [b, setB] = useState(() => params.get('b') ?? 'verstappen');

  const left = driverById[a] ?? drivers[0];
  const right = driverById[b] ?? drivers[1];
  const leftTeam = getTeam(left.team);
  const rightTeam = getTeam(right.team);
  const ls = standingsById[left.id];
  const rs = standingsById[right.id];

  const select = (side, value) => {
    if (side === 'a') setA(value);
    else setB(value);
    const next = new URLSearchParams(params);
    next.set(side, value);
    setParams(next, { replace: true });
  };

  const swap = () => {
    setA(b);
    setB(a);
    const next = new URLSearchParams(params);
    next.set('a', b);
    next.set('b', a);
    setParams(next, { replace: true });
  };

  // Compare only the dimensions both drivers have enough races to support.
  const attributeRows = useMemo(
    () =>
      Object.entries(ratingLabels)
        .filter(([key]) => hasRating(left, key) && hasRating(right, key))
        .map(([key, label]) => ({
          key,
          label,
          basis: ratingBasis[key],
          l: Math.round(left.ratings[key]),
          r: Math.round(right.ratings[key]),
        })),
    [left, right],
  );

  const raceRows = [
    { label: 'Races started', l: left.starts, r: right.starts },
    { label: 'Best finish', l: left.bestFinish ?? 0, r: right.bestFinish ?? 0, lowerBetter: true },
    { label: 'Finish rate %', l: left.finishRate ?? 0, r: right.finishRate ?? 0 },
    { label: 'Sprint points', l: left.sprintPoints ?? 0, r: right.sprintPoints ?? 0 },
  ];

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mono-label mb-6">Head to head</p>
          <h1 className="font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.05em]">
            TWO DRIVERS.
            <br />
            ONE ANSWER.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-dim">
            Pick any pair on the grid. Every bar pushes out from the centre —
            the longer side is the advantage.
          </p>
        </Reveal>

        {/* ── Selectors ──────────────────────────────────────── */}
        <div className="relative mt-16 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <DriverPicker
            value={a}
            onChange={(v) => select('a', v)}
            exclude={b}
            driver={left}
            team={leftTeam}
            stats={ls}
            side="left"
          />

          <button
            type="button"
            onClick={swap}
            aria-label="Swap drivers"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-ink-dim transition-all duration-300 hover:rotate-180 hover:border-white/25 hover:text-ink"
          >
            <ArrowLeftRight size={17} aria-hidden />
          </button>

          <DriverPicker
            value={b}
            onChange={(v) => select('b', v)}
            exclude={a}
            driver={right}
            team={rightTeam}
            stats={rs}
            side="right"
          />
        </div>

        {/* ── Season ─────────────────────────────────────────── */}
        <section className="mt-24">
          <SectionHeader eyebrow="Season 2026" title="This year" />
          <div className="mt-12 flex flex-col gap-7">
            {SEASON_ROWS.map((row, i) => (
              <VersusRow
                key={row.key}
                label={row.label}
                left={ls[row.key] ?? 0}
                right={rs[row.key] ?? 0}
                leftColor={leftTeam.accent}
                rightColor={rightTeam.accent}
                lowerBetter={row.lowerBetter}
                index={i}
                decimals={String(ls[row.key]).includes('.') ? 1 : 0}
              />
            ))}
          </div>
        </section>

        {/* ── Attributes ─────────────────────────────────────── */}
        <section className="mt-24">
          <SectionHeader
            eyebrow="Capability"
            title="Nine dimensions, side by side"
            lede="Scores out of 100, derived from real 2026 classifications — the same numbers the prediction engine consumes."
          />
          <div className="mt-12 flex flex-col gap-7">
            {attributeRows.map((row, i) => (
              <VersusRow
                key={row.key}
                label={row.label}
                left={row.l}
                right={row.r}
                leftColor={leftTeam.accent}
                rightColor={rightTeam.accent}
                index={i}
              />
            ))}
          </div>
        </section>

        {/* ── Career ─────────────────────────────────────────── */}
        <section className="mt-24">
          <SectionHeader
            eyebrow="Season record"
            title="Races and reliability"
            lede="Counted from every 2026 round both drivers have contested."
          />
          <div className="mt-12 flex flex-col gap-7">
            {raceRows.map((row, i) => (
              <VersusRow
                key={row.label}
                label={row.label}
                left={row.l}
                right={row.r}
                lowerBetter={row.lowerBetter}
                leftColor={leftTeam.accent}
                rightColor={rightTeam.accent}
                index={i}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DriverPicker({ value, onChange, exclude, driver, team, stats, side }) {
  return (
    <motion.div
      layout
      transition={spring}
      className={cx(
        'relative overflow-hidden rounded-[24px] border border-white/[0.08] p-6 md:p-8',
        side === 'right' && 'sm:text-right',
      )}
      style={{
        background: `linear-gradient(${side === 'left' ? '110deg' : '250deg'}, ${tint(team.accent, 0.16)}, rgba(10,12,16,0.9) 62%)`,
      }}
    >
      <div className={cx('flex items-center gap-5', side === 'right' && 'sm:flex-row-reverse')}>
        <DriverHeadshot driver={driver} team={team} size={128} className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-[0.85rem] text-ink-mute">{driver.firstName}</p>
          <p className="truncate font-display text-[clamp(1.6rem,3.4vw,2.4rem)] leading-none font-medium tracking-[-0.045em]">
            {driver.lastName}
          </p>
          <p
            className="tabular mt-1 text-[1.6rem] leading-none font-semibold"
            style={{ color: team.accent }}
          >
            {driver.number}
          </p>
          <p
            className={cx(
              'mt-3 flex items-center gap-2.5 text-[0.82rem]',
              side === 'right' && 'sm:flex-row-reverse',
            )}
            style={{ color: team.accent }}
          >
            <TeamLogo team={team} size={20} showFallbackLabel={false} />
            <span className="truncate">{team.name}</span>
          </p>
          <p className="tabular mt-2 text-[0.78rem] text-ink-mute">
            P{stats.position} · {stats.points} pts · #{driver.number}
          </p>
        </div>
      </div>

      <label className="mt-7 block">
        <span className="sr-only">Select driver</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-full border border-white/[0.12] bg-[#0d1016] px-5 text-sm text-ink focus:border-white/30 focus:outline-none"
        >
          {drivers.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === exclude}>
              {fullName(d)} — {getTeam(d.team).name}
            </option>
          ))}
        </select>
      </label>
    </motion.div>
  );
}

function VersusRow({ label, left, right, leftColor, rightColor, lowerBetter = false, index = 0, decimals = 0 }) {
  const total = Math.abs(left) + Math.abs(right) || 1;
  const leftPct = (Math.abs(left) / total) * 100;
  const rightPct = 100 - leftPct;
  const leftWins = lowerBetter ? left < right : left > right;
  const tie = left === right;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.35), ease: easeOut }}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-4">
        <span
          className="tabular text-[1.15rem] font-medium md:text-[1.4rem]"
          style={{ color: tie ? '#a2a9b4' : leftWins ? leftColor : '#454b55' }}
        >
          <Counter value={left} decimals={decimals} duration={1} />
        </span>
        <span className="mono-label text-center text-[0.55rem]">{label}</span>
        <span
          className="tabular text-[1.15rem] font-medium md:text-[1.4rem]"
          style={{ color: tie ? '#a2a9b4' : !leftWins ? rightColor : '#454b55' }}
        >
          <Counter value={right} decimals={decimals} duration={1} />
        </span>
      </div>
      <div className="flex h-2 items-center gap-1.5">
        <div className="flex h-full flex-1 justify-end overflow-hidden rounded-full bg-white/[0.05]">
          <motion.span
            className="h-full rounded-full"
            style={{ background: leftWins || tie ? leftColor : tint(leftColor, 0.34) }}
            initial={{ width: '0%' }}
            whileInView={{ width: `${leftPct}%` }}
            viewport={viewport}
            transition={{ duration: 0.9, delay: index * 0.05, ease: easeOut }}
          />
        </div>
        <span className="h-3 w-px shrink-0 bg-white/20" aria-hidden />
        <div className="flex h-full flex-1 overflow-hidden rounded-full bg-white/[0.05]">
          <motion.span
            className="h-full rounded-full"
            style={{ background: !leftWins || tie ? rightColor : tint(rightColor, 0.34) }}
            initial={{ width: '0%' }}
            whileInView={{ width: `${rightPct}%` }}
            viewport={viewport}
            transition={{ duration: 0.9, delay: index * 0.05, ease: easeOut }}
          />
        </div>
      </div>
    </motion.div>
  );
}
