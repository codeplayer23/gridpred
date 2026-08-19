import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Reveal from '@/components/ui/Reveal';
import RaceRow from '@/components/races/RaceRow';
import CircuitCard from '@/components/circuits/CircuitCard';
import { LayoutGrid, List } from 'lucide-react';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { races, nextRace, SEASON } from '@/data/races';

const FILTERS = [
  { id: 'all', label: 'Full season' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

export default function Races() {
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  // Pinned at mount so filtering stays stable across re-renders.
  const [now] = useState(() => Date.now());
  const upcoming = nextRace(now);

  const visible = useMemo(() => {
    if (filter === 'upcoming') return races.filter((r) => new Date(r.date).getTime() > now);
    if (filter === 'completed') return races.filter((r) => new Date(r.date).getTime() <= now);
    return races;
  }, [filter, now]);

  const completedCount = races.filter((r) => new Date(r.date).getTime() <= now).length;

  return (
    <div className="px-6 pt-32 pb-16 md:px-10 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="mono-label mb-6">Calendar · {SEASON}</p>
          <h1 className="font-display text-[clamp(2.6rem,8vw,6.5rem)] leading-[0.88] font-medium tracking-[-0.05em]">
            TWENTY-FOUR
            <br />
            WEEKENDS.
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink-dim">
            Every circuit has a personality — a top speed, a tyre bill, a
            tolerance for overtaking. Hover a round to read it.
          </p>
        </Reveal>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-5">
          <div className="flex rounded-full border border-white/[0.08] p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cx(
                  'relative rounded-full px-4 py-2 text-[0.78rem] font-medium whitespace-nowrap transition-colors',
                  filter === f.id ? 'text-void' : 'text-ink-mute hover:text-ink-dim',
                )}
              >
                {filter === f.id && (
                  <motion.span layoutId="race-filter" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
                )}
                <span className="relative">{f.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <p className="mono-label">
              {completedCount} of {races.length} rounds complete
            </p>
            <div className="flex rounded-full border border-white/[0.08] p-1">
              {[
                { id: 'list', icon: List, label: 'List' },
                { id: 'grid', icon: LayoutGrid, label: 'Circuits' },
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
                    <motion.span layoutId="races-view" className="absolute inset-0 rounded-full bg-ink" transition={springSnappy} />
                  )}
                  <v.icon size={14} className="relative" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'list' ? (
          <ol className="mt-10 border-t border-white/[0.06]">
            {visible.map((race, i) => (
              <RaceRow key={race.id} race={race} index={i} isNext={race.id === upcoming.id} />
            ))}
          </ol>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((race, i) => (
              <CircuitCard key={race.id} race={race} index={i} isNext={race.id === upcoming.id} />
            ))}
          </ul>
        )}

        {visible.length === 0 && (
          <p className="mt-16 text-center text-ink-mute">Nothing scheduled in this window.</p>
        )}
      </div>
    </div>
  );
}
