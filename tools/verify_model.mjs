/**
 * Train/serve parity check.
 *
 * The model is fitted in Python and evaluated in JavaScript. Those are two
 * implementations of the same arithmetic, and the ways they can disagree are
 * all silent: a missing value sent down the wrong branch, `<` read as `<=`, a
 * feature order that drifted, a base score added on one side only. None of
 * those throw. They just make the shipped model a slightly different model
 * from the validated one.
 *
 * So the trainer exports real feature vectors together with the score it gave
 * them, and this feeds the same vectors through the browser's tree walker and
 * diffs. Run by `npm run model:verify`, and on every Vercel build.
 *
 *     node tools/verify_model.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const modelDir = join(here, '..', 'src', 'data', 'model');
const read = (name) => JSON.parse(readFileSync(join(modelDir, name), 'utf8'));

const { score } = await import(join(here, '..', 'src', 'lib', 'xgboost.js'));

const meta = read('meta.json');
const models = { race: read('race.json'), qualifying: read('qualifying.json') };

// A float32 model evaluated in float64 will not match to the last bit, and it
// does not need to. This is loose enough to ignore representation and tight
// enough that a wrong branch — worth whole tenths — cannot hide under it.
const TOLERANCE = 1e-4;

const fixture = meta.parityFixture ?? [];
if (!fixture.length) {
  console.error('no parity fixture in meta.json — retrain with tools/train_model.py');
  process.exit(1);
}

let failures = 0;
let worst = 0;

for (const row of fixture) {
  for (const [kind, key] of [['race', 'raceScore'], ['qualifying', 'qualifyingScore']]) {
    const model = models[kind];
    const vector = model.features.map((name) => {
      const value = row.features[name];
      return value === null || value === undefined ? NaN : value;
    });

    // No base score is added on either side. XGBoost's ranking objectives
    // return the raw sum of leaf values — `base_score` is not folded into a
    // ranking prediction — so the browser's plain tree sum is the same number.
    // This check is what established that, by failing by exactly 0.5 when the
    // base score was assumed to be there.
    const actual = score(model, vector);
    const expected = row[key];
    const delta = Math.abs(actual - expected);
    worst = Math.max(worst, delta);

    if (delta > TOLERANCE) {
      failures += 1;
      console.error(
        `  MISMATCH ${kind} ${row.driverId} ${row.season} r${row.round}: `
        + `python ${expected.toFixed(6)}, js ${actual.toFixed(6)}, delta ${delta.toExponential(2)}`,
      );
    }
  }
}

// Synthetic vectors: the missing-value branches and the split thresholds, which
// the real rows above barely touch. Both gaps were demonstrated, not assumed —
// with only the real rows, flipping every default direction in a tree passed,
// and so did moving a split by a whole position.
let probeChecks = 0;
for (const [kind, probes] of Object.entries(meta.parityProbes ?? {})) {
  const model = models[kind];
  for (const probe of probes) {
    const vector = model.features.map((name) => {
      const value = probe.values[name];
      return value === null || value === undefined ? NaN : value;
    });
    const actual = score(model, vector);
    const delta = Math.abs(actual - probe.score);
    worst = Math.max(worst, delta);
    probeChecks += 1;
    if (delta > TOLERANCE) {
      failures += 1;
      console.error(
        `  MISMATCH ${kind} probe ${probe.label}: `
        + `python ${probe.score.toFixed(6)}, js ${actual.toFixed(6)}, `
        + `delta ${delta.toExponential(2)}`,
      );
    }
  }
}

if (!probeChecks) {
  console.error('no parity probes in meta.json — retrain with tools/train_model.py');
  process.exit(1);
}

const checks = fixture.length * 2 + probeChecks;
if (failures) {
  console.error(`\nmodel parity FAILED: ${failures}/${checks} vectors disagree.`);
  console.error('The browser would score drivers differently from the trained model.');
  process.exit(1);
}

console.log(
  `model parity ok: ${checks} vectors `
  + `(${fixture.length * 2} real, ${probeChecks} synthetic), `
  + `worst delta ${worst.toExponential(2)} (tolerance ${TOLERANCE.toExponential(0)})`,
);
