import { cx, tint } from '@/lib/format';

/**
 * Ambient colour wash behind a surface.
 *
 * Every one of these used to be a hard-edged radial gradient rescued by a
 * 100–130px `filter: blur()`. A blur that wide is an offscreen buffer the size
 * of the element plus the radius on each side, rebuilt whenever the element is
 * composited — and a page like the driver detail hero carries several at once
 * over a fixed background that is itself being composited. On a phone that is
 * the whole frame budget, spent on something the gradient can do by itself.
 *
 * So the softness comes from the stops. Same wash, no filter, no buffer.
 *
 * @param {string} accent hex colour the wash is built from
 * @param {number} intensity peak alpha at the centre
 */
export default function Bloom({ accent, intensity = 0.3, className = '' }) {
  return (
    <span
      aria-hidden
      className={cx('pointer-events-none absolute rounded-full', className)}
      style={{
        background:
          // `farthest-side` reaches zero exactly at the box edge, so the wash
          // never shows the hard line where the element clips — which is the
          // one thing the blur was really buying. The stops then hold their
          // energy through the middle of the falloff so the spread still reads
          // like the blurred original rather than a tight dot.
          `radial-gradient(ellipse farthest-side, ${tint(accent, intensity)}, ` +
          `${tint(accent, intensity * 0.78)} 30%, ` +
          `${tint(accent, intensity * 0.45)} 58%, ` +
          `${tint(accent, intensity * 0.16)} 80%, ` +
          `transparent 100%)`,
      }}
    />
  );
}
