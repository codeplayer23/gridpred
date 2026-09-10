/**
 * Mount heavy subtrees one per frame instead of all at once.
 *
 * A panel with three charts used to build all three in the commit that the tab
 * click triggered, so the click paid for every one of them before the interface
 * responded. Deferring each chart by a frame individually does not help — they
 * all wake on the same frame. This hands out one slot per frame, so the charts
 * arrive in quick succession and the browser gets to paint between them.
 *
 * The total work is unchanged; what changes is that none of it lands on the
 * interaction.
 */
const queue = [];
let running = false;

function flush() {
  const next = queue.shift();
  if (next) next();
  if (queue.length) requestAnimationFrame(flush);
  else running = false;
}

/**
 * Run `callback` on one of the next few frames, after anything already queued.
 * @returns {() => void} cancel, for components that unmount before their turn
 */
export function queueMount(callback) {
  queue.push(callback);
  if (!running) {
    running = true;
    requestAnimationFrame(flush);
  }
  return () => {
    const i = queue.indexOf(callback);
    if (i >= 0) queue.splice(i, 1);
  };
}
