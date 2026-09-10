import { Link } from 'react-router-dom';
import { navItems } from '@/components/navigation/navItems';
import { SEASON } from '@/data/races';
import Wordmark from '@/components/brand/Wordmark';

export default function Footer() {
  return (
    <footer className="relative z-10 mt-32 border-t border-white/[0.07] px-6 pt-16 pb-28 md:px-10 md:pb-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Wordmark size="lg" />
            <p className="mt-5 text-sm leading-relaxed text-ink-mute">
              A Formula 1 race-prediction interface built on real {SEASON} season
              data from FastF1 — real results, real circuit geometry measured
              from car telemetry, real corner positions. The Madring has not been
              raced yet, so its outline is the surveyed centreline from
              OpenStreetMap.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-12 gap-y-8">
            <div className="flex flex-col gap-3">
              <span className="mono-label">Explore</span>
              {navItems.slice(1, 4).map((i) => (
                <Link key={i.to} to={i.to} className="text-sm text-ink-dim transition-colors hover:text-ink">
                  {i.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <span className="mono-label">Model</span>
              <Link to="/predict" className="text-sm text-ink-dim transition-colors hover:text-ink">
                Predictions
              </Link>
              <Link to="/analytics" className="text-sm text-ink-dim transition-colors hover:text-ink">
                Analytics
              </Link>
              <Link to="/compare" className="text-sm text-ink-dim transition-colors hover:text-ink">
                Compare
              </Link>
            </div>
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-8 text-[0.72rem] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {SEASON} GridPred — an independent project, not affiliated with Formula 1.</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="mono-label text-[0.6rem]">Data via FastF1</span>
            {/* ODbL 1.0 requires the source to be credited wherever the data is shown. */}
            <span className="mono-label text-[0.6rem]">
              Map data ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-ink-dim"
              >
                OpenStreetMap
              </a>{' '}
              contributors
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
