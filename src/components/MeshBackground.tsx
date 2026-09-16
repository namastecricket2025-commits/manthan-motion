import { useEffect, useRef } from "react";
import { settingsRuntime } from "@/lib/app-settings";

/**
 * Manthan backdrop engine — a native HTML5 canvas tracking the cursor.
 *
 * Structure: one full-viewport container (`100vw × 100vh`, `position: fixed`,
 * `top/left: 0`, `z-index: 1`, `pointer-events: none`, `filter: blur(140px)`)
 * holding a single `<canvas>`. Nothing about the motion is CSS: every frame is
 * painted by the 2D rendering context inside a requestAnimationFrame loop, and
 * the container's heavy blur smears those shapes into ambient light.
 *
 * THE PAINT (exactly the historical fill): each shape is an organic path —
 * a circular silhouette modulated by two slow sine harmonics, so it morphs
 * instead of being a perfect circle — filled with a radial gradient of
 *
 *     rgba(180, 20, 20, 0.16)   0%
 *     rgba(130, 10, 10, 0.04)   50%
 *     transparent              100%
 *
 * scaled per shape by its own alpha so overlapping glows blend into a halo
 * rather than stacking into one solid slab.
 *
 * THE MOTION: a window-level `mousemove` / `pointermove` listener records the
 * raw cursor metrics (clientX / clientY) immediately. The rAF loop then eases
 * the live position toward them with a linear-interpolation dampening step —
 *
 *     pos += (target − pos) · lerp · k        // k normalises the step to 60fps
 *
 * — and each shape chases that already-damped position with its *own* lerp
 * factor, which is what produces the luxurious, liquid delay and the layered
 * depth between the shapes. Radii are lerped too, so the field glides and
 * expands rather than snapping. After the pointer rests, the target drifts
 * along a slow closed path so the atmosphere keeps breathing on its own.
 *
 * Motionless Mode freezes the loop, the 30fps framerate target throttles it,
 * `--bg-glow-opacity` (Ambient Intensity) scales the whole layer, and touch /
 * reduced-motion visitors get the same atmosphere parked on a static frame.
 */

/** Resting pointer spot, as a fraction of the viewport. */
const REST = { x: 0.34, y: 0.36 };
/** Canopy dampening per 60fps step — lower is heavier and floatier. */
const CANOPY_LERP = 0.055;
/** How long the pointer must be still before the field drifts on its own. */
const IDLE_AFTER = 2.4;
/** Radial samples per silhouette (smooth enough once blurred 140px). */
const LOBES = 56;
/** The canvas sits behind a 140px blur, so rendering it small is invisible to
 *  the eye and keeps the loop cheap on mid-range devices. */
const MAX_EDGE = 1024;
/** Day-theme paint multiplier: a pale canvas must never turn pink. */
const LIGHT_STRENGTH = 0.4;

/** The mandated gradient ramp. */
const CORE = [180, 20, 20] as const;
const MID = [130, 10, 10] as const;
const CORE_ALPHA = 0.16;
const MID_ALPHA = 0.04;

type ShapeConfig = {
  /** Per-shape dampening — the spread of these values is the depth layering. */
  lerp: number;
  /** Resting radius, as a fraction of the viewport's longest edge. */
  radius: number;
  /** Multiplier on the mandated gradient ramp. */
  alpha: number;
  /** Offset from the cursor, as a fraction of the viewport. */
  ox: number;
  oy: number;
  /** Breathing / morph phase so no two shapes move together. */
  phase: number;
};

/** Five massive layers: two broad ones, three tighter and nearer. */
const SHAPES: ShapeConfig[] = [
  { lerp: 0.1, radius: 0.3, alpha: 1, ox: 0, oy: 0, phase: 0 },
  { lerp: 0.045, radius: 0.42, alpha: 0.7, ox: -0.2, oy: -0.1, phase: 1.7 },
  { lerp: 0.07, radius: 0.26, alpha: 0.75, ox: 0.22, oy: 0.14, phase: 3.1 },
  { lerp: 0.028, radius: 0.52, alpha: 0.5, ox: 0.08, oy: -0.22, phase: 4.4 },
  { lerp: 0.085, radius: 0.2, alpha: 0.8, ox: -0.15, oy: 0.18, phase: 5.6 },
];

export default function MeshBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = { w: window.innerWidth, h: window.innerHeight };
    const buffer = { w: 0, h: 0, s: 1 };

    /** Live state per shape — positions and radii are lerped, never set raw. */
    const live = SHAPES.map((cfg) => ({
      cfg,
      x: size.w * (REST.x + cfg.ox),
      y: size.h * (REST.y + cfg.oy),
      r: cfg.radius * Math.max(size.w, size.h),
    }));

    const target = { x: size.w * REST.x, y: size.h * REST.y };
    const pos = { ...target };

    const resize = () => {
      size.w = window.innerWidth;
      size.h = window.innerHeight;
      const longest = Math.max(size.w, size.h);
      const s = Math.min(1, MAX_EDGE / longest);
      buffer.s = s;
      buffer.w = Math.max(1, Math.round(size.w * s));
      buffer.h = Math.max(1, Math.round(size.h * s));
      canvas.width = buffer.w;
      canvas.height = buffer.h;
    };
    resize();

    const paint = (t: number) => {
      const s = buffer.s;
      // Theme strength is a class read (no style recalc), so it can be checked
      // cheaply every frame and still react instantly to the theme toggle.
      const strength = document.documentElement.classList.contains("dark")
        ? 1
        : LIGHT_STRENGTH;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, buffer.w, buffer.h);

      for (const item of live) {
        const { cfg } = item;
        const cx = item.x * s;
        const cy = item.y * s;
        const r = item.r * s;
        if (r <= 0.5) continue;

        // Organic silhouette: two slow harmonics on the radius give the shape
        // its liquid, morphing contour.
        ctx.beginPath();
        for (let i = 0; i <= LOBES; i += 1) {
          const a = (i / LOBES) * Math.PI * 2;
          const wobble =
            1 +
            0.13 * Math.sin(3 * a + t * 0.21 + cfg.phase) +
            0.08 * Math.sin(5 * a - t * 0.16 + cfg.phase * 1.7);
          const rr = r * wobble;
          const px = cx + Math.cos(a) * rr;
          const py = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // The mandated ramp, scaled by this shape's weight and the theme.
        const core = CORE_ALPHA * cfg.alpha * strength;
        const mid = MID_ALPHA * cfg.alpha * strength;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(${CORE[0]}, ${CORE[1]}, ${CORE[2]}, ${core.toFixed(4)})`);
        grad.addColorStop(0.5, `rgba(${MID[0]}, ${MID[1]}, ${MID[2]}, ${mid.toFixed(4)})`);
        grad.addColorStop(1, `rgba(${MID[0]}, ${MID[1]}, ${MID[2]}, 0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    // Raw pointer capture — the immediate half of the tracking.
    let idle = 0;
    const onMove = (e: MouseEvent | PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      idle = 0;
    };
    // `pointermove` is the modern listener; plain `mousemove` keeps the same
    // cursor tracking on browsers that never shipped Pointer Events.
    const moveEvent: "pointermove" | "mousemove" =
      "onpointermove" in window ? "pointermove" : "mousemove";
    window.addEventListener(moveEvent, onMove, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    const reduced =
      settingsRuntime.reduceMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    // Touch devices and reduced-motion visitors keep the atmosphere parked:
    // one static frame of the resting arrangement, no loop.
    if (reduced || !finePointer) {
      paint(0);
      return () => {
        window.removeEventListener(moveEvent, onMove);
        window.removeEventListener("resize", resize);
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

      const k = Math.min(dt * 60, 3);
      const t = now / 1000;

      // No pointer for a while → drift along a slow closed path so the field
      // keeps moving on its own.
      idle += dt;
      if (idle > IDLE_AFTER) {
        target.x = size.w * (0.5 + 0.2 * Math.sin(t * 0.11));
        target.y = size.h * (0.5 + 0.14 * Math.cos(t * 0.09));
      }

      // The canopy: a linear-interpolation dampening step, normalised to 60fps
      // so a 144Hz display and a 30fps device trail identically.
      const canopy = Math.min(1, CANOPY_LERP * k);
      pos.x += (target.x - pos.x) * canopy;
      pos.y += (target.y - pos.y) * canopy;

      const longest = Math.max(size.w, size.h);
      for (const item of live) {
        const { cfg } = item;
        // Each shape chases the already-damped canopy at its own rate, and
        // keeps its own offset — that is the layered, liquid lag.
        const shapeEase = Math.min(1, cfg.lerp * k);
        item.x += (pos.x + cfg.ox * size.w - item.x) * shapeEase;
        item.y += (pos.y + cfg.oy * size.h - item.y) * shapeEase;

        // Radii breathe too, so the shapes expand and contract as they travel.
        const want = cfg.radius * longest * (1 + 0.1 * Math.sin(t * 0.15 + cfg.phase));
        item.r += (want - item.r) * Math.min(1, 0.05 * k);
      }

      paint(t);
    };

    paint(0);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener(moveEvent, onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="mesh-canvas-wrap" aria-hidden="true">
      <canvas ref={canvasRef} className="mesh-canvas" />
    </div>
  );
}
