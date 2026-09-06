import { useEffect, useRef } from "react";

/**
 * Manthan background — "pixelated drifting blobs".
 *
 * A metaball field rendered to a low-resolution offscreen canvas, then
 * upscaled onto the visible canvas with `image-rendering: pixelated` for
 * the chunky retro-pixel look. Each blob random-walks its heading (±15–20°
 * every few seconds), soft-bounces at the viewport edges, gently repels
 * neighbours (so they never cluster), and drifts toward the cursor only on
 * pointer-capable devices. The loop pauses when the tab is hidden or the
 * canvas scrolls out of view, mobile gets fewer blobs + coarser pixels, and
 * `prefers-reduced-motion` freezes a single static frame.
 */

interface Drifter {
  x: number;
  y: number;
  r: number;
  speed: number;
  heading: number;
}

type RGB = [number, number, number];

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function hexToRgb(hex: string): RGB {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readCanvasColors(): { a: RGB; b: RGB; c: RGB } {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string) => hexToRgb(cs.getPropertyValue(name).trim());
  return { a: read("--bg-canvas-a"), b: read("--bg-canvas-b"), c: read("--bg-canvas-c") };
}

export default function BlobBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointerFine = window.matchMedia("(pointer: fine)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const low = document.createElement("canvas");
    const lowCtx = low.getContext("2d");
    if (!lowCtx) return;

    let image: ImageData | null = null;
    let drifters: Drifter[] = [];
    let width = 0;
    let height = 0;
    let pixel = 10;
    let colors: { a: RGB; b: RGB; c: RGB } = readCanvasColors();
    let running = true;
    let visible = document.visibilityState === "visible";
    let raf = 0;
    let last = performance.now();

    // Cursor parallax (pointer devices only)
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const blobCount = () => (isMobile() ? 4 : 6);

    const isMobile = () =>
      window.innerWidth <= 768 ||
      window.matchMedia("(pointer: coarse)").matches;

    function buildDrifters() {
      const count = blobCount();
      drifters = Array.from({ length: count }, () => {
        const r = Math.min(width, height) * (0.22 + Math.random() * 0.16);
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r,
          speed: (0.8 + Math.random() * 0.9) * (width / 100),
          heading: Math.random() * TAU,
        };
      });
    }

    function resize() {
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      pixel = isMobile() ? 7 : 10;
      width = Math.max(24, Math.ceil(cssW / pixel));
      height = Math.max(24, Math.ceil(cssH / pixel));
      low.width = width;
      low.height = height;
      canvas!.width = Math.ceil(width * pixel * dpr);
      canvas!.height = Math.ceil(height * pixel * dpr);
      canvas!.style.width = `${cssW}px`;
      canvas!.style.height = `${cssH}px`;
      image = lowCtx!.createImageData(width, height);
      colors = readCanvasColors();
      buildDrifters();
      // Freeze the first frame immediately (also covers reduced-motion)
      draw();
    }

    function randomWalk(d: Drifter, dt: number) {
      // Tiny continuous wobble + occasional gentle re-aim (±15–20°)
      d.heading += (Math.random() - 0.5) * 0.004 * (dt * 60);
      if (Math.random() < 0.005 * dt * 60) {
        d.heading += (Math.random() - 0.5) * (Math.PI / 5);
      }
      let vx = Math.cos(d.heading) * d.speed * dt;
      let vy = Math.sin(d.heading) * d.speed * dt;
      const margin = d.r * 0.4;
      if (d.x + vx < -margin || d.x + vx > width + margin) {
        d.heading = Math.PI - d.heading;
        vx = -vx;
      }
      if (d.y + vy < -margin || d.y + vy > height + margin) {
        d.heading = -d.heading;
        vy = -vy;
      }
      d.x = clamp(d.x + vx, -margin, width + margin);
      d.y = clamp(d.y + vy, -margin, height + margin);
    }

    function separate() {
      // Gentle neighbour repulsion so blobs never fully cluster
      for (let i = 0; i < drifters.length; i++) {
        for (let j = i + 1; j < drifters.length; j++) {
          const a = drifters[i];
          const b = drifters[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.r + b.r) * 0.75;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.0001 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = ((min - d) / d) * 0.04;
            a.x -= dx * push;
            a.y -= dy * push;
            b.x += dx * push;
            b.y += dy * push;
          }
        }
      }
    }

    /** Rasterise the current blob state (no motion, no guards). */
    function draw() {
      if (!image) return;
      // Lerp cursor parallax (only meaningful on pointer devices)
      if (pointerFine) {
        curX += (targetX - curX) * 0.035;
        curY += (targetY - curY) * 0.035;
      }
      const parX = curX * width * 0.07;
      const parY = curY * height * 0.07;

      const { a, b, c } = colors;
      const data = image.data;
      const w = width;
      const h = height;
      let p = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let f = 0;
          for (let i = 0; i < drifters.length; i++) {
            const d = drifters[i];
            const dx = x - (d.x + parX);
            const dy = y - (d.y + parY);
            const d2 = dx * dx + dy * dy;
            f += (d.r * d.r) / (d2 + 1);
          }
          // Soft ramp around the metaball threshold (f ≈ 1)
          const u = clamp((f - 0.85) / 0.55, 0, 1);
          const v = clamp(u * 1.45, 0, 1);
          const col = lerpRgb(c, lerpRgb(b, a, v), u);
          data[p++] = col[0];
          data[p++] = col[1];
          data[p++] = col[2];
          data[p++] = 255;
        }
      }
      lowCtx!.putImageData(image, 0, 0);
      ctx!.imageSmoothingEnabled = false;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.drawImage(low, 0, 0, canvas!.width, canvas!.height);
    }

    function step(dt: number) {
      if (!running) return;
      if (dt > 0 && !reduced) {
        for (const d of drifters) randomWalk(d, dt);
        separate();
      }
      draw();
    }

    function loop(now: number) {
      raf = 0;
      if (!running || !visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);
      if (!reduced) raf = requestAnimationFrame(loop);
    }

    function start() {
      running = true;
      last = performance.now();
      if (!reduced && !raf) raf = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function onVisibility() {
      visible = document.visibilityState === "visible";
      if (visible) start();
      else stop();
    }

    // Pause when the (fixed) canvas scrolls out of view
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          const hit = entries[0]?.isIntersecting ?? true;
          if (hit) start();
          else stop();
        },
        { threshold: 0 },
      );
      io.observe(canvas);
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointerFine) return;
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    }

    function onResize() {
      resize();
      if (!reduced) {
        last = performance.now();
        start();
      }
    }

    // Re-read palette on theme change (data-theme / .dark)
    const themeObserver = new MutationObserver(() => {
      colors = readCanvasColors();
      if (reduced || !running) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    resize();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    if (pointerFine) {
      window.addEventListener("pointermove", onPointerMove);
    }

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      io?.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="blob-canvas" aria-hidden="true" />;
}