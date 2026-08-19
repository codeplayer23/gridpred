import Button from '@/components/ui/Button';
import Reveal from '@/components/ui/Reveal';
import { nextRace } from '@/data/races';
import { countdownParts, pad2 } from '@/lib/format';
import { useCountdown } from '@/hooks';

export default function ClosingCta() {
  const race = nextRace();
  const ms = useCountdown(race.date);
  const { days, hours, minutes, seconds } = countdownParts(ms);

  return (
    <section className="relative px-6 py-32 md:px-10 md:py-44">
      <div className="mx-auto max-w-5xl text-center">
        <Reveal>
          <p className="mono-label mb-8">{race.shortName} · Round {race.round}</p>
          <h2 className="font-display text-[clamp(2.4rem,8vw,6.5rem)] leading-[0.9] font-medium tracking-[-0.05em]">
            The grid is set.
            <br />
            <span className="text-ink-faint">Make your call.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="tabular mt-12 font-display text-[clamp(2rem,6vw,4rem)] leading-none font-medium tracking-[-0.05em]">
            {pad2(days)}
            <span className="text-ink-faint">:</span>
            {pad2(hours)}
            <span className="text-ink-faint">:</span>
            {pad2(minutes)}
            <span className="text-ink-faint">:</span>
            <span className="text-signal">{pad2(seconds)}</span>
          </p>
          <p className="mono-label mt-4">Until lights out</p>
        </Reveal>

        <Reveal delay={0.18} className="mt-14 flex flex-wrap justify-center gap-3">
          <Button to="/predict" size="lg">
            Predict the race
          </Button>
          <Button to="/compare" size="lg" variant="ghost">
            Compare drivers
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
