/**
 * Native-feeling product motion: a unit-mass spring with moderate stiffness
 * and high damping. It settles with a small, organic settle instead of a
 * robotic overshoot, and is shared by dashboard cards, chart strokes and
 * feature workspaces so layout changes feel like one system.
 */
export const SPRING = {
  type: "spring",
  mass: 1,
  stiffness: 120,
  damping: 18,
} as const;
