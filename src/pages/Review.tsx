import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { MaterialSourcePeek } from "@/components/dashboard/SourcePeek";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Brain,
  Check,
  Clock,
  FileSearch,
  Flame,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Rating = "again" | "hard" | "good" | "easy";

type ReviewCard = {
  id: Id<"reviewCards">;
  materialId: Id<"materials"> | null;
  notebookId: Id<"notebooks"> | null;
  kind: "flashcard" | "quiz" | "practice";
  prompt: string;
  answer: string;
  options: string[];
  answerIndex: number | null;
  explanation: string | null;
  source: string | null;
  dueAt: number;
  intervalDays: number;
  reps: number;
  lapses: number;
};

const RATINGS: { id: Rating; label: string; hint: string; tone: string }[] = [
  { id: "again", label: "Again", hint: "in 10 min", tone: "text-rose-400" },
  { id: "hard", label: "Hard", hint: "shorter gap", tone: "text-amber-400" },
  { id: "good", label: "Good", hint: "normal gap", tone: "text-[var(--signal)]" },
  { id: "easy", label: "Easy", hint: "longer gap", tone: "text-emerald-400" },
];

function KindChip({ kind }: { kind: ReviewCard["kind"] }) {
  const label =
    kind === "flashcard" ? "Flashcard" : kind === "quiz" ? "Quiz" : "Practice";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-medium text-text-dim">
      {kind === "flashcard" ? (
        <Brain className="h-3 w-3" />
      ) : kind === "quiz" ? (
        <Sparkles className="h-3 w-3" />
      ) : (
        <Flame className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}

export default function Review() {
  const summary = useQuery(api.review.summary);
  const due = useQuery(api.review.queue, { limit: 60 });
  const ensure = useMutation(api.review.ensure);
  const gradeCard = useMutation(api.review.grade);

  const [building, setBuilding] = useState(true);
  const [session, setSession] = useState<ReviewCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const [peek, setPeek] = useState<{
    materialId: Id<"materials">;
    sourceName: string;
  } | null>(null);

  const current = session?.[index] ?? null;
  const total = session?.length ?? 0;

  useEffect(() => {
    let live = true;
    void ensure({})
      .catch(() => {
        /* The page can still show whatever was already scheduled. */
      })
      .finally(() => {
        if (live) setBuilding(false);
      });
    return () => {
      live = false;
    };
  }, [ensure]);

  useEffect(() => {
    if (!session && due && due.length > 0) {
      setSession(due as ReviewCard[]);
    }
  }, [due, session]);

  const nextInterval = useMemo(() => {
    if (!current) return "—";
    if (current.reps === 0) return "first review";
    return `seen ${current.reps} time${current.reps === 1 ? "" : "s"}`;
  }, [current]);

  async function rate(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await gradeCard({ cardId: current.id, rating });
      setDone((value) => value + 1);
      if (rating === "again") setAgain((value) => value + 1);
      setRevealed(false);
      setPicked(null);
      setIndex((value) => value + 1);
    } catch (error) {
      toast.error("Could not save that review", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  function answerQuiz(option: number) {
    if (picked !== null) return;
    setPicked(option);
    setRevealed(true);
  }

  function restart() {
    setSession(null);
    setIndex(0);
    setRevealed(false);
    setPicked(null);
    setDone(0);
    setAgain(0);
  }

  const finished = session !== null && index >= session.length;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
            Daily review
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            A little every day.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim">
            Cards come from your own flashcards, quizzes and Maths practice
            mistakes. Each answer decides when you see it again — the aim is
            recall just before you would forget, not a pile of new material.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim">
              <Clock className="h-3 w-3 text-[var(--signal)]" />
              {summary?.due ?? 0} due
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim">
              <Brain className="h-3 w-3 text-[var(--signal)]" />
              {summary?.total ?? 0} in the queue
            </span>
            {session ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim">
                <Check className="h-3 w-3 text-[var(--signal)]" />
                {done} answered this session
              </span>
            ) : null}
          </div>

          {building || due === undefined ? (
            <div className="mt-10 flex min-h-[30vh] items-center justify-center text-sm text-text-dim">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building today's queue…
            </div>
          ) : !session && (summary?.total ?? 0) === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-[var(--card-border)] px-5 py-12 text-center">
              <Brain className="h-6 w-6 text-[var(--signal)]" />
              <p className="mt-3 font-display text-lg font-semibold">
                Nothing in the queue yet.
              </p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-text-dim">
                Generate flashcards or a quiz in a notebook, or miss a question
                in the Mistake Bank. Those are the cards this page schedules.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                  Open a notebook
                </MovingBorderButton>
                <Link
                  to="/mistakes"
                  className="inline-flex items-center rounded-full border border-[var(--card-border)] px-4 py-2.5 text-[12px] font-medium text-text-dim transition-colors hover:text-foreground"
                >
                  Mistake Bank
                </Link>
              </div>
            </div>
          ) : finished ? (
            <section className="mt-8 rounded-2xl border border-[var(--card-border)] p-6 text-center sm:p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--signal)]/40 text-[var(--signal)]">
                <Check className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
                Session complete.
              </h2>
              <p className="mt-2 text-sm text-text-dim">
                {done} card{done === 1 ? "" : "s"} reviewed
                {again > 0 ? ` · ${again} marked “again”` : " · none marked again"}.
                {again > 0
                  ? " Those will return in about ten minutes."
                  : " The next cards will appear when they are due."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2.5 text-[12px] font-medium transition-colors hover:border-[var(--signal)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Check again
                </button>
                <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                  Back to dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </MovingBorderButton>
              </div>
            </section>
          ) : !session ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-[var(--card-border)] px-5 py-12 text-center">
              <Clock className="h-6 w-6 text-[var(--signal)]" />
              <p className="mt-3 font-display text-lg font-semibold">
                Nothing due right now.
              </p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-text-dim">
                You have {summary?.total ?? 0} card
                {summary?.total === 1 ? "" : "s"} scheduled. The next one will
                appear here when it is time to recall it.
              </p>
              <div className="mt-5">
                <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                  Back to dashboard
                </MovingBorderButton>
              </div>
            </div>
          ) : current ? (
            <>
              <div className="mt-6 flex items-center justify-between gap-3 text-[11px] text-text-dim">
                <span>
                  Card {index + 1} of {total}
                </span>
                <span>{nextInterval}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]">
                <div
                  className="h-full rounded-full bg-[var(--signal)] transition-[width] duration-300"
                  style={{ width: `${total ? (index / total) * 100 : 0}%` }}
                />
              </div>

              <section className="mt-5 rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <KindChip kind={current.kind} />
                  <div className="flex items-center gap-2">
                    {current.source && current.materialId ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPeek({
                            materialId: current.materialId as Id<"materials">,
                            sourceName: current.source as string,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground"
                      >
                        <FileSearch className="h-3 w-3" />
                        Source
                      </button>
                    ) : current.source ? (
                      <span className="truncate text-[10px] text-text-dim">
                        {current.source}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-5 font-display text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                  {current.prompt}
                </p>

                {current.kind === "quiz" && current.options.length > 0 ? (
                  <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                    {current.options.map((option, optionIndex) => {
                      const isCorrect = optionIndex === current.answerIndex;
                      const isPicked = picked === optionIndex;
                      const show = picked !== null;
                      return (
                        <li key={`${optionIndex}-${option}`}>
                          <button
                            type="button"
                            disabled={show}
                            onClick={() => answerQuiz(optionIndex)}
                            className={
                              "flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] leading-snug transition-colors " +
                              (show && isCorrect
                                ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                                : show && isPicked
                                  ? "border-rose-400/40 text-text-dim"
                                  : "border-[var(--card-border)] hover:border-[var(--signal)]")
                            }
                          >
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] text-[9px]">
                              {show && isCorrect ? (
                                <Check className="h-2.5 w-2.5 text-[var(--signal)]" />
                              ) : show && isPicked ? (
                                <X className="h-2.5 w-2.5 text-rose-400" />
                              ) : (
                                String.fromCharCode(65 + optionIndex)
                              )}
                            </span>
                            {option}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {current.kind !== "quiz" && !revealed ? (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2 text-[12px] font-medium transition-colors hover:border-[var(--signal)]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--signal)]" />
                    Show the answer
                  </button>
                ) : null}

                {revealed ? (
                  <div className="mt-5 rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--signal)]">
                      {current.kind === "quiz" ? "Answer" : "The answer"}
                    </p>
                    <p className="mt-1.5 text-[14px] leading-relaxed">{current.answer}</p>
                    {current.explanation ? (
                      <p className="mt-2 text-[12px] leading-relaxed text-text-dim">
                        {current.explanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {revealed ? (
                  <div className="mt-5">
                    <p className="text-[10.5px] text-text-dim">
                      How well did you remember it?
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {RATINGS.map((rating) => (
                        <button
                          key={rating.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void rate(rating.id)}
                          className="flex flex-col items-start rounded-xl border border-[var(--card-border)] px-3 py-2.5 text-left transition-colors hover:border-[var(--signal)] disabled:opacity-50"
                        >
                          <span className={"text-[12px] font-semibold " + rating.tone}>
                            {rating.label}
                          </span>
                          <span className="mt-0.5 text-[10px] text-text-dim">
                            {rating.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          <p className="mt-8 text-[11px] leading-relaxed text-text-dim">
            The schedule is stored on your account, so a review done on your
            phone is already counted when you open this on a laptop. “Again”
            returns in ten minutes; the other ratings space themselves out.
          </p>
        </main>
        <Footer />
      </div>

      {peek ? (
        <MaterialSourcePeek
          materialId={peek.materialId}
          sourceName={peek.sourceName}
          onClose={() => setPeek(null)}
        />
      ) : null}
    </div>
  );
}
