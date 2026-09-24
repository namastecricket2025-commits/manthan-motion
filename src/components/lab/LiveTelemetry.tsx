import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Activity, Sigma } from "lucide-react";
import { settingsRuntime } from "@/lib/app-settings";

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
  /** accent colour for the pulse dot */
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

/**
 * Write the feed directly — used by the shell to clear stale readouts when
 * the student switches instruments, so a heart rate never outlives its lab.
 */
export function useTelemetrySetter() {
  return useContext(TelemetryCtx).setFeed;
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = useState<TelemetryFeed | null>(null);
  return <TelemetryCtx.Provider value={{ feed, setFeed }}>{children}</TelemetryCtx.Provider>;
}

/* ---------- the panel ---------- */

/**
 * The live readout.
 *
 * It used to carry a rolling canvas sparkline. A two-line trace on a wide,
 * short strip reads as a stray graph floating beside the instrument — it told
 * the student nothing the numeric rows do not, so the panel is now the numbers
 * and the governing equation only. The signal value still drives the pulse
 * dot, which is the one piece of continuous motion that earns its place.
 */
export function LiveTelemetry({ feed, embedded = false }: { feed: TelemetryFeed; embedded?: boolean }) {
  const pulse = useRef<HTMLSpanElement | null>(null);
  const feedRef = useRef(feed);
  feedRef.current = feed;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (settingsRuntime.reduceMotion) {
        // idle pulse parks in Motionless Mode
        if (pulse.current) pulse.current.style.opacity = "0.85";
        return;
      }
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
        <span className="min-w-0 flex-1 truncate" style={{ color: feed.accent }}>
          {feed.subject}
        </span>
        <span ref={pulse} className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: feed.accent }} />
      </div>
      <div className="lab-telemetry__body">
        <div>
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
