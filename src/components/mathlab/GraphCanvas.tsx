import type { PlotModel } from "./mathlab";
import { useCallback, useEffect, useRef } from "react";

/**
 * The Math Lab graphing canvas.
 *
 * A 2D Cartesian grid with equal-scaled axes, drawn on a device-pixel-ratio
 * aware canvas. Parameter sliders do not snap the curve over — every change
 * re-plots through a momentum curve (cubic-bezier(0.25, 1, 0.5, 1)), so the
 * graph glides into its new shape and settles.
 *
 * The pointer is a measuring tool: hovering the plot shows the exact
 * coordinates the curve passes through at that x.
 */

const X_MIN = -10;
const X_MAX = 10;
const PAD = { left: 30, right: 14, top: 14, bottom: 22 };
const DURATION = 620;

type Values = Record<string, number>;

/** Momentum easing — the standard cubic-bezier(0.25, 1, 0.5, 1) solver. */
function momentum() {
  const x1 = 0.25;
  const y1 = 1;
  const x2 = 0.5;
  const y2 = 1;
  const a = (p: number, q: number) => 1 - 3 * q + 3 * p;
  const b = (p: number, q: number) => 3 * q - 6 * p;
  const c = (p: number) => 3 * p;
  const calc = (t: number, p: number, q: number) =>
    ((a(p, q) * t + b(p, q)) * t + c(p)) * t;
  const slope = (t: number, p: number, q: number) =>
    3 * a(p, q) * t * t + 2 * b(p, q) * t + c(p);

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (Math.abs(s) < 1e-6) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    let low = 0;
    let high = 1;
    t = Math.min(1, Math.max(0, t));
    for (let i = 0; i < 5; i++) {
      if (Math.abs(calc(t, x1, x2) - x) < 1e-5) break;
      if (calc(t, x1, x2) > x) high = t;
      else low = t;
      t = (low + high) / 2;
    }
    return calc(t, y1, y2);
  };
}

const ease = momentum();

function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    grid: read("--card-border", "rgba(224,50,58,0.2)"),
    axis: read("--text-dim", "#b9aca7"),
    curve: read("--signal", "#e0323a"),
    label: read("--text-dim", "#b9aca7"),
  };
}

export function GraphCanvas({
  model,
  params,
}: {
  model: PlotModel;
  params: Values;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<PlotModel>(model);
  const displayRef = useRef<Values>({ ...params });
  const targetRef = useRef<Values>({ ...params });
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef(0);
  const animRef = useRef<{ from: Values; to: Values; start: number } | null>(null);

  modelRef.current = model;

  /** One full repaint, reading only refs so it never goes stale. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 260;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const palette = readPalette();
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    const unit = plotW / (X_MAX - X_MIN);
    const originX = PAD.left + (0 - X_MIN) * unit;
    const originY = PAD.top + plotH / 2;
    const yMax = plotH / 2 / unit;
    const yMin = -yMax;

    const toPx = (x: number) => originX + x * unit;
    const toPy = (y: number) => originY - y * unit;

    // Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.grid;
    ctx.beginPath();
    for (let x = X_MIN; x <= X_MAX; x += 1) {
      const px = Math.round(toPx(x)) + 0.5;
      ctx.moveTo(px, PAD.top);
      ctx.lineTo(px, height - PAD.bottom);
    }
    for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y += 1) {
      const py = Math.round(toPy(y)) + 0.5;
      ctx.moveTo(PAD.left, py);
      ctx.lineTo(width - PAD.right, py);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = palette.axis;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const axisY = Math.min(height - PAD.bottom, Math.max(PAD.top, toPy(0)));
    const axisX = Math.min(width - PAD.right, Math.max(PAD.left, toPx(0)));
    ctx.moveTo(PAD.left, axisY);
    ctx.lineTo(width - PAD.right, axisY);
    ctx.moveTo(axisX, PAD.top);
    ctx.lineTo(axisX, height - PAD.bottom);
    ctx.stroke();

    // Tick labels
    ctx.fillStyle = palette.label;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = X_MIN + 2; x < X_MAX; x += 2) {
      if (x === 0) continue;
      ctx.fillText(String(x), toPx(x), Math.min(height - PAD.bottom + 4, axisY + 5));
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = Math.ceil(yMin / 2) * 2; y <= Math.floor(yMax / 2) * 2; y += 2) {
      if (y === 0) continue;
      ctx.fillText(String(y), PAD.left - 5, toPy(y));
    }

    // Curves
    const values = displayRef.current;
    const active = modelRef.current;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left, PAD.top, plotW, plotH);
    ctx.clip();

    for (const branch of active.branches) {
      ctx.beginPath();
      ctx.lineWidth = branch.dashed ? 1.4 : 2.4;
      // Canvas has no color-mix; a plain alpha drop reads the same.
      ctx.globalAlpha = branch.dashed ? 0.6 : 1;
      ctx.strokeStyle = palette.curve;
      ctx.setLineDash(branch.dashed ? [6, 5] : []);
      let started = false;
      const step = 2;
      for (let px = PAD.left; px <= width - PAD.right; px += step) {
        const x = (px - originX) / unit;
        const y = branch.evaluate(x, values);
        if (y === null || !Number.isFinite(y) || Math.abs(y) > yMax * 12) {
          started = false;
          continue;
        }
        const py = toPy(y);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Pointer readout
    const pointer = pointerRef.current;
    if (pointer && pointer.x > PAD.left && pointer.x < width - PAD.right) {
      ctx.strokeStyle = palette.axis;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(pointer.x, PAD.top);
      ctx.lineTo(pointer.x, height - PAD.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const x = (pointer.x - originX) / unit;
      let row = 14;
      ctx.font = "600 10px Inter, system-ui, sans-serif";
      for (const branch of active.branches) {
        const y = branch.evaluate(x, values);
        if (y === null || !Number.isFinite(y)) continue;
        const py = toPy(y);
        if (py < PAD.top || py > height - PAD.bottom) continue;
        ctx.fillStyle = palette.curve;
        ctx.beginPath();
        ctx.arc(pointer.x, py, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = palette.label;
        ctx.fillText(
          `(${x.toFixed(1)}, ${y.toFixed(2)})`,
          Math.min(pointer.x + 7, width - PAD.right - 74),
          row,
        );
        row += 13;
      }
    }
  }, []);

  /** Animate the displayed parameters to the new target through `ease`. */
  useEffect(() => {
    const from = { ...displayRef.current };
    const to = { ...params };
    targetRef.current = to;
    animRef.current = { from, to, start: performance.now() };
    cancelAnimationFrame(frameRef.current);

    const step = (now: number) => {
      const anim = animRef.current;
      if (!anim) return;
      const progress = Math.min(1, (now - anim.start) / DURATION);
      const eased = ease(progress);
      const next: Values = {};
      for (const key of Object.keys(anim.to)) {
        const startValue = anim.from[key];
        next[key] =
          typeof startValue === "number"
            ? startValue + (anim.to[key] - startValue) * eased
            : anim.to[key];
      }
      displayRef.current = next;
      paint();
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [params, paint]);

  useEffect(() => {
    displayRef.current = { ...params };
    paint();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);

    const themeObserver = new MutationObserver(() => paint());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
    // Repaint on mount and whenever the model changes shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id, paint]);

  return (
    <canvas
      ref={canvasRef}
      className="mathlab-canvas"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        if (!animRef.current) paint();
      }}
      onPointerLeave={() => {
        pointerRef.current = null;
        if (!animRef.current) paint();
      }}
      aria-label={`Graph of ${model.formula}`}
      role="img"
    />
  );
}

export default GraphCanvas;
