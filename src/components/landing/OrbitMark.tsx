/**
 * The Manthan hero mark — the site's central brand asset, restored from the
 * previous build.
 *
 * The large gold circle (`.big-circle`) is anchored at the centre of the
 * 400×400 viewBox and never moves. The connector line and the small light
 * satellite (`.small-circle`) live in an `.orbit-group` that GSAP rotates a
 * full 360° around the core, forever, on a 14s linear loop with
 * `svgOrigin: "200 200"` so it pivots exactly on the core's centre.
 *
 * Motionless Mode and `prefers-reduced-motion` skip the tween entirely, so
 * the satellite simply parks at its starting angle.
 */
import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

export default function OrbitMark({
  className,
  svgClassName,
}: {
  className?: string;
  svgClassName?: string;
} = {}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.to(ref.current?.querySelectorAll(".orbit-group") ?? [], {
        rotation: 360,
        svgOrigin: "200 200",
        duration: 14,
        ease: "none",
        repeat: -1,
      });
    }, ref);
    return () => context.revert();
  }, []);

  return (
    <div
      ref={ref}
      className={
        className ?? "flex h-full w-full items-center justify-center"
      }
    >
      <svg
        className={
          svgClassName
            ? `logo-svg ${svgClassName}`
            : "logo-svg h-auto w-[min(72vw,360px)]"
        }
        viewBox="0 0 400 400"
        role="img"
        aria-label="Manthan"
      >
        <g className="orbit-group">
          <line className="connector" x1="200" y1="200" x2="358" y2="200" />
          <circle className="small-circle" cx="358" cy="200" r="22" />
        </g>
        <circle className="big-circle" cx="200" cy="200" r="86" />
      </svg>
    </div>
  );
}
