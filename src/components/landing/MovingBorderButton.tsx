import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

/**
 * The Manthan action button — a spinning CD.
 *
 * One JS-driven clock (a rAF lerp in cd-engine) owns the disc's angle for
 * every button on the page. Hovering a button sets that button's target
 * speed to fast; leaving it lets the lerp glide the speed back down, so the
 * spin-up AND the slow-down are both smooth — no CSS animation restarts, no
 * jump when the cursor leaves. The sheen wedge lives on the face (beneath the
 * label) and the rim carries the same angle, so the whole pill reads as one
 * disc; the label brightens while the disc races under the cursor.
 */

declare global {
  interface Window {
    __cdEngine?: {
      register(el: HTMLElement): void;
      setHover(el: HTMLElement, hovering: boolean): void;
      setBusy(el: HTMLElement, busy: boolean): void;
    };
  }
}

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
  const rootRef = useRef<HTMLElement | null>(null);

  // Registry membership + hover wiring is the same for every element kind.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const engine = window.__cdEngine;
    if (!engine) return;
    engine.register(el);
    const enter = () => engine.setHover(el, true);
    const leave = () => engine.setHover(el, false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      engine.setHover(el, false);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (el) window.__cdEngine?.setBusy(el, loading);
  }, [loading]);

  const inner = cn(
    "cd-face inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-display text-sm font-semibold tracking-wide duration-300",
    innerClassName,
  );

  const setRef = (node: HTMLElement | null) => {
    rootRef.current = node;
  };

  const label = (
    <span className={inner}>
      {/* z-10 keeps the text above the sweeping sheen wedge. */}
      <span className="cd-label relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </span>
  );

  if (to) {
    return (
      <Link
        to={to}
        ref={setRef as never}
        className={cn("moving-border block w-fit", loading && "is-busy", className)}
        onClick={onClick}
        aria-label={ariaLabel}
        target={target}
        rel={rel}
      >
        {label}
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        ref={setRef as never}
        className={cn("moving-border block w-fit", loading && "is-busy", className)}
        onClick={onClick}
        aria-label={ariaLabel}
        target={target}
        rel={rel}
      >
        {label}
      </a>
    );
  }
  return (
    <button
      type={type}
      ref={setRef}
      disabled={disabled}
      className={cn(
        "moving-border block w-fit disabled:cursor-not-allowed disabled:opacity-60",
        loading && "is-busy",
        className,
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
