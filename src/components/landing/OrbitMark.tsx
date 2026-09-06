import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useEffect, useRef } from "react";

/**
 * Hero-sized Manthan mark — a large signal circle with the small light
 * circle slowly orbiting around it (14s linear), connected by a thin line
 * that stays fixed to the big circle's center.
 *
 * Correctness notes (this fixed a visible detachment bug):
 * - The rotation pivot is the SVG user-space point (200, 200) — the big
 *   circle's true center. Using transformOrigin "50% 50%" instead would
 *   pivot around the orbit-group's *bounding box* center, which sits far
 *   right of the circle (the line extends to x=330), so the assembly swung
 *   around the wrong point and the line visually detached from the circle.
 * - The big circle is painted AFTER the orbit group so the connector
 *   visually emerges from the circle's rim instead of drawing over it.
 * - Reduced motion shows the static mark with the satellite at 3 o'clock.
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
        className="logo-svg h-auto w-[min(62vw,320px)]"
        viewBox="0 0 400 400"
        role="img"
        aria-label="Manthan"
      >
        {/* Orbit group first (under), big circle last (over) so the
            connector always appears anchored to the circle's rim. */}
        <g className="orbit-group">
          <line className="connector" x1="200" y1="200" x2="330" y2="200" />
          <circle className="small-circle" cx="330" cy="200" r="24" />
        </g>
        <circle className="big-circle" cx="200" cy="200" r="86" />
      </svg>
    </div>
  );
}
