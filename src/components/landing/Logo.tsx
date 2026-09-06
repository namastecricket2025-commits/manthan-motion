import { cn } from "@/lib/utils";

/**
 * Manthan mark — exact shapes from the reference files:
 * a red circle connected by a thin line to a smaller light-colored circle,
 * no background tile.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-7 w-7", className)} aria-hidden="true">
      <circle cx="20" cy="20" r="9" fill="var(--signal)" />
      <circle cx="33" cy="20" r="3" fill="var(--text-main)" />
      <line
        x1="20"
        y1="20"
        x2="33"
        y2="20"
        stroke="var(--text-dim)"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        Manthan
      </span>
    </span>
  );
}
