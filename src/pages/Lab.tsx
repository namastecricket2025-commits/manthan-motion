import BiologyVectorLab from "@/components/lab/BiologyVectorLab";
import ChemistryGlassLab from "@/components/lab/ChemistryGlassLab";
import PhysicsVectorLab from "@/components/lab/PhysicsVectorLab";
import { useSpringTransition, viewVariants } from "@/lib/motion";
import { useSettings } from "@/components/settings/SettingsProvider";
import { SearchWithGoogle } from "@/components/shared/SearchWithGoogle";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Atom, Beaker, Dna, Eye, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import "@/components/lab/apple-lab.css";

type Subject = "physics" | "chemistry" | "biology";

const SUBJECTS: Array<{
  id: Subject;
  label: string;
  icon: typeof Atom;
  blurb: string;
}> = [
  {
    id: "physics",
    label: "Physics",
    icon: Atom,
    blurb: "Vector circuits, a drop tower with live energy and an oracle, plus wave streams.",
  },
  {
    id: "chemistry",
    label: "Chemistry",
    icon: FlaskConical,
    blurb: "A complete periodic table with a profile that pushes in, plus a reaction builder and titration bench.",
  },
  {
    id: "biology",
    label: "Biology",
    icon: Dna,
    blurb: "Crisp schematics with cross-section callouts, and a processing helix.",
  },
];

/**
 * The STEM Lab.
 *
 * A dark room, two blurred colour meshes at 4% and glass — nothing else on the
 * canvas. Three environments live inside it, each one vector-first:
 * Physics (circuits / motion / dynamics / waves), Chemistry (periodic table +
 * Bohr model) and Biology (structural schematics + the DNA indicator).
 *
 * Switching subject is a state shift, so it moves on the shared spring: the
 * outgoing bench lifts away and the incoming one settles in. No blur cut, no
 * white flash, no spinner.
 */
export default function Lab() {
  const [subject, setSubject] = useState<Subject>("physics");
  const transition = useSpringTransition();
  const active = SUBJECTS.find((entry) => entry.id === subject) ?? SUBJECTS[0];
  const { settings, update } = useSettings();

  return (
    <div className="apple-lab">
      {/* The only background art: two organic meshes, floating deep. */}
      <div className="apple-lab__mesh apple-lab__mesh--violet" aria-hidden />
      <div className="apple-lab__mesh apple-lab__mesh--cyan" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 md:py-8">
        <header className="apple-lab-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/dashboard"
              className="apple-lab-btn !px-3 !py-1.5 !text-[12px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="hidden h-5 w-px bg-[var(--lab-line)] sm:block" />
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "color-mix(in srgb, var(--signal) 32%, transparent)",
                  background: "color-mix(in srgb, var(--signal) 12%, transparent)",
                  color: "var(--signal)",
                }}
              >
                <Beaker className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="apple-lab-title truncate text-[15px] leading-tight">
                  STEM Lab
                </p>
                <p className="text-[11px] leading-tight text-[var(--lab-ink-micro)]">
                  Vector models, live equations
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchWithGoogle
              topic={`${active.label} practical experiment — NCERT CBSE explained`}
              label="Search with Google"
              compact={false}
            />
            <button
              type="button"
              className="apple-lab-btn !px-3 !py-2 !text-[12px]"
              data-active={settings.eyeComfort}
              aria-pressed={settings.eyeComfort}
              onClick={() => update({ eyeComfort: !settings.eyeComfort })}
              title="Eye comfort: warm, low-glare light across the whole app"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Eye comfort {settings.eyeComfort ? "on" : "off"}
              </span>
            </button>
            <span className="apple-lab-chip">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--signal)" }}
              />
              sandboxed — nothing here touches real apparatus
            </span>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div
            className="apple-lab-tabrail"
            role="tablist"
            aria-label="STEM Lab subjects"
          >
            {SUBJECTS.map((entry) => {
              const Icon = entry.icon;
              const isActive = subject === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="apple-lab-tab"
                  onClick={() => setSubject(entry.id)}
                >
                  {isActive && (
                    <motion.span
                      layoutId="lab-subject-pill"
                      className="apple-lab-pill"
                      transition={transition}
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-4 w-4 ${isActive ? "text-[var(--signal)]" : ""}`}
                  />
                  <span className="relative z-10">{entry.label}</span>
                </button>
              );
            })}
          </div>
          <p className="apple-lab-note hidden max-w-sm text-right lg:block">
            {active.blurb}
          </p>
        </div>

        <main className="mt-5 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={subject}
              variants={viewVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={transition}
            >
              {subject === "physics" && <PhysicsVectorLab />}
              {subject === "chemistry" && <ChemistryGlassLab />}
              {subject === "biology" && <BiologyVectorLab />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] text-[var(--lab-ink-micro)]">
          <span>Manthan STEM Lab</span>
          <span>
            Interactive models for revision, not substitutes for a teacher.
          </span>
        </footer>
      </div>
    </div>
  );
}
