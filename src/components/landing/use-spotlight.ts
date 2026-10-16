import { useEffect, type RefObject } from "react";

/**
 * The pointer light for `.spot-card` (the card language's hover, see the
 * `.spot-card` rules in index.css).
 *
 * One listener per SECTION, not per card: the handler finds the card under
 * the pointer with `closest(".spot-card")` and writes `--spot-x`/`--spot-y`
 * on that one element. A grid of nine cards therefore costs one listener and
 * one variable write per frame, and a card that is never pointed at never
 * paints the layer at all.
 *
 * Gated three ways, because this is decoration:
 * - no real pointer (touch) means there is no hover state to light;
 * - `prefers-reduced-motion` drops it entirely, alongside the section's other
 *   GSAP work;
 * - writes are coalesced into one rAF, so a fast drag sets the target twice a
 *   frame at worst and never on scroll.
 */
export function useSpotlight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let target: HTMLElement | null = null;

    const paint = () => {
      frame = 0;
      const card = target;
      if (!card) return;
      const box = card.getBoundingClientRect();
      if (!box.width) return;
      card.style.setProperty("--spot-x", `${(pointerX - box.left).toFixed(1)}px`);
      card.style.setProperty("--spot-y", `${(pointerY - box.top).toFixed(1)}px`);
    };

    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".spot-card");
      target = card ?? null;
      if (!target) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onMove);
    };
  }, [ref]);
}
