import { useStillMotion } from "@/lib/motion";
import { useEffect, useRef } from "react";

/**
 * The plane the landing page sits on.
 *
 * The hero's light is spent inside the first screen — that is deliberate, and
 * it is why the pages below it used to be flat black rectangles with cards
 * floating in them. This is the one layer that fixes that: the same 26px dot
 * cell the rest of the site already uses as its paper, and the site's own
 * soft light, together on a fixed plane behind everything, with their
 * positions driven by scroll.
 *
 * Two movements, both slow enough to be felt rather than watched:
 *
 *   the texture   drifts at 4% of the scroll. Because the dot cell repeats
 *                 every 26px, the offset can wrap for ever — the drift is
 *                 nudged the short way round the wrap, so it never reverses
 *                 and never jumps, whatever the reader does.
 *   the light     is tied to page PROGRESS, not to the scroll offset: it
 *                 starts above the first screen (so the hero keeps only its
 *                 mark's halo, exactly as designed) and glides down to the
 *                 bottom third of the screen by the time the footer arrives.
 *                 It eases toward its target instead of tracking the wheel,
 *                 which is what makes it read as weight rather than as a
 *                 scrollbar.
 *
 * Everything is written as a transform on two children of one composited
 * layer, and the frame loop stops itself the moment both have settled — a page
 * that is not being scrolled costs nothing. Under `prefers-reduced-motion` or
 * Motionless Mode the effect never attaches: the texture stays as texture and
 * the light stays off the hero.
 */
export function AmbientField() {
  const grid = useRef<HTMLDivElement | null>(null);
  const light = useRef<HTMLDivElement | null>(null);
  const still = useStillMotion();

  useEffect(() => {
    const gridEl = grid.current;
    const lightEl = light.current;
    if (!gridEl || !lightEl || still) return;

    /** One dot of the texture, in px. Must match `.ambient-field__grid`. */
    const CELL = 26;
    let vh = window.innerHeight;
    let span = 1;
    let raf = 0;
    let easedLight = 0;
    let easedGrid = 0;
    let targetLight = 0;
    let targetGrid = 0;
    let first = true;

    const frame = () => {
      raf = 0;
      const dLight = targetLight - easedLight;
      const dGrid = targetGrid - easedGrid;
      easedLight += Math.abs(dLight) < 0.4 ? dLight : dLight * 0.08;
      easedGrid += Math.abs(dGrid) < 0.15 ? dGrid : dGrid * 0.16;
      lightEl.style.transform = `translate3d(-50%, ${easedLight.toFixed(2)}px, 0)`;
      gridEl.style.transform = `translate3d(0, ${easedGrid.toFixed(2)}px, 0)`;
      if (easedLight !== targetLight || easedGrid !== targetGrid) raf = requestAnimationFrame(frame);
    };

    const read = () => {
      const y = window.scrollY || 0;
      const progress = span > 1 ? Math.min(1, Math.max(0, y / span)) : 0;
      /* −0.6 screen at the top of the page, +0.4 at the bottom. */
      targetLight = (progress - 0.6) * vh;
      let dGrid = -((y * 0.04) % CELL) - targetGrid;
      if (Math.abs(dGrid) > CELL / 2) dGrid -= Math.sign(dGrid) * CELL;
      targetGrid += dGrid;
      if (first) {
        /* A refresh half way down the page — or a deep link — must not play
           the glide from the top. Place it, then ease from there. */
        first = false;
        easedLight = targetLight;
        easedGrid = targetGrid;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const measure = () => {
      vh = window.innerHeight;
      span = Math.max(1, document.documentElement.scrollHeight - vh);
      read();
    };

    measure();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", measure);
    /* The page's height is not final at mount — fonts, the lazily-loaded
       below-the-fold sections and the testimonial rows all change it, and the
       light's travel is measured against it. Re-measure when the body's box
       changes rather than reading scrollHeight every frame (which would force
       a layout on each one). */
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", measure);
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
  }, [still]);

  return (
    <div className="ambient-field" aria-hidden="true">
      <div ref={grid} className="ambient-field__grid" />
      {/* The light only exists to travel, so with motion off it is not rendered
          at all rather than parked on the hero — the texture alone still keeps
          the plane from being flat black. */}
      {still ? null : <div ref={light} className="ambient-field__light" />}
    </div>
  );
}

export default AmbientField;
