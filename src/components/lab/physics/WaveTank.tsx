import { useRef, useState } from "react";
import { Pause, Play, SlidersHorizontal, Waves } from "lucide-react";
import { useCanvasSize, useRaf, clamp } from "../use-canvas";

type Mode = "single" | "two" | "slit" | "obstacle";

const MODES: { key: Mode; label: string }[] = [
  { key: "single", label: "Single source" },
  { key: "two", label: "Two sources" },
  { key: "slit", label: "Double slit" },
  { key: "obstacle", label: "Obstacle" },
];

export default function WaveTank() {
  const [mode, setMode] = useState<Mode>("two");
  const [freq, setFreq] = useState(3.2);
  const [d, setD] = useState(110);
  const [amp, setAmp] = useState(1);
  const [speed, setSpeed] = useState(260);
  const [paused, setPaused] = useState(false);

  const lambda = speed / freq;

  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const st = useRef({ mode, freq, d, speed, amp, paused });
  st.current = { mode, freq, d, speed, amp, paused };

  useRaf((_dt, t) => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = st.current;
    const time = S.paused ? 0 : t;
    const k = (2 * Math.PI) / lambda;
    const omega = 2 * Math.PI * S.freq;
    const ampScale = S.amp;

    const srcX = w * 0.24;
    const barrierX = w * 0.55;
    const midY = h / 2;

    let sources: { x: number; y: number; a: number }[] = [];
    if (S.mode === "single") {
      sources = [{ x: srcX, y: midY, a: 1 }];
    } else if (S.mode === "two") {
      sources = [
        { x: srcX, y: midY - S.d / 2, a: 1 },
        { x: srcX, y: midY + S.d / 2, a: 1 },
      ];
    } else if (S.mode === "slit") {
      sources = [
        { x: barrierX, y: midY - S.d / 2, a: 1 },
        { x: barrierX, y: midY + S.d / 2, a: 1 },
      ];
    } else {
      // obstacle: main source + weak diffracted waves at the obstacle's corners
      const oy = h * 0.3;
      sources = [
        { x: srcX, y: midY, a: 1 },
        { x: w * 0.62, y: midY - oy / 2, a: 0.45 },
        { x: w * 0.62, y: midY + oy / 2, a: 0.45 },
      ];
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // interference field
    const stride = 3;
    for (let gy = 0; gy < h; gy += stride) {
      for (let gx = 0; gx < w; gx += stride) {
        let ampSum = 0;
        for (const s of sources) {
          const r = Math.hypot(gx - s.x, gy - s.y);
          ampSum += (s.a * Math.sin(k * r - omega * time)) / Math.sqrt(r + 24);
        }
        const i = clamp(0.5 + ampSum * 11 * ampScale, 0, 1);
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

    // expanding ripple rings
    ctx.strokeStyle = "rgba(165,243,252,0.22)";
    ctx.lineWidth = 1.2;
    const ringSpan = lambda * 5;
    for (const s of sources) {
      if (s.a < 0.8) continue;
      const base = ((time * S.speed) % ringSpan);
      for (let i = 0; i < 4; i++) {
        const r = base + i * lambda;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // slit barrier
    if (S.mode === "slit") {
      ctx.fillStyle = "rgba(30,41,59,0.92)";
      ctx.fillRect(barrierX - 5, 0, 10, midY - S.d / 2 - 14);
      ctx.fillRect(barrierX - 5, midY + S.d / 2 + 14, 10, h - (midY + S.d / 2 + 14));
      ctx.strokeStyle = "rgba(148,163,184,0.5)";
      ctx.strokeRect(barrierX - 5, 0, 10, midY - S.d / 2 - 14);
      ctx.strokeRect(barrierX - 5, midY + S.d / 2 + 14, 10, h - (midY + S.d / 2 + 14));
    }

    // obstacle block
    if (S.mode === "obstacle") {
      const oy = h * 0.3;
      const ox = w * 0.62;
      const ow = 16;
      ctx.fillStyle = "rgba(30,41,59,0.95)";
      ctx.fillRect(ox - ow / 2, midY - oy / 2, ow, oy);
      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox - ow / 2, midY - oy / 2, ow, oy);
      // soft shadow behind the obstacle
      const sh = ctx.createLinearGradient(ox + ow / 2, 0, ox + ow / 2 + 42, 0);
      sh.addColorStop(0, "rgba(2,6,23,0.55)");
      sh.addColorStop(1, "rgba(2,6,23,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(ox + ow / 2, midY - oy / 2, 42, oy);
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("barrier", ox + ow / 2 + 6, midY - oy / 2 + 12);
    }

    // sources glow
    for (const s of sources) {
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

    // readout
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.font = "600 11px ui-monospace, monospace";
    ctx.fillText(`λ = ${lambda.toFixed(0)} px · f = ${S.freq.toFixed(1)} Hz · v = ${S.speed.toFixed(0)} px/s`, 10, 18);
  });

  const L = 380; // distance to far edge (px)
  const fringe = (lambda * L) / d;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">Wave interference tank</p>
            <p className="text-[11px] text-slate-500">
              Bright fringes where crest meets crest, dark where crest meets trough.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="lab-tabs">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={`lab-tab ${mode === m.key ? "lab-tab--on" : ""}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              className={`lab-btn ${paused ? "lab-btn--active" : ""}`}
              title={paused ? "Resume waves" : "Freeze waves"}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <canvas ref={ref} className="h-[420px] w-full rounded-2xl border border-white/10 bg-[#0b1120]" />
      </div>

      <div className="lab-glass-deep h-fit space-y-4 p-4">
        <div>
          <p className="lab-label mb-2">
            <SlidersHorizontal className="mr-1 inline h-3 w-3" /> Controls
          </p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Source spacing (d)</span>
                <span className="lab-value text-slate-200">{d} px</span>
              </div>
              <input
                type="range"
                className="lab-range mt-1.5 disabled:opacity-40"
                min={40}
                max={240}
                step={2}
                value={d}
                disabled={mode === "single" || mode === "obstacle"}
                onChange={(e) => setD(Number(e.target.value))}
              />
              {(mode === "single" || mode === "obstacle") && (
                <p className="mt-1 text-[9px] text-slate-500">spacing applies to two-source and double-slit modes</p>
              )}
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
            {mode === "single" && "One point source — circular ripples. Add a second source to see interference fringes appear."}
            {mode === "two" && "Two coherent sources overlap: bright fringes where path difference is a whole number of wavelengths."}
            {mode === "slit" && "Young's double slit: the barrier blocks everything except two slits, which act as fresh coherent sources."}
            {mode === "obstacle" && "Waves bend around the barrier edges — diffraction. The shadow region still gets weak waves from the corners."}
          </p>
        </div>
      </div>
    </div>
  );
}