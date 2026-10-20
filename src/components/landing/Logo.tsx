import { cn } from "@/lib/utils";

/**
 * Manthan mark: one large circle joined by a short bar to a smaller circle.
 *
 * The core carries `--brand-mark` — amber on paper, warm white at night — and
 * the satellite plus the bar stay in the theme's ink, which is what makes the
 * mark read on both surfaces without a tile behind it. Geometry is the
 * supplied artwork, 1:1.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="60 190 904 640" className={cn("h-6 w-auto", className)} aria-hidden="true">
      <circle cx="372" cy="507.5" r="312" fill="var(--brand-mark)" />
      <rect x="693" y="492" width="73" height="48" fill="var(--text-main)" />
      <circle cx="860" cy="516.5" r="96.5" fill="var(--text-main)" />
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
