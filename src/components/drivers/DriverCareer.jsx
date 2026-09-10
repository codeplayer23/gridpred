import { Flag, Gauge, Trophy } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import { cx } from '@/lib/format';
import { careerHeadline, drivingTraits, getCareer, previousSeasons } from '@/data/careers';

const dateLong = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * A driver's record before this season: where they started and what every
 * season since came to.
 *
 * Every figure is a count of real classifications, aggregated from the races
 * themselves rather than copied from a summary, so a career total is the sum of
 * results that can be pointed at. Drivers on debut have no history to show, and
 * this says so instead of padding the page.
 */
export default function DriverCareer({ driver, field = [], accent = '#e10600', season }) {
  const career = getCareer(driver?.id);
  const headline = careerHeadline(driver?.id);
  const earlier = previousSeasons(driver?.id, season);
  const traits = drivingTraits(driver, field);
  if (!career) return null;

  const debut = career.debut;
  const rookie = earlier.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ── debut ─────────────────────────────────────────── */}
        {debut && (
          <Reveal className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
            <p className="mono-label mb-6 flex items-center gap-2">
              <Flag size={13} aria-hidden />
              First Grand Prix
            </p>
            <p className="font-display text-[1.6rem] leading-tight font-medium tracking-[-0.03em]">
              {debut.race}
            </p>
            <p className="mt-2 text-[0.9rem] text-ink-mute">
              {dateLong(debut.date)} · {debut.circuit}
            </p>
            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[
                ['Team', debut.team],
                ['Grid', debut.grid ? `P${debut.grid}` : '—'],
                ['Finish', debut.status === 'Finished' || /^\+/.test(debut.status ?? '')
                  ? `P${debut.position}`
                  : (debut.status ?? '—')],
                ['Age', debut.ageYears != null ? `${debut.ageYears}` : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="mono-label text-[0.5rem]">{k}</dt>
                  <dd className="mt-1.5 text-[0.92rem] font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        )}

        {/* ── career totals ─────────────────────────────────── */}
        <Reveal
          delay={0.05}
          className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl"
        >
          <p className="mono-label mb-6 flex items-center gap-2">
            <Trophy size={13} aria-hidden />
            Career to date
          </p>
          <dl className="grid grid-cols-3 gap-x-5 gap-y-7">
            {headline.map((h) => (
              <div key={h.key}>
                <dt className="mono-label text-[0.5rem]">{h.label}</dt>
                <dd className="tabular mt-2 font-display text-[1.7rem] leading-none font-medium tracking-[-0.04em]">
                  <Counter value={h.value} duration={0.9} />
                </dd>
              </div>
            ))}
          </dl>
          {career.bestFinish != null && (
            <p className="mt-7 border-t border-white/[0.06] pt-4 text-[0.78rem] text-ink-faint">
              Best finish P{career.bestFinish} · debut season {debut?.season}
            </p>
          )}
        </Reveal>
      </div>

      {/* ── how they drive, from measured figures ───────────── */}
      {traits.length > 0 && (
        <Reveal delay={0.1} className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
          <p className="mono-label mb-2 flex items-center gap-2">
            <Gauge size={13} aria-hidden />
            What the season says about how he drives
          </p>
          <p className="mb-7 max-w-2xl text-[0.82rem] leading-relaxed text-ink-faint">
            Not a character sketch — each of these is a measured rating ranked
            against the rest of the grid, shown with the figure that earned it.
            Ratings run 0–100 and are derived from real classifications.
          </p>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {traits.map((t) => (
              <li key={t.key} className="flex flex-col gap-1.5">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-[1.02rem] font-medium" style={{ color: accent }}>
                    {t.label}
                  </span>
                  <span className="mono-label text-[0.5rem]">{t.rank}</span>
                </span>
                <span className="text-[0.86rem] leading-relaxed text-ink-mute">{t.blurb}</span>
                <span className="tabular text-[0.8rem] text-ink-dim">
                  {t.figure}
                  {t.races != null && <span className="text-ink-faint"> · {t.races} races</span>}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {/* ── season by season ──────────────────────────────── */}
      <Reveal delay={0.15} className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
        <p className="mono-label mb-6">Season by season</p>
        {rookie ? (
          <p className="text-[0.88rem] leading-relaxed text-ink-mute">
            {driver.firstName} is in his first Formula 1 season, so there is no
            earlier record to show. It fills in from {season} onwards.
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[0.87rem]">
              <thead>
                <tr className="text-left">
                  {['Season', 'Team', 'Races', 'Pts', 'Wins', 'Podiums', 'Best'].map((h, i) => (
                    <th
                      key={h}
                      className={cx(
                        'mono-label border-b border-white/[0.08] px-2 pb-3 text-[0.5rem] font-normal',
                        i > 1 && 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {earlier.map((s) => (
                  <tr key={s.season} className="border-b border-white/[0.05] last:border-0">
                    <td className="tabular px-2 py-3 font-medium">{s.season}</td>
                    <td className="px-2 py-3 text-ink-mute">{s.teams.join(', ')}</td>
                    <td className="tabular px-2 py-3 text-right text-ink-dim">{s.races}</td>
                    <td className="tabular px-2 py-3 text-right font-medium">{s.points}</td>
                    <td className="tabular px-2 py-3 text-right text-ink-dim">{s.wins || '—'}</td>
                    <td className="tabular px-2 py-3 text-right text-ink-dim">{s.podiums || '—'}</td>
                    <td className="tabular px-2 py-3 text-right text-ink-dim">
                      {s.bestFinish ? `P${s.bestFinish}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>
    </div>
  );
}
