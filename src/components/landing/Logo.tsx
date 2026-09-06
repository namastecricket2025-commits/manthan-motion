import { cn } from "@/lib/utils";

/** Manthan wordmark — two metaballs churning, echoing the background system. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <rect
        width="64"
        height="64"
        rx="16"
        fill="var(--ink)"
        stroke="var(--card-border)"
        strokeWidth="1.5"
      />
      <circle cx="29" cy="35" r="17" fill="var(--signal)" />
      <circle cx="42" cy="24" r="11" fill="var(--signal-2)" opacity="0.9" />
      <circle cx="29" cy="35" r="17" fill="var(--signal)" opacity="0.35" />
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