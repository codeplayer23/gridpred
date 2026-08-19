import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import CircuitMap from '@/components/circuits/CircuitMap';
import { revealLine } from '@/lib/motion';
import { useCalmMotion, useLiveValue } from '@/hooks';
import { nextRace, SEASON } from '@/data/races';

const LINES = ['WHO WINS', 'NEXT?'];

/** One live-ish telemetry readout in the hero footer strip. */
function Readout({ label, base, spread, suffix, decimals = 0 }) {
  const value = useLiveValue(base, { spread, decimals });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mono-label text-[0.58rem]">{label}</span>
      <span className="tabular text-[0.95rem] font-medium">
        {value.toFixed(decimals)}
        <span className="ml-0.5 text-ink-mute">{suffix}</span>
      </span>
    </div>
  );
}

export default function Hero() {
  const race = nextRace();
  const m = race.circuit?.measurements;
  const ref = useRef(null);
  const calm = useCalmMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const typeY = useTransform(scrollYProgress, [0, 1], ['0%', calm ? '0%' : '-38%']);
  const typeOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const mapScale = useTransform(scrollYProgress, [0, 1], [1, calm ? 1 : 1.18]);
  const mapOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.1]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col justify-between overflow-hidden px-6 pt-28 pb-28 md:px-10 md:pt-32 md:pb-8"
    >
      {/* The next circuit, rendered as ambient architecture behind the type. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ scale: mapScale, opacity: mapOpacity }}
      >
        <div className="w-[150%] max-w-[1500px] opacity-[0.28] md:w-[108%]">
          <CircuitMap
            circuit={race.circuit}
            accent="#e10600"
            strokeWidth={6}
            showStartFinish={false}
            showTelemetry
            lapSeconds={18}
          />
        </div>
      </motion.div>

      <motion.div
        className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center"
        style={{ y: typeY, opacity: typeOpacity }}
      >
        <motion.p
          className="mono-label mb-8 flex flex-wrap items-center gap-x-4 gap-y-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
        >
          <span className="flex items-center gap-2 text-signal">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-signal animate-pulse-soft" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            Season {SEASON}
          </span>
          <span className="hidden h-3 w-px bg-white/15 sm:block" />
          <span>Round {race.round}</span>
          <span className="hidden h-3 w-px bg-white/15 sm:block" />
          <span>{race.circuitName}</span>
        </motion.p>

        <h1 className="text-balance-tight font-display font-medium" aria-label="Who wins next?">
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden">
              <motion.span
                className="block text-[clamp(2.9rem,10.5vw,9.5rem)]"
                custom={i}
                variants={revealLine}
                initial={calm ? { opacity: 0 } : 'hidden'}
                animate={calm ? { opacity: 1 } : 'show'}
                aria-hidden
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          className="mt-10 flex flex-col gap-8 md:mt-12 md:flex-row md:items-end md:justify-between"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          <p className="max-w-md text-[1.05rem] leading-relaxed text-ink-dim md:text-xl">
            Machine learning meets Formula 1. Real session data, real circuit
            geometry, and a model that tells you exactly why it made the call.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button to="/predict" size="lg" icon={ArrowRight}>
              Predict the race
            </Button>
            <Button to="/drivers" size="lg" variant="ghost" icon={Users}>
              Explore drivers
            </Button>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="relative mx-auto flex w-full max-w-7xl items-end justify-between gap-6 border-t border-white/[0.07] pt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.15, duration: 0.9 }}
      >
        <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 lg:max-w-3xl">
          <Readout label="Top speed" base={m?.maxSpeed ?? 0} spread={3} suffix=" km/h" />
          <Readout label="Average speed" base={m?.avgSpeed ?? 0} spread={2} suffix=" km/h" />
          <Readout label="Full throttle" base={m?.fullThrottlePct ?? 0} spread={1} suffix="%" decimals={1} />
          <Readout label="Corners" base={race.cornerCount ?? 0} spread={0} suffix="" />
        </div>
        <span className="hidden shrink-0 items-center gap-2 text-[0.7rem] tracking-[0.18em] text-ink-faint uppercase md:flex">
          Scroll
          <motion.span
            animate={calm ? {} : { y: [0, 5, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown size={14} aria-hidden />
          </motion.span>
        </span>
      </motion.div>
    </section>
  );
}
