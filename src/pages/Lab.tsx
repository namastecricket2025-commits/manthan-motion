import BiologyVectorLab from "@/components/lab/BiologyVectorLab";
import ChemistryGlassLab from "@/components/lab/ChemistryGlassLab";
import PhysicsVectorLab from "@/components/lab/PhysicsVectorLab";
import { useSpringTransition, viewVariants } from "@/lib/motion";
import { useResolvedTheme } from "@/lib/app-settings";
import { SearchWithGoogle } from "@/components/shared/SearchWithGoogle";
import { StemAsk } from "@/components/lab/StemAsk";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  Beaker,
  Dna,
  FlaskConical,
  ListChecks,
  Mic,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import "@/components/lab/apple-lab.css";

type Subject = "physics" | "chemistry" | "biology";

/** One question per bench, to show what "ask the lab" is for. */
const QUICK_ASK: Record<Subject, string> = {
  physics: "Why does the current fall when I add a bulb in series?",
  chemistry: "Why does copper sulphate solution fade during electrolysis?",
  biology: "How does a nephron filter blood?",
};

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
 * The room follows the site theme: a dark dashboard opens a dark lab, a light
 * dashboard opens a paper one. The benches still carry their own switch for
 * reading a single plate in daylight, but nobody is dropped into a black room
 * from a light account.
 *
 * Switching subject is a state shift, so it moves on the shared spring: the
 * outgoing bench lifts away and the incoming one settles in. No blur cut, no
 * white flash, no spinner.
 */
export default function Lab() {
  const [subject, setSubject] = useState<Subject>("physics");
  const [askOpen, setAskOpen] = useState(false);
  const [askMode, setAskMode] = useState<"ask" | "drill">("ask");
  const [askSeed, setAskSeed] = useState<string | null>(null);
  const transition = useSpringTransition();
  const theme = useResolvedTheme();
  const active = SUBJECTS.find((entry) => entry.id === subject) ?? SUBJECTS[0];

  function openAssistant(mode: "ask" | "drill") {
    setAskMode(mode);
    setAskOpen(true);
  }

  return (
    <div className="apple-lab" data-lab-theme={theme}>
      {/* The math lab's top wash, in the lab's own room: two radials centred
          above the viewport edge, spent before the first panel arrives. */}
      <div className="apple-lab-glow" aria-hidden="true" />
      <div
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 md:py-8"
        data-lab-theme={theme}
      >
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
                  borderColor: "var(--lab-line)",
                  background: "var(--lab-fill)",
                  color: "var(--lab-ink)",
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
                    className={`relative z-10 h-4 w-4 ${isActive ? "text-[var(--lab-ink)]" : ""}`}
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

        <section className="apple-lab-glass mt-4 rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="apple-lab-micro">Physics · Chemistry · Biology</p>
              <h1 className="apple-lab-title mt-1 text-[24px] leading-tight sm:text-[28px]">
                Try it, break it, then ask why.
              </h1>
              <p className="apple-lab-note mt-1.5 max-w-2xl">
                Run a circuit, tilt an organ or heat a reaction — then ask the
                lab the question the bench cannot answer. Every answer ends
                with three questions so the idea stays.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="apple-lab-btn apple-lab-btn--solid"
                onClick={() => openAssistant("ask")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask the lab
              </button>
              <button
                type="button"
                className="apple-lab-btn"
                onClick={() => openAssistant("drill")}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Quick drill
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--lab-ink-micro)]">
              Try asking
            </span>
            <button
              type="button"
              onClick={() => {
                setAskMode("ask");
                setAskSeed(QUICK_ASK[subject]);
                setAskOpen(true);
              }}
              className="apple-lab-chip max-w-full text-left transition-colors hover:text-[var(--lab-ink)]"
            >
              <span className="truncate">{QUICK_ASK[subject]}</span>
            </button>
          </div>
        </section>

        {/* Three things the lab can do beyond the bench. They sit above the
            apparatus rather than in a menu, because the question a student has
            after turning a dial is the part the dial cannot answer. */}
        <section className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => openAssistant("ask")}
            className="apple-lab-card group flex items-start gap-3 rounded-2xl border border-[var(--lab-line)] p-3.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--lab-ink)_30%,transparent)]"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--lab-line)", background: "var(--lab-fill)" }}
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-[var(--lab-ink)]">
                Ask any “why”
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--lab-ink-micro)]">
                An answer, the key points, and three checks.
              </span>
            </span>
            <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90" />
          </button>

          <button
            type="button"
            onClick={() => openAssistant("drill")}
            className="apple-lab-card group flex items-start gap-3 rounded-2xl border border-[var(--lab-line)] p-3.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--lab-ink)_30%,transparent)]"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--lab-line)", background: "var(--lab-fill)" }}
            >
              <ListChecks className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-[var(--lab-ink)]">
                Question drill
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--lab-ink-micro)]">
                5–15 MCQs from any chapter, marked instantly.
              </span>
            </span>
            <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90" />
          </button>

          <Link
            to="/viva"
            className="apple-lab-card group flex items-start gap-3 rounded-2xl border border-[var(--lab-line)] p-3.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--lab-ink)_30%,transparent)]"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--lab-line)", background: "var(--lab-fill)" }}
            >
              <Mic className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-[var(--lab-ink)]">
                Voice viva
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--lab-ink-micro)]">
                Explain it aloud and get marked on the reasoning.
              </span>
            </span>
            <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90" />
          </Link>
        </section>

        <main className="mt-4 flex-1">
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

      {/* Mounted only while open: each visit starts from the subject, mode
          and seed in hand, and the seed is spent on close so reopening "Ask
          the lab" gives a clean box instead of the old chip's question. */}
      {askOpen ? (
        <StemAsk
          open
          onOpenChange={(next) => {
            setAskOpen(next);
            if (!next) setAskSeed(null);
          }}
          subject={subject}
          mode={askMode}
          seed={askSeed}
        />
      ) : null}
    </div>
  );
}
