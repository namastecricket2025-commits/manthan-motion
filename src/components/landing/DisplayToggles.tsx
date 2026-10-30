import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { ComfortToggle } from "@/components/landing/ComfortToggle";

/**
 * The two display switches, together: theme and eye comfort. Every header
 * mounts this pair so the reading mode is never more than one tap away.
 */
export function DisplayToggles({
  className,
  /** A collapsed sidebar is 76px wide: stack the pair instead of overflowing. */
  stacked = false,
}: {
  className?: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={
        (stacked ? "inline-flex flex-col items-center gap-1.5 " : "inline-flex items-center gap-1.5 ") +
        (className ?? "")
      }
    >
      <ThemeToggle />
      <ComfortToggle />
    </div>
  );
}

export default DisplayToggles;
