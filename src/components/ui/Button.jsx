import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const MotionLink = motion.create(Link);
import { ArrowRight } from 'lucide-react';
import { cx } from '@/lib/format';
import { springSnappy } from '@/lib/motion';
import { useMagnetic } from '@/hooks';

const VARIANTS = {
  primary: 'bg-ink text-void hover:bg-white',
  ghost: 'bg-white/[0.04] text-ink hairline hover:bg-white/[0.09]',
  outline: 'text-ink hairline hover:bg-white/[0.06]',
};

/**
 * Magnetic call-to-action. The whole control leans toward the pointer while the
 * label and arrow separate slightly — the movement reads as responsiveness, not
 * decoration, and it is disabled entirely under reduced motion.
 */
export default function Button({
  children,
  to,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  icon: Icon = ArrowRight,
  showIcon = true,
  className = '',
  type = 'button',
  ...rest
}) {
  const { ref, x, y, onPointerMove, onPointerLeave } = useMagnetic(9);

  const content = (
    <>
      <span className="relative z-10 whitespace-nowrap">{children}</span>
      {showIcon && Icon && (
        <motion.span
          className="relative z-10 flex items-center"
          variants={{ rest: { x: 0 }, hover: { x: 5 } }}
          transition={springSnappy}
        >
          <Icon size={size === 'lg' ? 19 : 16} strokeWidth={2.1} aria-hidden />
        </motion.span>
      )}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white/12"
        variants={{ rest: { opacity: 0, scale: 0.86 }, hover: { opacity: 1, scale: 1 } }}
        transition={{ duration: 0.35 }}
      />
    </>
  );

  const classes = cx(
    'group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full font-medium tracking-[-0.01em] transition-colors duration-300',
    size === 'lg' ? 'h-14 px-8 text-[0.98rem]' : size === 'sm' ? 'h-9 px-4 text-[0.8rem]' : 'h-11 px-6 text-sm',
    VARIANTS[variant],
    className,
  );

  const motionProps = {
    ref,
    style: { x, y },
    onPointerMove,
    onPointerLeave,
    initial: 'rest',
    whileHover: 'hover',
    whileFocus: 'hover',
    whileTap: { scale: 0.97 },
    animate: 'rest',
    className: classes,
  };

  if (to) {
    return (
      <MotionLink {...motionProps} to={to} onClick={onClick} {...rest}>
        {content}
      </MotionLink>
    );
  }
  if (href) {
    return (
      <motion.a {...motionProps} href={href} {...rest}>
        {content}
      </motion.a>
    );
  }
  return (
    <motion.button {...motionProps} type={type} onClick={onClick} {...rest}>
      {content}
    </motion.button>
  );
}
