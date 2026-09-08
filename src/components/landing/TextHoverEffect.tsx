import { cn } from "@/lib/utils";

/**
 * "STUDY MATERIAL" closing word — filled Outfit 800 with a solid
gradient that reads as text-colour → signal red.

- In dark mode the gradient starts pure warm white (matching the rest of
  the heading) then burns into a bright signal-family red across the tail
  letters.
- In light mode the gradient starts espresso black, then ignites into
  signal red on the final letters.
- The word is always solid — no hollow strokes, no cursor-tracked mask,
  no cursor interaction. Reduced motion shows the finished state
  immediately.
*/
export function TextHoverEffect({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-display font-bold tracking-tight",
        "bg-gradient-to-r from-[var(--gt-head)] via-[var(--gt-head)] to-[var(--gt-tail)]",
        "bg-[length:120%_auto]",
        "bg-clip-text",
        "text-[var(--text-main)]",
        "-webkit-text-fill-color:transparent",
        "text-hover-effect",
        className,
      )}
      style={{ fontSize: "clamp(34px, 7vw, 56px)", lineHeight: 1.05 }}
      aria-label={text}
    >
      {text}
    </span>
  );
}
