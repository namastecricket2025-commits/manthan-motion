import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * The Manthan action button.
 *
 * A conic-gradient ring sits behind a crimson inner face, and one spin clock
 * drives BOTH the rim and the sheen that sweeps across the fill — the button
 * reads as a single spinning CD. One slow 8s turn at rest, spinning up to
 * ~1.1s the moment the pointer lands on it (and on :active for touch, where
 * there is no hover), and ~0.9s while `loading` is set so an in-flight action
 * visibly races instead of freezing.
 *
 * Renders a router link, an anchor, or a real <button> depending on which
 * props it is given, so the dashboard's actions get the same motion as the
 * marketing CTAs.
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
  type = "button",
  disabled,
  loading = false,
  ariaLabel,
}: {
  to?: string;
  href?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  /** In-flight marker: the disc spins fast and the button stops looking dead. */
  loading?: boolean;
  ariaLabel?: string;
}) {
  const inner = cn(
    "moving-border__inner inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-semibold tracking-wide duration-300",
    innerClassName,
  );

  const common = {
    className: cn("moving-border block w-fit", loading && "is-busy", className),
    onClick,
    "aria-label": ariaLabel,
  };

  if (to) {
    return (
      <Link to={to} {...common} target={target} rel={rel}>
        <span className={inner}>
          <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
        </span>
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} {...common} target={target} rel={rel}>
        <span className={inner}>
          <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
        </span>
      </a>
    );
  }
  return (
    <button
      type={type}
      {...common}
      disabled={disabled}
      className={cn(
        "moving-border block w-fit disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span className={inner}>
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </span>
    </button>
  );
}