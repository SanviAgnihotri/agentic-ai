"use client";

/**
 * Motion primitives — the shared animation system (see DESIGN.md → Motion).
 *
 * Rules baked in here:
 *  - Motion is feedback, not decoration: fade + small y-translate, no bounce.
 *  - One press curve: scale(0.97).
 *  - Everything respects `prefers-reduced-motion` by rendering static.
 */

import { animate, motion, useInView, useReducedMotion, type Transition } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export const motionTokens = {
  fast: 0.12,
  base: 0.18,
  slow: 0.26,
  stagger: 0.035,
  pressScale: 0.97,
  spring: { type: "spring", stiffness: 400, damping: 34, mass: 0.8 } as Transition,
};

const ENTER_EASE = [0.25, 0.46, 0.45, 0.94] as const;

/** Fade + rise into view (once). The only scroll-triggered primitive. */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 6,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li";
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: motionTokens.base, ease: ENTER_EASE, delay }}
    >
      {children}
    </Component>
  );
}

/** Orchestrated list entrance. Use with <StaggerItem>; caps the cascade at ~8. */
export function Stagger({
  children,
  className,
  as = "div",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul";
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: Math.min(motionTokens.stagger, 0.28 / 8), delayChildren: delay },
        },
      }}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 6 },
        show: { opacity: 1, y: 0, transition: { duration: motionTokens.base, ease: ENTER_EASE } },
      }}
    >
      {children}
    </Component>
  );
}

/** Animated number for stats — counts up when scrolled into view. */
export function CountUp({
  value,
  className,
  duration = 0.6,
  style,
}: {
  value: number;
  className?: string;
  duration?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [inView, reduced, value, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {Math.round(display).toLocaleString()}
    </span>
  );
}

/** Shared layoutId — render inside elements that should crossfade/morph, e.g.
 *  the active nav pill. All siblings must share the same `id`. */
export function ActiveIndicator({
  layoutId,
  className,
}: {
  layoutId: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.span
      layoutId={layoutId}
      className={className}
      transition={motionTokens.spring}
    />
  );
}
