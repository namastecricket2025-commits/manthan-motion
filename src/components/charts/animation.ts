import type { Transition } from "motion/react";

/**
 * Default cartesian chart motion. A high-damping unit-mass spring replaces
 * robotic/linear chart reveals while keeping a predictable maximum duration
 * for clip-based path drawing.
 */
export const DEFAULT_CHART_ENTER_TRANSITION: Transition = {
  type: "spring",
  mass: 1,
  stiffness: 120,
  damping: 18,
  restDelta: 0.001,
};

/** SVG clip width cannot be spring-interpolated, so expose only a duration. */
export const DEFAULT_ANIMATION_DURATION_MS = 1100;

/** CSS timing used only where the browser is interpolating a raw SVG width. */
export const DEFAULT_ANIMATION_EASING = "cubic-bezier(0.25, 1, 0.5, 1)";

/** Clip-path width reveal requires a tween; the visible chart still uses SPRING. */
export function clipRevealTransition(enterTransition?: Transition): Transition {
  if (enterTransition?.type === "tween") {
    return {
      ...enterTransition,
      ease: enterTransition.ease ?? [0.25, 1, 0.5, 1],
    };
  }

  const duration =
    typeof enterTransition?.duration === "number"
      ? enterTransition.duration
      : DEFAULT_ANIMATION_DURATION_MS / 1000;

  return {
    type: "tween",
    duration,
    ease: [0.25, 1, 0.5, 1],
  };
}
