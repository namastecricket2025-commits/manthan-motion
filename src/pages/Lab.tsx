import BiologyVectorLab from "@/components/lab/BiologyVectorLab";
import ChemistryGlassLab from "@/components/lab/ChemistryGlassLab";
import PhysicsVectorLab from "@/components/lab/PhysicsVectorLab";
import { useSpringTransition, viewVariants } from "@/lib/motion";
import { SearchWithGoogle } from "@/components/shared/SearchWithGoogle";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Atom, Beaker, Dna, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import "@/components/lab/apple-lab.css";

type Subject = "physics" | "chemistry" | "biology";

const SUBJECTS: Array<{
  id: Subject;
  label: string;
  icon: typeof Atom;
}> = [
  { id: "physics", label: "Physics", icon: Atom },
  { id: "chemistry", label: "Chemistry", icon: FlaskConical },
  { id: "biology", label: "Biology", icon: Dna },
];

/**
 * The STEM Lab.
 *
 * A black room, one dot field and flat near-black panels — the same surface
 * language as the dashboard. Three environments live inside it, each one
 * vector-first:
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

  return (
    <div className="apple-lab">
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
              <p className="apple-lab-title truncate text-[15px] leading-tight">
                STEM Lab
              </p>
            </div>
          </div>
          {/* The subject rail sits in the same bar as the title. It used to
              live on its own row under the header, which left a full-width
              line holding three small tabs and a stretch of empty glass. One
              bar, one place to look for "which room am I in". */}
          <div
            className="apple-lab-tabrail order-3 w-full lg:order-none lg:w-auto"
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

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <SearchWithGoogle
              topic={`${active.label} practical experiment — NCERT CBSE explained`}
              label="Search"
              compact={false}
            />
          </div>
        </header>

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

        <footer className="mt-8 pb-2 text-[11px] text-[var(--lab-ink-micro)]">
          Manthan STEM Lab
        </footer>
      </div>
    </div>
  );
}
