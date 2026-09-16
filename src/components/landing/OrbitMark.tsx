import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { settingsRuntime } from "@/lib/app-settings";

/**
 * The Manthan hero mark — the two geometric circles that anchor the landing
 * page centre:
 *
 *   • the large primary (signal red) circle, fixed at the centre, and
 *   • the smaller light satellite circle, orbiting it on a perfect 360° loop.
 *
 * The orbit is driven by GSAP with an `svgOrigin` pivot at the big circle's
 * centre, so the connector and the satellite rotate around the core as one
 * rigid group. It must stay the only writer of that transform: a CSS
 * `@keyframes orbit` on the same group used to fight this tween every frame
 * (last-in-DOM wins) and visually detached the connector from the circle.
 *
 * Motionless Mode and the OS reduced-motion flag park the satellite at its
 * starting angle instead of spinning it.
 */
export default function OrbitMark() {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;

    const group = svg.querySelector<SVGGElement>(".orbit-group");
    if (!group) return;

    const off = settingsRuntime.reduceMotion || prefersReducedMotion();

    const ctx = gsap.context(() => {
      // Pivot: the centre of the large circle (viewBox 400×400 → 200,200).
      gsap.set(group, { svgOrigin: "200 200", rotation: 0 });
      if (off) return;
      gsap.to(group, {
        rotation: 360,
        duration: 16,
        ease: "none",
        repeat: -1,
      });
    }, svg);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={ref}
      viewBox="0 0 400 400"
      className="orbit-mark"
      role="img"
      aria-label="Manthan"
    >
      {/* soft ember halo behind the anchored core */}
      <circle className="orbit-mark__halo" cx="200" cy="200" r="150" />

      {/* large primary circle — anchored, never moves */}
      <circle className="orbit-mark__core" cx="200" cy="200" r="58" />

      {/* the orbiting pair: connector + satellite, pivoting on the core */}
      <g className="orbit-group">
        <line className="orbit-mark__connector" x1="200" y1="200" x2="312" y2="200" />
        <circle className="orbit-mark__satellite" cx="312" cy="200" r="13" />
      </g>
    </svg>
  );
}
