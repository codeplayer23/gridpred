import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import DriverHeadshot from './DriverHeadshot';
import TeamLogo from '@/components/teams/TeamLogo';
import { useCurrentTeam } from '@/hooks/useDriverAssets';
import { cx, tint } from '@/lib/format';
import { spring } from '@/lib/motion';
import { usePointerParallax } from '@/hooks';
import { getTeam } from '@/data/teams';
import { seasonStats } from '@/data/results';
import { useDriverStats, useLiveSeason } from '@/hooks/useLiveSeason';
import { predictionScore } from '@/data/drivers';

/**
 * Driver card.
 *
 * Resting state is deliberately quiet — number, name, team. Hovering lifts the
 * card, drifts the portrait toward the pointer, washes the team colour in and
 * slides a stat panel up from the base. Everything moves on transform/opacity.
 */
function DriverCard({ driver, index = 0, compact = false }) {
  const team = useCurrentTeam(driver) ?? getTeam(driver.team);
  const liveStats = useDriverStats(driver.id);
  const stats = liveStats ?? seasonStats(driver.id);
  const { entry } = useLiveSeason();
  // The badge describes the weekend in progress, so it retires with it.
  const standingIn = Boolean(driver.isSubstitute && entry?.current);
  const [hover, setHover] = useState(false);
  const { handlers } = usePointerParallax(compact ? 6 : 12);

  const metrics = [
    { label: 'Points', value: stats?.points ?? 0 },
    { label: 'Wins', value: stats?.wins ?? 0 },
    { label: 'Podiums', value: stats?.podiums ?? 0 },
    { label: 'Race pace', value: Math.round(driver.ratings.racePace ?? 0) },
    { label: 'Qualifying', value: Math.round(driver.ratings.qualifying ?? 0) },
    { label: 'Poles', value: stats?.poles ?? 0 },
  ];

  return (
    <motion.article
      className={cx(
        'group relative shrink-0 snap-start',
        compact ? 'w-[15.5rem]' : 'w-[17.5rem] sm:w-[19.5rem]',
      )}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/drivers/${driver.id}`}
        className="block focus-visible:outline-none"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={`${driver.firstName} ${driver.lastName}, number ${driver.number}, ${team.name}, championship position ${stats?.position}`}
        {...handlers}
      >
        <motion.div
          className={cx(
            'relative flex flex-col overflow-hidden rounded-[24px] border border-white/[0.07]',
            compact ? 'h-[24rem]' : 'h-[27.5rem]',
          )}
          style={{
            background: `linear-gradient(168deg, ${tint(team.accent, hover ? 0.2 : 0.07)} 0%, rgba(12,14,18,0.9) 46%, rgba(8,10,13,0.96) 100%)`,
          }}
          animate={{ y: hover ? -8 : 0, scale: hover ? 1.014 : 1 }}
          transition={spring}
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${team.accent}, transparent)` }}
            animate={{ opacity: hover ? 1 : 0.3 }}
          />

          <header className="relative z-20 flex items-start justify-between p-5">
            <div className="flex flex-col gap-1">
              <span className="mono-label text-[0.55rem]">Championship</span>
              <span className="tabular text-[1.15rem] leading-none font-medium">
                P{stats?.position ?? '—'}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="mono-label text-[0.55rem]">Prediction</span>
              <span
                className="tabular text-[1.15rem] leading-none font-medium"
                style={{ color: team.accent }}
              >
                {predictionScore(driver) ?? '—'}%
              </span>
            </div>
          </header>

          <div className="relative flex flex-1 items-center justify-center">
            <motion.div
              className="absolute inset-x-0 -bottom-2 flex justify-center"
              animate={{ scale: hover ? 1.06 : 1 }}
              transition={spring}
            >
              <DriverHeadshot
                driver={driver}
                team={team}
                size={compact ? 208 : 248}
                showNumber={false}
                tilt={false}
              />
            </motion.div>
          </div>

          {/* resting identity block */}
          <motion.footer
            className="relative z-20 flex items-end justify-between gap-3 p-5"
            animate={{ opacity: hover ? 0 : 1, y: hover ? 10 : 0 }}
            transition={{ duration: 0.28 }}
          >
            <div className="min-w-0">
              <p className="truncate text-[0.8rem] text-ink-mute">{driver.firstName}</p>
              <p className="truncate font-display text-[1.55rem] leading-none font-medium tracking-[-0.04em]">
                {driver.lastName}
              </p>
              <p className="mt-2 flex items-center gap-2 text-[0.76rem] text-ink-mute">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: team.accent }}
                  aria-hidden
                />
                <span className="truncate">{team.name}</span>
              </p>
              <span className="mt-2.5 flex items-center gap-2">
                <TeamLogo team={team} size={18} />
                {standingIn && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[0.45rem] font-semibold tracking-[0.14em] uppercase"
                    style={{ background: team.accent, color: '#06070a' }}
                  >
                    Stand-in
                  </span>
                )}
              </span>
            </div>
            <span
              className="tabular shrink-0 font-display text-[2.4rem] leading-none font-semibold tracking-[-0.06em]"
              style={{ color: tint(team.accent, 0.55) }}
            >
              {driver.number}
            </span>
          </motion.footer>

          {/* hover stat panel */}
          <motion.div
            className="absolute inset-x-0 bottom-0 z-30 border-t border-white/[0.09] bg-[#0a0c10]/85 p-5 backdrop-blur-2xl"
            initial={false}
            animate={{ y: hover ? 0 : '104%' }}
            transition={spring}
            aria-hidden={!hover}
          >
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-[1.35rem] leading-none font-medium tracking-[-0.04em]">
                  {driver.lastName}
                </p>
                <p className="mt-1.5 truncate text-[0.74rem] text-ink-mute">
                  {driver.flag} {driver.nationality}
                </p>
              </div>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: team.accent, color: '#06070a' }}
              >
                <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-3.5">
              {metrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  className="flex flex-col gap-1"
                  animate={hover ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  transition={{ delay: hover ? 0.06 + i * 0.035 : 0, duration: 0.3 }}
                >
                  <dt className="mono-label text-[0.5rem] leading-tight">{m.label}</dt>
                  <dd className="tabular text-[1.02rem] leading-none font-medium">{m.value}</dd>
                </motion.div>
              ))}
            </dl>
          </motion.div>
        </motion.div>
      </Link>
    </motion.article>
  );
}

export default memo(DriverCard);
