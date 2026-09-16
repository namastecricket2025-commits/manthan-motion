import { useEffect, useRef } from "react";
import { settingsRuntime } from "@/lib/app-settings";

/**
 * Manthan backdrop engine — the signature crimson atmosphere.
 *
 * One full-viewport, pointer-transparent layer (`pointer-events: none`,
 * `z-index: 1`) holds everything:
 *
 *   1. THE POINTER CANOPY (`.mesh-cursor-glow`) — the signature fill,
 *      `radial-gradient(circle at var(--mouse-x) var(--mouse-y), …)` behind a
 *      140px blur. Because the gradient itself is anchored to those two
 *      variables, the whole pool of light travels with the cursor.
 *   2. FOUR ORGANIC SHAPES (`.mesh-shape--a…d`) — oversized crimson/ruby/
 *      oxblood radial blobs that morph fluidly on long keyframe loops and are
 *      translated by the same damped position at four different damping
 *      factors, which is what gives the field layered depth.
 *
 * THE MOTION: a window-level `mousemove` listener captures the raw cursor
 * coordinates (clientX / clientY) immediately; a single rAF loop then eases
 * the live position toward them with an exponential lerp —
 *
 *     pos += (target − pos) · LERP · k          // k normalises to 60fps
 *
 * — and writes the *smoothed* value back into `--mouse-x` / `--mouse-y` on the
 * layer. That is the inertia: the shapes keep gliding after the cursor stops,
 * and lag behind it while it moves, instead of snapping. Everything is written
 * straight to inline styles/custom properties, so pointer movement never
 * re-renders React.
 *
 * After the pointer rests, the target eases along a slow Lissajous path so the
 * background is never dead. Motionless Mode freezes it in place, the 30fps
 * framerate target throttles the loop, `--bg-glow-opacity` (Ambient Intensity)
 * scales the whole layer, and touch / reduced-motion users get the same
 * atmosphere parked as a static pool of light.
 */

/** Resting spot as a fraction of the viewport, before the first pointer move. */
const REST = { x: 0.32, y: 0.34 };
/** Lerp factor per 60fps step for the canopy — lower is heavier, floatier. */
const LERP = 0.055;
/** How far each ambient shape trails the cursor, per shape (px of drift per
 *  px of cursor displacement from the viewport centre). Deliberately four
 *  different values so the layers separate in depth as the mouse moves. */
const SHAPE_DAMP = [0.05, 0.075, 0.03, 0.095];
/** How long the pointer must be still before the field drifts on its own. */
const IDLE_AFTER = 2.4;

export default function MeshBackground() {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const shapes = Array.from(
      layer.querySelectorAll<HTMLElement>(".mesh-shape"),
    );
    const offsets = shapes.map(() => ({ x: 0, y: 0 }));

    const size = { w: window.innerWidth, h: window.innerHeight };
    const target = { x: size.w * REST.x, y: size.h * REST.y };
    const pos = { ...target };

    const writeVars = () => {
      layer.style.setProperty("--mouse-x", `${pos.x.toFixed(1)}px`);
      layer.style.setProperty("--mouse-y", `${pos.y.toFixed(1)}px`);
    };
    const writeShapes = () => {
      for (let i = 0; i < shapes.length; i += 1) {
        const { x, y } = offsets[i];
        shapes[i].style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(
          2,
        )}px, 0)`;
      }
    };

    // Publish the resting position immediately so the canopy is never stuck
    // at the CSS fallback while waiting for a first mousemove.
    writeVars();

    const onResize = () => {
      size.w = window.innerWidth;
      size.h = window.innerHeight;
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Raw pointer capture — the immediate half of the tracking.
    let idle = 0;
    const onMove = (e: MouseEvent | PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      idle = 0;
    };
    // `pointermove` is the modern listener; plain `mousemove` keeps the same
    // cursor mapping on browsers that never shipped Pointer Events.
    const moveEvent: "pointermove" | "mousemove" =
      "onpointermove" in window ? "pointermove" : "mousemove";
    window.addEventListener(moveEvent, onMove, { passive: true });

    const reduced =
      settingsRuntime.reduceMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    // Touch devices and reduced-motion users keep the atmosphere parked: the
    // resting pool of light, no follow loop.
    if (reduced || !finePointer) {
      writeShapes();
      return () => {
        window.removeEventListener(moveEvent, onMove);
        window.removeEventListener("resize", onResize);
      };
    }

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Motionless Mode can be toggled live from the settings dashboard.
      if (settingsRuntime.reduceMotion) return;

      // Honour the 30fps render budget without changing the follow feel.
      if (settingsRuntime.frameTarget === 30) {
        acc += dt;
        if (acc < 1 / 30) return;
        acc = 0;
      }

      // No pointer for a while → drift along a slow closed path so the
      // atmosphere keeps moving on its own.
      idle += dt;
      if (idle > IDLE_AFTER) {
        const t = now / 1000;
        target.x = size.w * (0.5 + 0.2 * Math.sin(t * 0.13));
        target.y = size.h * (0.5 + 0.14 * Math.cos(t * 0.11));
      }

      // Inertia: exponential lerp, normalised so a 144Hz display and a 30fps
      // device trail identically.
      const k = Math.min(dt * 60, 3);
      const ease = Math.min(1, LERP * k);
      pos.x += (target.x - pos.x) * ease;
      pos.y += (target.y - pos.y) * ease;
      writeVars();

      // Layered parallax: each shape trails the same eased position by its own
      // factor, so the field separates in depth rather than sliding as one
      // sheet.
      const dx = pos.x - size.w / 2;
      const dy = pos.y - size.h / 2;
      for (let i = 0; i < offsets.length; i += 1) {
        const damp = SHAPE_DAMP[i % SHAPE_DAMP.length];
        offsets[i].x += (dx * damp - offsets[i].x) * ease;
        offsets[i].y += (dy * damp - offsets[i].y) * ease;
      }
      writeShapes();
    };

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener(moveEvent, onMove);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={layerRef} className="mesh-backdrop" aria-hidden="true">
      {/* the pointer-tracked canopy — the signature crimson fill */}
      <span className="mesh-cursor-glow" />

      {/* four fluid crimson shapes, translated by the damped cursor position */}
      <span className="mesh-shape mesh-shape--a">
        <span className="mesh-glow mesh-glow--a" />
      </span>
      <span className="mesh-shape mesh-shape--b">
        <span className="mesh-glow mesh-glow--b" />
      </span>
      <span className="mesh-shape mesh-shape--c">
        <span className="mesh-glow mesh-glow--c" />
      </span>
      <span className="mesh-shape mesh-shape--d">
        <span className="mesh-glow mesh-glow--d" />
      </span>
    </div>
  );
}
