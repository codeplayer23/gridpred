import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { navItems } from './navItems';

/**
 * Thumb-reachable bottom navigation for small screens.
 * Mobile gets its own control surface rather than a shrunken desktop rail.
 */
export default function MobileTabBar() {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-[#08090d]/88 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
    >
      <ul className="flex items-stretch justify-around px-1">
        {navItems.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'relative flex flex-col items-center gap-1 py-2.5 text-[0.6rem] font-medium tracking-[0.1em] uppercase transition-colors',
                  isActive ? 'text-ink' : 'text-ink-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-active"
                      className="absolute inset-x-3 top-0 h-px bg-signal"
                      transition={springSnappy}
                    />
                  )}
                  <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
