import { motion } from 'framer-motion';
import { cx } from '@/lib/format';

/**
 * Glass surface with an optional accent wash and hover elevation.
 * One shared container idiom keeps the product feeling like one product.
 */
export default function Panel({
  children,
  accent,
  interactive = false,
  className = '',
  wash = 0.07,
  as = 'div',
  ...rest
}) {
  const Comp = motion[as] ?? motion.div;
  return (
    <Comp
      className={cx(
        'relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.022]',
        'backdrop-blur-xl',
        interactive && 'transition-colors duration-500 hover:border-white/[0.14]',
        className,
      )}
      {...(interactive
        ? { whileHover: { y: -4 }, transition: { type: 'spring', stiffness: 300, damping: 26 } }
        : {})}
      {...rest}
    >
      {accent && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      {accent && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[130%] -translate-x-1/2 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
          style={{ background: `radial-gradient(closest-side, ${accent}, transparent)`, opacity: wash }}
        />
      )}
      {children}
    </Comp>
  );
}
