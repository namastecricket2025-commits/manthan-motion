import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Activity, Sigma } from "lucide-react";
import { clamp } from "./use-canvas";

export interface TelemetryRow {
  k: string;
  v: string;
  accent?: string;
}

export interface TelemetryFeed {
  /** short subject label, e.g. "Physics · Optics" */
  subject: string;
  rows: TelemetryRow[];
  /** the formula behind the current simulation */
  equation: string;
  eqNote: string;
  /** a live signal to plot (0..1 normalised) */
  signal: number;
  /** accent colour for the pulse dot + sparkline */
  accent: string;
}

/* ---------- telemetry bus ----------
   Sims publish their live feed; the Lab shell subscribes and renders the
   sidebar. One shared context so any depth of sub-tab can publish. */
export const TelemetryCtx = createContext<{
  feed: TelemetryFeed | null;
  setFeed: (f: TelemetryFeed | null) => void;
}>({ feed: null, setFeed: () => {} });

/** Publishes the calling simulation's live telemetry to the lab sidebar. */
export function useTelemetryPublisher() {
  return useContext(TelemetryCtx).setFeed;
}

/** Read the current feed (used by the shell to render the panel). */
export function useTelemetry() {
  return useContext(TelemetryCtx).feed;
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = useState<TelemetryFeed | null>(null);
  return <TelemetryCtx.Provider value={{ feed, setFeed }}>{children}</TelemetryCtx.Provider>;
}

/* ---------- tiny live sparkline (canvas, zero deps) ---------- */
function Spark({ feed }: { feed: TelemetryFeed }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const hist = useRef<number[]>([]);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 50) return; // ~20 fps is plenty for a sparkline
      last = now;
      const c = ref.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (!w || !h) return;
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      hist.current.push(clamp(feedRef.current.signal, 0, 1));
      if (hist.current.length > 90) hist.current.shift();
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // baseline grid
      ctx.strokeStyle = "rgba(148,163,184,0.14)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const y = (i / 3) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const pts = hist.current;
      ctx.strokeStyle = feedRef.current.accent;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = feedRef.current.accent;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = (i / (90 - 1)) * w;
        const y = h - p * (h - 4) - 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="h-9 w-full rounded-md border border-white/10 bg-black/25" />;
}

/* ---------- the panel ---------- */
export function LiveTelemetry({ feed, embedded = false }: { feed: TelemetryFeed; embedded?: boolean }) {
  const pulse = useRef<HTMLSpanElement | null>(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (pulse.current) {
        pulse.current.style.opacity = String(0.45 + 0.55 * Math.abs(Math.sin(performance.now() / 540)));
        pulse.current.style.boxShadow = `0 0 8px ${feedRef.current.accent}`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={embedded ? "lab-telemetry-embedded" : "lab-telemetry"}>
      <div className="lab-telemetry__head">
        <Activity className="h-3.5 w-3.5" style={{ color: feed.accent }} />
        <span className="min-w-0 flex-1 truncate">Live Physics / Bio Telemetry</span>
        <span ref={pulse} className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: feed.accent }} />
      </div>
      <div className="lab-telemetry__body">
        <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-slate-500">{feed.subject}</p>
        <Spark feed={feed} />
        <div className="mt-1.5">
          {feed.rows.map((r) => (
            <div key={r.k} className="lab-telemetry__row">
              <span className="k">{r.k}</span>
              <span className="v" style={r.accent ? { color: r.accent } : undefined}>
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="lab-telemetry__eq">
        <p className="lab-label mb-1 flex items-center gap-1.5">
          <Sigma className="h-3 w-3" /> Governing equation
        </p>
        <span className="eq">{feed.equation}</span>
        <p className="eq-note">{feed.eqNote}</p>
      </div>
    </div>
  );
}

export default LiveTelemetry;
