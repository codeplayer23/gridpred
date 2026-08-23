/** Shared motion vocabulary so every surface animates with the same physics. */

export const spring = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 };
export const springSoft = { type: 'spring', stiffness: 150, damping: 24 };
export const springSnappy = { type: 'spring', stiffness: 420, damping: 34 };
export const easeOut = [0.16, 1, 0.3, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: easeOut } },
};

export const stagger = (staggerChildren = 0.07, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

/** Big display type that resolves upward with a slight blur — the hero idiom. */
export const revealLine = {
  hidden: { opacity: 0, y: '38%', filter: 'blur(14px)' },
  show: (i = 0) => ({
    opacity: 1,
    y: '0%',
    filter: 'blur(0px)',
    transition: { duration: 1.05, ease: easeOut, delay: 0.1 + i * 0.11 },
  }),
};

/**
 * The same reveal without the blur pass.
 *
 * Animating `filter: blur()` across the largest type on the page means a real
 * blur of the rasterised glyphs on every frame of the intro — on the element
 * that is also the page's largest contentful paint. Worse, the element keeps
 * `filter: blur(0px)` afterwards, which holds it on its own composited layer
 * with a filter attached for the rest of the session. Touch devices get the
 * lift and the fade, which is where nearly all of the effect lives anyway.
 */
export const revealLineLean = {
  hidden: { opacity: 0, y: '38%' },
  show: (i = 0) => ({
    opacity: 1,
    y: '0%',
    transition: { duration: 0.85, ease: easeOut, delay: 0.08 + i * 0.09 },
  }),
};

export const viewport = { once: true, amount: 0.25, margin: '0px 0px -12% 0px' };
