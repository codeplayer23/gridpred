import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import Reveal from '@/components/ui/Reveal';
import Button from '@/components/ui/Button';
import RadialGauge from '@/components/ui/RadialGauge';
import PredictionGrid from '@/components/predictions/PredictionGrid';
import ModelReasoning from '@/components/predictions/ModelReasoning';
import { nextRace } from '@/data/races';
import { explain, predictRace } from '@/data/predictions';

/**
 * Home-page prediction preview: the projected podium, the confidence, and the
 * model's reasoning for whoever is currently selected.
 */
export default function PredictionTeaser() {
  const race = nextRace();
  const prediction = useMemo(() => predictRace(race), [race]);
  const [selected, setSelected] = useState(null);
  const focusId = selected ?? prediction.race[0]?.driverId;
  const explanation = useMemo(() => explain(prediction, focusId), [prediction, focusId]);
  const accent = prediction.byId?.[focusId]?.team.accent ?? '#e10600';

  return (
    <section className="relative px-6 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="The prediction"
          title={<>The model has<br />already decided.</>}
          lede={`A projected finishing order for ${race.shortName}, and the reasoning behind every position.`}
          action={<Button to="/predict">Open the engine</Button>}
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-10">
          <Reveal>
            <PredictionGrid
              rows={prediction.race}
              mode="race"
              limit={6}
              selectedId={selected}
              onSelect={(id) => setSelected(id === selected ? null : id)}
            />
          </Reveal>

          <Reveal delay={0.1} className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-6 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 text-center backdrop-blur-xl">
              <RadialGauge
                value={prediction.confidence}
                size={186}
                accent="#e10600"
                label="Confidence"
                suffix="%"
              />
              <p className="text-[0.86rem] leading-relaxed text-ink-mute">
                Six weighted features, twenty cars, one projected order. Confidence
                reflects how decisive the gap at the front is.
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl">
              {prediction.factors.map((f) => (
                <li key={f.key}>
                  <p className="mono-label text-[0.5rem] leading-tight">{f.label}</p>
                  <p className="tabular mt-1.5 text-[1.25rem] font-medium">{f.weight}%</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <motion.div
          className="mt-10 rounded-[28px] border border-white/[0.07] bg-white/[0.02] p-7 backdrop-blur-xl md:p-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          <ModelReasoning explanation={explanation} accent={accent} />
        </motion.div>
      </div>
    </section>
  );
}
