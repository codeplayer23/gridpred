import { AnimatePresence, motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

/**
 * Readout for the hovered corner.
 *
 * Shows only what is actually known: the corner's number and where it sits
 * along the lap, both from FastF1's circuit data. Entry speeds and braking
 * figures would need per-corner telemetry that this snapshot does not carry, so
 * they are not shown rather than estimated.
 */
export default function CircuitCornerPanel({ circuit, corner }) {
  const layout = circuit?.layout;
  const lap = layout?.lapDistance;

  return (
    <div className="mt-4 min-h-[4.5rem]">
      <AnimatePresence mode="wait">
        {corner ? (
          <motion.div
            key={`${corner.number}${corner.letter ?? ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={springSnappy}
            className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 backdrop-blur-xl"
          >
            <span className="font-display text-[1.6rem] leading-none font-medium tracking-[-0.04em]">
              T{corner.number}
              {corner.letter ?? ''}
            </span>
            <span>
              <span className="mono-label block text-[0.5rem]">Distance into lap</span>
              <span className="tabular text-[0.9rem] font-medium">
                {(corner.distance / 1000).toFixed(2)} km
              </span>
            </span>
            {lap && (
              <span>
                <span className="mono-label block text-[0.5rem]">Lap position</span>
                <span className="tabular text-[0.9rem] font-medium">
                  {Math.round((corner.distance / lap) * 100)}%
                </span>
              </span>
            )}
          </motion.div>
        ) : (
          <motion.p
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-1 py-4 text-[0.8rem] text-ink-faint"
          >
            {layout
              ? `${layout.corners.length} corners marked from FastF1 circuit data — hover one to read it.`
              : null}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
