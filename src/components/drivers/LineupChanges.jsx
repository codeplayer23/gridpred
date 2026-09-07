import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, UserMinus, UserPlus } from 'lucide-react';
import TeamLogo from '@/components/teams/TeamLogo';
import { cx, tint } from '@/lib/format';
import { spring } from '@/lib/motion';
import { getTeam } from '@/data/teams';
import { driverById } from '@/data/drivers';
import { useLiveSeason, useWeekendGrid } from '@/hooks/useLiveSeason';

/**
 * Lineup changes for the current race weekend.
 *
 * Substitutions are invisible in a championship table — a driver who sits out
 * keeps their points and their standings place, and a stand-in has no standings
 * row at all — so this reads the session entry and states plainly who is not
 * driving, who has moved, and who has come in.
 *
 * Renders nothing when the entry matches the contracted lineup.
 */
export default function LineupChanges({ className = '', compact = false }) {
  const { entry } = useLiveSeason();
  const { drivers: grid, absentDrivers = [], newcomers = [], changed } = useWeekendGrid();

  // Only describes a weekend in progress; a past entry is history.
  if (!entry?.current || !changed) return null;

  const movedIn = grid.filter((d) => d.isSubstitute && !newcomers.some((n) => n.id === d.id));

  return (
    <motion.section
      className={cx(
        'rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5 backdrop-blur-xl',
        className,
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      aria-label="Lineup changes for this round"
    >
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-signal px-2.5 py-0.5 text-[0.5rem] font-semibold tracking-[0.16em] text-white uppercase">
          Lineup change
        </span>
        <span className="mono-label text-[0.55rem]">
          Confirmed at {entry.sessionName ?? 'the latest session'}
          {entry.location ? ` · ${entry.location}` : ''}
        </span>
      </header>

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {absentDrivers.map((d) => (
            <Row
              key={`out-${d.id}`}
              icon={<UserMinus size={13} aria-hidden />}
              tone="out"
              driver={d}
              detail="Not competing this round"
              compact={compact}
            />
          ))}
          {movedIn.map((d) => {
            const from = driverById[d.id];
            return (
              <Row
                key={`move-${d.id}`}
                icon={<ArrowRight size={13} aria-hidden />}
                tone="move"
                driver={d}
                detail={
                  from ? `Stepping up from ${getTeam(from.team).name}` : 'Standing in this round'
                }
                compact={compact}
              />
            );
          })}
          {newcomers.map((d) => (
            <Row
              key={`in-${d.id}`}
              icon={<UserPlus size={13} aria-hidden />}
              tone="in"
              driver={d}
              detail="Called up as reserve"
              compact={compact}
            />
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

function Row({ icon, tone, driver, detail, compact }) {
  const team = getTeam(driver.team);
  const colour =
    tone === 'out' ? 'var(--color-negative)' : tone === 'in' ? 'var(--color-positive)' : team.accent;

  const body = (
    <>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: tint(colour, 0.16), color: colour }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cx(
              'truncate text-[0.9rem] font-medium',
              tone === 'out' && 'text-ink-mute line-through decoration-white/25',
            )}
          >
            {driver.name}
          </span>
          <span className="tabular shrink-0 text-[0.7rem] text-ink-faint">#{driver.number}</span>
        </span>
        {!compact && <span className="block truncate text-[0.74rem] text-ink-mute">{detail}</span>}
      </span>
      {tone !== 'out' && <TeamLogo team={team} size={16} showFallbackLabel={false} />}
    </>
  );

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={spring}
    >
      {tone === 'out' ? (
        <span className="flex items-center gap-3">{body}</span>
      ) : (
        <Link
          to={`/drivers/${driver.id}`}
          className="flex items-center gap-3 transition-opacity hover:opacity-75"
        >
          {body}
        </Link>
      )}
    </motion.li>
  );
}
