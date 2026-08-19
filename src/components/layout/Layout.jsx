import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from '@/components/navigation/Navbar';
import MobileTabBar from '@/components/navigation/MobileTabBar';
import Footer from './Footer';
import ScrollToTop from './ScrollToTop';
import Backdrop from './Backdrop';
import { GridMark } from '@/components/brand/Wordmark';
import { easeOut } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';

/** Branded route fallback — the grid mark holds the space while a page loads. */
function RouteFallback() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5">
      <GridMark size={38} className="text-ink-faint animate-pulse-soft" animated={false} />
      <span className="mono-label">Loading session data…</span>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const calm = useCalmMotion();

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <ScrollToTop />
      <Navbar />
      <main id="main" className="relative z-10 pb-24 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={calm ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={calm ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: calm ? 0.2 : 0.44, ease: easeOut }}
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
