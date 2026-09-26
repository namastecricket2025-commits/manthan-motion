/**
 * The product's single motion system.
 *
 * One unit-mass spring — moderate stiffness, high damping — owns every layout
 * change, menu click and element reveal in the app. It settles with a small,
 * organic weight instead of a robotic overshoot or a linear snap, so a
 * workspace swap, a sidebar highlight and a card arriving all feel like the
 * same physical material (macOS / visionOS window behaviour).
 *
 * Nothing animates with `linear` or `duration` easing on its own: components
 * import SPRING (through `useSpringTransition`) and the shared variants below.
 */
import { useEffect, useState } from "react";
import { useReducedMotion, type Transition, type Variants } from "motion/react";

/** The one spring. Everything that moves in this app moves on it. */
export const SPRING = {
  type: "spring",
  mass: 1,
  stiffness: 90,
  damping: 20,
} as const;

/** Motionless Mode / prefers-reduced-motion: the same beats, no travel. */
export const STILL: Transition = { duration: 0 };

/**
 * True when either the operating system or the in-app Motionless Mode asks
 * for stillness. Motionless Mode is the `data-motion="reduced"` attribute the
 * settings provider writes on <html>, so it is observed here rather than
 * assumed.
 */
export function useStillMotion(): boolean {
  const systemReduced = useReducedMotion();
  const [appReduced, setAppReduced] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.motion === "reduced",
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setAppReduced(root.dataset.motion === "reduced");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    return () => observer.disconnect();
  }, []);

  return Boolean(systemReduced) || appReduced;
}

/** The spring, or an instant settle when the user asked for stillness. */
export function useSpringTransition(): Transition {
  return useStillMotion() ? STILL : SPRING;
}

/** Stagger step that collapses to zero under reduced motion. */
export function useStagger(step = 0.06): (index: number) => number {
  const still = useStillMotion();
  return (index: number) => (still ? 0 : index * step);
}

/** A block arriving: it rises and settles into place with weight. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/**
 * A view swap: the outgoing face lifts away, the incoming one slides up and
 * settles — the "window" feeling of replacing a state, never a cut.
 */
export const viewVariants: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.988 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -18, scale: 0.992 },
};
