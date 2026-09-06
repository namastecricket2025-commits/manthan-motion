import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { Fragment, useLayoutEffect, useRef } from "react";

/**
 * Aceternity-style Text Generate Effect: the heading animates in word by
 * word, once, on mount/route-enter. Each segment can carry its own styling
 * (e.g. gradient-text for the accent words).
 *
 * Robustness rules (these fixed a production bug):
 * - Words are visible by default — the hidden pre-animation state is applied
 *   imperatively by GSAP (useLayoutEffect, before paint), never via a static
 *   `opacity-0` class, so a failed/missed trigger can never leave a word
 *   invisible.
 * - An explicit space is inserted between segments so adjacent inline spans
 *   can never concatenate ("intoclarity").
 */
export function TextGenerate({
  segments,
  className,
  delay = 0.1,
}: {
  segments: { text: string; className?: string }[];
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll<HTMLElement>(".tge-word");
    if (prefersReducedMotion()) {
      gsap.set(words, { opacity: 1, y: 0, filter: "blur(0px)" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0, y: 18, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.045,
          delay,
        },
      );
    }, el);
    return () => ctx.revert();
  }, [delay]);

  return (
    <h1 ref={ref} className={className}>
      {segments.map((segment, si) => {
        const words = segment.text.split(" ");
        return (
          <Fragment key={si}>
            <span className={segment.className}>
              {words.map((word, wi) => (
                <span key={wi} className="inline-block whitespace-pre">
                  <span className="tge-word inline-block will-change-transform">
                    {word}
                  </span>
                  {wi < words.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
            {/* Explicit space between segments — never let them concatenate */}
            {si < segments.length - 1 ? <span aria-hidden="true"> </span> : null}
          </Fragment>
        );
      })}
    </h1>
  );
}