import { motion } from 'framer-motion';
import { CalendarDays, CloudRain, Flag, MapPin, Thermometer, Wind } from 'lucide-react';
import Reveal from '@/components/ui/Reveal';
import Counter from '@/components/ui/Counter';
import CircuitMap from '@/components/circuits/CircuitMap';
import Button from '@/components/ui/Button';
import { countdownParts, dateParts, pad2 } from '@/lib/format';
import { useCountdown } from '@/hooks';
import { nextRace } from '@/data/races';

function CountdownUnit({ value, label, pulse = false }) {
  return (
    <div className="flex flex-col items-start">
      <span className="tabular font-display text-[clamp(2.6rem,7vw,4.6rem)] leading-[0.85] font-medium tracking-[-0.05em]">
        {pad2(value)}
      </span>
      <span className={`mono-label mt-2.5 text-[0.58rem] ${pulse ? 'text-signal' : ''}`}>{label}</span>
    </div>
  );
}

function TrackTrait({ label, value, suffix = '', decimals = 0 }) {
  return (
    <div className="group flex flex-col gap-2 border-t border-white/[0.07] pt-4 transition-colors duration-500 hover:border-white/25">
      <span className="mono-label text-[0.58rem]">{label}</span>
      <span className="tabular text-[1.55rem] leading-none font-medium tracking-[-0.04em]">
        <Counter value={value} decimals={decimals} />
        <span className="text-[0.9rem] text-ink-mute">{suffix}</span>
      </span>
    </div>
  );
}

/**
 * The marquee race card: countdown, circuit, conditions and the traits the
 * model weighs most heavily for this venue.
 */
export default function NextRaceSection() {
  const race = nextRace();
  const ms = useCountdown(race.startsAt);
  const { days, hours, minutes, seconds } = countdownParts(ms);
  const date = dateParts(race.startsAt);
  const m = race.circuit?.measurements;

  return (
    <section className="relative px-6 pb-32 md:px-10 md:pb-44">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mono-label mb-5 flex items-center gap-3">
                <span className="inline-block h-px w-8 bg-white/25" aria-hidden />
                Next Grand Prix
              </p>
              <h2 className="font-display text-[clamp(2.4rem,7vw,5.5rem)] leading-[0.9] font-medium tracking-[-0.045em]">
                {race.shortName}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-dim">
              <span className="flex items-center gap-2">
                <MapPin size={15} className="text-ink-faint" aria-hidden />
                {race.shortName}, {race.country}
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays size={15} className="text-ink-faint" aria-hidden />
                {date.full}
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="group relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/4 h-80 w-[60%] rounded-full opacity-25 blur-[100px]"
            style={{ background: 'radial-gradient(circle, #e10600, transparent 70%)' }}
          />

          <div className="relative grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-between gap-10 p-7 md:p-10 lg:border-r lg:border-white/[0.07]">
              <div>
                <span className="mono-label">Round {race.round} · {race.isSprint ? 'Sprint weekend' : 'Race weekend'}</span>
                <h3 className="mt-4 max-w-md font-display text-[clamp(1.6rem,3.2vw,2.4rem)] leading-[1.02] font-medium tracking-[-0.035em]">
                  {race.name}
                </h3>
                <p className="mt-4 max-w-sm text-[0.94rem] leading-relaxed text-ink-mute">
                  {race.circuitName} · {race.laps} laps · {race.raceDistance} km
                </p>
              </div>

              <div>
                <p className="mono-label mb-6">Lights out in</p>
                <div className="flex flex-wrap items-start gap-x-10 gap-y-6 md:gap-x-14">
                  <CountdownUnit value={days} label="Days" />
                  <CountdownUnit value={hours} label="Hours" />
                  <CountdownUnit value={minutes} label="Minutes" />
                  <CountdownUnit value={seconds} label="Seconds" pulse />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {race.sessions.slice(0, 3).map((s) => (
                  <span key={s.name} className="flex items-center gap-2.5 text-sm text-ink-dim">
                    <CalendarDays size={15} className="text-ink-faint" aria-hidden />
                    {s.name} · {dateParts(s.dateUtc).weekday} {dateParts(s.dateUtc).time}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex flex-col">
              <motion.div
                className="relative flex flex-1 items-center justify-center p-6 md:p-10"
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                <CircuitMap circuit={race.circuit} accent="#e10600" className="max-w-lg" showStartFinish showTelemetry lapSeconds={14} />
              </motion.div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/[0.07] p-7 sm:grid-cols-3 md:p-10">
                <TrackTrait label="Top speed" value={m?.maxSpeed ?? 0} suffix=" km/h" />
                <TrackTrait label="Avg speed" value={m?.avgSpeed ?? 0} suffix=" km/h" />
                <TrackTrait label="Full throttle" value={m?.fullThrottlePct ?? 0} suffix="%" decimals={1} />
                <TrackTrait label="Corners" value={race.cornerCount ?? 0} />
                <TrackTrait label="Laps" value={race.laps ?? 0} />
                <TrackTrait label="Distance" value={race.raceDistance ?? 0} suffix=" km" decimals={1} />
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] px-7 py-5 md:px-10">
            <span className="flex items-center gap-2.5 text-[0.82rem] text-ink-mute">
              <Flag size={14} className="text-ink-faint" aria-hidden />
              {race.circuit?.layout
                ? `Layout measured from ${race.circuit.layout.source?.driver ?? 'a race lap'} at the ${race.circuit.layout.source?.year} race`
                : 'Circuit layout not yet available'}
            </span>
            <div className="flex flex-wrap gap-2.5">
              <Button to={`/races/${race.id}`} variant="ghost" size="sm">
                Circuit detail
              </Button>
              <Button to="/predict" size="sm">
                See prediction
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
