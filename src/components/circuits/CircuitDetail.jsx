import CircuitMap from './CircuitMap';
import CircuitCornerPanel from './CircuitCornerPanel';

/**
 * Composed circuit block: the map, its corner readout, and the provenance of
 * the geometry. Used by the race page; kept separate so any future surface can
 * drop in the same complete circuit presentation.
 */
export default function CircuitDetail({
  circuit,
  accent = '#e10600',
  corner,
  onCornerChange,
  telemetry = false,
  className = '',
}) {
  return (
    <div className={className}>
      <CircuitMap
        circuit={circuit}
        accent={accent}
        interactive
        showCorners
        showStartFinish
        showTelemetry={telemetry}
        showBraking={telemetry}
        onCornerChange={onCornerChange}
        lapSeconds={12}
      />
      <CircuitCornerPanel circuit={circuit} corner={corner} />
    </div>
  );
}
