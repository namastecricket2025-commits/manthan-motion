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
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (w !== el.width || h !== el.height) {
        el.width = w;
        el.height = h;
      }
      size.current = { w: el.width, h: el.height, dpr };
    });
    ro.observe(el);
    return () => ro.disconnect();
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

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));