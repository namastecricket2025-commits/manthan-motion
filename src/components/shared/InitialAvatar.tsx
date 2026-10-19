import {
  AVATAR_PALETTE,
  preferredAvatarColor,
} from "@/components/shared/avatar-colors";
import { useResolvedTheme } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

/**
 * InitialAvatar — a circular monogram for a reviewer.
 *
 * No photos and no stock faces: the avatar carries the first letter of the
 * display name on a soft gradient. Each palette hue has a light and a dark
 * variant, selected live from the app theme, so the monogram keeps its
 * contrast in both.
 *
 * Standalone uses fall back to the name hash. Lists should pass the index from
 * `assignAvatarColors(orderedReviews)` so neighbouring cards never share a
 * colour — see `avatar-colors.ts` for the assignment rule.
 *
 * `aria-hidden` is deliberate: the name is always rendered beside the avatar,
 * so the letter is decoration, not information.
 */
export function InitialAvatar({
  name,
  size = 44,
  colorIndex,
  className,
}: {
  name?: string;
  /** Diameter in px. 44 on review cards, 32 in the compact strip. */
  size?: number;
  /** Index into AVATAR_PALETTE from `assignAvatarColors`. */
  colorIndex?: number;
  className?: string;
}) {
  const theme = useResolvedTheme();
  const trimmed = (name ?? "").trim();
  const initial = trimmed ? Array.from(trimmed)[0]!.toUpperCase() : "";
  const index =
    typeof colorIndex === "number"
      ? ((colorIndex % AVATAR_PALETTE.length) + AVATAR_PALETTE.length) %
        AVATAR_PALETTE.length
      : preferredAvatarColor(trimmed);
  const swatch = AVATAR_PALETTE[index]![theme];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:border-white/25",
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
