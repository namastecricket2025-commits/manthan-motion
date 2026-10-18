import * as React from "react";
import { cn } from "@/lib/utils";

const PALETTE = [
  // Soft, app-accent-adjacent pastels — same deterministic order for every name.
  // Chosen so the white letter keeps at least ~4.5:1 contrast in both light and
  // dark mode on each swatch.
  {
    from: "radial-gradient(circle at 30% 25%, #fde68a, #f59e0b)",
    to: "radial-gradient(circle at 70% 75%, #fbbf24, #d97706)",
    ring: "rgba(180 83 9 / 0.35)",
  },
  {
    from: "radial-gradient(circle at 30% 25%, #a7f3d0, #10b981)",
    to: "radial-gradient(circle at 70% 75%, #34d399, #047857)",
    ring: "rgba(16 185 129 / 0.35)",
  },
  {
    from: "radial-gradient(circle at 30% 25%, #bfdbfe, #3b82f6)",
    to: "radial-gradient(circle at 70% 75%, #60a5fa, #1d4ed8)",
    ring: "rgba(59 130 246 / 0.35)",
  },
  {
    from: "radial-gradient(circle at 30% 25%, #fbcfe8, #ec4899)",
    to: "radial-gradient(circle at 70% 75%, #f472b6, #be185d)",
    ring: "rgba(236 72 153 / 0.35)",
  },
  {
    from: "radial-gradient(circle at 30% 25%, #ddd6fe, #8b5cf6)",
    to: "radial-gradient(circle at 70% 75%, #a78bfa, #5b21b6)",
    ring: "rgba(139 92 246 / 0.35)",
  },
  {
    from: "radial-gradient(circle at 30% 25%, #fed7aa, #ea580c)",
    to: "radial-gradient(circle at 70% 75%, #fb923c, #9a3412)",
    ring: "rgba(234 88 12 / 0.35)",
  },
];

/** Deterministic index from a name so the same person always gets the same color. */
function paletteIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTE.length;
}

export interface InitialAvatarProps {
  name?: string | null;
  size?: "sm" | "md";
  className?: string;
}

/** Circular avatar with the uppercase first letter of `name`, or a generic user
 *  icon when no name is provided.
 *
 *  The letter is drawn in `color-mix` ink strong so it keeps contrast against
 *  both the light and dark theme surfaces the cards sit on. The same name always
 *  resolves to the same palette entry. Marked aria-hidden since the name is shown
 *  next to it.
 */
export function InitialAvatar({ name, size = "md", className }: InitialAvatarProps) {
  const letter = React.useMemo(() => {
    if (!name || name.trim().length === 0) return null;
    return name.trim()[0].toUpperCase();
  }, [name]);

  const idx = React.useMemo(() => (letter ? paletteIndex(name ?? "") : 0), [letter, name]);
  const colors = PALETTE[idx];

  const sizeClass =
    size === "sm"
      ? "h-[32px] w-[32px] text-[13px]"
      : "h-11 w-11 text-base";

  if (!letter) {
    return (
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full border",
          sizeClass,
          className,
        )}
        style={{
          background: colors.from,
          borderColor: colors.ring,
          borderWidth: 1,
        }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="absolute inset-0 m-auto h-4 w-4 text-white"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative shrink-0 flex items-center justify-center rounded-full border overflow-hidden font-semibold",
        sizeClass,
        className,
      )}
      style={{
        background: colors.from,
        borderColor: colors.ring,
        borderWidth: 1,
        color: "color-mix(in srgb, var(--text-main) 92%, white)",
      }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export default InitialAvatar;
