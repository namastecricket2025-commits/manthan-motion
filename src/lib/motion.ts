/**
 * Shared motion preset: the fluid spring physics used across the product
 * (stiffness 250, damping 22). Kept in `lib` so features outside the STEM Lab
 * can use it without importing lab modules.
 */
export const SPRING = { type: "spring", stiffness: 250, damping: 22 } as const;
