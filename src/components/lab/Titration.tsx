import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Droplets, FlaskConical, Gauge, Play, RefreshCw, RotateCcw } from "lucide-react";
import { sfx } from "./lab-sound";
import { SPRING, useCanvasSize, useRaf, clamp } from "./use-canvas";

const PKA = 4.76;

/**
 * pH of `V0` mL of C0 M titrand after adding `vol` mL of Ct M titrant.
 * `weak` selects acetic acid (pKa 4.76) instead of HCl; the equivalence
 * pH is then the conjugate-base salt value instead of 7.00.
 */
function phAt(
  vol: number,
  mode: "acid-into-base" | "base-into-acid",
  weak: boolean,
  C0: number,
  Ct: number,
  V0: number,
): number {
  const v = clamp(vol, 0, 60);
  const V = V0 + v;
  const nFlask = C0 * V0; // mmol of base (or acid) in the flask
  const nAdd = Ct * v; // mmol of titrant added
  const Veq = nFlask / Ct;
  const saltC = nFlask / (V0 + Veq);
  const eq = weak ? 7 + 0.5 * (PKA + Math.log10(saltC)) : 7;

  if (mode === "acid-into-base") {
    // flask holds base; titrant is the acid
    const excessOH = nFlask - nAdd;
    if (v < Veq - 1e-9) return 14 + Math.log10(excessOH / V);
    if (Math.abs(v - Veq) <= 1e-9) return eq;
    // after equivalence: excess weak acid buffers the flask
    if (weak) return PKA + Math.log10(nFlask / (nAdd - nFlask));
    return -Math.log10((nAdd - nFlask) / V);
  }

  // base-into-acid: flask holds the acid
  const excessH = nFlask - nAdd;
  if (v < Veq - 1e-9) {
    if (weak) {
      // buffer region: pH = pKa + log([Ac⁻]/[HAc])
      if (v < 0.05) return 0.5 * (PKA - Math.log10(C0));
      return PKA + Math.log10(nAdd / excessH);
    }
    return -Math.log10(excessH / V);
  }
  if (Math.abs(v - Veq) <= 1e-9) return eq;
  return 14 + Math.log10((nAdd - nFlask) / V);
}

function Curve({
  vol,
  mode,
  weak,
  C0,
  Ct,
  V0,
}: {
  vol: number;
  mode: "acid-into-base" | "base-into-acid";
  weak: boolean;
  C0: number;
  Ct: number;
  V0: number;
}) {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const state = useRef({ vol, mode, weak, C0, Ct, V0 });
  state.current = { vol, mode, weak, C0, Ct, V0 };

  useRaf(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = state.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const Veq = (S.C0 * S.V0) / S.Ct;
    const X = (v: number) => (v / 60) * (w - 24) + 12;
    const Y = (p: number) => h - 14 - (clamp(p, 0, 14) / 14) * (h - 30);

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(100,116,139,0.8)";
    ctx.font = "9px ui-monospace, monospace";
    for (let p = 0; p <= 14; p += 2) {
      ctx.beginPath();
      ctx.moveTo(10, Y(p));
      ctx.lineTo(w - 10, Y(p));
      ctx.stroke();
      ctx.fillText(String(p), 2, Y(p) + 3);
    }
    for (let v = 0; v <= 60; v += 10) {
      ctx.beginPath();
      ctx.moveTo(X(v), 8);
      ctx.lineTo(X(v), h - 8);
      ctx.stroke();
      ctx.fillText(String(v), X(v) - 3, h - 2);
    }

    // full curve (faint)
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let v = 0; v <= 60; v += 0.25) {
      const p = phAt(v, S.mode, S.weak, S.C0, S.Ct, S.V0);
      const x = X(v);
      const y = Y(p);
      if (v === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // equivalence marker
    const ex = X(Veq);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,59,92,0.5)";
    ctx.beginPath();
    ctx.moveTo(ex, 8);
    ctx.lineTo(ex, h - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ff647c";
    ctx.font = "bold 10px ui-monospace, monospace";
    const eqPh = phAt(Veq, S.mode, S.weak, S.C0, S.Ct, S.V0);
    ctx.fillText(`EQ ${Veq.toFixed(1)} mL · pH ${eqPh.toFixed(2)}`, ex + 5, 18);

    // live segment
    const vNow = S.vol;
    ctx.strokeStyle = "#ff647c";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "rgba(255,59,92,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    let started = false;
    for (let v = 0; v <= vNow; v += 0.25) {
      const p = phAt(v, S.mode, S.weak, S.C0, S.Ct, S.V0);
      const x = X(v);
      const y = Y(p);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // current point
    const cx = X(vNow);
    const cy = Y(phAt(vNow, S.mode, S.weak, S.C0, S.Ct, S.V0));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff3b5c";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  return <canvas ref={ref} className="h-44 w-full rounded-xl border border-white/10 bg-[#0b1120]" />;
}

export default function Titration() {
  const [mode, setMode] = useState<"acid-into-base" | "base-into-acid">("acid-into-base");
  const [weak, setWeak] = useState(false);
  const [vol, setVol] = useState(0);
  const [angle, setAngle] = useState(0); // 0 closed → π/2 fully open
  const [C0, setC0] = useState(0.1); // flask concentration (M)
  const [Ct, setCt] = useState(0.1); // titrant concentration (M)
  const [flowRate, setFlowRate] = useState(1); // 0.5 – 3 × base drip speed
  const [indicator, setIndicator] = useState<"pp" | "mo">("pp");
  const [auto, setAuto] = useState(false);
  const [dropTick, setDropTick] = useState(0);
  const lastTick = useRef(0);

  const Veq = (C0 * 25) / Ct;
  const open = angle > 0.06;
  const flowing = (open || auto) && vol < 60;

  // valve click on open/close + drip per drop
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) sfx.click();
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (dropTick > 0) sfx.drip();
  }, [dropTick]);

  useRaf((dt, t) => {
    if (!flowing) return;
    const rate = (auto ? 4.2 : 1.7 * (angle / (Math.PI / 2))) * flowRate;
    setVol((v) => Math.min(60, v + rate * dt));
    const interval = 0.5 / flowRate;
    if (t - lastTick.current > interval) {
      lastTick.current = t;
      setDropTick((k) => k + 1);
    }
  });

  const ph = phAt(vol, mode, weak, C0, Ct, 25);
  const eqPh = phAt(Veq, mode, weak, C0, Ct, 25);

  // indicator colour
  const ppPink = clamp((ph - 8.2) / 2.3, 0, 1); // phenolphthalein: colourless < 8.2 → pink > 10.5
  const moTint = clamp((ph - 3.1) / 1.3, 0, 1); // methyl orange: red < 3.1 → yellow > 4.4
  const liquidColor =
    indicator === "pp"
      ? `rgba(244,114,182,${0.1 + ppPink * 0.85})`
      : `rgba(251,146,60,${0.12 + (1 - moTint) * 0.55})`;

  const excessOH = mode === "acid-into-base" ? C0 * 25 - Ct * vol : Ct * vol - C0 * 25;
  const inBuffer = weak && mode === "base-into-acid" && vol > 0.1 && vol < Veq - 0.1;
  const status = inBuffer
    ? "Buffer region — the CH₃COOH / CH₃COO⁻ pair resists pH change (Henderson–Hasselbalch)"
    : vol < Veq - 0.05
      ? mode === "acid-into-base"
        ? "Before equivalence — excess OH⁻ keeps the flask basic"
        : weak
          ? "Before equivalence — partial neutralisation forms the acetate buffer"
          : "Before equivalence — excess H⁺ keeps the flask acidic"
      : vol > Veq + 0.05
        ? mode === "acid-into-base"
          ? weak
            ? "After equivalence — excess weak acid buffers the flask near pH 4.8"
            : "After equivalence — excess H⁺ turns the flask acidic"
          : "After equivalence — excess OH⁻ turns the flask basic"
        : weak
          ? `At equivalence — all acid neutralised; the salt solution sits at pH ${eqPh.toFixed(2)}`
          : "At equivalence — acid and base are exactly neutralised (pH 7)";

  const handleRotate = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as SVGGElement).ownerSVGElement!.getBoundingClientRect();
    const sx = rect.left + (60 / 120) * rect.width;
    const sy = rect.top + (266 / 330) * rect.height;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    const a = clamp(Math.PI - Math.atan2(dy, dx), 0, Math.PI / 2);
    setAngle(a);
  };

  const reset = () => {
    setVol(0);
    setAngle(0);
    setAuto(false);
  };

  const level = 252 - (vol / 60) * 238;

  const acidFormula = weak ? "CH₃COOH" : "HCl";
  const flaskLabel = mode === "acid-into-base" ? `NaOH · ${C0.toFixed(2)} M` : `${acidFormula} · ${C0.toFixed(2)} M`;
  const titrantLabel = mode === "acid-into-base" ? `${acidFormula} · ${Ct.toFixed(2)} M` : `NaOH · ${Ct.toFixed(2)} M`;

  return (
    <div className="lab-col lab-split lab-split--side-left">
      {/* apparatus */}
      <div className="lab-stage-pane lab-glass flex flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-100">Apparatus</p>
          <span className="lab-chip">
            <Droplets className="h-3 w-3 text-cyan-300" />
            {mode === "acid-into-base" ? `${acidFormula} → NaOH` : `NaOH → ${acidFormula}`}
          </span>
        </div>

        {/* acid system selector */}
        <div className="lab-tabs mb-3 self-start">
          {(
            [
              { key: false, label: "Strong · HCl" },
              { key: true, label: "Weak · acetic" },
            ] as const
          ).map((a) => (
            <button
              key={String(a.key)}
              type="button"
              onClick={() => {
                setWeak(a.key);
                reset();
              }}
              className={`lab-tab !py-1.5 !text-[11px] ${weak === a.key ? "lab-tab--on" : ""}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="relative mx-auto flex w-full max-w-[220px] items-end justify-center gap-2">
          {/* burette */}
          <svg viewBox="0 0 120 330" className="w-[92px] shrink-0">
            <defs>
              <linearGradient id="bur-glass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="rgba(148,163,184,0.28)" />
                <stop offset="0.5" stopColor="rgba(226,232,240,0.12)" />
                <stop offset="1" stopColor="rgba(148,163,184,0.3)" />
              </linearGradient>
            </defs>
            <rect x="42" y="8" width="36" height="252" rx="5" fill="url(#bur-glass)" stroke="rgba(148,163,184,0.4)" strokeWidth="1" />
            <rect x="44" y={level} width="32" height={252 - level + 4} rx="3" fill="rgba(103,232,249,0.18)" />
            <line x1="44" y1={level} x2="76" y2={level} stroke="rgba(165,243,252,0.6)" strokeWidth="1.4" />
            {Array.from({ length: 13 }, (_, i) => {
              const y = 8 + (i * 238) / 12;
              return (
                <g key={i}>
                  <line x1="36" y1={y} x2="42" y2={y} stroke="rgba(148,163,184,0.5)" />
                  {i % 2 === 0 && (
                    <text x="30" y={y + 3} fontSize="8" fill="rgba(148,163,184,0.8)" textAnchor="end" fontFamily="monospace">
                      {Math.round((i * 60) / 12)}
                    </text>
                  )}
                </g>
              );
            })}
            <path d="M52 256 L60 286 L68 256 Z" fill="url(#bur-glass)" stroke="rgba(148,163,184,0.45)" strokeWidth="1" />
            <circle cx="60" cy="262" r="9" fill="rgba(15,23,42,0.8)" stroke="rgba(148,163,184,0.5)" />
            <g
              style={{ transformOrigin: "60px 262px", transform: `rotate(${angle}rad)`, cursor: "grab" }}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture(e.pointerId);
                handleRotate(e);
              }}
              onPointerMove={(e) => e.buttons > 0 && handleRotate(e)}
            >
              <line x1="60" y1="262" x2="42" y2="262" stroke="#ff647c" strokeWidth="3" strokeLinecap="round" />
              <circle cx="42" cy="262" r="3.5" fill="#ff647c" />
            </g>
            {flowing && (
              <circle key={dropTick} cx="60" cy="292" r="2.6" fill="rgba(165,243,252,0.9)">
                <animate attributeName="cy" from="292" to="322" dur="0.55s" repeatCount="1" />
                <animate attributeName="opacity" from="0.95" to="0" dur="0.55s" repeatCount="1" />
              </circle>
            )}
          </svg>

          {/* flask */}
          <div className="flex flex-col items-center">
            <span className="mb-1 text-[9px] uppercase tracking-widest text-slate-500">
              Flask · 25 mL {flaskLabel}
            </span>
            <svg viewBox="0 0 110 150" className="w-[110px]">
              <defs>
                <clipPath id="flask-clip">
                  <path d="M30 0 h50 v62 a25 25 0 0 1 14 14 l12 56 a8 8 0 0 1 -8 10 h-86 a8 8 0 0 1 -8 -10 l12 -56 a25 25 0 0 1 14 -14 Z" />
                </clipPath>
              </defs>
              <g clipPath="url(#flask-clip)">
                <rect x="0" y="66" width="110" height="90" fill={liquidColor} />
                <rect x="0" y="66" width="110" height="6" fill="rgba(255,255,255,0.14)" />
              </g>
              <path
                d="M30 0 h50 v62 a25 25 0 0 1 14 14 l12 56 a8 8 0 0 1 -8 10 h-86 a8 8 0 0 1 -8 -10 l12 -56 a25 25 0 0 1 14 -14 Z"
                fill="rgba(148,163,184,0.08)"
                stroke="rgba(148,163,184,0.4)"
                strokeWidth="1.6"
              />
              <line x1="40" y1="52" x2="70" y2="52" stroke="rgba(226,232,240,0.35)" strokeWidth="1" />
              <text x="55" y="120" textAnchor="middle" fontSize="10" fill={indicator === "pp" ? (ppPink > 0.3 ? "#f9a8d4" : "rgba(226,232,240,0.75)") : "rgba(226,232,240,0.85)"} fontFamily="monospace">
                pH {ph.toFixed(2)}
              </text>
            </svg>
            <span className="lab-chip mt-1">
              {indicator === "pp" ? "Phenolphthalein" : "Methyl orange"}
            </span>
          </div>
        </div>

        {/* indicator choice */}
        <div className="lab-tabs mt-3 self-start">
          {(
            [
              { key: "pp", label: "Phenolphthalein" },
              { key: "mo", label: "Methyl orange" },
            ] as const
          ).map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setIndicator(a.key)}
              className={`lab-tab !py-1.5 !text-[11px] ${indicator === a.key ? "lab-tab--on" : ""}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => { setMode((m) => (m === "acid-into-base" ? "base-into-acid" : "acid-into-base")); reset(); }} className="lab-btn">
            <RotateCcw className="h-3.5 w-3.5" /> Swap roles
          </button>
          <button type="button" onClick={() => { setAuto((a) => !a); if (!auto) setAngle(0); }} className={`lab-btn ${auto ? "lab-btn--active" : ""}`}>
            {auto ? <Play className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />}
            {auto ? "Stop auto" : "Auto-titrate"}
          </button>
          <button type="button" onClick={reset} className="lab-btn">
            <RefreshCw className="h-3.5 w-3.5" /> Refill
          </button>
        </div>

        {/* concentrations */}
        <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Flask conc. ({mode === "acid-into-base" ? "NaOH" : acidFormula})</span>
              <span className="lab-value text-slate-200">{C0.toFixed(2)} M</span>
            </div>
            <input type="range" className="lab-range mt-1" min={0.02} max={0.5} step={0.01} value={C0} onChange={(e) => { setC0(Number(e.target.value)); reset(); }} />
          </div>
          <div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Titrant conc. ({mode === "acid-into-base" ? acidFormula : "NaOH"})</span>
              <span className="lab-value text-slate-200">{Ct.toFixed(2)} M</span>
            </div>
            <input type="range" className="lab-range mt-1" min={0.02} max={0.5} step={0.01} value={Ct} onChange={(e) => { setCt(Number(e.target.value)); reset(); }} />
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Equivalence volume = C·V/c = <span className="lab-value text-slate-300">{Veq.toFixed(1)} mL</span> — it moves when you change the concentrations.
          </p>
        </div>

        {/* flow rate */}
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Drip speed</span>
            <span className="lab-value text-slate-200">{flowRate.toFixed(1)}×</span>
          </div>
          <input type="range" className="lab-range mt-1" min={0.5} max={3} step={0.1} value={flowRate} onChange={(e) => setFlowRate(Number(e.target.value))} />
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-500">
          {auto
            ? "Auto-titrating at 4.2 mL/s — watch the curve sweep to equivalence."
            : open
              ? "Valve open — drag the handle to control the drip."
              : "Grab the red handle and pull it downward to open the valve."}
        </p>
      </div>

      {/* readouts + curve */}
      <div className="lab-deck-pane lab-glass flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Titrant added", v: `${vol.toFixed(1)} mL` },
            { k: "pH", v: ph.toFixed(2) },
            { k: "Equivalence", v: `${Veq.toFixed(1)} mL` },
            {
              k: "Indicator",
              v: indicator === "pp" ? (ppPink > 0.5 ? "Pink" : "Colourless") : moTint > 0.5 ? "Yellow" : moTint > 0.15 ? "Orange" : "Red",
            },
          ].map((r) => (
            <motion.div
              key={r.k}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <p className="lab-label">{r.k}</p>
              <p className="lab-value mt-1 text-sm">{r.v}</p>
            </motion.div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-100">pH titration curve</p>
            <span className="lab-chip">
              <FlaskConical className="h-3 w-3 text-violet-300" />
              {weak ? `weak acid · buffer region · EQ pH ${eqPh.toFixed(2)}` : "strong acid · sharp endpoint"}
            </span>
          </div>
          <Curve vol={vol} mode={mode} weak={weak} C0={C0} Ct={Ct} V0={25} />
          <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="lab-pulse inline-block h-1.5 w-1.5 rounded-full bg-[#ff3b5c]" />
            {status}
          </p>
          {indicator === "mo" && (
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Methyl orange flips red → yellow between pH 3.1–4.4 — it suits the strong-acid endpoint but would change colour before a weak-acid equivalence (pH {eqPh.toFixed(2)}).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}