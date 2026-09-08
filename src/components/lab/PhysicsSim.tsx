import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Atom,
  Lightbulb,
  MoveRight,
  Pause,
  Play,
  Power,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const G = 9.8;
const TAU = Math.PI * 2;
const OBJ_W = 56;

interface SimState {
  t: number;
  x: number;
  v: number;
  trackW: number;
  points: { t: number; x: number }[];
  maxX: number;
  last: number;
}

/* ------------------------------------------------------------------ */
/* 1. Motion lab — draggable block, sliders, live position graph       */
/* ------------------------------------------------------------------ */

function MotionLab() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const objRef = useRef<HTMLDivElement | null>(null);
  const graphWrapRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<HTMLCanvasElement | null>(null);
  const tRef = useRef<HTMLSpanElement | null>(null);
  const xRef = useRef<HTMLSpanElement | null>(null);
  const vRef = useRef<HTMLSpanElement | null>(null);
  const keRef = useRef<HTMLSpanElement | null>(null);

  const [params, setParams] = useState({ v0: 8, mass: 12, mu: 0.25 });
  const [running, setRunning] = useState(false);
  const paramsRef = useRef(params);
  const sim = useRef<SimState>({
    t: 0, x: 0, v: 0, trackW: 0, points: [], maxX: 1, last: 0,
  });
  const dragging = useRef(false);
  const raf = useRef(0);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const resetSim = (p = paramsRef.current) => {
    const W = trackRef.current?.clientWidth ?? 600;
    const s = sim.current;
    s.t = 0;
    s.x = 0;
    s.v = p.v0;
    s.trackW = W - OBJ_W;
    s.points = [];
    s.maxX = 1;
    s.last = performance.now();
    if (objRef.current) objRef.current.style.transform = "translateX(0px)";
    updateReadouts(0, 0, p.v0);
    drawGraph();
  };

  const updateReadouts = (t: number, x: number, v: number) => {
    const p = paramsRef.current;
    const ke = 0.5 * p.mass * v * v;
    if (tRef.current) tRef.current.textContent = t.toFixed(1);
    if (xRef.current) xRef.current.textContent = x.toFixed(1);
    if (vRef.current) vRef.current.textContent = v.toFixed(2);
    if (keRef.current) keRef.current.textContent = ke.toFixed(1);
  };

  const drawGraph = () => {
    const canvas = graphRef.current;
    const wrap = graphWrapRef.current;
    const s = sim.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 38, r: 10, t: 14, b: 24 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const tMax = Math.max(1.5, s.t * 1.1);
    const xMax = Math.max(1, s.maxX * 1.1);

    // grid
    ctx.strokeStyle = "color-mix(in srgb, var(--text-dim) 22%, transparent)";
    ctx.lineWidth = 1;
    ctx.font = "10px Inter, sans-serif";
    ctx.fillStyle = "color-mix(in srgb, var(--text-dim) 85%, transparent)";
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ph / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillText(((xMax * (4 - i)) / 4).toFixed(0), 6, y + 3);
    }
    for (let i = 0; i <= 5; i++) {
      const x = pad.l + (pw / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, h - pad.b);
      ctx.stroke();
      ctx.fillText(((tMax * i) / 5).toFixed(1), x - 6, h - 8);
    }
    ctx.fillStyle = "color-mix(in srgb, var(--text-dim) 60%, transparent)";
    ctx.fillText("t (s) →", w - 44, h - 8);
    ctx.fillText("x (m)", 4, 10);

    // position curve
    ctx.strokeStyle = "var(--signal)";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const px = pad.l + (p.t / tMax) * pw;
      const py = pad.t + ph - (p.x / xMax) * ph;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const last = s.points[s.points.length - 1];
    if (last) {
      const px = pad.l + (last.t / tMax) * pw;
      const py = pad.t + ph - (last.x / xMax) * ph;
      ctx.fillStyle = "var(--signal)";
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "color-mix(in srgb, var(--signal) 45%, transparent)";
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, TAU);
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const s = sim.current;
      const p = paramsRef.current;
      const dt = Math.min((performance.now() - s.last) / 1000, 0.05);
      s.last = performance.now();
      if (s.v > 0) {
        const a = p.mu * G;
        s.v = Math.max(0, s.v - a * dt);
        s.x += s.v * dt;
        s.t += dt;
        if (s.x >= s.trackW) {
          s.x = s.trackW;
          s.v = 0;
        }
        s.points.push({ t: s.t, x: s.x });
        if (s.points.length > 900) s.points.shift();
        s.maxX = Math.max(s.maxX, s.x);
        if (objRef.current) objRef.current.style.transform = `translateX(${s.x}px)`;
        updateReadouts(s.t, s.x, s.v);
        drawGraph();
      }
      if (s.v <= 0) {
        setRunning(false);
        drawGraph();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  useEffect(() => {
    resetSim();
    // Re-measure track on resize so the sim stays inside the visible bar.
    const onResize = () => resetSim();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slider changes stop the run and restart it with the new physics.
  const setParam = (key: keyof typeof params, value: number) => {
    setRunning(false);
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  // New parameters → fresh run from the start line.
  useEffect(() => {
    resetSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const onObjDown = (e: React.PointerEvent) => {
    setRunning(false);
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onObjMove = (e: React.PointerEvent) => {
    if (!dragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const W = rect.width - OBJ_W;
    const x = Math.max(0, Math.min(W, e.clientX - rect.left - OBJ_W / 2));
    const s = sim.current;
    s.t = 0;
    s.x = x;
    s.v = paramsRef.current.v0;
    s.trackW = W;
    s.points = [];
    s.maxX = 1;
    if (objRef.current) objRef.current.style.transform = `translateX(${x}px)`;
    updateReadouts(0, x, paramsRef.current.v0);
    drawGraph();
  };
  const onObjUp = () => {
    dragging.current = false;
  };

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Atom className="h-4 w-4 text-[var(--signal)]" />
            Motion lab
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Friction drags the block to rest — watch position vs time as it happens.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 rounded-full bg-[var(--signal)] text-[var(--primary-foreground)] hover:bg-[var(--signal)]/90"
            onClick={() => {
              if (!running && sim.current.v <= 0) resetSim();
              setRunning((r) => !r);
            }}
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Pause" : "Run"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full border-[var(--card-border)] bg-transparent"
            onClick={() => {
              setRunning(false);
              resetSim();
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        {/* Control deck */}
        <div className="flex flex-col gap-5">
          {(
            [
              { key: "v0", label: "Initial velocity", unit: "m/s", min: 1, max: 20, step: 0.5, value: params.v0 },
              { key: "mass", label: "Mass", unit: "kg", min: 1, max: 50, step: 1, value: params.mass },
              { key: "mu", label: "Friction (μ)", unit: "", min: 0, max: 0.9, step: 0.05, value: params.mu },
            ] as const
          ).map((row) => (
            <div key={row.key}>
              <div className="flex items-center justify-between text-xs font-medium text-text-dim">
                <span>{row.label}</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {row.value}
                  {row.unit ? ` ${row.unit}` : ""}
                </span>
              </div>
              <Slider
                className="mt-2.5"
                min={row.min}
                max={row.max}
                step={row.step}
                value={[row.value]}
                onValueChange={([v]) => setParam(row.key, v)}
              />
            </div>
          ))}

          {/* Live readouts */}
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                { label: "Time", ref: tRef, unit: "s" },
                { label: "Distance", ref: xRef, unit: "m" },
                { label: "Velocity", ref: vRef, unit: "m/s" },
                { label: "Kinetic E", ref: keRef, unit: "J" },
              ] as const
            ).map((r) => (
              <div
                key={r.label}
                className="rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_5%,transparent)] px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-dim">
                  {r.label}
                </p>
                <p className="mt-0.5 font-display text-base font-bold tabular-nums text-foreground">
                  <span ref={r.ref}>0.0</span>{" "}
                  <span className="text-xs font-medium text-text-dim">{r.unit}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
            <MoveRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
            Drag the block along the track to reposition it, then press Run.
          </p>
        </div>

        {/* Workspace */}
        <div className="flex flex-col gap-4">
          {/* Track */}
          <div
            ref={trackRef}
            className="relative h-20 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_4%,transparent)]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, color-mix(in srgb, var(--text-dim) 12%, transparent) 0 1px, transparent 1px 32px)",
            }}
          >
            {/* start flag */}
            <span className="absolute left-2 top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-[var(--signal)]" />
            <div
              ref={objRef}
              onPointerDown={onObjDown}
              onPointerMove={onObjMove}
              onPointerUp={onObjUp}
              onPointerCancel={onObjUp}
              className="absolute left-0 top-1/2 z-10 flex h-14 w-14 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)] shadow-lg backdrop-blur-md active:cursor-grabbing"
              style={{ transform: "translateX(0px)" }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--signal)_14%,transparent)] text-[var(--signal)]">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] font-medium text-text-dim">
              friction coefficient μ = {params.mu.toFixed(2)}
            </span>
          </div>

          {/* Graph */}
          <div ref={graphWrapRef} className="relative h-48 w-full overflow-hidden rounded-2xl border border-[var(--card-border)] sm:h-56">
            <canvas ref={graphRef} className="absolute inset-0 h-full w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Reflection lab — rotating beam against a mirror                  */
/* ------------------------------------------------------------------ */

const RB_CX = 300;
const RB_CY = 240;
const RB_R = 150;

function ReflectionLab() {
  const [angle, setAngle] = useState(70);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const rad = (angle * Math.PI) / 180;
  // Beam comes from above the horizontal mirror: y shrinks as the angle
  // approaches 90° (normal incidence), so the knob stays inside the viewBox.
  const srcX = RB_CX + RB_R * Math.cos(rad);
  const srcY = RB_CY - RB_R * Math.sin(rad);
  const refX = RB_CX - RB_R * Math.cos(rad);
  const refY = RB_CY - RB_R * Math.sin(rad);
  const incidence = Math.abs(90 - angle);

  const angleFromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return angle;
    const rect = svg.getBoundingClientRect();
    const scaleX = 600 / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleX;
    let a = (Math.atan2(py - RB_CY, px - RB_CX) * 180) / Math.PI;
    a = Math.round(((a % 180) + 180) % 180);
    return Math.max(0, Math.min(180, a));
  };

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Lightbulb className="h-4 w-4 text-[var(--signal)]" />
            Reflection lab
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Drag the beam knob — the angle of incidence always equals the angle of reflection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-text-dim">Angle</label>
          <input
            type="number"
            min={0}
            max={180}
            value={angle}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) setAngle(Math.max(0, Math.min(180, Math.round(v))));
            }}
            className="w-16 rounded-full border border-[var(--card-border)] bg-transparent px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-foreground outline-none focus:border-[var(--signal)]"
          />
          <span className="text-xs font-medium text-text-dim">°</span>
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-text-dim">
              <span>Beam direction</span>
              <span className="font-semibold tabular-nums text-foreground">{angle}°</span>
            </div>
            <Slider
              className="mt-2.5"
              min={0}
              max={180}
              step={1}
              value={[angle]}
              onValueChange={([v]) => setAngle(v)}
            />
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_5%,transparent)] px-3.5 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-dim">Incidence</span>
              <span className="font-display text-base font-bold tabular-nums text-foreground">
                {incidence}°
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-text-dim">Reflection</span>
              <span className="font-display text-base font-bold tabular-nums text-[var(--signal)]">
                {incidence}°
              </span>
            </div>
            <p className="mt-2.5 border-t border-[var(--card-border)] pt-2 text-[11px] leading-relaxed text-text-dim">
              θ<sub>i</sub> = θ<sub>r</sub> — the law of reflection, measured from the normal
              (dashed line).
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_3%,transparent)]">
          <svg
            ref={svgRef}
            viewBox="0 0 600 360"
            className="block h-auto w-full touch-none select-none"
            onPointerMove={(e) => {
              if (dragging.current) setAngle(angleFromPointer(e));
            }}
            onPointerUp={() => (dragging.current = false)}
            onPointerLeave={() => (dragging.current = false)}
          >
            <defs>
              <linearGradient id="mirrorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="color-mix(in srgb, var(--text-main) 75%, transparent)" />
                <stop offset="45%" stopColor="color-mix(in srgb, var(--text-main) 18%, transparent)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--text-main) 55%, transparent)" />
              </linearGradient>
            </defs>

            {/* mirror */}
            <rect x="70" y={RB_CY - 4} width="460" height="9" rx="4.5" fill="url(#mirrorGrad)" />
            <line
              x1={RB_CX - 40}
              y1={RB_CY - 22}
              x2={RB_CX + 40}
              y2={RB_CY - 22}
              stroke="color-mix(in srgb, var(--text-dim) 30%, transparent)"
              strokeWidth="1"
            />
            {Array.from({ length: 14 }, (_, i) => (
              <line
                key={i}
                x1={100 + i * 32}
                y1={RB_CY + 8}
                x2={112 + i * 32}
                y2={RB_CY + 16}
                stroke="color-mix(in srgb, var(--text-dim) 45%, transparent)"
                strokeWidth="1.5"
              />
            ))}
            <text x="318" y={RB_CY + 34} fontSize="10" fill="color-mix(in srgb, var(--text-dim) 75%, transparent)" textAnchor="middle">
              MIRROR
            </text>

            {/* normal (dashed) */}
            <line
              x1={RB_CX}
              y1={RB_CY - 130}
              x2={RB_CX}
              y2={RB_CY + 130}
              stroke="color-mix(in srgb, var(--text-dim) 55%, transparent)"
              strokeWidth="1.5"
              strokeDasharray="5 6"
            />
            <text x={RB_CX + 6} y={RB_CY - 118} fontSize="10" fill="color-mix(in srgb, var(--text-dim) 70%, transparent)">
              normal
            </text>

            {/* incident ray */}
            <line
              x1={srcX}
              y1={srcY}
              x2={RB_CX}
              y2={RB_CY}
              stroke="var(--signal)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1={srcX}
              y1={srcY}
              x2={RB_CX}
              y2={RB_CY}
              stroke="var(--signal)"
              strokeWidth="3"
              strokeLinecap="round"
              className="lab-beam"
              opacity="0.85"
            />
            {/* reflected ray */}
            <line
              x1={RB_CX}
              y1={RB_CY}
              x2={refX}
              y2={refY}
              stroke="#b97750"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1={RB_CX}
              y1={RB_CY}
              x2={refX}
              y2={refY}
              stroke="#b97750"
              strokeWidth="3"
              strokeLinecap="round"
              className="lab-beam lab-beam--slow"
              opacity="0.85"
            />

            {/* source + knob */}
            <circle cx={srcX} cy={srcY} r="13" fill="var(--signal)" opacity="0.18" />
            <circle
              cx={srcX}
              cy={srcY}
              r="9"
              fill="var(--signal)"
              stroke="var(--primary-foreground)"
              strokeWidth="2"
              className="cursor-grab"
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setAngle(angleFromPointer(e));
              }}
            />
            <text x={srcX} y={srcY - 20} fontSize="10" fill="var(--text-dim)" textAnchor="middle">
              source
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Circuit sandbox — series circuit with switch and two bulbs       */
/* ------------------------------------------------------------------ */

const CIRCUIT_PATH = "M 140 250 H 560 V 72 H 100 V 250";

function CircuitLab() {
  const [power, setPower] = useState(true);
  const [swClosed, setSwClosed] = useState(true);
  const [bulb1, setBulb1] = useState(true);
  const [bulb2, setBulb2] = useState(true);

  const energized = power && swClosed && bulb1 && bulb2;
  const wireColor = energized ? "var(--signal)" : "var(--card-border)";

  const status = !power
    ? "Power is off — no current flows."
    : !swClosed
      ? "Switch open — the circuit is broken."
      : !bulb1
        ? "Bulb 1 is burnt out — a series circuit needs every component."
        : !bulb2
          ? "Bulb 2 is burnt out — a series circuit needs every component."
          : "Circuit closed — current flows through both bulbs.";

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Zap className="h-4 w-4 text-[var(--signal)]" />
            Circuit sandbox
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            A 9 V series circuit — toggle the battery, switch and bulbs to trace the current.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPower((v) => !v)}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors " +
              (power
                ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_14%,transparent)] text-[var(--signal)]"
                : "border-[var(--card-border)] text-text-dim hover:text-foreground")
            }
          >
            <Power className="h-3.5 w-3.5" />
            Battery {power ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => setSwClosed((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-[var(--signal)]"
          >
            <Zap className="h-3.5 w-3.5 text-[var(--signal)]" />
            Switch {swClosed ? "closed" : "open"}
          </button>
          <button
            type="button"
            onClick={() => setBulb1((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-[var(--signal)]"
          >
            <Lightbulb className="h-3.5 w-3.5 text-[var(--signal)]" />
            Bulb 1 {bulb1 ? "on" : "out"}
          </button>
          <button
            type="button"
            onClick={() => setBulb2((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-[var(--signal)]"
          >
            <Lightbulb className="h-3.5 w-3.5 text-[var(--signal)]" />
            Bulb 2 {bulb2 ? "on" : "out"}
          </button>
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-4">
          <div
            className={
              "rounded-xl border px-3.5 py-3 text-xs leading-relaxed transition-colors " +
              (energized
                ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] text-foreground"
                : "border-[var(--card-border)] text-text-dim")
            }
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <span
                className={
                  "relative flex h-1.5 w-1.5 " + (energized ? "" : "opacity-40")
                }
              >
                <span
                  className={
                    "absolute inline-flex h-full w-full animate-ping rounded-full " +
                    (energized ? "bg-[var(--signal)]" : "bg-transparent")
                  }
                  style={{ opacity: energized ? 0.7 : 0 }}
                />
                <span
                  className={
                    "relative inline-flex h-1.5 w-1.5 rounded-full " +
                    (energized ? "bg-[var(--signal)]" : "bg-text-dim")
                  }
                />
              </span>
              {energized ? "Current flowing" : "No current"}
            </span>
            <p className="mt-1.5 text-[11px]">{status}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-[var(--card-border)] pt-2.5 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">V</p>
                <p className="font-display text-sm font-bold tabular-nums">9.0</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">R</p>
                <p className="font-display text-sm font-bold tabular-nums">60 Ω</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">I</p>
                <p className="font-display text-sm font-bold tabular-nums">
                  {energized ? "0.15 A" : "0 A"}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-text-dim">
            Two 30 Ω bulbs in series: total resistance 60 Ω, so I = V ÷ R = 9 ÷ 60 = 0.15 A.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_3%,transparent)]">
          <svg viewBox="0 0 600 300" className="block h-auto w-full">
            <defs>
              <radialGradient id="bulbGlow">
                <stop offset="0%" stopColor="#ffd27a" stopOpacity="0.95" />
                <stop offset="45%" stopColor="#ffb35c" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffb35c" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="batteryGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--signal)" />
                <stop offset="100%" stopColor="var(--signal-2)" />
              </linearGradient>
            </defs>

            {/* wires */}
            <path
              d="M 100 250 H 560 V 72 H 100 V 250"
              fill="none"
              stroke={wireColor}
              strokeWidth={energized ? 3.5 : 2.5}
              strokeLinecap="round"
              style={{ transition: "stroke 300ms ease, stroke-width 300ms ease" }}
            />

            {/* electrons */}
            {energized && (
              <g>
                {[0, 1, 2].map((i) => (
                  <circle key={i} r="4.5" fill="var(--signal)" className="lab-electron">
                    <animateMotion
                      dur={`${1.8 + i * 0.55}s`}
                      repeatCount="indefinite"
                      path={CIRCUIT_PATH}
                      begin={`${i * 0.6}s`}
                    />
                  </circle>
                ))}
              </g>
            )}

            {/* battery (bottom-left) */}
            <g>
              <line x1="108" y1="266" x2="108" y2="284" stroke="var(--text-main)" strokeWidth="5" strokeLinecap="round" />
              <line x1="124" y1="262" x2="124" y2="288" stroke="var(--text-main)" strokeWidth="2.5" strokeLinecap="round" />
              <text x="96" y="282" fontSize="11" fill="var(--text-dim)" fontWeight="700">+</text>
              <text x="133" y="282" fontSize="11" fill="var(--text-dim)" fontWeight="700">−</text>
              <rect x="84" y="242" width="58" height="10" rx="5" fill="url(#batteryGrad)" opacity={power ? 1 : 0.35} />
              <text x="104" y="306" fontSize="10" fill="color-mix(in srgb, var(--text-dim) 80%, transparent)" textAnchor="middle">
                9 V
              </text>
            </g>

            {/* switch (bottom-right) */}
            <g>
              <line x1="470" y1="250" x2="505" y2="250" stroke={energized ? "var(--signal)" : "var(--card-border)"} strokeWidth="3" strokeLinecap="round" />
              <line
                x1="505"
                y1="250"
                x2={swClosed ? 545 : 528}
                y2={swClosed ? 250 : 232}
                stroke="var(--text-main)"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ transition: "all 250ms ease" }}
              />
              <line x1="545" y1="250" x2="560" y2="250" stroke={energized ? "var(--signal)" : "var(--card-border)"} strokeWidth="3" strokeLinecap="round" />
              <circle cx="545" cy="250" r="4" fill={swClosed ? "var(--signal)" : "var(--text-dim)"} />
              <text x="517" y="286" fontSize="10" fill="color-mix(in srgb, var(--text-dim) 80%, transparent)" textAnchor="middle">
                {swClosed ? "closed" : "open"}
              </text>
            </g>

            {/* bulb 1 (top-left) */}
            <Bulb x={165} y={72} lit={energized && bulb1} label="R₁ · 30 Ω" />
            {/* bulb 2 (top-right) */}
            <Bulb x={460} y={72} lit={energized && bulb2} label="R₂ · 30 Ω" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function Bulb({ x, y, lit, label }: { x: number; y: number; lit: boolean; label: string }) {
  return (
    <g>
      <rect x={x - 16} y={y + 14} width="32" height="10" rx="4" fill="var(--card-border)" />
      {lit && <circle cx={x} cy={y} r="46" fill="url(#bulbGlow)" className="lab-electron" />}
      <circle
        cx={x}
        cy={y}
        r="17"
        fill={lit ? "color-mix(in srgb, #ffd27a 85%, white)" : "color-mix(in srgb, var(--text-main) 10%, transparent)"}
        stroke={lit ? "#ffd27a" : "var(--card-border)"}
        strokeWidth="2"
      />
      {/* filament */}
      <path
        d={`M ${x - 7} ${y + 8} L ${x - 3} ${y} L ${x} ${y + 8} L ${x + 3} ${y} L ${x + 7} ${y + 8}`}
        fill="none"
        stroke={lit ? "#c81f27" : "var(--text-dim)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text x={x} y={y + 42} fontSize="10" fill="color-mix(in srgb, var(--text-dim) 80%, transparent)" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */

export default function PhysicsSim() {
  return (
    <div className="flex flex-col gap-6">
      <MotionLab />
      <ReflectionLab />
      <CircuitLab />
    </div>
  );
}