import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import DriverHeadshot from '@/components/drivers/DriverHeadshot';
import { tint } from '@/lib/format';
import { viewport } from '@/lib/motion';
import { getDriver } from '@/data/drivers';
import { seasonStats } from '@/data/results';

const ROWS = [
  { key: 'points', label: 'Points' },
  { key: 'wins', label: 'Wins' },
  { key: 'podiums', label: 'Podiums' },
  { key: 'poles', label: 'Poles' },
  { key: 'avgFinish', label: 'Avg finish', lowerBetter: true },
  { key: 'avgGrid', label: 'Avg grid', lowerBetter: true },
];

/**
 * Head-to-head between a team's two drivers.
 *
 * Each row is a single split bar: the two drivers push against each other from
 * the centre, so the balance of the garage is readable at a glance.
 */
export default function TeamComparison({ team }) {
  const [a, b] = team.drivers.map(getDriver).filter(Boolean);
  const sa = seasonStats(a.id);
  const sb = seasonStats(b.id);

  return (
    <div>
      <div className="mb-9 grid grid-cols-2 gap-4">
        {[a, b].map((d, i) => (
          <Link
            key={d.id}
            to={`/drivers/${d.id}`}
            className={`group flex items-center gap-4 ${i === 1 ? 'flex-row-reverse text-right' : ''}`}
          >
            <DriverHeadshot driver={d} team={team} size={78} showNumber={false} glow={false} tilt={false} />
            <div className="min-w-0">
              <p className="truncate text-[0.75rem] text-ink-mute">{d.firstName}</p>
              <p className="truncate font-display text-[1.25rem] leading-tight font-medium tracking-[-0.035em] transition-colors group-hover:text-ink">
                {d.lastName}
              </p>
              <p className="tabular text-[0.72rem] text-ink-faint">#{d.number}</p>
            </div>
          </Link>
        ))}
      </div>

      <ul className="flex flex-col gap-5">
        {ROWS.map((row, i) => {
          const va = sa[row.key] ?? 0;
          const vb = sb[row.key] ?? 0;
          const total = va + vb || 1;
          const leftPct = (va / total) * 100;
          const aWins = row.lowerBetter ? va < vb : va > vb;

          return (
            <li key={row.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span
                  className="tabular text-[0.9rem] font-medium"
                  style={{ color: aWins ? team.accent : '#6b7280' }}
                >
                  {va}
                </span>
                <span className="mono-label text-[0.55rem]">{row.label}</span>
                <span
                  className="tabular text-[0.9rem] font-medium"
                  style={{ color: !aWins ? team.accent : '#6b7280' }}
                >
                  {vb}
                </span>
              </div>
              <div className="flex h-1.5 gap-1 overflow-hidden rounded-full">
                <motion.span
                  className="h-full rounded-full"
                  style={{ background: aWins ? team.accent : tint(team.accent, 0.28) }}
                  initial={{ width: '50%' }}
                  whileInView={{ width: `${leftPct}%` }}
                  viewport={viewport}
                  transition={{ duration: 0.9, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.span
                  className="h-full flex-1 rounded-full"
                  style={{ background: !aWins ? team.accent : tint(team.accent, 0.28) }}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={viewport}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
