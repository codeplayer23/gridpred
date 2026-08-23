/**
 * Fixed ambient background: carbon weave, a faint measurement grid and two slow
 * colour blooms. Sits behind everything so pages themselves stay flat and cheap
 * to animate.
 *
 * This layer is full-viewport and permanently on screen, which makes it the one
 * place where a careless effect costs a frame on *every* scroll. So it holds to
 * three rules:
 *
 *   - No `filter: blur()`. The blooms are radial gradients with soft stops,
 *     which the rasteriser draws directly. A 130px blur on a 46rem box reads
 *     identically and costs a large offscreen buffer per frame.
 *   - No blend modes on touch devices. `mix-blend-overlay` on a fixed layer
 *     pulls everything painted beneath it into the blend, so the compositor
 *     cannot treat the page as static while scrolling.
 *   - The drift animation is for pointer devices only; it is decoration, and a
 *     phone should spend its GPU on the content instead.
 */
export default function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden carbon"
      style={{ contain: 'strict' }}
    >
      <div className="absolute inset-0 grid-lines opacity-60" />
      <div
        className="absolute -top-[22rem] -left-[16rem] h-[46rem] w-[46rem] rounded-full opacity-[0.22] fine:animate-drift"
        style={{
          background:
            'radial-gradient(ellipse farthest-side, rgba(54,113,255,0.6), rgba(54,113,255,0.47) 30%, rgba(54,113,255,0.27) 58%, rgba(54,113,255,0.1) 80%, transparent 100%)',
        }}
      />
      <div
        className="absolute -right-[18rem] top-[34rem] h-[40rem] w-[40rem] rounded-full opacity-[0.17] fine:animate-drift"
        style={{
          background:
            'radial-gradient(ellipse farthest-side, rgba(255,45,45,0.58), rgba(255,45,45,0.45) 30%, rgba(255,45,45,0.26) 58%, rgba(255,45,45,0.09) 80%, transparent 100%)',
          animationDelay: '-6s',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay touch:hidden"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
