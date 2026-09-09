import BiologyExplorer from "@/components/lab/BiologyExplorer";
import ChemistryWorkspace from "@/components/lab/ChemistryWorkspace";
import PhysicsSim from "@/components/lab/PhysicsSim";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { SPRING } from "@/components/lab/use-canvas";
import { isSoundEnabled, setSoundEnabled } from "@/components/lab/lab-sound";
import { Atom, Beaker, Dna, FlaskConical, ArrowLeft, Radiation, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import "../components/lab/lab.css";

type LabTab = "physics" | "chemistry" | "biology";

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
];

export default function Lab() {
  const [tab, setTab] = useState<LabTab>("physics");
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="lab-root">
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1120]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-[#ff3b5c] hover:text-[#ff647c]"
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
                <Radiation className="h-3 w-3 text-[#ff647c]" />
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
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 pb-3 sm:px-6">
            <div className="lab-tabs">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className="lab-tab"
                  >
                    {isActive && (
                      <motion.span layoutId="lab-tab-pill" className="lab-pill" transition={SPRING} />
                    )}
                    <Icon
                      className={`relative z-10 h-4 w-4 ${isActive ? "text-[#ff647c]" : "text-slate-500"}`}
                    />
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="hidden pb-2 text-right text-[11px] leading-snug text-slate-500 md:block">
              {active.blurb}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "physics" && <PhysicsSim />}
              {tab === "chemistry" && <ChemistryWorkspace />}
              {tab === "biology" && <BiologyExplorer />}
            </motion.div>
          </AnimatePresence>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            <Beaker className="h-3.5 w-3.5 text-[#ff647c]" />
            Manthan STEM Lab — interactive models for revision, not substitutes for a teacher.
          </p>
        </main>
      </div>
    </div>
  );
}