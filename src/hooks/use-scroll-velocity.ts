import { useEffect } from "react";

/**
 * Publishes the reader's scroll velocity as `--scroll-v` on `<html>`, a signed
 * number in −1…1 that CSS can lean against.
 *
 * This is the cheap half of "the page has weight": nothing here moves on its
 * own, and nothing is scheduled. A wheel notch or a flick pushes the value up,
 * it decays within a few frames once the hand stops, and every element that
 * opts in (`.scroll-skew`) settles back to rest with it. Because it is a CSS
 * custom property, the value can drive transforms without React re-rendering
 * a single component.
 *
 * Lenis moves the native scroll position, so reading `window.scrollY` is
 * enough — no coupling to the smoothing instance, and the hook still behaves
 * on pages without it. Reduced motion opts out entirely, and the property is
 * reset on unmount so a stale lean can never survive a route change.
 */
export function useScrollVelocity(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    root.style.setProperty("--scroll-v", "0");

    let lastY = window.scrollY;
    let lastTime = performance.now();
    let target = 0;
    let value = 0;
    let frame = 0;
    let idle = 0;

    const paint = () => {
      frame = 0;
      value += (target - value) * 0.14;
      if (target === 0 && Math.abs(value) < 0.002) {
        value = 0;
        root.style.setProperty("--scroll-v", "0");
        return;
      }
      root.style.setProperty("--scroll-v", value.toFixed(3));
      frame = requestAnimationFrame(paint);
    };

    const kick = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(16, now - lastTime);
      const dy = y - lastY;

      // ~3.5px/ms is a hard flick; anything past it is clamped so the lean
      // tops out at the angle the CSS declares instead of folding the page.
      target = Math.max(-1, Math.min(1, dy / dt / 3.5));
      lastY = y;
      lastTime = now;

      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        target = 0;
        kick();
      }, 80);

      kick();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idle);
      if (frame) cancelAnimationFrame(frame);
      root.style.setProperty("--scroll-v", "0");
    };
  }, [enabled]);
}
