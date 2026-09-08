import BiologyExplorer from "@/components/lab/BiologyExplorer";
import ChemistryWorkspace from "@/components/lab/ChemistryWorkspace";
import PhysicsSim from "@/components/lab/PhysicsSim";
import BlobBackground from "@/components/landing/BlobBackground";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { Atom, Beaker, Dna, FlaskConical, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";

type LabTab = "physics" | "chemistry" | "biology";

const TABS: { key: LabTab; label: string; icon: typeof Atom; blurb: string }[] = [
  {
    key: "physics",
    label: "Physics",
    icon: Atom,
    blurb: "Motion, reflection and circuits — experiment with live parameters.",
  },
  {
    key: "chemistry",
    label: "Chemistry",
    icon: FlaskConical,
    blurb: "The periodic table and a reaction bench — explore matter at a tap.",
  },
  {
    key: "biology",
    label: "Biology",
    icon: Dna,
    blurb: "Zoomable cell and heart diagrams with annotated structure notes.",
  },
];

export default function Lab() {
  const [tab, setTab] = useState<LabTab>("physics");
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="relative min-h-screen">
      <BlobBackground />
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-[var(--card-border)] bg-[var(--ink)]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-text-dim transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <span className="hidden h-5 w-px bg-[var(--card-border)] sm:block" />
              <Logo markClassName="h-6 w-6" />
              <span className="hidden font-display text-sm font-bold tracking-tight text-foreground sm:inline">
                STEM Lab
              </span>
            </div>
            <ThemeToggle />
          </div>

          {/* Tab bar */}
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 pb-3 sm:px-6">
            <div className="glass-chip flex items-center gap-1 p-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={
                      "relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors sm:px-5 sm:text-[13px] " +
                      (isActive ? "text-foreground" : "text-text-dim hover:text-foreground")
                    }
                  >
                    {isActive && (
                      <motion.span
                        layoutId="lab-tab-pill"
                        className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] ring-1 ring-[var(--card-border)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon
                      className={
                        "relative z-10 h-4 w-4 " +
                        (isActive ? "text-[var(--signal)]" : "text-text-dim")
                      }
                    />
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="hidden pb-2 text-right text-[11px] leading-snug text-text-dim md:block">
              {active.blurb}
            </p>
          </div>
        </header>

        {/* Workspace */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-10">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {tab === "physics" && <PhysicsSim />}
            {tab === "chemistry" && <ChemistryWorkspace />}
            {tab === "biology" && <BiologyExplorer />}
          </motion.div>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-text-dim">
            <Beaker className="h-3.5 w-3.5 text-[var(--signal)]" />
            Manthan STEM Lab — interactive models for revision, not substitutes for a teacher.
          </p>
        </main>
      </div>
    </div>
  );
}