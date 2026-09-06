import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useEffect, useRef } from "react";

/**
 * Hero-sized Manthan mark — exact markup/geometry from the reference files,
 * restored as its own full-height section: a large signal circle with the
 * small light circle slowly orbiting around it (14s linear). The connector
 * is drawn to the orbiting circle's static SVG position and rotates with it.
 */
export default function OrbitMark() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to(ref.current?.querySelectorAll(".orbit-group") ?? [], {
        rotation: 360,
        transformOrigin: "50% 50%",
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
        <circle className="big-circle" cx="200" cy="200" r="86" />
        <g className="orbit-group">
          <line className="connector" x1="200" y1="200" x2="330" y2="200" />
          <circle className="small-circle" cx="330" cy="200" r="24" />
        </g>
      </svg>
    </div>
  );
}
