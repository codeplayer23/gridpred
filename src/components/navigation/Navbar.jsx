import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GitCompareArrows, Menu, X } from 'lucide-react';
import { cx } from '@/lib/format';
import { spring, springSnappy } from '@/lib/motion';
import { useScrolled } from '@/hooks';
import { navItems } from './navItems';
import Wordmark from '@/components/brand/Wordmark';

/**
 * Floating primary navigation.
 *
 * Starts as a transparent rail over the hero and condenses into a glass pill on
 * scroll. The active indicator is a single shared layout element, so it slides
 * between items rather than cross-fading.
 */
export default function Navbar() {
  const scrolled = useScrolled(40);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-6"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.2 }}
      >
        <motion.nav
          aria-label="Primary"
          className={cx(
            'flex w-full max-w-6xl items-center justify-between rounded-full transition-[background,border-color,box-shadow,padding] duration-500',
            scrolled
              ? 'border border-white/[0.08] bg-[#0a0c10]/72 px-3 py-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl touch:bg-[#0a0c10]/97 md:px-4'
              : 'border border-transparent bg-transparent px-2 py-3 md:px-4',
          )}
          animate={{ scale: scrolled ? 0.985 : 1 }}
          transition={spring}
        >
          <Link to="/" className="group flex shrink-0 items-center pl-2" aria-label="GridPred — home">
            <Wordmark />
          </Link>

          <ul className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'relative block rounded-full px-4 py-2 text-[0.82rem] font-medium tracking-[0.02em] uppercase transition-colors duration-300',
                      isActive ? 'text-ink' : 'text-ink-mute hover:text-ink-dim',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-full bg-white/[0.08]"
                          transition={springSnappy}
                        />
                      )}
                      <span className="relative">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Link
              to="/compare"
              className={cx(
                'hidden items-center gap-2 rounded-full px-4 py-2 text-[0.82rem] font-medium tracking-[0.02em] uppercase transition-colors sm:inline-flex',
                pathname.startsWith('/compare')
                  ? 'bg-white/[0.08] text-ink'
                  : 'text-ink-mute hover:text-ink',
              )}
            >
              <GitCompareArrows size={15} strokeWidth={2} aria-hidden />
              Compare
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-white/[0.06] hover:text-ink lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu size={19} strokeWidth={2} />
            </button>
          </div>
        </motion.nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full bg-void/80 backdrop-blur-xl touch:bg-void/97"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="relative flex h-full flex-col justify-center px-8"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={spring}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-7 right-7 flex h-10 w-10 items-center justify-center rounded-full hairline text-ink-dim"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
              <ul className="flex flex-col gap-1">
                {[...navItems, { to: '/compare', label: 'Compare' }].map((item, i) => (
                  <motion.li
                    key={item.to}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.045, ...spring }}
                  >
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cx(
                          'block py-2 font-display text-[2.6rem] leading-tight font-medium tracking-[-0.045em] transition-colors',
                          isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-dim',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
