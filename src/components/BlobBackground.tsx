/**
 * Manthan blob field — the site's signature crimson backdrop.
 *
 * This is the original background engine, restored verbatim from the previous
 * build. It is a single fixed full-viewport `<canvas>` (`.blob-canvas`) that
 * renders a metaball field at a deliberately coarse grid (10px cells on
 * desktop, 7px on phones) and then upscales it with image smoothing disabled.
 * That coarse grid + nearest-neighbour upscale is what gives the field its
 * soft, banded, painted-by-hand look.
 *
 * Every frame:
 *   1. N blobs (6 desktop / 4 touch) drift with a slowly jittering heading and
 *      bounce off the field edges, plus a cheap pairwise separation pass so
 *      they never merge into one mass.
 *   2. The metaball sum is evaluated per grid cell — K = Σ r² / (d² + 1) —
 *      and mapped through two thresholds into a colour that ramps from the
 *      canvas ink (`--bg-canvas-c`) through the deep crimson
 *      (`--bg-canvas-b`) into the bright signal red (`--bg-canvas-a`).
 *   3. The palette is read from the live CSS custom properties, and re-read
 *      whenever the theme class on <html> changes, so light/dark swap the
 *      field instead of leaving a stale frame.
 *
 * On fine pointers the whole field also eases toward the cursor (each blob is
 * offset by the eased position), so it drifts with the mouse rather than
 * snapping to it.
 *
 * Motion is a single rAF loop that pauses itself when the canvas scrolls out
 * of view or the tab is hidden, and `prefers-reduced-motion` renders one
 * static frame instead. Ambient Intensity fades the whole layer through
 * `--bg-canvas-opacity` × `--bg-glow-opacity` in the stylesheet.
 */
import { useEffect, useRef } from "react";
import { settingsRuntime } from "@/lib/app-settings";

const TAU = Math.PI * 2;

type Triple = [number, number, number];

interface Blob {
  x: number;
  y: number;
  r: number;
  speed: number;
  heading: number;
}

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpTriple = (a: Triple, b: Triple, t: number): Triple => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** `#rgb` / `#rrggbb` → [r, g, b] */
function hexToRgb(hex: string): Triple {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const int = parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** The three gradient stops, read from the active theme's CSS variables. */
function readColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => hexToRgb(styles.getPropertyValue(name).trim());
  return {
    a: read("--bg-canvas-a"),
    b: read("--bg-canvas-b"),
    c: read("--bg-canvas-c"),
  };
}

export default function BlobBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const context2d = element.getContext("2d");
    if (!context2d) return;
    /* Widened aliases: the engine's inner functions run long after the guards
       above, so they need non-nullable references. */
    const canvas: HTMLCanvasElement = element;
    const ctx: CanvasRenderingContext2D = context2d;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // The metaball field is painted into this offscreen canvas at grid
    // resolution, then blown up onto the visible one.
    const scratch = document.createElement("canvas");
    const scratchCtx = scratch.getContext("2d");
    if (!scratchCtx) return;
    const field: HTMLCanvasElement = scratch;
    const fieldCtx: CanvasRenderingContext2D = scratchCtx;

    let image: ImageData | null = null;
    let blobs: Blob[] = [];
    let cols = 0;
    let rows = 0;
    let cell = 10;
    let colors = readColors();

    let running = true;
    let visible = document.visibilityState === "visible";
    let frame = 0;
    let last = performance.now();

    // Pointer influence: the raw cursor target, and the eased position the
    // field actually follows.
    let pointerX = 0;
    let pointerY = 0;
    let easedX = 0;
    let easedY = 0;

    const isSmall = () =>
      window.innerWidth <= 768 || window.matchMedia("(pointer: coarse)").matches;
    const blobCount = () => (isSmall() ? 4 : 6);

    function spawn() {
      const count = blobCount();
      blobs = Array.from({ length: count }, () => ({
        x: Math.random() * cols,
        y: Math.random() * rows,
        r: Math.min(cols, rows) * (0.22 + Math.random() * 0.16),
        speed: (0.8 + Math.random() * 0.9) * (cols / 100),
        heading: Math.random() * TAU,
      }));
    }

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      cell = isSmall() ? 7 : 10;
      cols = Math.max(24, Math.ceil(width / cell));
      rows = Math.max(24, Math.ceil(height / cell));

      field.width = cols;
      field.height = rows;
      canvas.width = Math.ceil(cols * cell * dpr);
      canvas.height = Math.ceil(rows * cell * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      image = fieldCtx.createImageData(cols, rows);
      colors = readColors();
      spawn();
      paint();
    }

    /** Drift a blob, bouncing it off the (slightly padded) field edges. */
    function advance(blob: Blob, dt: number) {
      blob.heading += (Math.random() - 0.5) * 0.004 * (dt * 60);
      if (Math.random() < 0.005 * dt * 60) {
        blob.heading += (Math.random() - 0.5) * (Math.PI / 5);
      }

      let dx = Math.cos(blob.heading) * blob.speed * dt;
      let dy = Math.sin(blob.heading) * blob.speed * dt;
      const pad = blob.r * 0.4;

      if (blob.x + dx < -pad || blob.x + dx > cols + pad) {
        blob.heading = Math.PI - blob.heading;
        dx = -dx;
      }
      if (blob.y + dy < -pad || blob.y + dy > rows + pad) {
        blob.heading = -blob.heading;
        dy = -dy;
      }
      blob.x = clamp(blob.x + dx, -pad, cols + pad);
      blob.y = clamp(blob.y + dy, -pad, rows + pad);
    }

    /** Cheap pairwise separation so neighbouring blobs stay distinguishable. */
    function separate() {
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i];
          const b = blobs[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.r + b.r) * 0.75;
          const distSq = dx * dx + dy * dy;
          if (distSq > 1e-4 && distSq < min * min) {
            const dist = Math.sqrt(distSq);
            const push = ((min - dist) / dist) * 0.04;
            a.x -= dx * push;
            a.y -= dy * push;
            b.x += dx * push;
            b.y += dy * push;
          }
        }
      }
    }

    /** Evaluate the metaball field and upload it as one ImageData frame. */
    function paint() {
      if (!image || !fieldCtx) return;

      // Cursor-tracking is its own preference: when it is off the field keeps
      // drifting exactly as before but never leans toward the pointer.
      const follow = finePointer && settingsRuntime.cursorField;
      if (follow) {
        easedX += (pointerX - easedX) * 0.035;
        easedY += (pointerY - easedY) * 0.035;
      } else {
        // Ease the offset home so toggling the setting mid-drift settles the
        // field back instead of freezing it displaced.
        easedX += (0 - easedX) * 0.035;
        easedY += (0 - easedY) * 0.035;
      }
      const offsetX = easedX * cols * 0.07;
      const offsetY = easedY * rows * 0.07;

      const { a, b, c } = colors;
      const data = image.data;
      const w = cols;
      const h = rows;
      let p = 0;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0;
          for (let i = 0; i < blobs.length; i++) {
            const blob = blobs[i];
            const dx = x - (blob.x + offsetX);
            const dy = y - (blob.y + offsetY);
            sum += (blob.r * blob.r) / (dx * dx + dy * dy + 1);
          }
          const core = clamp((sum - 0.85) / 0.55, 0, 1);
          const glow = clamp(core * 1.45, 0, 1);
          const rgb = lerpTriple(c, lerpTriple(b, a, glow), core);
          data[p++] = rgb[0];
          data[p++] = rgb[1];
          data[p++] = rgb[2];
          data[p++] = 255;
        }
      }

      fieldCtx.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(field, 0, 0, canvas.width, canvas.height);
    }

    function step(dt: number) {
      if (!running) return;
      if (dt > 0 && !reduceMotion) {
        for (const blob of blobs) advance(blob, dt);
        separate();
      }
      paint();
    }

    function loop(now: number) {
      frame = 0;
      if (!running || !visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);
      if (!reduceMotion) frame = requestAnimationFrame(loop);
    }

    function start() {
      running = true;
      last = performance.now();
      if (!reduceMotion && !frame) frame = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    function onVisibility() {
      visible = document.visibilityState === "visible";
      if (visible) start();
      else stop();
    }

    function onPointerMove(event: PointerEvent) {
      if (!finePointer) return;
      pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      pointerY = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function onResize() {
      resize();
      if (!reduceMotion) {
        last = performance.now();
        start();
      }
    }

    // Theme switches (class / data-theme on <html>) swap the palette, so
    // re-read the stops and, when the loop is parked, repaint one frame.
    const themeObserver = new MutationObserver(() => {
      colors = readColors();
      if (reduceMotion || !running) paint();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    let intersection: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      intersection = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting ?? true) start();
          else stop();
        },
        { threshold: 0 },
      );
      intersection.observe(canvas);
    }

    resize();
    start();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    if (finePointer) window.addEventListener("pointermove", onPointerMove);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      intersection?.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="blob-canvas" aria-hidden="true" />;
}
