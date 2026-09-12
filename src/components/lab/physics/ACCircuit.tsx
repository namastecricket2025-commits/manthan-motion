import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Activity, Zap } from "lucide-react";
import { SPRING, useCanvasSize, useRaf, clamp } from "../use-canvas";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left"
      style={{ borderColor: on ? "rgba(255,59,92,0.45)" : undefined }}
    >
      <span className={`text-[11px] font-semibold ${on ? "text-slate-100" : "text-slate-500"}`}>{label}</span>
      <span
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
        style={{ background: on ? "linear-gradient(135deg,#ff2e55,#e11d48)" : "rgba(51,65,85,0.9)", boxShadow: on ? "0 0 12px rgba(255,59,92,0.45)" : "none" }}
      >
        {/* transform-only knob: a `layout` animation here would force Framer
            to re-measure the probe each frame and jitter the whole panel. */}
        <motion.span
          animate={{ x: on ? 15 : 0 }}
          transition={SPRING}
          className="absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow"
        />
      </span>
    </button>
  );
}

function Scope({ V, f, I, phi }: { V: number; f: number; I: number; phi: number }) {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const st = useRef({ V, f, I, phi });
  st.current = { V, f, I, phi };

  useRaf((_, t) => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = st.current;
    const omega = 2 * Math.PI * S.f;
    const T = 1 / S.f;
    const windowT = T * 2;
    const midY = h / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.14)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(100,116,139,0.8)";
    ctx.font = "9px ui-monospace, monospace";
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.fillText("0", 4, midY - 4);
    ctx.fillText(`f = ${S.f.toFixed(0)} Hz`, 4, 12);

    // traces
    const ampV = (S.V / 24) * (h / 2 - 12);
    const ampI = clamp(S.I / 0.5, 0, 1) * (h / 2 - 24);
    const draw = (amp: number, phase: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * w;
        const ph = (x / w) * windowT * omega + phase;
        const y = midY - amp * Math.sin(ph);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    draw(ampV, 0, "#ff3b5c");
    draw(ampI, -S.phi, "#22d3ee");

    // phase annotation
    const lagPx = ((S.phi / (2 * Math.PI)) * windowT) / windowT * w;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.beginPath();
    ctx.moveTo(w * 0.6, 10);
    ctx.lineTo(w * 0.6 + lagPx, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(226,232,240,0.9)";
    ctx.font = "600 10px ui-monospace, monospace";
    ctx.fillText(`φ = ${(-S.phi * 180 / Math.PI).toFixed(1)}°`, 8, h - 8);

    // sweep line
    const sx = ((t * 60) % 1) * w;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  });

  return <canvas ref={ref} className="h-44 w-full rounded-xl border border-white/10 bg-[#04120e]" />;
}

export default function ACCircuit() {
  const [V, setV] = useState(12);
  const [f, setF] = useState(60);
  const [R, setR] = useState(120);
  const [Lm, setLm] = useState(120); // mH
  const [Cu, setCu] = useState(22); // μF
  const [hasR, setHasR] = useState(true);
  const [hasL, setHasL] = useState(true);
  const [hasC, setHasC] = useState(true);

  const math = useMemo(() => {
    const XL = hasL ? 2 * Math.PI * f * (Lm / 1000) : 0;
    const XC = hasC ? 1 / (2 * Math.PI * f * Cu * 1e-6) : 0;
    const net = XL - XC;
    const Z = Math.hypot(R, net);
    const I = V / Z;
    const phi = Math.atan2(net, R);
    const f0 = hasL && hasC ? 1 / (2 * Math.PI * Math.sqrt((Lm / 1000) * (Cu * 1e-6))) : null;
    const pf = Z > 0 ? R / Z : 0;
    const S = V * I; // apparent power (VA)
    const P = S * pf; // real power (W)
    const Q = S * Math.sin(phi); // reactive power (VAR)
    return { XL, XC, net, Z, I, phi, f0, pf, S, P, Q };
  }, [V, f, R, Lm, Cu, hasL, hasC]);

  const path = "M 60 44 H 300 V 240 H 60 Z";
  const flowDur = clamp(0.9 / (math.I * 60 + 0.05), 0.35, 4);
  const f0 = math.f0;

  return (
    <div className="lab-col lab-split">
      <div className="lab-stage-pane lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">AC circuit laboratory</p>
            <p className="text-[11px] text-slate-500">
              Series R–L–C driven by an alternating source. Watch impedance and phase respond live.
            </p>
          </div>
          <span className="lab-chip">
            <Zap className="h-3.5 w-3.5 text-amber-400" /> {V} V AC · {f} Hz
          </span>
        </div>

        {/* circuit */}
        <svg viewBox="0 0 360 284" className="w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_30%,#101b30_0%,#0b1120_80%)]">
          {/* wires */}
          <path d={path} fill="none" stroke="rgba(148,163,184,0.55)" strokeWidth="2.4" />
          <path d={path} fill="none" stroke="rgba(255,59,92,0.8)" strokeWidth="2.4" className="lab-dash" />

          {/* AC source */}
          <circle cx="60" cy="44" r="26" fill="#1e293b" stroke="rgba(255,59,92,0.55)" />
          <path d="M 45 44 q 5 -9 10 0 q 5 9 10 0 q 5 -9 10 0" fill="none" stroke="#ff647c" strokeWidth="2" />
          <text x="60" y="18" fontSize="9" fill="rgba(148,163,184,0.8)" textAnchor="middle" fontFamily="monospace">AC</text>

          {/* R */}
          {hasR ? (
            <g>
              <polyline points="150,18 158,28 142,40 158,52 142,64 158,70 150,76" fill="none" stroke="#a78bfa" strokeWidth="2.4" strokeLinejoin="round" />
              <text x="150" y="92" fontSize="9" fill="rgba(167,139,250,0.9)" textAnchor="middle" fontFamily="monospace">R {R} Ω</text>
            </g>
          ) : (
            <line x1="150" y1="44" x2="150" y2="76" stroke="rgba(148,163,184,0.3)" />
          )}

          {/* L */}
          {hasL ? (
            <g>
              {[0, 1, 2, 3].map((i) => (
                <path key={i} d={`M ${208 + i * 10} 44 q 5 -7 10 0`} fill="none" stroke="#22d3ee" strokeWidth="2.2" />
              ))}
              <text x="233" y="92" fontSize="9" fill="rgba(34,211,238,0.9)" textAnchor="middle" fontFamily="monospace">L {Lm} mH</text>
            </g>
          ) : (
            <line x1="208" y1="44" x2="248" y2="44" stroke="rgba(148,163,184,0.3)" />
          )}

          {/* C */}
          {hasC ? (
            <g>
              <line x1="282" y1="30" x2="282" y2="58" stroke="#fbbf24" strokeWidth="2.4" />
              <line x1="288" y1="30" x2="288" y2="58" stroke="#fbbf24" strokeWidth="2.4" />
              <text x="285" y="92" fontSize="9" fill="rgba(251,191,36,0.9)" textAnchor="middle" fontFamily="monospace">C {Cu} μF</text>
            </g>
          ) : (
            <line x1="282" y1="44" x2="288" y2="44" stroke="rgba(148,163,184,0.3)" />
          )}

          {/* flowing electrons */}
          {[0, 0.5].map((off) => (
            <circle key={off} r="4" fill="#ff647c" opacity="0.9">
              <animateMotion dur={`${flowDur}s`} repeatCount="indefinite" begin={`${off * flowDur}s`} path={path} />
            </circle>
          ))}
          <circle r="4" fill="#22d3ee" opacity="0.9">
            <animateMotion dur={`${flowDur * 1.4}s`} repeatCount="indefinite" path={path} />
          </circle>
        </svg>

        {/* oscilloscope */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="lab-label">
              <Activity className="mr-1 inline h-3 w-3 text-[#ff647c]" /> Oscilloscope — voltage vs current
            </p>
            <span className="lab-chip">CH1 V (red) · CH2 I (cyan)</span>
          </div>
          <Scope V={V} f={f} I={math.I} phi={math.phi} />
        </div>
      </div>

      {/* controls */}
      <div className="lab-deck-pane lab-glass-deep space-y-4 p-4">
        <div>
          <p className="lab-label mb-2">Components in the loop</p>
          <div className="grid grid-cols-3 gap-2">
            <Toggle on={hasR} onChange={setHasR} label="Resistor" />
            <Toggle on={hasL} onChange={setHasL} label="Inductor" />
            <Toggle on={hasC} onChange={setHasC} label="Capacitor" />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            Short any component out to see how Z and φ react.
          </p>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">Source</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Peak voltage</span>
                <span className="lab-value text-slate-200">{V} V</span>
              </div>
              <input type="range" className="lab-range mt-1" min={1} max={24} step={0.5} value={V} onChange={(e) => setV(Number(e.target.value))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Frequency</span>
                <span className="lab-value text-slate-200">{f} Hz</span>
              </div>
              <input type="range" className="lab-range mt-1" min={50} max={5000} step={10} value={f} onChange={(e) => setF(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">Component values</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Resistance R</span>
                <span className="lab-value text-slate-200">{R} Ω</span>
              </div>
              <input type="range" className="lab-range mt-1" min={10} max={1000} step={5} value={R} onChange={(e) => setR(Number(e.target.value))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Inductance L</span>
                <span className="lab-value text-slate-200">{Lm} mH</span>
              </div>
              <input type="range" className="lab-range mt-1" min={1} max={500} step={1} value={Lm} onChange={(e) => setLm(Number(e.target.value))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Capacitance C</span>
                <span className="lab-value text-slate-200">{Cu} μF</span>
              </div>
              <input type="range" className="lab-range mt-1" min={0.1} max={100} step={0.1} value={Cu} onChange={(e) => setCu(Number(e.target.value))} />
            </div>
          </div>
        </div>

        {f0 !== null && f0 > 0 && (
          <button
            type="button"
            onClick={() => setF(Math.round(f0))}
            className="lab-btn lab-btn-neon w-full"
          >
            <Activity className="h-3.5 w-3.5" /> Set frequency to resonance ({(f0 / 1000).toFixed(1)} kHz)
          </button>
        )}

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">Live values</p>
          {[
            { k: "X_L = 2πfL", v: math.XL.toFixed(1) + " Ω" },
            { k: "X_C = 1/(2πfC)", v: math.XC.toFixed(1) + " Ω" },
            { k: "Impedance Z", v: math.Z.toFixed(1) + " Ω" },
            { k: "Current I (peak)", v: (math.I * 1000).toFixed(1) + " mA" },
            { k: "Phase φ", v: `${(math.phi * 180 / Math.PI).toFixed(1)}°` },
            { k: "Power factor", v: math.pf.toFixed(2) },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between py-1 text-[11px]">
              <span className="text-slate-500">{r.k}</span>
              <span className="lab-value text-slate-200">{r.v}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="lab-label mb-2">Power</p>
          {[
            { k: "Real P = V·I·cosφ", v: math.P.toFixed(2) + " W" },
            { k: "Reactive Q = V·I·sinφ", v: math.Q.toFixed(2) + " VAR" },
            { k: "Apparent S = V·I", v: math.S.toFixed(2) + " VA" },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between py-1 text-[11px]">
              <span className="text-slate-500">{r.k}</span>
              <span className="lab-value text-slate-200">{r.v}</span>
            </div>
          ))}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            At resonance φ = 0 and Q collapses to ~0 — all apparent power becomes real work.
          </p>
        </div>
      </div>
    </div>
  );
}