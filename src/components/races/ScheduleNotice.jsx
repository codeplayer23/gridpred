import { motion } from 'framer-motion';
import { CalendarX, MapPin, CalendarClock, CalendarPlus } from 'lucide-react';
import { cx, dateParts } from '@/lib/format';
import { spring } from '@/lib/motion';
import { useScheduleChanges } from '@/hooks/useLiveSeason';

/**
 * Calendar drift.
 *
 * Calendars move — a round gets cancelled, pushed to another date, or relocated
 * to a different circuit entirely. The bundled calendar is a snapshot, so this
 * compares it against the published schedule and states any difference rather
 * than quietly counting down to a race that is not happening.
 *
 * Renders nothing when the two agree.
 */
const ICONS = {
  removed: CalendarX,
  rescheduled: CalendarClock,
  relocated: MapPin,
  added: CalendarPlus,
};

const LABELS = {
  removed: 'Cancelled',
  rescheduled: 'Rescheduled',
  relocated: 'Relocated',
  added: 'Added',
};

export default function ScheduleNotice({ className = '', round = null }) {
  const changes = useScheduleChanges();
  const relevant = round == null ? changes : changes.filter((c) => c.round === round);
  if (!relevant.length) return null;

  return (
    <motion.section
      className={cx('rounded-2xl border border-white/[0.09] bg-white/[0.03] p-5 backdrop-blur-xl', className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      aria-label="Calendar changes"
    >
      <header className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-full bg-signal px-2.5 py-0.5 text-[0.5rem] font-semibold tracking-[0.16em] text-white uppercase">
          Calendar change
        </span>
        <span className="mono-label text-[0.55rem]">Against the published schedule</span>
      </header>
      <ul className="flex flex-col gap-3">
        {relevant.map((c) => {
          const Icon = ICONS[c.type] ?? CalendarClock;
          return (
            <li key={`${c.type}-${c.round}`} className="flex items-start gap-3">
              <Icon size={14} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[0.88rem] font-medium">
                  Round {c.round} · {c.name}
                </span>
                <span className="block text-[0.76rem] text-ink-mute">
                  {c.type === 'removed' && 'No longer on the published calendar'}
                  {c.type === 'added' && 'Newly added to the calendar'}
                  {c.type === 'rescheduled' &&
                    `Moved from ${dateParts(`${c.from}T12:00:00Z`).full} to ${dateParts(`${c.to}T12:00:00Z`).full}`}
                  {c.type === 'relocated' &&
                    `Now at ${c.to}${c.locality ? `, ${c.locality}` : ''}`}
                </span>
              </span>
              <span className="mono-label ml-auto shrink-0 text-[0.5rem]">{LABELS[c.type]}</span>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
