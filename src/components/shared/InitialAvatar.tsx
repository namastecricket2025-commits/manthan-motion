import { cn } from "@/lib/utils";
import { User } from "lucide-react";

/**
 * InitialAvatar — a circular monogram for a reviewer.
 *
 * No photos and no stock faces: the avatar carries the first letter of the
 * display name on a soft gradient. The gradient is chosen by hashing the name,
 * so the same reviewer keeps the same colour across the carousel, the pricing
 * strip and any future surface.
 *
 * Every gradient is dark enough for the near-white letter to pass AA (the
 * amber is the exception: it stays light and takes dark ink), so the monogram
 * holds contrast on both the light and the dark theme without a theme branch.
 * `aria-hidden` is deliberate — the name is always rendered beside it, so the
 * letter is decoration, not information.
 */

type Swatch = {
  from: string;
  to: string;
  ink: string;
};

/** Indigo/violet core with complementary sky, teal, amber and rose. */
const PALETTE: Swatch[] = [
  { from: "#4f46e5", to: "#312e81", ink: "#eef2ff" }, // indigo
  { from: "#7c3aed", to: "#4c1d95", ink: "#f5f3ff" }, // violet
  { from: "#0284c7", to: "#075985", ink: "#f0f9ff" }, // sky
  { from: "#0d9488", to: "#115e59", ink: "#f0fdfa" }, // teal
  { from: "#fbbf24", to: "#d97706", ink: "#2a1a00" }, // brand amber
  { from: "#e11d48", to: "#9f1239", ink: "#fff1f2" }, // rose
];

/** Stable, order-independent hash so a name always lands on one swatch. */
function hashName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.toLowerCase().charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function InitialAvatar({
  name,
  size = 44,
  className,
}: {
  name?: string;
  /** Diameter in px. 44 on review cards, 32 in the compact strip. */
  size?: number;
  className?: string;
}) {
  const trimmed = (name ?? "").trim();
  const initial = trimmed ? Array.from(trimmed)[0]!.toUpperCase() : "";
  const swatch = PALETTE[hashName(trimmed) % PALETTE.length]!;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(145deg, ${swatch.from}, ${swatch.to})`,
        color: swatch.ink,
      }}
    >
      {initial ? (
        <span
          className="font-semibold leading-none tracking-wide"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {initial}
        </span>
      ) : (
        <User
          strokeWidth={1.8}
          style={{
            width: Math.round(size * 0.5),
            height: Math.round(size * 0.5),
          }}
        />
      )}
    </span>
  );
}

export default InitialAvatar;
