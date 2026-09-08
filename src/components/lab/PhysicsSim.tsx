import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Activity,
  Atom,
  Gauge,
  Lightbulb,
  MoveRight,
  Pause,
  Play,
  Power,
  RotateCcw,
  Timer,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const G = 9.8;
const TAU = Math.PI * 2;
const OBJ_W = 56;

const SURFACES = [
  { id: "ice", label: "Ice", mu: 0.05 },
  { id: "wood", label: "Wood", mu: 0.3 },
  { id: "rubber", label: "Rubber", mu: 0.7 },
] as const;

interface SimState {
  t: number;
  x: number;
  v: number;
  stopped: boolean;
  trackW: number;
  points: { t: number; x: number; v: number }[];
  maxX: number;
  last: number;
}

/* ------------------------------------------------------------------ */
/* 1. Motion lab — draggable block, sliders, live graphs + stop report */
/* ------------------------------------------------------------------ */

type TraceKey = "x" | "v" | "a";

const TRACE_META: Record<TraceKey, { label: string; color: string }> = {
  x: { label: "Position", color: "var(--signal)" },
  v: { label: "Velocity", color: "#e8915a" },
  a: { label: "Acceleration", color: "#5aa0b5" },
};

function MotionLab() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const objRef = useRef<HTMLDivElement | null>(null);
  const graphWrapRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<HTMLCanvasElement | null>(null);
  const tRef = useRef<HTMLSpanElement | null>(null);
  const xRef = useRef<HTMLSpanElement | null>(null);
  const vRef = useRef<HTMLSpanElement | null>(null);
  const aRef = useRef<HTMLSpanElement | null>(null);
  const keRef = useRef<HTMLSpanElement | null>(null);
  const pRef = useRef<HTMLSpanElement | null>(null);

  const [params, setParams] = useState({ v0: 8, mass: 12, mu: 0.25 });
  const [surface, setSurface] = useState<string>("wood");
  const [traces, setTraces] = useState<Record<TraceKey, boolean>>({ x: true, v: true, a: false });
  const [running, setRunning] = useState(false);
  const [restAt, setRestAt] = useState<{ t: number; x: number } | null>(null);
  const paramsRef = useRef(params);
  const sim = useRef<SimState>({
    t: 0, x: 0, v: 0, stopped: false, trackW: 0, points: [], maxX: 1, last: 0,
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
    s.stopped = false;
    s.trackW = W - OBJ_W;
    s.points = [];
    s.maxX = 1;
    s.last = performance.now();
    setRestAt(null);
    if (objRef.current) objRef.current.style.transform = "translateX(0px)";
    updateReadouts(0, 0, p.v0);
    drawGraph();
  };

  const updateReadouts = (t: number, x: number, v: number) => {
    const p = paramsRef.current;
    const a = v > 0 ? -p.mu * G : 0;
    const ke = 0.5 * p.mass * v * v;
    const mom = p.mass * v;
    if (tRef.current) tRef.current.textContent = t.toFixed(1);
    if (xRef.current) xRef.current.textContent = x.toFixed(1);
    if (vRef.current) vRef.current.textContent = v.toFixed(2);
    if (aRef.current) aRef.current.textContent = a.toFixed(2);
    if (keRef.current) keRef.current.textContent = ke.toFixed(1);
    if (pRef.current) pRef.current.textContent = mom.toFixed(1);
  };

  const drawGraph = () => {
    const canvas = graphRef.current;
    const wrap = graphWrapRef.current;
    const s = sim.current;
    const p = paramsRef.current;
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

    // velocity / acceleration maxima for their own scales
    let vMax = 1;
    for (const pt of s.points) vMax = Math.max(vMax, Math.abs(pt.v));
    const aMag = p.mu * G;

    const trace = (key: TraceKey, color: string) => {
      if (!traces[key]) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = key === "x" ? 2.2 : 1.8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      s.points.forEach((pt, i) => {
        const px = pad.l + (pt.t / tMax) * pw;
        let val: number;
        if (key === "x") val = pt.x / xMax;
        else if (key === "v") val = (pt.v + vMax) / (2 * vMax);
        // acceleration: constant −μg while moving, 0 once stopped
        else val = pt.v > 0 ? 0 : 0.5;
        const py = pad.t + ph - val * ph;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    trace("x", TRACE_META.x.color);
    trace("v", TRACE_META.v.color);
    trace("a", TRACE_META.a.color);

    // end dot for the primary trace
    if (traces.x) {
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
    }
  };

  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const s = sim.current;
      const p = paramsRef.current;
      const dt = Math.min((performance.now() - s.last) / 1000, 0.05);
      s.last = performance.now();
      if (!s.stopped) {
        const a = p.mu * G;
        s.v = Math.max(0, s.v - a * dt);
        s.x += s.v * dt;
        s.t += dt;
        let hitEnd = false;
        if (s.x >= s.trackW) {
          s.x = s.trackW;
          s.v = 0;
          hitEnd = true;
        }
        s.points.push({ t: s.t, x: s.x, v: s.v });
        if (s.points.length > 900) s.points.shift();
        s.maxX = Math.max(s.maxX, s.x);
        if (objRef.current) objRef.current.style.transform = `translateX(${s.x}px)`;
        updateReadouts(s.t, s.x, s.v);
        drawGraph();
        if (s.v <= 0 || hitEnd) {
          s.stopped = true;
          setRestAt({ t: s.t, x: s.x });
          setRunning(false);
          drawGraph();
          return;
        }
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  useEffect(() => {
    resetSim();
    const onResize = () => resetSim();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setParam = (key: keyof typeof params, value: number) => {
    setRunning(false);
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    resetSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const pickSurface = (id: string) => {
    const s = SURFACES.find((x) => x.id === id);
    if (!s) return;
    setSurface(id);
    setParam("mu", s.mu);
  };

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
    s.stopped = false;
    s.trackW = W;
    s.points = [];
    s.maxX = 1;
    setRestAt(null);
    if (objRef.current) objRef.current.style.transform = `translateX(${x}px)`;
    updateReadouts(0, x, paramsRef.current.v0);
    drawGraph();
  };
  const onObjUp = () => {
    dragging.current = false;
  };

  // predicted stop (friction-only)
  const mu = params.mu;
  const tPred = mu > 0 ? params.v0 / (mu * G) : 0;
  const dPred = mu > 0 ? (params.v0 * params.v0) / (2 * mu * G) : 0;
  const accelMag = mu * G;
  const fricForce = mu * params.mass * G;

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Atom className="h-4 w-4 text-[var(--signal)]" />
            Motion lab
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Friction decelerates the block at a = −μg — watch it glide, then read the full stop report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 rounded-full bg-[var(--signal)] text-[var(--primary-foreground)] hover:bg-[var(--signal)]/90"
            onClick={() => {
              if (!running && sim.current.stopped) resetSim();
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

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
        {/* Control deck */}
        <div className="flex flex-col gap-5">
          {/* surface presets */}
          <div>
            <p className="text-xs font-medium text-text-dim">Surface</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--card-border)] p-1">
              {SURFACES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSurface(s.id)}
                  className={
                    "rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors " +
                    (surface === s.id
                      ? "bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] text-foreground"
                      : "text-text-dim hover:text-foreground")
                  }
                >
                  {s.label}
                  <span className="block text-[9px] font-medium opacity-70">μ = {s.mu}</span>
                </button>
              ))}
            </div>
          </div>

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

          {/* live readouts */}
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                { label: "Time", ref: tRef, unit: "s", icon: Timer },
                { label: "Distance", ref: xRef, unit: "m", icon: MoveRight },
                { label: "Velocity", ref: vRef, unit: "m/s", icon: Gauge },
                { label: "Accel.", ref: aRef, unit: "m/s²", icon: Activity },
                { label: "Kinetic E", ref: keRef, unit: "J", icon: Zap },
                { label: "Momentum", ref: pRef, unit: "kg·m/s", icon: Power },
              ] as const
            ).map((r) => (
              <div
                key={r.label}
                className="rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_5%,transparent)] px-3 py-2"
              >
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-text-dim">
                  <r.icon className="h-3 w-3" />
                  {r.label}
                </p>
                <p className="mt-0.5 font-display text-base font-bold tabular-nums text-foreground">
                  <span ref={r.ref}>0.0</span>{" "}
                  <span className="text-xs font-medium text-text-dim">{r.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* physics summary */}
          <div className="rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_4%,transparent)] px-3.5 py-3 text-[11px] leading-relaxed text-text-dim">
            <p className="font-semibold text-foreground">Setup</p>
            <p className="mt-1">
              Deceleration <span className="font-semibold tabular-nums text-foreground">{accelMag.toFixed(2)} m/s²</span>{" "}
              from friction F = μmg = <span className="font-semibold tabular-nums text-foreground">{fricForce.toFixed(1)} N</span>.
            </p>
            <p className="mt-1">
              Predicted stop at <span className="font-semibold tabular-nums text-foreground">t = {tPred.toFixed(1)} s</span>,{" "}
              <span className="font-semibold tabular-nums text-foreground">d = {dPred.toFixed(1)} m</span>.
            </p>
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
              {SURFACES.find((s) => s.id === surface)?.label ?? "Custom"} · μ = {params.mu.toFixed(2)}
            </span>
          </div>

          {/* stop report */}
          <div
            className={
              "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3.5 py-2.5 text-[11px] transition-colors " +
              (restAt
                ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                : "border-[var(--card-border)] bg-transparent text-text-dim")
            }
          >
            {restAt ? (
              <>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
                  Block at rest
                </span>
                <span className="tabular-nums">
                  actual: <b className="text-foreground">t = {restAt.t.toFixed(1)} s</b> ·{" "}
                  <b className="text-foreground">d = {restAt.x.toFixed(1)} m</b>
                </span>
                <span className="tabular-nums">
                  predicted: <b className="text-foreground">t = {tPred.toFixed(1)} s</b> ·{" "}
                  <b className="text-foreground">d = {dPred.toFixed(1)} m</b>
                </span>
                {restAt.x >= sim.current.trackW - 0.01 && (
                  <span className="text-text-dim">— the block ran out of track first.</span>
                )}
              </>
            ) : (
              <span>
                {running ? "Simulating… velocity is bleeding off at μg = " : "Run the sim — "}
                <b className="tabular-nums text-foreground">{accelMag.toFixed(2)} m/s²</b>
                {!running && " to see the stop report."}
              </span>
            )}
          </div>

          {/* Graph with trace toggles */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "x", ...TRACE_META.x },
                  { key: "v", ...TRACE_META.v },
                  { key: "a", ...TRACE_META.a },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTraces((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors " +
                    (traces[t.key]
                      ? "border-[var(--card-border)] text-foreground"
                      : "border-transparent text-text-dim opacity-60 hover:opacity-100")
                  }
                >
                  <span className="h-1.5 w-3 rounded-full" style={{ background: t.color }} />
                  {t.label}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-text-dim">
                velocity & acceleration use their own scales
              </span>
            </div>
            <div
              ref={graphWrapRef}
              className="relative h-48 w-full overflow-hidden rounded-2xl border border-[var(--card-border)] sm:h-56"
            >
              <canvas ref={graphRef} className="absolute inset-0 h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Reflection lab — glowing beam, specular/diffuse surfaces         */
/* ------------------------------------------------------------------ */

const RB_CX = 300;
const RB_CY = 240;
const RB_R = 150;

function ReflectionLab() {
  const [angle, setAngle] = useState(70);
  const [surface, setSurface] = useState<"mirror" | "rough">("mirror");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const rad = (angle * Math.PI) / 180;
  const srcX = RB_CX + RB_R * Math.cos(rad);
  const srcY = RB_CY - RB_R * Math.sin(rad);
  const refX = RB_CX - RB_R * Math.cos(rad);
  const refY = RB_CY - RB_R * Math.sin(rad);
  const incidence = Math.abs(90 - angle);
  const glancing = 90 - incidence;

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

  // What's happening now — pedagogical readout
  const readout =
    surface === "rough"
      ? "Rough surface: the reflected ray breaks into a scattered fan — each micro-facet sends light its own way, so the mirror image blurs into diffuse reflection."
      : incidence === 0
        ? "Normal incidence: the beam strikes the mirror head-on and retraces its own path — θi = θr = 0°, a perfect bounce-back."
        : incidence === 90
          ? "Grazing incidence: the beam skims along the surface. The reflected ray hugs the mirror and the image appears edge-on."
          : incidence > 45
            ? `Steep incidence: the ray meets the mirror at ${incidence}° from the normal and leaves at exactly the same ${incidence}° — the reflected angle mirrors the incident one.`
            : `Shallow incidence: the ray grazes in at ${incidence}° from the normal. Reflection is symmetric across the normal, so θi = θr = ${incidence}°.`;

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Lightbulb className="h-4 w-4 text-[var(--signal)]" />
            Reflection lab
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            Drag the beam knob or type an angle — the law of reflection holds at every step.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-chip flex items-center gap-1 p-1">
            {(
              [
                { key: "mirror", label: "Mirror" },
                { key: "rough", label: "Rough" },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSurface(s.key)}
                className={
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors " +
                  (surface === s.key
                    ? "bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] text-foreground"
                    : "text-text-dim hover:text-foreground")
                }
              >
                {s.label}
              </button>
            ))}
          </div>
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
              <span className="text-text-dim">Incidence θi</span>
              <span className="font-display text-base font-bold tabular-nums text-foreground">
                {incidence}°
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-text-dim">Reflection θr</span>
              <span className="font-display text-base font-bold tabular-nums text-[var(--signal)]">
                {surface === "rough" ? "scattered" : `${incidence}°`}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-text-dim">Glancing angle</span>
              <span className="font-semibold tabular-nums text-foreground">{glancing}°</span>
            </div>
            <p className="mt-2.5 border-t border-[var(--card-border)] pt-2 text-[11px] leading-relaxed text-text-dim">
              θ<sub>i</sub> = θ<sub>r</sub> — always measured from the normal (dashed line).
            </p>
          </div>

          {/* live explanation */}
          <div className="rounded-xl border border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_7%,transparent)] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--signal)]">
              <Zap className="h-3 w-3" />
              What's happening
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground">{readout}</p>
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
              <radialGradient id="impactGlow">
                <stop offset="0%" stopColor="color-mix(in srgb, var(--signal) 60%, transparent)" />
                <stop offset="55%" stopColor="color-mix(in srgb, var(--signal) 22%, transparent)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--signal) 0%, transparent)" />
              </radialGradient>
              <filter id="beamBlur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
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
              {surface === "mirror" ? "MIRROR" : "ROUGH SURFACE"}
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

            {/* impact glow */}
            <circle cx={RB_CX} cy={RB_CY} r="64" fill="url(#impactGlow)" />

            {/* incident ray — core + glow + flowing dashes */}
            <line
              x1={srcX} y1={srcY} x2={RB_CX} y2={RB_CY}
              stroke="var(--signal)" strokeWidth="6" strokeLinecap="round" opacity="0.28"
              filter="url(#beamBlur)"
            />
            <line
              x1={srcX} y1={srcY} x2={RB_CX} y2={RB_CY}
              stroke="var(--signal)" strokeWidth="3" strokeLinecap="round"
            />
            <line
              x1={srcX} y1={srcY} x2={RB_CX} y2={RB_CY}
              stroke="var(--signal)" strokeWidth="3" strokeLinecap="round"
              className="lab-beam" opacity="0.85"
            />

            {/* reflected rays */}
            {surface === "mirror" ? (
              <g>
                <line
                  x1={RB_CX} y1={RB_CY} x2={refX} y2={refY}
                  stroke="#e8915a" strokeWidth="6" strokeLinecap="round" opacity="0.25"
                  filter="url(#beamBlur)"
                />
                <line
                  x1={RB_CX} y1={RB_CY} x2={refX} y2={refY}
                  stroke="#e8915a" strokeWidth="3" strokeLinecap="round"
                />
                <line
                  x1={RB_CX} y1={RB_CY} x2={refX} y2={refY}
                  stroke="#e8915a" strokeWidth="3" strokeLinecap="round"
                  className="lab-beam lab-beam--slow" opacity="0.85"
                />
              </g>
            ) : (
              /* diffuse fan — rays scattered over ±34° */
              <g>
                {[-2, -1, 0, 1, 2].map((k) => {
                  const spread = (k * 17 * Math.PI) / 180;
                  const fx = RB_CX - RB_R * 0.92 * Math.cos(rad + spread);
                  const fy = RB_CY - RB_R * 0.92 * Math.sin(rad + spread);
                  const op = 0.9 - Math.abs(k) * 0.22;
                  return (
                    <line
                      key={k}
                      x1={RB_CX} y1={RB_CY} x2={fx} y2={fy}
                      stroke="#e8915a" strokeWidth={k === 0 ? 2.6 : 1.6}
                      strokeLinecap="round" opacity={op}
                    />
                  );
                })}
              </g>
            )}

            {/* photons flowing along the beams */}
            {surface === "mirror" && (
              <g>
                <circle r="3" fill="#ffd9c2" opacity="0.9">
                  <animateMotion
                    dur="1.6s"
                    repeatCount="indefinite"
                    path={`M ${srcX} ${srcY} L ${RB_CX} ${RB_CY}`}
                  />
                </circle>
                <circle r="3" fill="#ffd9c2" opacity="0.9">
                  <animateMotion
                    dur="2.2s"
                    begin="0.8s"
                    repeatCount="indefinite"
                    path={`M ${refX} ${refY} L ${RB_CX} ${RB_CY}`}
                  />
                </circle>
              </g>
            )}

            {/* source + knob */}
            <circle cx={srcX} cy={srcY} r="20" fill="var(--signal)" opacity="0.16" filter="url(#beamBlur)" />
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
            <text x={refX} y={refY - 14} fontSize="10" fill="color-mix(in srgb, #e8915a 80%, transparent)" textAnchor="middle">
              {surface === "mirror" ? `θr = ${incidence}°` : "scattered"}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Circuit sandbox — voltage slider, per-part switches, live maths  */
/* ------------------------------------------------------------------ */

const CIRCUIT_PATH = "M 140 250 H 560 V 72 H 100 V 250";

function CircuitLab() {
  const [volts, setVolts] = useState(9);
  const [power, setPower] = useState(true);
  const [swClosed, setSwClosed] = useState(true);
  const [bulb1, setBulb1] = useState(true);
  const [bulb2, setBulb2] = useState(true);

  const R_BULB = 30;
  const rTotal = R_BULB * 2;
  const energized = power && swClosed && bulb1 && bulb2;
  const current = energized ? volts / rTotal : 0; // amps
  const totalPower = energized ? volts * current : 0; // watts
  const brightness = Math.min(1, current / 0.15); // 1.0 at the 9 V baseline

  const status = !power
    ? "Power is off — no current flows."
    : !swClosed
      ? "Switch open — the loop is broken, current drops to zero instantly."
      : !bulb1
        ? "Bulb 1 removed — a series circuit needs every component in the loop."
        : !bulb2
          ? "Bulb 2 removed — a series circuit needs every component in the loop."
          : `Circuit closed — ${current.toFixed(2)} A flows through both bulbs.`;

  return (
    <section className="glass-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
            <Zap className="h-4 w-4 text-[var(--signal)]" />
            Circuit sandbox
          </h2>
          <p className="mt-0.5 text-xs text-text-dim">
            A series circuit — dial the battery, open the switch, pull a bulb. Watch current obey Ohm's law.
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
          {/* battery voltage */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-text-dim">
              <span>Battery voltage</span>
              <span className="font-semibold tabular-nums text-foreground">{volts.toFixed(0)} V</span>
            </div>
            <Slider
              className="mt-2.5"
              min={3}
              max={12}
              step={1}
              value={[volts]}
              onValueChange={([v]) => setVolts(v)}
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-text-dim">
              More volts, more push — current and bulb brightness rise together.
            </p>
          </div>

          <div
            className={
              "rounded-xl border px-3.5 py-3 text-xs leading-relaxed transition-colors " +
              (energized
                ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] text-foreground"
                : "border-[var(--card-border)] text-text-dim")
            }
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <span className={"relative flex h-1.5 w-1.5 " + (energized ? "" : "opacity-40")}>
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
            <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--card-border)] pt-2.5 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">V</p>
                <p className="font-display text-sm font-bold tabular-nums">{volts.toFixed(1)} V</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">R total</p>
                <p className="font-display text-sm font-bold tabular-nums">{rTotal} Ω</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">I = V/R</p>
                <p className="font-display text-sm font-bold tabular-nums">
                  {energized ? `${current.toFixed(2)} A` : "0 A"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-dim">P = VI</p>
                <p className="font-display text-sm font-bold tabular-nums">
                  {energized ? `${totalPower.toFixed(2)} W` : "0 W"}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-text-dim">
            Two {R_BULB} Ω bulbs in series: R = {R_BULB} + {R_BULB} = {rTotal} Ω, so I = V ÷ {rTotal}. Each bulb
            burns I²R ={" "}
            <span className="font-semibold tabular-nums text-foreground">
              {energized ? (current * current * R_BULB).toFixed(2) : "0.00"} W
            </span>
            .
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
              stroke={energized ? "var(--signal)" : "var(--card-border)"}
              strokeWidth={energized ? 3.5 : 2.5}
              strokeLinecap="round"
              style={{ transition: "stroke 300ms ease, stroke-width 300ms ease" }}
            />

            {/* electrons — speed follows current */}
            {energized && (
              <g>
                {[0, 1, 2].map((i) => (
                  <circle key={i} r="4.5" fill="var(--signal)" className="lab-electron">
                    <animateMotion
                      dur={`${(1.8 + i * 0.55) * (0.15 / current)}s`}
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
                {volts.toFixed(0)} V
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

            {/* bulbs */}
            <Bulb x={165} y={72} lit={energized && bulb1} glow={brightness} label="R₁ · 30 Ω" />
            <Bulb x={460} y={72} lit={energized && bulb2} glow={brightness} label="R₂ · 30 Ω" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function Bulb({ x, y, lit, glow, label }: { x: number; y: number; lit: boolean; glow: number; label: string }) {
  const intensity = lit ? glow : 0;
  return (
    <g>
      <rect x={x - 16} y={y + 14} width="32" height="10" rx="4" fill="var(--card-border)" />
      <circle
        cx={x}
        cy={y}
        r="46"
        fill="url(#bulbGlow)"
        className="lab-electron"
        style={{ opacity: intensity }}
      />
      <circle
        cx={x}
        cy={y}
        r="17"
        fill={
          lit
            ? `color-mix(in srgb, #ffd27a ${45 + glow * 40}%, ${glow > 0.35 ? "white" : "transparent"})`
            : "color-mix(in srgb, var(--text-main) 10%, transparent)"
        }
        stroke={lit ? "#ffd27a" : "var(--card-border)"}
        strokeWidth="2"
        style={{ transition: "fill 300ms ease, stroke 300ms ease" }}
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