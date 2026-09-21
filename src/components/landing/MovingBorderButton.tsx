import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * The Manthan action button.
 *
 * A conic-gradient ring sits behind a frosted inner pane, so the crimson sweep
 * rotates *through* the button like the sheen on a spinning CD — one slow 8s
 * turn at rest, spinning up to ~1.1s the moment the pointer lands on it (and
 * on :active for touch, where there is no hover).
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
  ariaLabel?: string;
}) {
  const inner = cn(
    "moving-border__inner inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-semibold tracking-wide duration-300",
    innerClassName,
  );

  const common = {
    className: cn("moving-border block w-fit", className),
    onClick,
    "aria-label": ariaLabel,
  };

  if (to) {
    return (
      <Link to={to} {...common} target={target} rel={rel}>
        <span className={inner}>{children}</span>
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} {...common} target={target} rel={rel}>
        <span className={inner}>{children}</span>
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
      <span className={inner}>{children}</span>
    </button>
  );
}