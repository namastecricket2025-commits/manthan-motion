import { useEffect, useRef, useState } from "react";
import { Box, Grid2x2, Pause, Play, SlidersHorizontal, Waves } from "lucide-react";
import { useCanvasSize, useRaf, clamp } from "../use-canvas";
import { useTelemetryPublisher } from "../PhysicsSim";

type Mode = "single" | "two" | "slit" | "obstacle";
type View = "flat" | "topo";

const MODES: { key: Mode; label: string }[] = [
  { key: "single", label: "Single" },
  { key: "two", label: "Two" },
  { key: "slit", label: "Double slit" },
  { key: "obstacle", label: "Obstacle" },
];

interface Source {
  u: number; // 0..1 in the tank's source plane
  v: number;
  a: number;
}

/** Evenly stacked obstacle slabs with open water between them. */
function obstacleBlocks(bars: number) {
  const TOTAL = 0.55;
  const GAP = 0.07;
  const bh = (TOTAL - (bars - 1) * GAP) / bars;
  const blocks: { v0: number; v1: number }[] = [];
  let v = 0.5 - TOTAL / 2;
  for (let i = 0; i < bars; i++) {
    blocks.push({ v0: v, v1: v + bh });
    v += bh + GAP;
  }
  return blocks;
}

/** Coherent-sum wave height at a normalised point of the tank. */
function heightAt(u: number, v: number, sources: Source[], k: number, omega: number, time: number) {
  let s = 0;
  for (const src of sources) {
    const r = Math.hypot(u - src.u, v - src.v);
    s += (src.a * Math.sin(k * r - omega * time)) / Math.sqrt(r + 0.06);
  }
  return s;
}

export default function WaveTank() {
  const [mode, setMode] = useState<Mode>("two");
  const [view, setView] = useState<View>("topo");
  const [freq, setFreq] = useState(3.2);
  const [d, setD] = useState(110);
  const [amp, setAmp] = useState(1);
  const [speed, setSpeed] = useState(260);
  const [paused, setPaused] = useState(false);
  const [bars, setBars] = useState(3);

  const lambda = speed / freq;

  // publish live wave telemetry (v = f·λ and friends)
  const publish = useTelemetryPublisher();
  useEffect(() => {
    publish({
      subject: "Physics · Waves",
      rows: [
        { k: "Frequency f", v: `${freq.toFixed(1)} Hz` },
        { k: "Wavelength λ", v: `${lambda.toFixed(0)} px` },
        { k: "Speed v", v: `${speed} px/s` },
        { k: "Fringe Δy", v: `≈ ${((lambda * 380) / d).toFixed(0)} px` },
        { k: "Sources", v: mode === "single" ? "1" : mode === "two" || mode === "slit" ? "2" : `grid ×${bars}` },
      ],
      equation: "v = f · λ",
      eqNote: "Wave speed equals frequency times wavelength — change one and another must follow.",
      signal: clamp(freq / 8, 0, 1),
      accent: "#22d3ee",
    });
  }, [freq, lambda, speed, d, mode, bars, publish]);

  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const st = useRef({ mode, freq, d, speed, amp, paused, view, bars });
  st.current = { mode, freq, d, speed, amp, paused, view, bars };
  /** reused per-quad height band buffer (keeps the render loop allocation-free) */
  const bands = useRef(new Uint8Array(64 * 64));

  useRaf((_dt, t) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = st.current;
    const time = S.paused ? 0 : t;

    // source plane is the unit square; k and omega use the same units as before
    const k = (2 * Math.PI) / (lambda / 420);
    const omega = 2 * Math.PI * S.freq;
    const spacing = S.d / 420;

    let sources: Source[] = [];
    if (S.mode === "single") sources = [{ u: 0.18, v: 0.5, a: 1 }];
    else if (S.mode === "two") sources = [
      { u: 0.18, v: 0.5 - spacing / 2, a: 1 },
      { u: 0.18, v: 0.5 + spacing / 2, a: 1 },
    ];
    else if (S.mode === "slit") sources = [
      { u: 0.5, v: 0.5 - spacing / 2, a: 1 },
      { u: 0.5, v: 0.5 + spacing / 2, a: 1 },
    ];
    else {
      const blocks = obstacleBlocks(S.bars);
      sources = [{ u: 0.18, v: 0.5, a: 1 }];
      blocks.forEach((b) => {
        sources.push({ u: 0.62, v: b.v0, a: 0.42 });
        sources.push({ u: 0.62, v: b.v1, a: 0.42 });
      });
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── background water ──
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#060b16");
    bg.addColorStop(1, "#04070f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (S.view === "flat") {
      /* ─────────── flat colour interference field ─────────── */
      const stride = 3;
      const px = (u: number) => u * w;
      const py = (v: number) => v * h;
      const srcPx = sources.map((s) => ({ x: px(s.u), y: py(s.v), a: s.a }));
      const kPx = (2 * Math.PI) / lambda;
      for (let gy = 0; gy < h; gy += stride) {
        for (let gx = 0; gx < w; gx += stride) {
          let ampSum = 0;
          for (const s of srcPx) {
            const r = Math.hypot(gx - s.x, gy - s.y);
            ampSum += (s.a * Math.sin(kPx * r - omega * time)) / Math.sqrt(r + 24);
          }
          const i = clamp(0.5 + ampSum * 11 * S.amp, 0, 1);
          if (i < 0.42) {
            const t2 = i / 0.42;
            ctx.fillStyle = `rgba(${11 + 9 * t2},${17 + 28 * t2},${32 + 44 * t2},0.9)`;
          } else if (i < 0.72) {
            const t2 = (i - 0.42) / 0.3;
            ctx.fillStyle = `rgba(${8 + 70 * t2},${56 + 120 * t2},${100 + 110 * t2},0.95)`;
          } else {
            const t2 = (i - 0.72) / 0.28;
            ctx.fillStyle = `rgba(${124 + 131 * t2},${235 - 60 * t2},${255 - 20 * t2},1)`;
          }
          ctx.fillRect(gx, gy, stride, stride);
        }
      }
      // ripple rings
      ctx.strokeStyle = "rgba(165,243,252,0.22)";
      ctx.lineWidth = 1.2;
      const ringSpan = lambda * 5;
      for (const s of srcPx) {
        if (s.a < 0.8) continue;
        const base = (time * S.speed) % ringSpan;
        for (let i = 0; i < 4; i++) {
          const r = base + i * lambda;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (S.mode === "slit") {
        const bx = px(0.5);
        ctx.fillStyle = "rgba(30,41,59,0.92)";
        ctx.fillRect(bx - 5, 0, 10, h * 0.5 - (S.d / 420) * h * 0.5 - 14);
        ctx.fillRect(bx - 5, h * 0.5 + (S.d / 420) * h * 0.5 + 14, 10, h);
      }
      if (S.mode === "obstacle") {
        const ox = px(0.62);
        const ow = 16;
        obstacleBlocks(S.bars).forEach((b, i) => {
          const y0 = b.v0 * h;
          const y1 = b.v1 * h;
          ctx.fillStyle = "rgba(30,41,59,0.95)";
          ctx.fillRect(ox - ow / 2, y0, ow, y1 - y0);
          ctx.strokeStyle = "rgba(148,163,184,0.65)";
          ctx.lineWidth = 1.4;
          ctx.strokeRect(ox - ow / 2, y0, ow, y1 - y0);
          // soft pressure shadow downstream of each slab
          const sh = ctx.createLinearGradient(ox + ow / 2, 0, ox + ow / 2 + 40, 0);
          sh.addColorStop(0, "rgba(2,6,23,0.5)");
          sh.addColorStop(1, "rgba(2,6,23,0)");
          ctx.fillStyle = sh;
          ctx.fillRect(ox + ow / 2, y0, 40, y1 - y0);
          if (i === 0) {
            ctx.fillStyle = "rgba(148,163,184,0.75)";
            ctx.font = "9px ui-monospace, monospace";
            ctx.fillText("slabs", ox + ow / 2 + 6, y0 + 12);
          }
        });
      }
      for (const s of srcPx) {
        if (s.a < 0.8) continue;
        const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 14);
        g.addColorStop(0, "#fff");
        g.addColorStop(0.4, "#22d3ee");
        g.addColorStop(1, "rgba(34,211,238,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      /* ─────────── 3D topographic water surface ─────────── */
      const GX = 40;
      const GY = 28;
      const cosA = 0.866;
      const sinA = 0.5;
      const tank = 420;
      // projected bounds for a unit-square tank
      const projW = tank * 2 * cosA;
      const projH = tank * 2 * sinA + 60;
      const scale = Math.min((w - 30) / projW, (h - 26) / projH);
      const cx = w / 2;
      const top = h * 0.5 - (projH * scale) / 2 + 26;

      const project = (u: number, v: number, hh: number) => {
        const x = (u - v) * tank * cosA;
        const y = (u + v - 1) * tank * sinA - hh;
        return { x: cx + x * scale, y: top + y * scale };
      };

      // sample the height field once
      const hv = new Float32Array(GX * GY);
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = 0; j < GY; j++) {
        for (let i = 0; i < GX; i++) {
          const raw = heightAt(i / (GX - 1), j / (GY - 1), sources, k, omega, time);
          const val = clamp(raw * 0.55 * S.amp, -1.6, 1.6);
          hv[j * GX + i] = val;
          if (val < lo) lo = val;
          if (val > hi) hi = val;
        }
      }
      const span = Math.max(0.4, hi - lo);
      const SX = 330; // vertical exaggeration in tank units
      const hy = (val: number) => ((val - lo) / span - 0.5) * SX;

      const pts = new Float32Array(GX * GY * 2);
      for (let j = 0; j < GY; j++) {
        for (let i = 0; i < GX; i++) {
          const p = project(i / (GX - 1), j / (GY - 1), hy(hv[j * GX + i]));
          pts[(j * GX + i) * 2] = p.x;
          pts[(j * GX + i) * 2 + 1] = p.y;
        }
      }

      // quantise each quad into a height band, then paint band by band —
      // no per-frame allocations, one fill + one stroke per band
      const LEVELS = 24;
      for (let j = 0; j < GY - 1; j++) {
        for (let i = 0; i < GX - 1; i++) {
          const a = j * GX + i;
          const hAvg = (hv[a] + hv[a + 1] + hv[a + GX] + hv[a + GX + 1]) / 4;
          bands.current[a] = clamp(Math.round(((hAvg - lo) / span) * (LEVELS - 1)), 0, LEVELS - 1);
        }
      }
      const bandsArr = bands.current;
      for (let lvl = 0; lvl < LEVELS; lvl++) {
        const f = lvl / (LEVELS - 1);
        const r = Math.round(10 + f * 150);
        const g = Math.round(26 + f * 190);
        const b = Math.round(46 + f * 130);
        ctx.fillStyle = `rgba(${r},${g},${b},0.97)`;
        ctx.strokeStyle = `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 50)},${Math.min(255, b + 40)},0.3)`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let j = 0; j < GY - 1; j++) {
          for (let i = 0; i < GX - 1; i++) {
            const a = j * GX + i;
            if (bandsArr[a] !== lvl) continue;
            const b2 = a + 1;
            const c2 = a + GX;
            const d2 = c2 + 1;
            ctx.moveTo(pts[a * 2], pts[a * 2 + 1]);
            ctx.lineTo(pts[b2 * 2], pts[b2 * 2 + 1]);
            ctx.lineTo(pts[d2 * 2], pts[d2 * 2 + 1]);
            ctx.lineTo(pts[c2 * 2], pts[c2 * 2 + 1]);
            ctx.closePath();
          }
        }
        ctx.fill();
        ctx.stroke();
      }

      // specular crest highlights — the water reads as wet
      for (let j = 0; j < GY - 1; j++) {
        for (let i = 0; i < GX - 1; i++) {
          const a = j * GX + i;
          const hL = hv[a];
          const hR = hv[a + 1];
          const hD = hv[a + GX];
          if (hL <= 0.85) continue;
          const slope = (hR - hL) + (hD - hL);
          if (slope > -0.05) continue;
          ctx.fillStyle = `rgba(236,254,255,${clamp(0.05 + (hL - 0.85) * 0.35, 0, 0.5)})`;
          ctx.beginPath();
          const b = a + 1;
          const c = a + GX;
          const d = c + 1;
          ctx.moveTo(pts[a * 2], pts[a * 2 + 1]);
          ctx.lineTo(pts[b * 2], pts[b * 2 + 1]);
          ctx.lineTo(pts[d * 2], pts[d * 2 + 1]);
          ctx.lineTo(pts[c * 2], pts[c * 2 + 1]);
          ctx.closePath();
          ctx.fill();
        }
      }

      // walls + sources in projected space
      const wall = (u0: number, v0: number, u1: number, v1: number) => {
        const p0 = project(u0, v0, 0);
        const p1 = project(u1, v1, 0);
        const p2 = project(u1, v1, hy(lo));
        const p3 = project(u0, v0, hy(lo));
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(20,32,54,0.85)";
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      };
      wall(0, 0, 1, 0);
      wall(1, 0, 1, 1);

      const wallAbs = (u: number, v0: number, v1: number, fill: string) => {
        const p0 = project(u, v0, hy(lo));
        const p1 = project(u, v1, hy(lo));
        const p2 = project(u, v1, hy(hi));
        const p3 = project(u, v0, hy(hi));
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(203,213,225,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      if (S.mode === "obstacle") {
        obstacleBlocks(S.bars).forEach((b) => wallAbs(0.62, b.v0, b.v1, "rgba(148,163,184,0.9)"));
      }

      if (S.mode === "slit") {
        const bx = 0.5;
        const half = spacing / 2;
        ctx.fillStyle = "rgba(148,163,184,0.85)";
        const wallSeg = (v0: number, v1: number) => {
          const p0 = project(bx, v0, hy(lo));
          const p1 = project(bx, v1, hy(lo));
          const p2 = project(bx, v1, hy(hi));
          const p3 = project(bx, v0, hy(hi));
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fill();
        };
        wallSeg(0, 0.5 - half - 0.035);
        wallSeg(0.5 + half + 0.035, 1);
      }

      for (const s of sources) {
        const p = project(s.u, s.v, hy(0));
        const rad = 5 + s.a * 4;
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad * 4);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.3, s.a > 0.8 ? "#67e8f9" : "#a5b4fc");
        g.addColorStop(1, "rgba(34,211,238,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e0f2fe";
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // crest / trough tags
      ctx.fillStyle = "rgba(165,243,252,0.75)";
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillText("crests stand proud", 12, h - 26);
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.fillText("troughs sink into shadow", 12, h - 12);
    }

    // readout
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText(`λ = ${lambda.toFixed(0)} px · f = ${S.freq.toFixed(1)} Hz · v = ${S.speed.toFixed(0)} px/s`, 10, 18);
  });

  const L = 380;
  const fringe = (lambda * L) / d;

  return (
    <div className="lab-col lab-split">
      <div className="lab-stage-pane lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Wave interference tank</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Crests add where waves arrive in step and cancel where they oppose — switch to the 3D surface to see the water rise and fall.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="lab-tabs !p-1">
              <button type="button" onClick={() => setView("flat")} className={`lab-tab !px-2.5 !py-1 text-xs ${view === "flat" ? "lab-tab--on" : ""}`}>
                <Grid2x2 className="h-3.5 w-3.5" /> 2D
              </button>
              <button type="button" onClick={() => setView("topo")} className={`lab-tab !px-2.5 !py-1 text-xs ${view === "topo" ? "lab-tab--on" : ""}`}>
                <Box className="h-3.5 w-3.5" /> 3D surface
              </button>
            </div>
            <button type="button" onClick={() => setPaused(!paused)} className={`lab-btn !px-2.5 ${paused ? "lab-btn--active" : ""}`} title={paused ? "Resume waves" : "Freeze waves"}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="lab-stage w-full rounded-2xl border border-white/10 bg-[#04070f]" />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button key={m.key} type="button" onClick={() => setMode(m.key)} className={`lab-btn !px-2.5 text-xs ${mode === m.key ? "lab-btn--active" : ""}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lab-deck-pane lab-glass-deep space-y-3.5 p-4">
        <div>
          <p className="lab-label mb-2">
            <SlidersHorizontal className="mr-1 inline h-3 w-3" /> Controls
          </p>
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Source spacing (d)</span>
                <span className="lab-value text-slate-200">{d} px</span>
              </div>
              <input type="range" className="lab-range mt-1.5 disabled:opacity-40" min={40} max={240} step={2} value={d} disabled={mode === "single" || mode === "obstacle"} onChange={(e) => setD(Number(e.target.value))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Frequency (f)</span>
                <span className="lab-value text-slate-200">{freq.toFixed(1)} Hz</span>
              </div>
              <input type="range" className="lab-range mt-1.5" min={1} max={8} step={0.1} value={freq} onChange={(e) => setFreq(Number(e.target.value))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Obstacle slabs</span>
                <span className="lab-value text-slate-200">{bars}</span>
              </div>
              <input
                type="range"
                className="lab-range mt-1.5 disabled:opacity-40"
                min={1}
                max={5}
                step={1}
                value={bars}
                disabled={mode !== "obstacle"}
                onChange={(e) => setBars(Number(e.target.value))}
              />
              {mode !== "obstacle" && <p className="mt-1 text-[9px] text-slate-500">applies to the obstacle-grid mode</p>}
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Amplitude</span>
                <span className="lab-value text-slate-200">{amp.toFixed(2)}×</span>
              </div>
              <input type="range" className="lab-range mt-1.5" min={0.3} max={1.8} step={0.05} value={amp} onChange={(e) => setAmp(Number(e.target.value))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Wave speed (v)</span>
                <span className="lab-value text-slate-200">{speed} px/s</span>
              </div>
              <input type="range" className="lab-range mt-1.5" min={120} max={420} step={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">
            <Waves className="mr-1 inline h-3 w-3" /> Live physics
          </p>
          {[
            { k: "Wavelength λ = v/f", v: `${lambda.toFixed(0)} px` },
            { k: "Fringe spacing", v: `≈ ${fringe.toFixed(0)} px` },
            { k: "Formula", v: "Δy = λ·L / d" },
            { k: "Constructive", v: "Δpath = n·λ" },
            { k: "Destructive", v: "Δpath = (n+½)·λ" },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between py-1 text-[11px]">
              <span className="text-slate-500">{r.k}</span>
              <span className="lab-value text-slate-200">{r.v}</span>
            </div>
          ))}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            {view === "topo"
              ? "The surface is the true sum of the two wave trains — where crests coincide the peaks stand taller, where a crest meets a trough the water stays flat."
              : mode === "single"
                ? "One point source — circular ripples. Add a second source to see interference fringes appear."
                : mode === "two"
                  ? "Two coherent sources overlap: bright fringes where the path difference is a whole number of wavelengths."
                  : mode === "slit"
                    ? "Young's double slit: the barrier blocks everything except two slits, which act as fresh coherent sources."
                    : "Waves bend around the barrier edges — diffraction. The shadow region still receives weak waves from the corners."}
          </p>
        </div>
      </div>
    </div>
  );
}
