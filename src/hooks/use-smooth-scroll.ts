import { gsap, ScrollTrigger } from "@/lib/gsap";
import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Lenis smooth scrolling, synced into GSAP's ticker so ScrollTrigger's
 * scrubbing stays frame-accurate with the smoothed scroll position.
 *
 * - Disabled entirely under prefers-reduced-motion (native scrolling).
 * - Intercepts in-page anchor clicks (#features, #how, …) so they glide
 *   instead of jumping, then keeps the hash in the URL without a jump.
 * - On unmount: destroys Lenis and restores native scrolling.
 *
 * Scope: mounted on the landing page only — the dashboard keeps native
 * scrolling so its tables/lists behave natively.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15, // glide feel: slow, weighty, but responsive
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Keep native touch scrolling — iOS momentum already glides, and
      // virtualizing touch fights the mobile browser's URL-bar handling.
      syncTouch: false,
      touchMultiplier: 1.4,
    });

    // Frame-accurate sync: Lenis.raf receives GSAP's delta time (seconds → ms).
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Smoothly glide to in-page anchors (dock links, hero "See how it works")
    const onAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest(
        'a[href^="#"]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;

      const el = document.querySelector<HTMLElement>(hash);
      // If a section with that id doesn't exist on this page, fall through
      // to native hash navigation instead of swallowing the click.
      if (!el) return;

      e.preventDefault();
      lenis.scrollTo(el, { offset: -96 }); // clear the fixed navbar
      // Keep the URL hash without triggering a second jump.
      window.history.pushState(null, "", hash);
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [enabled]);
}
