import { AnimatePresence, motion } from 'framer-motion';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';

/** Floating detail panel used by the form strip and chart hovers. */
export default function Tooltip({ open, children, className = '', placement = 'top' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, y: placement === 'top' ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: placement === 'top' ? 4 : -4, scale: 0.98 }}
          transition={springSnappy}
          className={cx(
            'pointer-events-none absolute z-40 w-max max-w-[19rem] rounded-2xl border border-white/10 bg-[#0d1016]/95 p-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl',
            placement === 'top' ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]',
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
