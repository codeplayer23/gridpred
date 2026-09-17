/**
 * XGBoost inference in the browser.
 *
 * The model is trained by `tools/train_model.py` and exported as plain nested
 * nodes; this walks them. There is no runtime dependency and no service to
 * call — a gradient-boosted ensemble is a few dozen shallow decision trees, and
 * evaluating one is a comparison per level. The whole race model is 6 KB.
 *
 * NODE FORMAT
 *   leaf      { v }                      the value contributed
 *   internal  { f, t, c, l, r, m }       feature index, threshold, node value,
 *                                        low child, high child, missing branch
 *
 * XGBoost sends a value STRICTLY BELOW the threshold down `l`, and everything
 * else — including equality — down `r`. A missing feature follows `m`, which
 * the model learned per split and which is not always the low side. Getting
 * either rule wrong produces a model that still returns plausible numbers and
 * is quietly wrong, which is why `npm run model:verify` checks the output
 * against vectors scored by the Python trainer.
 */

/** Walk one tree and return its leaf value. */
function leafOf(node, features) {
  let current = node;
  while (current.v === undefined) {
    const value = features[current.f];
    // NaN fails every comparison, so it is tested for rather than compared.
    const branch = Number.isNaN(value) || value === undefined || value === null
      ? current.m
      : (value < current.t ? 'l' : 'r');
    current = current[branch];
  }
  return current.v;
}

/**
 * Raw model score for one feature vector.
 *
 * No base score is added. XGBoost's `base_score` is a constant shared by every
 * row, and this score is only ever used to rank a field against itself or fed
 * to a softmax — a shared constant cancels in both, exactly.
 */
export function score(model, features) {
  let total = 0;
  for (let i = 0; i < model.trees.length; i += 1) {
    total += leafOf(model.trees[i], features);
  }
  return total;
}

/**
 * Per-feature attribution for one prediction.
 *
 * Walks root to leaf and charges each step's change in node value to the
 * feature that step split on. Summed over the ensemble the parts add up to the
 * score exactly, minus the ensemble's root value, which is returned as `base`.
 *
 * This is the split-path decomposition (the classic "tree interpreter"), NOT
 * SHAP. It is exact and additive, but it attributes along the path actually
 * taken rather than averaging over orderings, so a feature that mattered only
 * because of an earlier split is credited at the point it was used. That is the
 * right story for "why is this driver predicted here" and it is cheap enough to
 * run for twenty drivers on every slider drag.
 *
 * @returns {{base:number, total:number, contributions:number[]}}
 */
export function attribute(model, features) {
  const contributions = new Array(model.features.length).fill(0);
  let base = 0;
  let total = 0;

  for (let i = 0; i < model.trees.length; i += 1) {
    let current = model.trees[i];
    base += current.c ?? 0;
    let previous = current.c ?? 0;

    while (current.v === undefined) {
      const value = features[current.f];
      const branch = Number.isNaN(value) || value === undefined || value === null
        ? current.m
        : (value < current.t ? 'l' : 'r');
      const next = current[branch];
      const nextValue = next.v === undefined ? (next.c ?? 0) : next.v;
      contributions[current.f] += nextValue - previous;
      previous = nextValue;
      current = next;
    }
    total += current.v;
  }

  return { base, total, contributions };
}

/**
 * Softmax over scores at a fitted temperature.
 *
 * The temperature is not a display choice — it is fitted on held-out races by
 * maximum likelihood in `train_model.py`, so these percentages are calibrated
 * against how often the model's favourite actually won.
 */
export function softmax(scores, temperature) {
  const t = temperature > 0 ? temperature : 1;
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

/** Order indices best-first by score. */
export function rankOrder(scores) {
  return scores
    .map((s, i) => [s, i])
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
}
