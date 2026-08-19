import { motion } from 'framer-motion';
import { easeOut, viewport } from '@/lib/motion';
import { useCalmMotion } from '@/hooks';

/**
 * Scroll-triggered reveal. Collapses to a plain fade when the user prefers
 * reduced motion, rather than merely running faster.
 */
export default function Reveal({
  children,
  as = 'div',
  delay = 0,
  y = 26,
  duration = 0.7,
  className = '',
  once = true,
  ...rest
}) {
  const calm = useCalmMotion();
  const Comp = motion[as] ?? motion.div;

  return (
    <Comp
      className={className}
      initial={calm ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={calm ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ ...viewport, once }}
      transition={{ duration: calm ? 0.28 : duration, ease: easeOut, delay: calm ? 0 : delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
