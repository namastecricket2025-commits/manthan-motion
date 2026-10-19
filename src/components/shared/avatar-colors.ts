/**
 * Avatar colours for review lists.
 *
 * The palette is deliberately small, soft and theme-aware: eight hues from the
 * indigo/violet core with complementary teal, amber, rose, sky, emerald and
 * orange. Each hue has a light-mode and a dark-mode variant; the light variants
 * are pastel with deep ink, the dark variants are saturated with near-white ink
 * (amber and orange take dark ink), so the initial stays readable in both
 * themes.
 *
 * The colour for a single avatar is normally its name hash. Lists must use
 * `assignAvatarColors`, though: a hash alone can hand the same colour to two
 * neighbouring cards, which is exactly the bug this module exists to prevent.
 * The assignment is done on the FINAL display order and avoids the two cards
 * before and after each position, wrapping around the list because the
 * carousel loops.
 */

export type AvatarSwatch = {
  from: string;
  to: string;
  ink: string;
};

export type AvatarColor = {
  id: string;
  light: AvatarSwatch;
  dark: AvatarSwatch;
};

export const AVATAR_PALETTE: AvatarColor[] = [
  {
    id: "indigo",
    light: { from: "#c7d2fe", to: "#a5b4fc", ink: "#312e81" },
    dark: { from: "#4f46e5", to: "#312e81", ink: "#eef2ff" },
  },
  {
    id: "violet",
    light: { from: "#ddd6fe", to: "#c4b5fd", ink: "#4c1d95" },
    dark: { from: "#7c3aed", to: "#4c1d95", ink: "#f5f3ff" },
  },
  {
    id: "teal",
    light: { from: "#99f6e4", to: "#5eead4", ink: "#134e4a" },
    dark: { from: "#0f766e", to: "#115e59", ink: "#f0fdfa" },
  },
  {
    id: "amber",
    light: { from: "#fde68a", to: "#fcd34d", ink: "#78350f" },
    dark: { from: "#fbbf24", to: "#d97706", ink: "#2a1a00" },
  },
  {
    id: "rose",
    light: { from: "#fecdd3", to: "#fda4af", ink: "#881337" },
    dark: { from: "#be123c", to: "#9f1239", ink: "#fff1f2" },
  },
  {
    id: "sky",
    light: { from: "#bae6fd", to: "#7dd3fc", ink: "#0c4a6e" },
    dark: { from: "#0369a1", to: "#075985", ink: "#f0f9ff" },
  },
  {
    id: "emerald",
    light: { from: "#a7f3d0", to: "#6ee7b7", ink: "#064e3b" },
    dark: { from: "#047857", to: "#065f46", ink: "#ecfdf5" },
  },
  {
    id: "orange",
    light: { from: "#fed7aa", to: "#fdba74", ink: "#7c2d12" },
    dark: { from: "#c2410c", to: "#9a3412", ink: "#fff7ed" },
  },
];

/** Stable, order-independent hash so a name always starts on one hue. */
export function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.toLowerCase().charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function preferredAvatarColor(name?: string): number {
  return hashName((name ?? "").trim()) % AVATAR_PALETTE.length;
}

/**
 * Assign one palette index per review in display order.
 *
 * Each card starts at its name-hash hue and steps forward through the palette
 * until it differs from the two assigned before it and the two after it. The
 * final cards see the first cards as their "next" neighbours, so the list is
 * treated as a ring. Backtracking is used only when a greedy step would strand
 * a later card; with eight hues and a five-card window a solution always
 * exists.
 */
export function assignAvatarColors(
  orderedReviews: Array<{ displayName?: string }>,
): number[] {
  const count = orderedReviews.length;
  if (count === 0) return [];

  const paletteSize = AVATAR_PALETTE.length;
  const preferred = orderedReviews.map((review) =>
    preferredAvatarColor(review.displayName),
  );
  const assigned = new Array<number>(count).fill(-1);

  const fits = (index: number, color: number) => {
    for (const offset of [-2, -1, 1, 2]) {
      const neighbour = (index + offset + count) % count;
      if (assigned[neighbour] === color) return false;
    }
    return true;
  };

  const solve = (index: number): boolean => {
    if (index === count) return true;
    const start = preferred[index]!;
    for (let step = 0; step < paletteSize; step += 1) {
      const color = (start + step) % paletteSize;
      if (!fits(index, color)) continue;
      assigned[index] = color;
      if (solve(index + 1)) return true;
      assigned[index] = -1;
    }
    return false;
  };

  // The fallback should be unreachable with eight colours, but a list must
  // never render with a missing avatar colour.
  if (!solve(0)) {
    return orderedReviews.map((_, index) => index % paletteSize);
  }
  return assigned;
}
