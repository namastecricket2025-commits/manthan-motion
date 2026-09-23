import BiologyExplorer from "@/components/lab/BiologyExplorer";
import CanvasSolver from "@/components/lab/CanvasSolver";
import ChemistryWorkspace from "@/components/lab/ChemistryWorkspace";
import PhysicsSim from "@/components/lab/PhysicsSim";
import LiveTelemetry, { TelemetryProvider, useTelemetry } from "@/components/lab/LiveTelemetry";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { usePlan } from "@/components/plans/PlanProvider";
import { SPRING } from "@/components/lab/use-canvas";
import { isSoundEnabled, setSoundEnabled } from "@/components/lab/lab-sound";
import { Atom, Beaker, Dna, FlaskConical, ArrowLeft, Lock, Radiation, ScanSearch, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import "../components/lab/lab.css";

type LabTab = "physics" | "chemistry" | "biology" | "canvas";

const TABS: { key: LabTab; label: string; icon: typeof Atom; blurb: string }[] = [
  {
    key: "physics",
    label: "Physics",
    icon: Atom,
    blurb: "Motion, ray optics, wave interference and AC circuits.",
  },
  {
    key: "chemistry",
    label: "Chemistry",
    icon: FlaskConical,
    blurb: "3D atoms, a reaction bench and a live titration rig.",
  },
  {
    key: "biology",
    label: "Biology",
    icon: Dna,
    blurb: "Deep-zoom cell explorer, DNA transcription and heart anatomy.",
  },
  {
    key: "canvas",
    label: "AI Canvas Solver",
    icon: ScanSearch,
    blurb: "Photograph a question sheet — the beam reads it, then decomposes it.",
  },
];

/* per-tab ambient accent: drives the backdrop corner glows */
const TAB_ACCENT: Record<LabTab, { hex: string; rgba: string }> = {
  physics: { hex: "#38bdf8", rgba: "56, 189, 248" }, // deep sky — Snell/optics
  chemistry: { hex: "#a78bfa", rgba: "167, 139, 250" }, // violet — reagents
  biology: { hex: "#34d399", rgba: "52, 211, 153" }, // mint — living tissue
  canvas: { hex: "#f59e0b", rgba: "245, 158, 11" }, // amber — the scan beam
};

/* Mobile: one slim telemetry dock under the workspace — readouts + the
   governing equation in a single non-scrolling strip. */
function MobileTelemetry() {
  const feed = useTelemetry();
  if (!feed) return null;
  return (
    <div className="lab-mobile-telemetry">
      <span className="lab-mobile-telemetry__dot" style={{ background: feed.accent, boxShadow: `0 0 8px ${feed.accent}` }} />
      <span className="lab-mobile-telemetry__subject">{feed.subject}</span>
      <span className="lab-mobile-telemetry__vals">
        {feed.rows.slice(0, 3).map((r) => (
          <span key={r.k} className="lab-mobile-telemetry__val">
            {r.k} <b style={{ color: feed.accent }}>{r.v}</b>
          </span>
        ))}
      </span>
      <span className="lab-mobile-telemetry__eq">{feed.equation}</span>
    </div>
  );
}

function LabShell() {
  const [tab, setTab] = useState<LabTab>("physics");
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const active = TABS.find((t) => t.key === tab)!;
  const feed = useTelemetry();
  const accent = TAB_ACCENT[tab];
  const { can, requireAccess } = usePlan();

  /** The Canvas Solver is the one premium tab inside the lab. */
  function openTab(key: LabTab) {
    if (key === "canvas" && !requireAccess("canvasSolver")) return;
    setTab(key);
  }

  /* the publisher bus lives inside the sims; clear the readouts when a
     workspace unmounts so the sidebar never shows stale data */
  useEffect(() => {
    const root = document.querySelector(".lab-root");
    if (root) root.setAttribute("data-tab", tab);
  }, [tab]);

  return (
    <div className="lab-root" data-tab={tab}>
      {/* the same crimson atmosphere the rest of the site runs on, behind
          the lab's own blueprint matrix and per-subject accent glows */}
      {/* scientific backdrop: blueprint matrix + ambient accent glows.
          Scoped to this section (absolute, pointer-transparent) so it never
          covers the settings dashboard underneath. */}
      <div className="lab-backdrop lab-backdrop--grid" aria-hidden />
      <div className="lab-backdrop lab-backdrop--glow" aria-hidden>
        <span
          className="corner-glow corner-glow--tr"
          style={{ background: `radial-gradient(circle, rgba(${accent.rgba},0.5), transparent 65%)` }}
        />
        <span className="corner-glow corner-glow--bl" />
      </div>

      <div className="lab-shell relative z-10">
        {/* Header */}
        <header className="lab-header z-40 shrink-0 lg:sticky lg:top-0">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-[#8b93ff] hover:text-[#aab3ff]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <span className="hidden h-5 w-px bg-white/15 sm:block" />
              <Logo markClassName="h-6 w-6" />
              <span className="hidden font-display text-sm font-bold tracking-tight text-slate-100 sm:inline">
                STEM Lab
              </span>
              <span className="lab-chip hidden md:inline-flex">
                <Radiation className="h-3 w-3 text-[#aab3ff]" />
                sandboxed · no real chemicals
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !soundOn;
                  setSoundOn(next);
                  setSoundEnabled(next);
                }}
                className="lab-btn !rounded-full !p-2"
                title={soundOn ? "Mute lab sounds" : "Unmute lab sounds"}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <ThemeToggle />
            </div>
          </div>

          {/* Tab bar */}
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-3 pb-2.5 sm:px-6 sm:pb-3">
            <div className="lab-tabs">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                const gated = t.key === "canvas" && !can("canvasSolver");
                return (
                  <button key={t.key} type="button" onClick={() => openTab(t.key)} className="lab-tab">
                    {isActive && <motion.span layoutId="lab-tab-pill" className="lab-pill" transition={SPRING} />}
                    <Icon className={`relative z-10 h-4 w-4 ${isActive ? "text-[#aab3ff]" : "text-slate-500"}`} />
                    <span className="relative z-10">{t.label}</span>
                    {gated && <Lock className="relative z-10 h-3 w-3 text-slate-500" />}
                  </button>
                );
              })}
            </div>
            <p className="hidden pb-2 text-right text-[11px] leading-snug text-slate-500 md:block">{active.blurb}</p>
          </div>
        </header>

        {/* Workspace — on phones this is the only surface, and it never scrolls */}
        <main className="lab-shell__main mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="lab-fill"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "physics" && <PhysicsSim />}
              {tab === "chemistry" && <ChemistryWorkspace />}
              {tab === "biology" && <BiologyExplorer />}
              {tab === "canvas" && <CanvasSolver />}
            </motion.div>
          </AnimatePresence>

          {/* phones/tablets: slim live dock — keeps the whole lab on one screen */}
          <MobileTelemetry />

          <p className="mt-8 hidden items-center justify-center gap-2 text-center text-[11px] text-slate-500 lg:flex">
            <Beaker className="h-3.5 w-3.5 text-[#aab3ff]" />
            Manthan STEM Lab — interactive models for revision, not substitutes for a teacher.
          </p>
        </main>
      </div>

      {/* desktop: floating telemetry sidebar (≥1280px only, via CSS) */}
      {feed && <LiveTelemetry feed={feed} />}
    </div>
  );
}

export default function Lab() {
  return (
    <TelemetryProvider>
      <LabShell />
    </TelemetryProvider>
  );
}
