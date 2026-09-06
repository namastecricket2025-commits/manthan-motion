import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** True when the user prefers reduced motion — used to freeze animations. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Shared reveal config: one-time scroll-triggered entrance, matching the
 *  reference files' 60–90ms stagger rhythm. */
export const revealConfig = {
  start: "top 85%",
  toggleActions: "play none none none",
} as const;

/** Refresh ScrollTrigger measurements once fonts/layout settle. */
export function refreshOnLoad() {
  const onLoad = () => ScrollTrigger.refresh();
  window.addEventListener("load", onLoad);
  return () => window.removeEventListener("load", onLoad);
}