import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, List, Search } from 'lucide-react';
import DriverCard from '@/components/drivers/DriverCard';
import Reveal from '@/components/ui/Reveal';
import PositionBadge from '@/components/ui/PositionBadge';
import { cx, numberWord } from '@/lib/format';
import { spring, springSnappy } from '@/lib/motion';
import { drivers, fullName, predictionScore } from '@/data/drivers';
import { teams, getTeam } from '@/data/teams';
import { standingsById } from '@/data/results';
import { useLiveSeason, useWeekendGrid } from '@/hooks/useLiveSeason';
import LiveIndicator from '@/components/ui/LiveIndicator';

const SORTS = [
  { id: 'championship', label: 'Championship' },
  { id: 'prediction', label: 'Prediction' },
  { id: 'pace', label: 'Race pace' },
  { id: 'quali', label: 'Qualifying' },
];

/** Full driver index: filterable, sortable, and switchable between gallery and table. */
export default function Drivers() {
  const { driverStats } = useLiveSeason();
  const { drivers: grid } = useWeekendGrid();
  const [team, setTeam] = useState('all');
  const [sort, setSort] = useState('championship');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const by = {
      championship: (a, b) => (driverStats(a.id)?.position ?? 99) - (driverStats(b.id)?.position ?? 99),
      prediction: (a, b) => (predictionScore(b) ?? 0) - (predictionScore(a) ?? 0),
      pace: (a, b) => (b.ratings.racePace ?? 0) - (a.ratings.racePace ?? 0),
      quali: (a, b) => (b.ratings.qualifying ?? 0) - (a.ratings.qualifying ?? 0),
    };
    return grid
      .filter((d) => (team === 'all' ? true : d.team === team))
      .filter((d) =>
        q ? `${fullName(d)} ${d.abbreviation} ${d.number} ${getTeam(d.team).name}`.toLowerCase().includes(q) : true,
      )
      .sort(by[sort]);
  }, [team, sort, query, driverStats, grid]);

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mono-label mb-6">The grid · 2026</p>
          <h1 className="font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.05em]">
            EVERY
            <br />
            DRIVER.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-dim">
            {numberWord(drivers.length).replace(/^./, (c) => c.toUpperCase())} cars, each
            scored on the season it has actually had. Filter by constructor,
            reorder by what you care about, then open a driver for the full read.
          </p>
        </Reveal>

        {/* controls */}
        <div className="mt-14 flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative flex w-full max-w-sm items-center">
              <Search size={16} className="pointer-events-none absolute left-4 text-ink-faint" aria-hidden />
              <span className="sr-only">Search drivers</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search driver, number or team"
                className="h-11 w-full rounded-full border border-white/[0.09] bg-white/[0.03] pr-4 pl-11 text-sm text-ink placeholder:text-ink-faint focus:border-white/25 focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-full border border-white/[0.08] p-1">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSort(s.id)}
                    className={cx(
                      'relative rounded-full px-3.5 py-1.5 text-[0.74rem] font-medium whitespace-nowrap transition-colors',
                      sort === s.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
                    )}
                  >
                    {sort === s.id && (
                      <motion.span layoutId="drivers-sort" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
                    )}
                    <span className="relative">{s.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex rounded-full border border-white/[0.08] p-1">
                {[
                  { id: 'grid', icon: LayoutGrid, label: 'Gallery' },
                  { id: 'list', icon: List, label: 'Table' },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    aria-label={v.label}
                    aria-pressed={view === v.id}
                    className={cx(
                      'relative flex h-7 w-8 items-center justify-center rounded-full transition-colors',
                      view === v.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
                    )}
                  >
                    {view === v.id && (
                      <motion.span layoutId="drivers-view" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
                    )}
                    <v.icon size={14} className="relative" aria-hidden />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:px-0">
            <Chip active={team === 'all'} onClick={() => setTeam('all')}>
              All teams
            </Chip>
            {teams.map((t) => (
              <Chip key={t.id} active={team === t.id} onClick={() => setTeam(t.id)} accent={t.accent}>
                {t.name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="mono-label">{visible.length} drivers</p>
          <LiveIndicator />
        </div>

        {/* results */}
        <AnimatePresence mode="wait">
          {view === 'grid' ? (
            <motion.ul
              key="grid"
              className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {visible.map((d, i) => (
                <motion.li key={d.id} layout transition={spring} className="flex justify-center">
                  <DriverCard driver={d} index={i} />
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <motion.div
              key="list"
              className="mt-6 overflow-hidden rounded-[22px] border border-white/[0.07]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    {['Pos', 'Driver', 'Team', 'Pts', 'Wins', 'Podiums', 'Avg', 'Pred'].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={cx(
                          'mono-label px-4 py-4 text-[0.55rem] font-normal',
                          i > 2 && 'text-right',
                          i === 2 && 'hidden md:table-cell',
                          (i === 5 || i === 6) && 'hidden sm:table-cell',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const t = getTeam(d.team);
                    const s = driverStats(d.id) ?? standingsById[d.id];
                    return (
                      <tr
                        key={d.id}
                        className="group border-b border-white/[0.05] transition-colors last:border-0 hover:bg-white/[0.035]"
                      >
                        <td className="px-4 py-3.5">
                          <PositionBadge position={s.position} size="sm" />
                        </td>
                        <td className="px-4 py-3.5">
                          <Link to={`/drivers/${d.id}`} className="flex items-center gap-3">
                            <span
                              className="h-8 w-1 shrink-0 rounded-full"
                              style={{ background: t.accent }}
                              aria-hidden
                            />
                            <span>
                              <span className="block text-[0.92rem] font-medium">{fullName(d)}</span>
                              <span className="tabular block text-[0.72rem] text-ink-faint">
                                #{d.number} · {d.abbreviation}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="hidden px-4 py-3.5 text-[0.85rem] text-ink-dim md:table-cell">
                          {t.name}
                        </td>
                        <td className="tabular px-4 py-3.5 text-right font-medium">{s.points}</td>
                        <td className="tabular px-4 py-3.5 text-right text-ink-dim">{s.wins}</td>
                        <td className="tabular hidden px-4 py-3.5 text-right text-ink-dim sm:table-cell">
                          {s.podiums}
                        </td>
                        <td className="tabular hidden px-4 py-3.5 text-right text-ink-dim sm:table-cell">
                          {s.avgFinish ?? '—'}
                        </td>
                        <td className="tabular px-4 py-3.5 text-right font-medium" style={{ color: t.accent }}>
                          {predictionScore(d) ?? '—'}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>

        {visible.length === 0 && (
          <p className="mt-16 text-center text-ink-mute">No drivers match that search.</p>
        )}
      </div>
    </div>
  );
}

function Chip({ children, active, onClick, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'relative shrink-0 rounded-full px-4 py-2 text-[0.78rem] font-medium whitespace-nowrap transition-colors duration-300',
        active ? 'text-ink' : 'text-ink-mute hover:text-ink-dim',
      )}
    >
      {active && (
        <motion.span
          layoutId="drivers-team-filter"
          className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.07]"
          transition={springSnappy}
        />
      )}
      <span className="relative flex items-center gap-2">
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden />}
        {children}
      </span>
    </button>
  );
}
