import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

/**
 * Aceternity-style Text Generate Effect: the heading animates in word by
 * word, once, on mount/route-enter. Each segment can carry its own styling
 * (e.g. gradient-text for the accent words).
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

  useEffect(() => {
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
      {segments.map((segment, si) => (
        <span key={si} className={cn("inline", segment.className)}>
          {segment.text.split(" ").map((word, wi) => (
            <span key={`${si}-${wi}`} className="inline-block whitespace-pre">
              <span className="tge-word inline-block opacity-0 will-change-transform">
                {word}
              </span>
              {wi < segment.text.split(" ").length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}