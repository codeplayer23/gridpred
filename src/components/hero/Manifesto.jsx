import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Reveal from '@/components/ui/Reveal';
import { useCalmMotion } from '@/hooks';

const WORDS = 'The race is not random.'.split(' ');

/**
 * Statement section. Words resolve individually against scroll position, which
 * gives the page a beat between the hero and the first dense data surface.
 */
export default function Manifesto() {
  const ref = useRef(null);
  const calm = useCalmMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });

  return (
    <section ref={ref} className="relative px-6 py-32 md:px-10 md:py-48">
      <div className="mx-auto max-w-6xl">
        <p className="mono-label mb-10">The premise</p>
        <h2 className="font-display text-[clamp(2.4rem,8vw,7rem)] leading-[0.94] font-medium tracking-[-0.045em]">
          {WORDS.map((word, i) => {
            const start = i / WORDS.length;
            const end = start + 1 / WORDS.length;
            return <Word key={word + i} word={word} progress={scrollYProgress} range={[start, end]} calm={calm} />;
          })}
        </h2>
        <div className="mt-16 grid gap-10 border-t border-white/[0.07] pt-12 md:grid-cols-3 md:gap-16">
          {[
            {
              title: 'Predict the grid',
              body: 'A weighted model ranks the whole grid for qualifying and for the race, and re-ranks the moment you change its assumptions.',
            },
            {
              title: 'Understand the drivers',
              body: 'Every capability score is derived from real classifications — grid slots, finishes, stints — and any dimension the season cannot yet support is left out rather than guessed.',
            },
            {
              title: 'See what the data sees',
              body: 'Every prediction carries its own reasoning: which factors pushed a driver up the order, and which ones held them back.',
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <h3 className="text-lg font-medium tracking-[-0.02em]">{item.title}</h3>
              <p className="mt-3 text-[0.94rem] leading-relaxed text-ink-mute">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Word({ word, progress, range, calm }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const y = useTransform(progress, range, calm ? [0, 0] : [16, 0]);
  return (
    <motion.span className="mr-[0.28em] inline-block" style={{ opacity: calm ? 1 : opacity, y }}>
      {word}
    </motion.span>
  );
}
