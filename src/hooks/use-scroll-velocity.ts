import { useEffect } from "react";

/**
 * Publishes the reader's scroll velocity to the fields that lean with it.
 *
 * The value is written INLINE on each `.scroll-skew` element, never on
 * `<html>`. A custom property on the root invalidates style for the whole
 * document on every frame, which is exactly enough to turn a smooth scroll
 * into a visibly janky one; the same value on two leaf nodes invalidates two
 * small subtrees. That is the difference between this costing nothing and
 * being the most expensive thing on the page.
 *
 * Reads `window.scrollY`, so it works with Lenis (which moves the native
 * scroll position) and without it. Targets are re-queried once per gesture,
 * not once per frame, so an element that mounts late still leans. Reduced
 * motion opts out and the property is cleared on unmount.
 */
export function useScrollVelocity(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let nodes: HTMLElement[] = [];
    let lastY = window.scrollY;
    let lastTime = performance.now();
    let target = 0;
    let value = 0;
    let frame = 0;
    let idle = 0;

    const release = () => {
      nodes.forEach((el) => el.style.removeProperty("--scroll-v"));
      nodes = [];
    };

    const paint = () => {
      frame = 0;
      value += (target - value) * 0.14;
      if (target === 0 && Math.abs(value) < 0.002) {
        value = 0;
        release();
        return;
      }
      const text = value.toFixed(3);
      nodes.forEach((el) => el.style.setProperty("--scroll-v", text));
      frame = requestAnimationFrame(paint);
    };

    const kick = () => {
      if (frame) return;
      // One query per gesture, not per frame.
      nodes = Array.from(
        document.querySelectorAll<HTMLElement>(".scroll-skew"),
      );
      frame = requestAnimationFrame(paint);
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
      document
        .querySelectorAll<HTMLElement>(".scroll-skew")
        .forEach((el) => el.style.removeProperty("--scroll-v"));
      nodes = [];
    };
  }, [enabled]);
}
