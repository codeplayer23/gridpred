import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '@/lib/format';
import { useCarousel } from '@/hooks';
import DriverCard from './DriverCard';

/**
 * Horizontally scrollable driver gallery.
 *
 * Native overflow scrolling does the heavy lifting — it gives trackpad, touch
 * and keyboard support for free, and stays smooth with the whole grid mounted.
 * The arrows are progressive enhancement for pointer users.
 */
export default function DriverCarousel({ drivers, compact = false, className = '' }) {
  const { ref, edges, page } = useCarousel();

  return (
    <div className={cx('relative', className)}>
      <div className="pointer-events-none absolute -top-16 right-0 hidden gap-2 md:flex">
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={edges.start}
          aria-label="Previous drivers"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.09] text-ink-dim transition-all duration-300 enabled:hover:border-white/25 enabled:hover:text-ink disabled:opacity-25"
        >
          <ChevronLeft size={17} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={edges.end}
          aria-label="Next drivers"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.09] text-ink-dim transition-all duration-300 enabled:hover:border-white/25 enabled:hover:text-ink disabled:opacity-25"
        >
          <ChevronRight size={17} aria-hidden />
        </button>
      </div>

      <ul
        ref={ref}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-6 pt-2 pb-6 md:gap-5 md:px-10"
        style={{ scrollPaddingLeft: '1.5rem' }}
      >
        {drivers.map((driver, i) => (
          <li key={driver.id} className="contents">
            <DriverCard driver={driver} index={i} compact={compact} />
          </li>
        ))}
        <li aria-hidden className="w-2 shrink-0" />
      </ul>
    </div>
  );
}
