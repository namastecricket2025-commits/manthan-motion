import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useEffect, useRef } from "react";

/**
 * Hero-sized Manthan mark — a large signal circle with the small light
 * circle slowly orbiting around it (14s linear), connected by a thin line
 * that stays fixed to the big circle's center.
 *
 * Layout:
 * - viewBox 0 0 400 400; big circle at (200,200) r=86.
 * - Orbit group rotates around (200,200) via GSAP svgOrigin.
 * - The connector line and small circle are placed at x=358 (r=78 orbit),
 *   so the satellite sits just outside the big circle rim with a visible
 *   connector gap. Both fit well inside the 400-wide viewBox, so neither
 *   the connector nor the small circle is clipped by the SVG edges.
 *
 * Rendering order: orbit group first (under), big circle last (over) so the
 * connector visually emerges from the circle's rim instead of drawing over it.
 *
 * Reduced motion shows the static mark with the satellite at 3 o'clock.
 */
export default function OrbitMark() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to(ref.current?.querySelectorAll(".orbit-group") ?? [], {
        rotation: 360,
        // Rotate in SVG user space around the big circle's center (200, 200)
        // — bbox-relative origins are wrong for asymmetric groups like ours.
        svgOrigin: "200 200",
        duration: 14,
        ease: "none",
        repeat: -1,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      <svg
        className="logo-svg h-auto w-[min(72vw,360px)]"
        viewBox="0 0 400 400"
        role="img"
        aria-label="Manthan"
      >
        {/* Orbit group first (under), big circle last (over) so the
            connector always appears anchored to the circle's rim. */}
        <g className="orbit-group">
          <line className="connector" x1="200" y1="200" x2="358" y2="200" />
          <circle className="small-circle" cx="358" cy="200" r="22" />
        </g>
        <circle className="big-circle" cx="200" cy="200" r="86" />
      </svg>
    </div>
  );
}
