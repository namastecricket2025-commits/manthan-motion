import { cn } from "@/lib/utils";

/**
 * Manthan mark: one large circle joined by a short bar to a smaller circle,
 * all in one solid colour that follows the theme (white on dark, dark on light).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="60 190 904 640" className={cn("h-6 w-auto", className)} aria-hidden="true">
      <path
        fill="var(--text-main)"
        d="M372 195a312 312 0 1 0 0 625a312 312 0 1 0 0-625zM693 492h73v48h-73zM860 420a96 96 0 1 0 0 193a96 96 0 1 0 0-193z"
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
