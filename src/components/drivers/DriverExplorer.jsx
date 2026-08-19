import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import Button from '@/components/ui/Button';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { drivers, predictionScore } from '@/data/drivers';
import { teams } from '@/data/teams';
import { standingsById } from '@/data/results';
import DriverCarousel from './DriverCarousel';

const SORTS = [
  { id: 'championship', label: 'Championship' },
  { id: 'prediction', label: 'Prediction score' },
  { id: 'pace', label: 'Race pace' },
];

/**
 * Home-page driver gallery with live filtering by constructor and three sort
 * orders. Filtering re-renders the carousel in place so cards animate rather
 * than blink.
 */
export default function DriverExplorer() {
  const [team, setTeam] = useState('all');
  const [sort, setSort] = useState('championship');

  const visible = useMemo(() => {
    const list = team === 'all' ? [...drivers] : drivers.filter((d) => d.team === team);
    const by = {
      championship: (a, b) => (standingsById[a.id]?.position ?? 99) - (standingsById[b.id]?.position ?? 99),
      prediction: (a, b) => (predictionScore(b) ?? 0) - (predictionScore(a) ?? 0),
      pace: (a, b) => (b.ratings.racePace ?? 0) - (a.ratings.racePace ?? 0),
    };
    return list.sort(by[sort]);
  }, [team, sort]);

  return (
    <section className="relative pt-28 pb-14 md:pt-36 md:pb-18">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <SectionHeader
          eyebrow="The grid"
          title={<>Twenty drivers.<br />One set of numbers.</>}
          lede="Every driver is scored across nine performance dimensions. Hover a card to read the season, open one to read the career."
          action={<Button to="/drivers" variant="ghost">All drivers</Button>}
        />

        <div className="mt-12 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:px-0">
            <FilterChip active={team === 'all'} onClick={() => setTeam('all')} layoutId="team-filter">
              All teams
            </FilterChip>
            {teams.map((t) => (
              <FilterChip
                key={t.id}
                active={team === t.id}
                onClick={() => setTeam(t.id)}
                accent={t.accent}
                layoutId="team-filter"
              >
                {t.name}
              </FilterChip>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="mono-label hidden text-[0.55rem] sm:block">Sort</span>
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
                    <motion.span
                      layoutId="sort-active"
                      className="absolute inset-0 rounded-full bg-ink"
                      transition={springSnappy}
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DriverCarousel drivers={visible} className="mt-10 -mx-0" />
    </section>
  );
}

function FilterChip({ children, active, onClick, accent, layoutId }) {
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
          layoutId={layoutId}
          className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.07]"
          transition={springSnappy}
        />
      )}
      <span className="relative flex items-center gap-2">
        {accent && (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden />
        )}
        {children}
      </span>
    </button>
  );
}
