import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAction } from "convex/react";
import {
  Atom,
  Beaker,
  Check,
  ChevronRight,
  Dna,
  Lightbulb,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CLASSES } from "@/lib/curriculum";

export type LabSubject = "physics" | "chemistry" | "biology";

type AskQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

type AskResult = {
  title: string;
  answer: string;
  keyPoints: string[];
  misconception?: string;
  questions: AskQuestion[];
  model: string;
};

type DrillResult = {
  title: string;
  questions: AskQuestion[];
  model: string;
};

type AskMode = "ask" | "drill";

const SUBJECTS: { id: LabSubject; label: string; icon: typeof Atom }[] = [
  { id: "physics", label: "Physics", icon: Atom },
  { id: "chemistry", label: "Chemistry", icon: Beaker },
  { id: "biology", label: "Biology", icon: Dna },
];

/**
 * Which lab a NCERT science chapter belongs to. The exam syllabus keeps
 * science as one subject, but the lab is split into three benches; offering a
 * chemistry chapter under Physics would make the generated questions wrong.
 * Chemistry is tested first because "Chemical Effects of Electric Current"
 * contains both words.
 */
function chapterSubject(chapter: string): LabSubject | "both" {
  if (/chemical|acid|base|salt|metal|atom|molecule|matter|carbon|periodic|fibre|coal|petroleum|combustion/i.test(chapter)) {
    return "chemistry";
  }
  if (/light|sound|force|motion|gravitation|electric|magnetic|energy|pressure|friction|stars|natural phenomena|current|wave/i.test(chapter)) {
    return "physics";
  }
  if (/cell|tissue|life|reproduction|heredity|environment|resources|food|microorganism|crop|conservation|adolescence|control|coordination|diversity|pollution/i.test(chapter)) {
    return "biology";
  }
  return "both";
}

const PROMPTS: Record<LabSubject, string[]> = {
  physics: [
    "Why does the current fall when I add a bulb in series?",
    "How does a convex lens form a real image?",
    "Why is the magnetic field strongest at the poles?",
  ],
  chemistry: [
    "Why does copper sulphate solution fade during electrolysis?",
    "Why is baking soda added to cake batter?",
    "How does a catalyst change the rate of a reaction?",
  ],
  biology: [
    "How does a nephron filter blood?",
    "Why do we breathe faster after running?",
    "How does the heart keep oxygenated and deoxygenated blood apart?",
  ],
};

/** One MCQ with its options and the explanation revealed after a pick. */
function QuestionCard({
  item,
  index,
  choice,
  onPick,
}: {
  item: AskQuestion;
  index: number;
  choice: number | undefined;
  onPick: (index: number) => void;
}) {
  const answered = choice !== undefined;
  return (
    <article className="rounded-xl border border-[var(--card-border)] p-3.5">
      <p className="text-[12.5px] font-medium leading-relaxed">
        <span className="mr-1.5 text-text-dim">{index + 1}.</span>
        {item.question}
      </p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {item.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === item.answerIndex;
          const isPicked = choice === optionIndex;
          return (
            <button
              key={`${option}-${optionIndex}`}
              type="button"
              disabled={answered}
              onClick={() => onPick(optionIndex)}
              className={
                "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] leading-relaxed transition-colors " +
                (!answered
                  ? "border-[var(--card-border)] hover:border-[var(--text-main)]"
                  : isCorrect
                    ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                    : isPicked
                      ? "border-rose-500/50 bg-rose-500/10 text-foreground"
                      : "border-[var(--card-border)] text-text-dim opacity-70")
              }
            >
              <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase text-text-dim">
                {String.fromCharCode(65 + optionIndex)}
              </span>
              {option}
              {answered && isCorrect ? (
                <Check className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : null}
            </button>
          );
        })}
      </div>
      {answered && item.explanation ? (
        <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-text-dim">
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
          {item.explanation}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Ask the lab.
 *
 * The benches answer "what happens if"; this answers "why", then turns the
 * answer into three questions the student can answer on the spot. The drill
 * mode skips the essay and builds a short MCQ set on a chapter instead. The
 * practice set is deliberately small: a lab visit is followed by a check, not
 * a paper.
 */
export function StemAsk({
  open,
  onOpenChange,
  subject: initialSubject,
  mode: initialMode = "ask",
  seed,
  onSeedUsed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: LabSubject;
  /** The hero's two actions open the same assistant in different modes. */
  mode?: AskMode;
  /** A question from a suggested chip, typed in and submitted by the student. */
  seed?: string | null;
  onSeedUsed?: () => void;
}) {
  const ask = useAction(api.stemLab.ask);
  const drill = useAction(api.stemLab.drill);
  const [mode, setMode] = useState<AskMode>(initialMode);
  const [subject, setSubject] = useState<LabSubject>(initialSubject);
  const [className, setClassName] = useState("10");
  const [question, setQuestion] = useState("");
  const [chapter, setChapter] = useState("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "board">("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);
  const [drillResult, setDrillResult] = useState<DrillResult | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!open) return;
    setSubject(initialSubject);
    setMode(initialMode);
  }, [initialSubject, initialMode, open]);

  useEffect(() => {
    if (!open || !seed) return;
    setMode("ask");
    setQuestion(seed);
    setResult(null);
    setDrillResult(null);
    setPicked({});
    setError(null);
    onSeedUsed?.();
  }, [open, seed, onSeedUsed]);

  /** The science chapter list for the chosen class (STEM subjects share it). */
  const chapters = useMemo(() => {
    const science = CLASSES.find((entry) => entry.id === className)?.subjects.find(
      (entry) => entry.id === "science",
    );
    return (science?.chapters ?? []).filter((name) => {
      const owner = chapterSubject(name);
      return owner === subject || owner === "both";
    });
  }, [className, subject]);

  useEffect(() => {
    if (chapter && !chapters.includes(chapter)) setChapter("");
  }, [chapter, chapters]);

  const shownQuestions =
    mode === "drill" ? (drillResult?.questions ?? []) : (result?.questions ?? []);

  const score = useMemo(
    () =>
      shownQuestions.reduce(
        (total, item, index) =>
          total + (picked[index] === item.answerIndex ? 1 : 0),
        0,
      ),
    [picked, shownQuestions],
  );

  async function submit() {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDrillResult(null);
    setPicked({});
    try {
      const reply = await ask({ subject, className, question: text });
      setResult(reply as AskResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The lab could not answer that.";
      setError(message);
      toast.error("Could not answer that", { description: message });
    } finally {
      setBusy(false);
    }
  }

  async function submitDrill() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDrillResult(null);
    setPicked({});
    try {
      const reply = await drill({
        subject,
        className,
        chapter: chapter || undefined,
        count: Number(count),
        difficulty,
      });
      setDrillResult(reply as DrillResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "The lab could not build that drill.";
      setError(message);
      toast.error("Could not build the drill", { description: message });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setDrillResult(null);
    setPicked({});
    setQuestion("");
    setChapter("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-[var(--card-border)] bg-[var(--panel)] p-0 text-foreground sm:max-w-2xl">
        <DialogHeader className="border-b border-[var(--card-border)] px-5 py-4 text-left sm:px-6">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
            {mode === "ask" ? (
              <Sparkles className="h-3.5 w-3.5" />
            ) : (
              <ListChecks className="h-3.5 w-3.5" />
            )}
            {mode === "ask" ? "Ask the lab" : "Question drill"}
          </p>
          <DialogTitle className="font-display text-xl font-bold tracking-tight">
            {mode === "ask"
              ? "Ask a science question. Get an answer and a check."
              : "Build a short drill from this bench."}
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-text-dim">
            {mode === "ask"
              ? "Grounded in the CBSE Class 8–10 syllabus. Every answer ends with three questions on the same idea, so you leave the bench having recalled it, not just read it."
              : "Pick the chapter you are revising, how many questions and how hard. NCERT wording, four options, and the marking is immediate."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 sm:px-6">
          <div className="mb-4 inline-flex rounded-full border border-[var(--card-border)] p-0.5">
            {([
              { id: "ask", label: "Ask a question" },
              { id: "drill", label: "Generate questions" },
            ] as const).map((entry) => {
              const active = mode === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setMode(entry.id);
                    reset();
                  }}
                  aria-pressed={active}
                  className={
                    "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors " +
                    (active
                      ? "bg-[var(--text-main)] text-[var(--panel)]"
                      : "text-text-dim hover:text-foreground")
                  }
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-[var(--card-border)] p-0.5">
              {SUBJECTS.map((entry) => {
                const Icon = entry.icon;
                const active = subject === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSubject(entry.id)}
                    aria-pressed={active}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors " +
                      (active
                        ? "bg-[var(--text-main)] text-[var(--panel)]"
                        : "text-text-dim hover:text-foreground")
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {entry.label}
                  </button>
                );
              })}
            </div>
            <label className="ml-auto flex items-center gap-1.5 text-[11px] text-text-dim">
              Class
              <select
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                className="rounded-lg border border-[var(--card-border)] bg-transparent px-2 py-1 text-[12px] text-foreground outline-none focus:border-[var(--text-main)]"
              >
                {["8", "9", "10"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {mode === "ask" ? (
            <div className="mt-4">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
                rows={3}
                placeholder={`e.g. ${PROMPTS[subject][0]}`}
                className="w-full resize-y rounded-xl border border-[var(--card-border)] bg-transparent px-3.5 py-3 text-[13.5px] leading-relaxed outline-none placeholder:text-text-dim/70 focus:border-[var(--text-main)]"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    void submit();
                  }
                }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || question.trim().length < 8}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--text-main)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--panel)] transition-opacity disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {busy ? "Working it out…" : "Explain + practise"}
                </button>
                <span className="text-[10.5px] text-text-dim">
                  ⌘/Ctrl + Enter to send
                </span>
                {result ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-medium text-text-dim transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Ask another
                  </button>
                ) : null}
              </div>
              {!result && !busy ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PROMPTS[subject].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuestion(prompt)}
                      className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-left text-[10.5px] text-text-dim transition-colors hover:border-[var(--text-main)] hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-[11px] text-text-dim">
                Chapter
                <select
                  value={chapter}
                  onChange={(event) => setChapter(event.target.value)}
                  className="rounded-lg border border-[var(--card-border)] bg-transparent px-2.5 py-2 text-[12.5px] text-foreground outline-none focus:border-[var(--text-main)]"
                >
                  <option value="">Any chapter in this subject</option>
                  {chapters.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5 text-[11px] text-text-dim">
                  Questions
                  <select
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                    className="rounded-lg border border-[var(--card-border)] bg-transparent px-2.5 py-2 text-[12.5px] text-foreground outline-none focus:border-[var(--text-main)]"
                  >
                    {[5, 10, 15].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1.5 text-[11px] text-text-dim">
                  Level
                  <div className="inline-flex rounded-full border border-[var(--card-border)] p-0.5">
                    {(
                      [
                        { id: "easy", label: "Easy" },
                        { id: "medium", label: "Medium" },
                        { id: "board", label: "Board" },
                      ] as const
                    ).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setDifficulty(entry.id)}
                        aria-pressed={difficulty === entry.id}
                        className={
                          "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                          (difficulty === entry.id
                            ? "bg-[var(--text-main)] text-[var(--panel)]"
                            : "text-text-dim hover:text-foreground")
                        }
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void submitDrill()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--text-main)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--panel)] transition-opacity disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ListChecks className="h-4 w-4" />
                  )}
                  {busy ? "Setting the questions…" : `Generate ${count} questions`}
                </button>
                {drillResult ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-text-dim transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    New drill
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {error ? (
            <p className="mt-2 text-[12px] leading-relaxed text-rose-400">{error}</p>
          ) : null}

          {busy && !result && !drillResult ? (
            <div className="mt-5 flex flex-col gap-2 rounded-xl border border-[var(--card-border)] p-4">
              <span className="h-3 w-2/3 animate-pulse rounded bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]" />
              <span className="h-3 w-full animate-pulse rounded bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)]" />
              <span className="h-3 w-5/6 animate-pulse rounded bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)]" />
            </div>
          ) : null}

          {result && mode === "ask" ? (
            <div className="mt-5 flex flex-col gap-5">
              <section className="rounded-2xl border border-[var(--card-border)] p-4 sm:p-5">
                <h3 className="font-display text-lg font-bold tracking-tight">
                  {result.title}
                </h3>
                {result.answer.split(/\n{1,}/).map((paragraph, index) => (
                  <p
                    key={`${paragraph.slice(0, 24)}-${index}`}
                    className="mt-2.5 text-[13px] leading-relaxed text-text-dim first:mt-3"
                  >
                    {paragraph}
                  </p>
                ))}
                {result.keyPoints.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {result.keyPoints.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2 text-[12px] leading-relaxed"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-dim" />
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {result.misconception ? (
                  <p className="mt-3 flex gap-2 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] leading-relaxed text-text-dim">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-dim" />
                    <span>
                      <strong className="font-semibold text-foreground">
                        Common mistake:
                      </strong>{" "}
                      {result.misconception}
                    </span>
                  </p>
                ) : null}
              </section>

              {result.questions.length > 0 ? (
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                      <Lightbulb className="h-3.5 w-3.5 text-text-dim" />
                      Check yourself
                    </p>
                    <span className="text-[11px] tabular-nums text-text-dim">
                      {score} / {result.questions.length}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    {result.questions.map((item, index) => (
                      <QuestionCard
                        key={`${item.question.slice(0, 24)}-${index}`}
                        item={item}
                        index={index}
                        choice={picked[index]}
                        onPick={(optionIndex) =>
                          setPicked((current) => ({
                            ...current,
                            [index]: optionIndex,
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <p className="text-[10px] leading-relaxed text-text-dim">
                Generated from the syllabus, not from a textbook page. Check any
                figure against your NCERT book before you write it in an exam.
              </p>
            </div>
          ) : null}

          {drillResult && mode === "drill" ? (
            <div className="mt-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    <ListChecks className="h-3.5 w-3.5" />
                    Question drill
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold tracking-tight">
                    {drillResult.title}
                  </h3>
                </div>
                <span className="rounded-full border border-[var(--card-border)] px-3 py-1 text-[11px] font-semibold tabular-nums text-text-dim">
                  Score {score} / {drillResult.questions.length}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {drillResult.questions.map((item, index) => (
                  <QuestionCard
                    key={`${item.question.slice(0, 24)}-${index}`}
                    item={item}
                    index={index}
                    choice={picked[index]}
                    onPick={(optionIndex) =>
                      setPicked((current) => ({
                        ...current,
                        [index]: optionIndex,
                      }))
                    }
                  />
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-text-dim">
                Written to the CBSE Class {className} syllabus. If a question
                looks unfamiliar, open the chapter and check the NCERT wording
                before your exam.
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StemAsk;
