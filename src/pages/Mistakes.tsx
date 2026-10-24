import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { ProblemStatement } from "@/components/mathlab/parts";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FlaskConical,
  Loader2,
  RotateCcw,
  Sigma,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Mistake = {
  id: Id<"studyMistakes">;
  source: "quiz" | "practice";
  prompt: string;
  options: string[];
  answerIndex: number | null;
  correctAnswer: string | null;
  givenAnswer: string | null;
  explanation: string | null;
  materialId: string | null;
  chapter: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

function timeAgo(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function SourceChip({ source }: { source: "quiz" | "practice" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-medium text-text-dim">
      {source === "quiz" ? (
        <Sparkles className="h-3 w-3" />
      ) : (
        <Sigma className="h-3 w-3" />
      )}
      {source === "quiz" ? "Quiz" : "Practice"}
    </span>
  );
}

function QuizMistake({
  entry,
  onResolve,
  onRemove,
}: {
  entry: Mistake;
  onResolve: () => void;
  onRemove: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const correct = entry.answerIndex ?? 0;
  const chosen = picked ?? null;

  if (solved) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--signal)]/40 px-4 py-5 text-sm">
        <CheckCircle2 className="h-4 w-4 text-[var(--signal)]" />
        Correct — this one is off the list.
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-[var(--card-border)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SourceChip source="quiz" />
          {entry.chapter ? (
            <span className="truncate text-[10.5px] text-text-dim">{entry.chapter}</span>
          ) : null}
        </div>
        <span className="text-[10.5px] text-text-dim">{timeAgo(entry.createdAt)}</span>
      </div>

      <div className="mt-3 text-[14px] font-medium leading-snug">
        <ProblemStatement text={entry.prompt} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {entry.options.map((option, index) => {
          const isCorrect = index === correct;
          const isPicked = chosen === index;
          const revealed = chosen !== null;
          return (
            <button
              key={`${index}-${option}`}
              type="button"
              disabled={revealed}
              onClick={() => {
                setPicked(index);
                if (isCorrect) {
                  setSolved(true);
                  toast.success("Correct — removed from the bank");
                  onResolve();
                }
              }}
              className={
                "flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-[12.5px] leading-snug transition-colors " +
                (revealed && isCorrect
                  ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]"
                  : revealed && isPicked
                    ? "border-rose-400/40 text-text-dim"
                    : "border-[var(--card-border)] hover:border-[var(--signal)]")
              }
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] text-[9px]">
                {revealed && isCorrect ? (
                  <Check className="h-2.5 w-2.5 text-[var(--signal)]" />
                ) : revealed && isPicked ? (
                  <X className="h-2.5 w-2.5 text-rose-400" />
                ) : (
                  String.fromCharCode(65 + index)
                )}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      {chosen !== null && chosen !== correct ? (
        <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] p-3">
          <p className="text-[12px] font-medium">
            The answer is {entry.options[correct] ?? entry.correctAnswer ?? "shown in the material"}.
          </p>
          {entry.explanation ? (
            <p className="mt-1 text-[11.5px] leading-relaxed text-text-dim">
              {entry.explanation}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSolved(true);
                onResolve();
              }}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-medium transition-colors hover:text-foreground"
            >
              <Check className="h-3 w-3" />
              I understand it
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] text-text-dim transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Try again
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-[10.5px] text-text-dim transition-colors hover:text-rose-400"
          aria-label="Delete this mistake"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    </article>
  );
}

function PracticeMistake({
  entry,
  onResolve,
  onRemove,
}: {
  entry: Mistake;
  onResolve: () => void;
  onRemove: () => void;
}) {
  const grade = useAction(api.mathTutor.gradeAnswer);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<{ correct: boolean; note: string } | null>(null);

  async function check() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      const result = await grade({
        problem: entry.prompt,
        expectedAnswer: entry.correctAnswer ?? "",
        given: value,
      });
      setVerdict(result);
      if (result.correct) {
        onResolve();
      }
    } catch (error) {
      toast.error("Could not check that answer", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-[var(--card-border)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SourceChip source="practice" />
          {entry.chapter ? (
            <span className="truncate text-[10.5px] text-text-dim">{entry.chapter}</span>
          ) : null}
        </div>
        <span className="text-[10.5px] text-text-dim">{timeAgo(entry.createdAt)}</span>
      </div>

      <div className="mt-3 text-[14px] font-medium leading-snug">
        <ProblemStatement text={entry.prompt} />
      </div>

      {verdict ? (
        <div
          className={
            "mt-3 rounded-xl border p-3 " +
            (verdict.correct
              ? "border-[var(--signal)]/40"
              : "border-rose-400/30 bg-rose-500/5")
          }
        >
          <p className="text-[12px] font-medium">
            {verdict.correct ? "Correct — off the list." : "Not yet."}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-text-dim">{verdict.note}</p>
          {!verdict.correct && entry.correctAnswer ? (
            <p className="mt-2 text-[11.5px] text-text-dim">
              Correct answer: <span className="font-medium text-foreground">{entry.correctAnswer}</span>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {!verdict.correct ? (
              <button
                type="button"
                onClick={() => {
                  setVerdict(null);
                  setValue("");
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px]"
              >
                <RotateCcw className="h-3 w-3" />
                Try again
              </button>
            ) : null}
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] text-text-dim transition-colors hover:text-foreground"
            >
              <Check className="h-3 w-3" />
              Mark reviewed
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void check();
              }
            }}
            placeholder="Your answer"
            aria-label="Your answer"
            className="min-w-0 flex-1 rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--signal)]"
          />
          <button
            type="button"
            onClick={() => void check()}
            disabled={busy || !value.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--card-border)] px-4 py-2 text-[12px] font-medium transition-colors hover:border-[var(--signal)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Check
          </button>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-[10.5px] text-text-dim transition-colors hover:text-rose-400"
          aria-label="Delete this mistake"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    </article>
  );
}

export default function Mistakes() {
  const mistakes = useQuery(api.studyMistakes.list, {});
  const math = useQuery(api.mathHistory.mistakes);
  const resolve = useMutation(api.studyMistakes.resolve);
  const remove = useMutation(api.studyMistakes.remove);
  const [filter, setFilter] = useState<"all" | "quiz" | "practice">("all");

  const shown = useMemo(() => {
    const rows = (mistakes ?? []) as Mistake[];
    return filter === "all" ? rows : rows.filter((row) => row.source === filter);
  }, [filter, mistakes]);

  const counts = useMemo(() => {
    const rows = (mistakes ?? []) as Mistake[];
    return {
      all: rows.length,
      quiz: rows.filter((row) => row.source === "quiz").length,
      practice: rows.filter((row) => row.source === "practice").length,
    };
  }, [mistakes]);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
            Mistake Bank
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            The marks you can still save.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim">
            Every card is an answer you actually got wrong in a quiz or a
            practice set. Retry it here; a correct retry removes it. Nothing is
            generated, so this list can only contain real attempts.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: "All", count: counts.all },
                  { id: "quiz", label: "Quiz", count: counts.quiz },
                  { id: "practice", label: "Practice", count: counts.practice },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={filter === tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={
                    "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors " +
                    (filter === tab.id
                      ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] text-foreground"
                      : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                  }
                >
                  {tab.label}
                  <span className="ml-1.5 tabular-nums text-text-dim">{tab.count}</span>
                </button>
              ))}
            </div>
            <Link
              to="/math-lab?view=history"
              className="inline-flex items-center gap-1.5 text-[11.5px] text-text-dim transition-colors hover:text-foreground"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Maths Check-My-Work log
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {math && math.total > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-4 py-3">
              <p className="text-[12px] text-text-dim">
                <span className="font-medium text-foreground">{math.total} marked steps</span>{" "}
                across {math.attempts} checked problem{math.attempts === 1 ? "" : "s"} are
                waiting in the Maths history.
              </p>
              <Link
                to="/math-lab?view=history"
                className="text-[11px] font-medium text-[var(--signal)]"
              >
                Open history
              </Link>
            </div>
          ) : null}

          {mistakes === undefined ? (
            <div className="flex min-h-[30vh] items-center justify-center text-sm text-text-dim">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reading your attempts…
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-[var(--card-border)] px-5 py-12 text-center">
              <CheckCircle2 className="h-6 w-6 text-[var(--signal)]" />
              <p className="mt-3 font-display text-lg font-semibold">
                {counts.all === 0 ? "No wrong answers banked yet." : "Nothing in this filter."}
              </p>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-text-dim">
                Take a quiz in a notebook or a practice set in Math Lab. A wrong
                answer lands here automatically, with the exact question and a
                way to try it again.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                  Open a notebook
                </MovingBorderButton>
                <Link
                  to="/math-lab?view=practice"
                  className="inline-flex items-center rounded-full border border-[var(--card-border)] px-4 py-2.5 text-[12px] font-medium text-text-dim transition-colors hover:text-foreground"
                >
                  Practise maths
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {shown.map((entry) =>
                entry.source === "quiz" ? (
                  <QuizMistake
                    key={entry.id}
                    entry={entry}
                    onResolve={() => {
                      void resolve({ mistakeId: entry.id, resolved: true }).catch(
                        () => toast.error("Could not update that mistake"),
                      );
                    }}
                    onRemove={() => {
                      void remove({ mistakeId: entry.id }).catch(() =>
                        toast.error("Could not remove that mistake"),
                      );
                    }}
                  />
                ) : (
                  <PracticeMistake
                    key={entry.id}
                    entry={entry}
                    onResolve={() => {
                      void resolve({ mistakeId: entry.id, resolved: true }).catch(
                        () => toast.error("Could not update that mistake"),
                      );
                    }}
                    onRemove={() => {
                      void remove({ mistakeId: entry.id }).catch(() =>
                        toast.error("Could not remove that mistake"),
                      );
                    }}
                  />
                ),
              )}
            </div>
          )}

          <p className="mt-8 flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
            A wrong answer is not a verdict. It is a location — the precise place
            to spend the next five minutes.
          </p>
        </main>
        <Footer />
      </div>
    </div>
  );
}
