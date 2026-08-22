import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, GitCompareArrows } from 'lucide-react';
import DriverHeadshot from '@/components/drivers/DriverHeadshot';
import TeamLogo from '@/components/teams/TeamLogo';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import Button from '@/components/ui/Button';
import RadialGauge from '@/components/ui/RadialGauge';
import SectionHeader from '@/components/ui/SectionHeader';
import FormStrip from '@/components/drivers/FormStrip';
import AttributeProfile from '@/components/drivers/AttributeProfile';
import PaceChart from '@/components/charts/PaceChart';
import { cx, ordinal, tint } from '@/lib/format';
import { usePointerParallax } from '@/hooks';
import { driverById, fullName, predictionScore } from '@/data/drivers';
import { getTeam } from '@/data/teams';
import { seasonStats, standings } from '@/data/results';
import { useDriverStats, useGridDriver } from '@/hooks/useLiveSeason';
import { useCurrentTeam } from '@/hooks/useDriverAssets';
import { nextRace, SEASON } from '@/data/races';
import { predictRace } from '@/data/predictions';
import NotFound from './NotFound';

export default function DriverDetail() {
  const { id } = useParams();
  // A reserve called up for this round has no snapshot entry, so fall back to
  // the weekend grid before deciding the driver does not exist.
  const gridDriver = useGridDriver(id);
  const driver = driverById[id] ?? gridDriver;
  const race = nextRace();
  const prediction = useMemo(() => predictRace(race), [race]);
  const { handlers } = usePointerParallax(16);
  // Hooks must run before the not-found return, so this is keyed off the route
  // param rather than the resolved driver.
  const liveStats = useDriverStats(id);
  const liveTeam = useCurrentTeam(driver);

  if (!driver) return <NotFound label="Driver not found" />;

  const team = liveTeam ?? getTeam(driver.team);
  // A reserve called up for this round has contested nothing yet, so there is
  // no season record to read. Zeroes here are literal, not placeholders.
  const stats = liveStats ??
    seasonStats(driver.id) ?? {
      position: null, points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0,
      dnfs: 0, starts: 0, avgFinish: null, avgGrid: null, bestFinish: null,
      finishRate: null,
    };
  const accent = team.accent;
  const row = prediction.byId[driver.id];

  const order = standings.map((s) => s.driverId);
  const idx = order.indexOf(driver.id);
  const prev = driverById[order[(idx - 1 + order.length) % order.length]];
  const next = driverById[order[(idx + 1) % order.length]];

  const record = [
    { label: 'Best finish', value: stats.bestFinish ?? 0, prefix: 'P' },
    { label: 'Avg grid', value: stats.avgGrid ?? 0, decimals: 2 },
    { label: 'Finish rate', value: stats.finishRate ?? 0, suffix: '%' },
    { label: 'Sprint points', value: driver.sprintPoints ?? 0 },
  ];

  const season = [
    { label: 'Points', value: stats.points },
    { label: 'Wins', value: stats.wins },
    { label: 'Podiums', value: stats.podiums },
    { label: 'Pole positions', value: stats.poles },
    { label: 'Fastest laps', value: stats.fastestLaps },
    { label: 'DNFs', value: stats.dnfs },
  ];

  return (
    <article className="relative">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden px-6 pt-32 pb-20 md:px-10 md:pt-40 md:pb-28">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-52 left-1/2 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: `radial-gradient(circle, ${tint(accent, 0.3)}, transparent 68%)` }}
        />

        <div className="relative mx-auto max-w-7xl">
          <Reveal y={10}>
            <Link
              to="/drivers"
              className="mono-label inline-flex items-center gap-2 transition-colors hover:text-ink"
            >
              <ArrowLeft size={13} aria-hidden />
              All drivers
            </Link>
          </Reveal>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <motion.h1
                className="font-display leading-[0.82] font-medium tracking-[-0.055em]"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <span
                  className="tabular mb-4 block text-[clamp(3rem,9vw,7rem)] leading-none font-semibold"
                  style={{ color: accent }}
                >
                  {driver.number}
                </span>
                <span className="block text-[clamp(2.4rem,7vw,5.5rem)] text-ink-dim">
                  {driver.firstName.toUpperCase()}
                </span>
                <span className="block text-[clamp(2.9rem,10vw,8.5rem)]">
                  {driver.lastName.toUpperCase()}
                </span>
              </motion.h1>

              <motion.div
                className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.7 }}
              >
                <Link
                  to={`/teams/${team.id}`}
                  className="flex items-center gap-3 transition-opacity hover:opacity-70"
                >
                  <TeamLogo team={team} size={26} />
                  <span className="text-[0.95rem] font-medium" style={{ color: accent }}>
                    {team.name}
                  </span>
                </Link>
                <span className="text-[0.95rem] text-ink-dim">
                  {driver.flag} {driver.nationality}
                </span>
                <span className="text-[0.95rem] text-ink-dim">{driver.abbreviation}</span>
              </motion.div>

              <motion.div
                className="mt-10 flex flex-wrap gap-3"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.7 }}
              >
                <Button to={`/compare?a=${driver.id}`} icon={GitCompareArrows}>
                  Compare driver
                </Button>
                <Button to="/predict" variant="ghost">
                  Race prediction
                </Button>
              </motion.div>
            </div>

            <motion.div
              className="relative flex justify-center lg:justify-end"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              {...handlers}
            >
              <div className="flex items-end gap-4">
                <DriverHeadshot
                  driver={driver}
                  team={team}
                  size={300}
                  variant="full"
                  showNumber={false}
                  priority
                  className="max-w-full"
                />
              </div>
            </motion.div>
          </div>

          {/* headline season numbers */}
          <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-white/[0.07] pt-10 sm:grid-cols-4">
            {[
              { label: 'Championship', value: stats.position, prefix: 'P', empty: '—' },
              { label: 'Points', value: stats.points },
              { label: 'Avg finish', value: stats.avgFinish, decimals: 1, empty: '—' },
              { label: 'Form score', value: predictionScore(driver) ?? 0, suffix: '' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.06}>
                <p className="mono-label">{s.label}</p>
                <p className="tabular mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-none font-medium tracking-[-0.05em]">
                  {s.value == null ? (
                    <span className="text-ink-faint">{s.empty ?? '—'}</span>
                  ) : (
                    <>
                      {s.prefix}
                      <Counter value={s.value} decimals={s.decimals ?? 0} />
                      {s.suffix && <span className="text-ink-mute">{s.suffix}</span>}
                    </>
                  )}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </header>

      {/* ── Performance ──────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Driver performance"
            title="The season so far"
            lede={
              stats.starts
                ? `${stats.starts} rounds contested, ${stats.finishRate}% of them reaching the flag.`
                : 'No rounds contested this season yet — called up for this weekend.'
            }
          />

          <div className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              {season.map((s, i) => (
                <Reveal key={s.label} delay={i * 0.05} as="div">
                  <dt className="mono-label">{s.label}</dt>
                  <dd className="tabular mt-3 text-[clamp(2.2rem,4.5vw,3.4rem)] leading-none font-medium tracking-[-0.05em]">
                    <Counter value={s.value} />
                  </dd>
                </Reveal>
              ))}
            </dl>

            <Reveal delay={0.1} className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
              <p className="mono-label mb-7">Season record</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-7">
                {record.map((c) => (
                  <div key={c.label}>
                    <dt className="mono-label text-[0.55rem]">{c.label}</dt>
                    <dd className="tabular mt-2 text-[1.9rem] leading-none font-medium tracking-[-0.045em]">
                      {c.prefix}
                      <Counter value={c.value} decimals={c.decimals ?? 0} />
                      {c.suffix}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 border-t border-white/[0.07] pt-6 text-[0.8rem] leading-relaxed text-ink-faint">
                {stats.position
                  ? `${ordinal(stats.position)} in the ${SEASON} standings after ${stats.starts} rounds.`
                  : `No ${SEASON} championship classification yet.`}{' '}
                Every figure on this page is read from real session results.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Form ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Form"
            title="Last ten rounds"
            lede="Bar height is finishing position. Hover any round for the full result."
          />
          <Reveal delay={0.1} className="mt-14 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl md:p-9">
            <FormStrip driverId={driver.id} accent={accent} />
          </Reveal>
        </div>
      </section>

      {/* ── Pace ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Qualifying vs race pace"
            title="Where the time goes"
            lede="Grid slot against finishing position for every round contested this season."
          />
          <Reveal delay={0.1} className="mt-14">
            <PaceChart driverId={driver.id} accent={accent} />
          </Reveal>
        </div>
      </section>

      {/* ── Profile ──────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow="Driver profile"
            title="Measured capability"
            lede="Every axis is derived from real classifications this season. Dimensions with fewer than three races behind them are left out rather than guessed."
          />
          <Reveal delay={0.1} className="mt-14 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl md:p-10">
            <AttributeProfile driver={driver} accent={accent} />
          </Reveal>
        </div>
      </section>

      {/* ── Prediction ───────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 rounded-[28px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl md:p-12 lg:grid-cols-[auto_1fr]">
            <div className="flex justify-center">
              <RadialGauge
                value={row?.winProbability ?? 0}
                max={40}
                size={200}
                accent={accent}
                label="Win share"
                suffix="%"
                decimals={1}
              />
            </div>
            <div>
              <p className="mono-label mb-4">Next round · {race.shortName}</p>
              <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.6rem)] leading-[1.02] font-medium tracking-[-0.04em]">
                Projected P{row?.position} from P{row?.gridPosition}
              </h2>
              <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-ink-mute">
                At {race.circuitName} the model ranks {fullName(driver)} {ordinal(row?.position)} on
                race pace. The factors moving that number most:
              </p>
              <ul className="mt-7 flex flex-wrap gap-2.5">
                {row?.contributions.slice(0, 4).map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center gap-2.5 rounded-full border border-white/[0.09] px-4 py-2 text-[0.82rem]"
                  >
                    <span className="text-ink-dim">{c.label}</span>
                    <span
                      className="tabular font-medium"
                      style={{ color: c.value >= 0 ? '#35d67f' : '#ff5a5a' }}
                    >
                      {c.value >= 0 ? '+' : '−'}
                      {Math.abs(c.value).toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <Button to="/predict" variant="ghost">
                  Full race prediction
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Prev / next ──────────────────────────────────────── */}
      <nav className="border-t border-white/[0.07] px-6 py-10 md:px-10" aria-label="Driver pagination">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <DriverLink driver={prev} direction="prev" />
          <DriverLink driver={next} direction="next" />
        </div>
      </nav>
    </article>
  );
}

function DriverLink({ driver, direction }) {
  if (!driver) return <span />;
  const team = getTeam(driver.team);
  const isNext = direction === 'next';
  return (
    <Link
      to={`/drivers/${driver.id}`}
      className={cx('group flex flex-col gap-2', isNext && 'items-end text-right')}
    >
      <span className="mono-label flex items-center gap-2 text-[0.55rem]">
        {!isNext && <ArrowLeft size={12} aria-hidden />}
        {isNext ? 'Next' : 'Previous'}
        {isNext && <ArrowRight size={12} aria-hidden />}
      </span>
      <span className="font-display text-[1.4rem] leading-none font-medium tracking-[-0.04em] transition-colors group-hover:text-ink md:text-[2rem]">
        {driver.lastName}
      </span>
      <span className="text-[0.78rem]" style={{ color: team.accent }}>
        {team.name}
      </span>
    </Link>
  );
}
