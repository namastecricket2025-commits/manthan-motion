import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Atom,
  Beaker,
  Dna,
  FlaskConical,
  ScanSearch,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Link } from "react-router";
import BiologyExplorer from "@/components/lab/BiologyExplorer";
import CanvasSolver from "@/components/lab/CanvasSolver";
import ChemistryWorkspace from "@/components/lab/ChemistryWorkspace";
import LiveTelemetry, {
  TelemetryProvider,
  useTelemetry,
  useTelemetrySetter,
} from "@/components/lab/LiveTelemetry";
import PhysicsSim from "@/components/lab/PhysicsSim";
import { SPRING } from "@/components/lab/use-canvas";
import { isSoundEnabled, setSoundEnabled } from "@/components/lab/lab-sound";
import "@/components/lab/lab.css";

type LabTab = "physics" | "chemistry" | "biology" | "canvas";

const SUBJECTS: Array<{
  id: LabTab;
  label: string;
  icon: typeof Atom;
  blurb: string;
}> = [
  {
    id: "physics",
    label: "Physics",
    icon: Atom,
    blurb: "Motion, ray optics, wave interference and AC circuits.",
  },
  {
    id: "chemistry",
    label: "Chemistry",
    icon: FlaskConical,
    blurb: "3D atoms, a reaction bench and a live titration rig.",
  },
  {
    id: "biology",
    label: "Biology",
    icon: Dna,
    blurb: "Deep-zoom cell explorer, DNA transcription and heart anatomy.",
  },
  {
    id: "canvas",
    label: "AI Canvas Solver",
    icon: ScanSearch,
    blurb: "Photograph a question sheet and let the beam decompose it.",
  },
];

function LabChrome() {
  const [tab, setTab] = useState<LabTab>("physics");
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const feed = useTelemetry();
  const clearTelemetry = useTelemetrySetter();
  const subject = SUBJECTS.find((entry) => entry.id === tab) ?? SUBJECTS[0];

  useEffect(() => {
    clearTelemetry(null);
  }, [clearTelemetry, tab]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <div className="lab-root" data-tab={tab}>
      <div className="lab-backdrop lab-backdrop--grid" aria-hidden="true" />
      <div className="lab-backdrop lab-backdrop--glow" aria-hidden="true">
        <span className="corner-glow corner-glow--tr" />
        <span className="corner-glow corner-glow--bl" />
      </div>

      <div className="lab-shell relative z-10">
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
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#8b93ff]/30 bg-[#8b93ff]/10 text-[#aab3ff]">
                  <Beaker className="h-4 w-4" />
                </span>
                <span className="truncate font-display text-sm font-bold tracking-tight text-slate-100 sm:text-base">STEM Lab</span>
              </div>
              <span className="lab-chip hidden md:inline-flex">sandboxed · no real chemicals</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                className="lab-btn !rounded-full !p-2"
                aria-label={soundOn ? "Mute lab sounds" : "Unmute lab sounds"}
                title={soundOn ? "Mute lab sounds" : "Unmute lab sounds"}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-3 pb-2.5 pt-4 sm:px-6 sm:pb-3 sm:pt-6">
          <div className="lab-tabs" role="tablist" aria-label="STEM Lab subjects">
            {SUBJECTS.map((entry) => {
              const Icon = entry.icon;
              const active = tab === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`lab-tab ${active ? "lab-tab--on" : ""}`}
                  onClick={() => setTab(entry.id)}
                >
                  {active && <motion.span layoutId="lab-subject-pill" className="lab-pill" transition={SPRING} />}
                  <Icon className={`relative z-10 h-4 w-4 ${active ? "text-[#aab3ff]" : "text-slate-500"}`} />
                  <span className="relative z-10">{entry.label}</span>
                </button>
              );
            })}
          </div>
          <p className="hidden max-w-sm text-right text-[11px] leading-snug text-slate-500 md:block">{subject.blurb}</p>
        </div>

        <main className="lab-shell__main mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              className="lab-fill"
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ duration: 0.36, ease: [0.25, 1, 0.5, 1] }}
            >
              {tab === "physics" && <PhysicsSim />}
              {tab === "chemistry" && <ChemistryWorkspace />}
              {tab === "biology" && <BiologyExplorer />}
              {tab === "canvas" && <CanvasSolver />}
            </motion.div>
          </AnimatePresence>

          {feed && <LiveTelemetry feed={feed} />}
        </main>

        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pb-8 text-[11px] text-slate-500 sm:px-6">
          <span>Manthan STEM Lab</span>
          <span>Interactive models for revision, not substitutes for a teacher.</span>
        </footer>
      </div>
    </div>
  );
}

export default function Lab() {
  return (
    <TelemetryProvider>
      <LabChrome />
    </TelemetryProvider>
  );
}
