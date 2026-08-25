import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInView, useMotionValue, useReducedMotion, useSpring, useTransform, animate } from 'framer-motion';
import { parseUtc } from '@/lib/session';

/**
 * Reduced-motion gate.
 * Returns true when the user has asked for less movement, so callers can drop
 * to instant transitions rather than merely shortening them.
 */
export function useCalmMotion() {
  return useReducedMotion() === true;
}

/** True on phones, tablets and touch laptops. */
export function useCoarsePointer() {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * Capability gate for the ambient effects layer.
 *
 * Large blur radii, blended full-viewport washes and scroll-linked transforms
 * over complex SVG are all paid for on the compositor. A desktop GPU absorbs
 * them; a phone or tablet drops frames for the whole scroll.
 *
 * The gate is the pointer, not a hardware sniff. `navigator.deviceMemory` and
 * `hardwareConcurrency` are absent on Safari and Firefox and only loosely track
 * GPU fill rate anywhere else, so keying off them would mean the same phone
 * rendering differently in two browsers. A coarse pointer is reported by every
 * device that has the problem and by nothing that doesn't.
 */
export function useReducedEffects() {
  const coarse = useCoarsePointer();
  const calm = useCalmMotion();
  return coarse || calm;
}

/**
 * Animated counter that only runs once its element enters the viewport.
 * @returns {[React.RefObject, string]} ref to attach, and the display string
 */
export function useCountUp(target, { duration = 1.4, decimals = 0, prefix = '', suffix = '' } = {}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const calm = useCalmMotion();
  const [display, setDisplay] = useState(() =>
    calm ? Number(target ?? 0).toFixed(decimals) : Number(0).toFixed(decimals),
  );

  useEffect(() => {
    const value = Number(target ?? 0);
    if (!inView) return undefined;
    if (calm) {
      setDisplay(value.toFixed(decimals));
      return undefined;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [inView, target, duration, decimals, calm]);

  return [ref, `${prefix}${display}${suffix}`];
}

/** Live countdown to an ISO timestamp, ticking once per second. */
export function useCountdown(iso) {
  const target = useMemo(() => parseUtc(iso), [iso]);
  const [ms, setMs] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    setMs(Math.max(0, target - Date.now()));
    const id = setInterval(() => setMs(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);

  return ms;
}

/**
 * Pointer-follow spring for magnetic buttons and parallax portraits.
 * @param {number} strength how far the element leans toward the cursor, in px
 */
export function useMagnetic(strength = 18) {
  const ref = useRef(null);
  // A touch drag emits pointermove, so without this gate every scroll over a
  // magnetic element drives a spring that nobody asked for.
  const reducedMotion = useCalmMotion();
  const coarse = useCoarsePointer();
  const calm = reducedMotion || coarse;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 20, mass: 0.6 });

  const onPointerMove = useCallback(
    (e) => {
      if (calm || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      x.set(((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * strength);
      y.set(((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * strength);
    },
    [calm, strength, x, y],
  );

  const reset = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return { ref, x: sx, y: sy, onPointerMove, onPointerLeave: reset, calm };
}

/**
 * Normalised pointer position over an element, as two -1..1 motion values.
 * Drives the driver-portrait parallax.
 */
export function usePointerParallax(depth = 12) {
  // Same reasoning as useMagnetic: on a touch device the "pointer" is a finger
  // that is scrolling, and leaning the artwork toward it is both wrong and
  // expensive.
  const reducedMotion = useCalmMotion();
  const coarse = useCoarsePointer();
  const calm = reducedMotion || coarse;
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 180, damping: 22 });
  const sy = useSpring(my, { stiffness: 180, damping: 22 });

  const handlers = useMemo(
    () => ({
      onPointerMove: (e) => {
        if (calm) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
        my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
      },
      onPointerLeave: () => {
        mx.set(0);
        my.set(0);
      },
    }),
    [calm, mx, my],
  );

  const translateX = useTransform(sx, [-1, 1], [-depth, depth]);
  const translateY = useTransform(sy, [-1, 1], [-depth, depth]);

  return { handlers, translateX, translateY, nx: sx, ny: sy, calm };
}

/**
 * Gently wandering telemetry value.
 *
 * The dataset is static, but a paddock feed never is — this keeps readouts
 * breathing without ever drifting far from the underlying number.
 */
export function useLiveValue(base, { spread = 0.8, interval = 1600, decimals = 1 } = {}) {
  const calm = useCalmMotion();
  // Only the drift lives in state. Keeping the base out of it means a changed
  // base (a re-run prediction, say) shows immediately instead of waiting for
  // the next tick.
  const [drift, setDrift] = useState(0);

  useEffect(() => {
    if (calm) return undefined;
    const id = setInterval(() => setDrift((Math.random() - 0.5) * spread * 2), interval);
    return () => clearInterval(id);
  }, [spread, interval, calm]);

  return calm ? base : Number((base + drift).toFixed(decimals));
}

/** Media query state, SSR-safe. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** True once the window has scrolled past `threshold` px. */
export function useScrolled(threshold = 24) {
  // Derived at init rather than in an effect, so the first paint is already
  // correct on a page restored mid-scroll.
  const [scrolled, setScrolled] = useState(
    () => typeof window !== 'undefined' && window.scrollY > threshold,
  );
  useEffect(() => {
    // The listener fires on every scroll frame, so the last crossing is kept in
    // the closure and React is only told when the boolean actually flips.
    let past = window.scrollY > threshold;
    const onScroll = () => {
      const next = window.scrollY > threshold;
      if (next === past) return;
      past = next;
      setScrolled(next);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/** Horizontal drag-scroll + arrow paging for the driver carousel. */
export function useCarousel() {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const page = useCallback((dir) => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(280, el.clientWidth * 0.8);
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  return { ref, edges, page };
}
