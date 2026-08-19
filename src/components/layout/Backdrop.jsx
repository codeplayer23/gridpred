/**
 * Fixed ambient background: carbon weave, a faint measurement grid and two slow
 * colour blooms. Sits behind everything so pages themselves stay flat and cheap
 * to animate.
 */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden carbon">
      <div className="absolute inset-0 grid-lines opacity-60" />
      <div
        className="absolute -top-[22rem] -left-[16rem] h-[46rem] w-[46rem] rounded-full opacity-[0.16] blur-[130px] animate-drift"
        style={{ background: 'radial-gradient(circle, #3671ff, transparent 68%)' }}
      />
      <div
        className="absolute -right-[18rem] top-[34rem] h-[40rem] w-[40rem] rounded-full opacity-[0.12] blur-[130px] animate-drift"
        style={{ background: 'radial-gradient(circle, #ff2d2d, transparent 68%)', animationDelay: '-6s' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
