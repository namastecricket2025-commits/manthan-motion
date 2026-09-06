import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * Aceternity-style moving-border button (primary CTA).
 * The conic-gradient border orbits slowly at rest and accelerates on
 * hover/press — on touch devices the same feedback fires on :active.
 */
export function MovingBorderButton({
  to,
  href,
  children,
  className,
  innerClassName,
  onClick,
  target,
  rel,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
}) {
  const inner = cn(
    "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 font-display text-sm font-semibold tracking-wide text-foreground transition-colors duration-300",
    "hover:text-[var(--signal)] active:text-[var(--signal)]",
    innerClassName,
  );

  const common = {
    className: cn("moving-border block w-fit", className),
    onClick,
    target,
    rel,
  };

  if (to) {
    return (
      <Link to={to} {...common}>
        <span className={inner}>{children}</span>
      </Link>
    );
  }
  return (
    <a href={href} {...common}>
      <span className={inner}>{children}</span>
    </a>
  );
}