import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** Spring tuning used across the lab: stiffness 250, damping 22. */
export const SPRING = { type: "spring", stiffness: 250, damping: 22 } as const;

/** Runs a callback every animation frame with delta time (seconds). */
export function useRaf(cb: (dt: number, t: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** Resizes a canvas to its CSS box (devicePixelRatio-aware). */
export function useCanvasSize<T extends HTMLCanvasElement>() {
  const ref = useRef<T | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // ResizeObserver bursts are coalesced into one frame so a collapsing
    // scrollbar or mobile browser-chrome change can never thrash the canvas
    // (writing canvas.width resets the drawing buffer).
    let queued = 0;
    const apply = () => {
      queued = 0;
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (w !== el.width || h !== el.height) {
        el.width = w;
        el.height = h;
      }
      size.current = { w: el.width, h: el.height, dpr };
    };
    const ro = new ResizeObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(apply);
    });
    ro.observe(el);
    return () => {
      if (queued) cancelAnimationFrame(queued);
      ro.disconnect();
    };
  }, []);
  return { ref, size };
}

/** Native wheel listener with preventDefault — for canvas zoom. */
export function useWheelZoom(
  ref: RefObject<HTMLCanvasElement | null>,
  onZoom: (deltaY: number) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onZoom(e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, onZoom]);
}

/**
 * Native non-passive wheel listener on any element — prevents the page
 * from scrolling while a diagram zooms (React's synthetic onWheel is
 * attached passively and cannot call preventDefault).
 */
export function useNativeWheel<T extends HTMLElement>(ref: RefObject<T | null>, onWheel?: (e: WheelEvent) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      onWheel?.(e);
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, [ref, onWheel]);
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/* ============================================================
   WebGL viewport stabiliser.

   THREE.WebGLRenderer.setSize() assigns canvas.width/height, and the
   spec says assigning those *always* resets the drawing buffer — even
   when the value is unchanged. Calling it on every animation frame is
   therefore a guaranteed source of shimmer on the 3D diagrams, and doing
   it mid-drag makes the model visibly vibrate under the pointer.

   syncViewport() applies a new size only when the CSS box genuinely
   changed, and defers the swap while a pointer gesture is in flight.
   ============================================================ */

export interface Viewport {
  w: number;
  h: number;
  dirty: boolean;
}

/** Stable per-canvas viewport state. */
export function useViewport() {
  return useRef<Viewport>({ w: 0, h: 0, dirty: true });
}

export function syncViewport(
  vp: Viewport,
  renderer: { setSize: (w: number, h: number, updateStyle?: boolean) => void },
  camera: { aspect: number; updateProjectionMatrix: () => void },
  cssW: number,
  cssH: number,
  held: boolean,
) {
  if (cssW <= 0 || cssH <= 0) return;
  if (Math.abs(cssW - vp.w) > 0.5 || Math.abs(cssH - vp.h) > 0.5) {
    vp.w = cssW;
    vp.h = cssH;
    vp.dirty = true;
  }
  if (!vp.dirty || held) return;
  vp.dirty = false;
  renderer.setSize(cssW, cssH, false);
  camera.aspect = cssW / cssH;
  camera.updateProjectionMatrix();
}