import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { Logo } from "@/components/landing/Logo";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CLASSES,
  describePlan,
  findClass,
  findSubject,
  paperPlan,
  type ClassId,
  type PaperKind,
  type SubjectId,
} from "@/lib/curriculum";
import { boardBank, hasBoardQuestions } from "@/lib/boardBank";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Question = {
  id: string;
  section: string;
  type: "mcq" | "short" | "long";
  marks: number;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  modelAnswer?: string;
  markingPoints?: string[];
  /** Student-facing tag, e.g. "BOARD 2024". */
  source?: string;
  /** Full paper reference shown on hover. */
  sourceDetail?: string;
};

type ReportResult = {
  id: string;
  prompt: string;
  type: Question["type"];
  marks: number;
  awarded: number;
  given: string;
  correctAnswer?: string;
  modelAnswer?: string;
  markingPoints?: string[];
  feedback?: string;
  correct?: boolean;
};

type Report = {
  results: ReportResult[];
  objectiveScore: number;
  objectiveMax: number;
  writtenScore: number;
  writtenMax: number;
  total: number;
  max: number;
  percent: number;
  summary: string;
  gradedAt: number;
};

type SyllabusMeta = {
  className: string;
  subject: string;
  chapters: string[];
  paperKind: string;
};

type Exam = {
  id: Id<"mockExams">;
  notebookId: Id<"notebooks"> | null;
  syllabus: SyllabusMeta | null;
  notebookName: string;
  title: string;
  instructions: string;
  pattern: "objective" | "board";
  durationMinutes: number;
  totalMarks: number;
  status: "ready" | "in_progress" | "submitted" | "graded";
  startedAt: number | null;
  endsAt: number | null;
  submittedAt: number | null;
  objectiveScore: number | null;
  score: number | null;
  report: Report | null;
  responses: Record<string, string | number>;
  now: number;
  questions: Question[];
};

type ExamRow = {
  id: Id<"mockExams">;
  title: string;
  notebookName: string;
  syllabus: SyllabusMeta | null;
  pattern: "objective" | "board";
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  status: Exam["status"];
  score: number | null;
  createdAt: number;
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const STATUS_LABEL: Record<Exam["status"], string> = {
  ready: "Ready",
  in_progress: "In progress",
  submitted: "Marking",
  graded: "Marked",
};

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isAnswered(value: string | number | undefined) {
  return value !== undefined && value !== null && value !== "";
}

function examDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function Exam() {
  const notebooks = useQuery(api.notebooks.list);
  const recent = useQuery(api.exams.list);
  const generatePaper = useAction(api.examStudio.generate);
  const markPaper = useAction(api.examStudio.grade);
  const beginExam = useMutation(api.exams.begin);
  const saveResponses = useMutation(api.exams.saveResponses);
  const submitExam = useMutation(api.exams.submit);

  const [source, setSource] = useState<"syllabus" | "notebook">("syllabus");
  const [className, setClassName] = useState<ClassId>("10");
  const [subjectId, setSubjectId] = useState<SubjectId>("science");
  const [chapters, setChapters] = useState<string[]>([]);
  const [paperKind, setPaperKind] = useState<PaperKind>("board");
  const [notebookId, setNotebookId] = useState("");
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [pattern, setPattern] = useState<"objective" | "board">("board");
  const [examId, setExamId] = useState<Id<"mockExams"> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [tick, setTick] = useState(Date.now());

  const hydrated = useRef<string | null>(null);
  const submittingRef = useRef(false);

  const exam = useQuery(
    api.exams.get,
    examId ? { examId } : "skip",
  ) as Exam | null | undefined;

  const effectiveDuration = customDuration.trim()
    ? Math.round(Number(customDuration))
    : duration;
  const durationValid =
    Number.isFinite(effectiveDuration) &&
    effectiveDuration >= 5 &&
    effectiveDuration <= 300 &&
    (pattern === "objective" || effectiveDuration >= 15);

  const syllabusClass = findClass(className);
  const syllabusSubject = findSubject(className, subjectId);
  // A half-typed custom duration must not print "NaN questions".
  const plan = paperPlan(
    Number.isFinite(effectiveDuration) ? effectiveDuration : duration,
    pattern,
  );
  const availableBank = boardBank(className, subjectId).filter(
    (item) => chapters.length === 0 || chapters.includes(item.chapter),
  ).length;
  const realQuestions = hasBoardQuestions(className, subjectId, chapters);
  const readyToGenerate =
    durationValid &&
    (source === "syllabus" ? Boolean(syllabusSubject) : Boolean(notebookId));

  useEffect(() => {
    if (!notebookId && notebooks && notebooks.length > 0) {
      setNotebookId(notebooks[0].id);
    }
  }, [notebookId, notebooks]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!exam || hydrated.current === exam.id) return;
    hydrated.current = exam.id;
    setResponses(exam.responses ?? {});
    setIndex(0);
  }, [exam]);

  // Autosave while the paper is running. The answers are also passed to
  // `submit`, so a dropped save cannot lose the last keystroke.
  useEffect(() => {
    if (!examId || exam?.status !== "in_progress") return;
    const timer = window.setTimeout(() => {
      void saveResponses({ examId, responses }).catch(() => {
        /* The explicit submit still carries the current map. */
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [examId, exam?.status, responses, saveResponses]);

  const remaining = exam?.endsAt
    ? Math.max(0, exam.endsAt - tick)
    : effectiveDuration * 60_000;
  const urgent = exam?.status === "in_progress" && remaining <= 5 * 60_000;
  const critical = exam?.status === "in_progress" && remaining <= 60_000;

  const questions = exam?.questions ?? [];
  const current = questions[index] ?? null;
  const answered = useMemo(
    () => questions.filter((question) => isAnswered(responses[question.id])).length,
    [questions, responses],
  );
  const sections = useMemo(() => {
    const seen = new Map<string, number>();
    questions.forEach((question, questionIndex) => {
      if (!seen.has(question.section)) seen.set(question.section, questionIndex);
    });
    return [...seen.entries()];
  }, [questions]);

  async function createPaper() {
    if (!readyToGenerate || generating) return;
    if (!durationValid) {
      toast.error("Choose a duration between 5 and 300 minutes.", {
        description: "Board-style papers need at least 15 minutes.",
      });
      return;
    }
    setGenerating(true);
    try {
      const result =
        source === "syllabus"
          ? await generatePaper({
              className,
              subject: subjectId,
              chapters,
              paperKind,
              durationMinutes: effectiveDuration,
              pattern,
            })
          : await generatePaper({
              notebookId: notebookId as Id<"notebooks">,
              paperKind,
              durationMinutes: effectiveDuration,
              pattern,
            });
      setExamId(result.examId);
      setIndex(0);
      setResponses({});
      toast.success("Paper ready", {
        description: [
          `${result.questionCount} questions`,
          `${result.totalMarks} marks`,
          `${result.durationMinutes} minutes`,
          result.boardQuestions > 0
            ? `${result.boardQuestions} real board question${result.boardQuestions === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } catch (error) {
      toast.error("Could not make that paper", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function startPaper() {
    if (!examId || starting) return;
    setStarting(true);
    try {
      const result = await beginExam({ examId });
      setTick(Date.now());
      toast("Timer started", {
        description: `${effectiveDuration} minutes on the clock. Good luck.`,
      });
      return result;
    } catch (error) {
      toast.error("Could not start the timer", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setStarting(false);
    }
  }

  async function submitNow(auto = false) {
    if (!examId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await saveResponses({ examId, responses }).catch(() => undefined);
      const result = await submitExam({ examId, responses });
      if (result.status === "submitted") {
        setGrading(true);
        try {
          await markPaper({ examId });
          toast.success(auto ? "Time is up — paper submitted and marked" : "Paper submitted and marked");
        } catch (error) {
          toast.error("Written answers need marking", {
            description:
              error instanceof Error
                ? `${error.message} Use “Grade written answers” to retry.`
                : "Use “Grade written answers” to retry.",
          });
        } finally {
          setGrading(false);
        }
      } else {
        toast.success(auto ? "Time is up — paper submitted" : "Paper submitted");
      }
    } catch (error) {
      toast.error("Could not submit the paper", {
        description: error instanceof Error ? error.message : "Try again.",
      });
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  async function gradeNow() {
    if (!examId || grading) return;
    setGrading(true);
    try {
      await markPaper({ examId });
      toast.success("Written answers marked");
    } catch (error) {
      toast.error("Could not mark the written answers", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setGrading(false);
    }
  }

  // Server-owned deadline: when it passes, the paper closes even if the tab
  // was asleep. `submittingRef` keeps StrictMode and a slow network from
  // firing two submissions.
  useEffect(() => {
    if (
      exam?.status === "in_progress" &&
      exam.endsAt &&
      tick >= exam.endsAt &&
      !submittingRef.current
    ) {
      void submitNow(true);
    }
    // submitNow reads the current responses map; the tick is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, exam?.status, exam?.endsAt]);

  function chooseExam(row: ExamRow) {
    setExamId(row.id);
    setIndex(0);
    setResponses({});
  }

  function resetSetup() {
    setExamId(null);
    setIndex(0);
    setResponses({});
    hydrated.current = null;
    submittingRef.current = false;
  }

  const inExam = exam?.status === "in_progress";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <div className="relative z-10">
        {inExam ? (
          <header className="sticky top-0 z-40 border-b border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-3 backdrop-blur-xl max-[759px]:bg-[var(--panel)] sm:px-6">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Logo />
                <span className="hidden min-w-0 truncate text-[11px] text-text-dim sm:block">
                  {exam.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold tabular-nums " +
                    (critical
                      ? "border-rose-400/50 bg-rose-500/10 text-rose-300"
                      : urgent
                        ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                        : "border-[var(--card-border)] text-foreground")
                  }
                  aria-live="polite"
                >
                  <Timer className="h-3.5 w-3.5" />
                  {formatClock(remaining)}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--signal-strong)] px-4 py-2 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Submit
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit this paper?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You have answered {answered} of {questions.length}{" "}
                        questions. The timer stops now and the paper cannot be
                        reopened.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep writing</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void submitNow()}>
                        Submit paper
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </header>
        ) : (
          <Navbar />
        )}

        <main
          className={
            inExam
              ? "mx-auto w-full max-w-5xl px-4 py-5 sm:px-6"
              : "mx-auto w-full max-w-4xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32"
          }
        >
          {!examId ? (
            <>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
                Mock exam
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
                A real paper. A real clock.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim">
                Pick your class, subject and chapters, then choose the time a
                real paper would give you. The timer is enforced on the server,
                answers save as you write, and written answers are marked
                against a scheme. Class 10 papers mix real CBSE board
                questions from 2020–2026 with fresh ones in the same pattern.
              </p>

              <section className="mt-7 rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-5 sm:p-7">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                  <FileText className="h-3.5 w-3.5 text-[var(--signal)]" />
                  Paper settings
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: "syllabus" as const,
                        title: "Class 8–10 syllabus",
                        body: "Class, subject and chapters. No sources needed.",
                        icon: GraduationCap,
                      },
                      {
                        id: "notebook" as const,
                        title: "From my notebook",
                        body: "A paper grounded only in sources you added.",
                        icon: BookOpen,
                      },
                    ] as const
                  ).map((option) => {
                    const Icon = option.icon;
                    const active = source === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSource(option.id)}
                        className={
                          "rounded-xl border px-3.5 py-3 text-left transition-colors " +
                          (active
                            ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                            : "border-[var(--card-border)] hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)]")
                        }
                      >
                        <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                          <Icon className="h-4 w-4 text-[var(--signal)]" />
                          {option.title}
                        </span>
                        <span className="mt-1 block text-[10.5px] leading-relaxed text-text-dim">
                          {option.body}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {source === "syllabus" ? (
                  <div className="mt-5 flex flex-col gap-5">
                    <div>
                      <p className="text-[11px] font-medium text-text-dim">Class</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {CLASSES.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            aria-pressed={className === entry.id}
                            onClick={() => {
                              setClassName(entry.id);
                              setSubjectId(entry.subjects[0].id);
                              setChapters([]);
                            }}
                            className={
                              "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors " +
                              (className === entry.id
                                ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                                : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                            }
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[10.5px] leading-relaxed text-text-dim">
                        {syllabusClass?.note}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-text-dim">Subject</p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {(syllabusClass?.subjects ?? []).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            aria-pressed={subjectId === entry.id}
                            onClick={() => {
                              setSubjectId(entry.id);
                              setChapters([]);
                            }}
                            className={
                              "rounded-xl border px-3 py-2 text-left text-[11.5px] font-medium transition-colors " +
                              (subjectId === entry.id
                                ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                                : "border-[var(--card-border)] text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
                            }
                          >
                            {entry.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-text-dim">
                          Chapters
                          <span className="ml-2 font-normal opacity-70">
                            {chapters.length === 0
                              ? "whole subject"
                              : `${chapters.length} selected`}
                          </span>
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setChapters(syllabusSubject?.chapters ?? [])
                            }
                            className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] text-text-dim transition-colors hover:text-foreground"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setChapters([])}
                            className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] text-text-dim transition-colors hover:text-foreground"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-[var(--card-border)] p-2">
                        {(syllabusSubject?.chapters ?? []).map((chapter) => {
                          const on = chapters.includes(chapter);
                          return (
                            <button
                              key={chapter}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setChapters((current) =>
                                  on
                                    ? current.filter((item) => item !== chapter)
                                    : [...current, chapter],
                                )
                              }
                              className={
                                "rounded-full border px-2.5 py-1 text-[10.5px] transition-colors " +
                                (on
                                  ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                                  : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                              }
                            >
                              {chapter}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[10.5px] leading-relaxed text-text-dim">
                        Leave every chapter off to set the paper across the whole
                        subject.
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-text-dim">
                        Kind of paper
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            {
                              id: "practice" as const,
                              title: "Fresh practice",
                              body: "New questions written across the chapters you picked.",
                            },
                            {
                              id: "board" as const,
                              title:
                                className === "10"
                                  ? "Board simulation"
                                  : "Exam simulation",
                              body:
                                className === "10"
                                  ? "Real CBSE board questions from 2020–2026, mixed with fresh questions in the same pattern."
                                  : "The section pattern and marking weights your annual exam uses.",
                            },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={paperKind === option.id}
                            onClick={() => setPaperKind(option.id)}
                            className={
                              "rounded-xl border px-3.5 py-3 text-left transition-colors " +
                              (paperKind === option.id
                                ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                                : "border-[var(--card-border)] hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)]")
                            }
                          >
                            <span className="block text-[12px] font-semibold">
                              {option.title}
                            </span>
                            <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-dim">
                              {option.body}
                            </span>
                          </button>
                        ))}
                      </div>
                      {paperKind === "board" && className === "10" ? (
                        <p className="mt-2 text-[10.5px] leading-relaxed text-text-dim">
                          {realQuestions
                            ? `${availableBank} real board question${availableBank === 1 ? "" : "s"} match your chapters. Up to half the paper is filled from those papers and the rest is written fresh in the board pattern. The bank covers 2020–2026; the 2021 papers were cancelled and 2022 was term-based.`
                            : "No saved board question covers those chapters yet — the paper keeps the board pattern, marks and wording style instead. Real questions cover every Class 10 subject, including AI 417; chapters without one get a board-pattern question instead."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {source === "notebook" && notebooks === undefined ? (
                  <p className="mt-5 flex items-center gap-2 text-sm text-text-dim">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading notebooks…
                  </p>
                ) : source === "notebook" && (notebooks?.length ?? 0) === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-[var(--card-border)] px-4 py-8 text-center">
                    <p className="text-sm font-medium">No notebook to examine yet.</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-dim">
                      Add sources to a notebook first; the paper can only use
                      what you have given it.
                    </p>
                    <div className="mt-4">
                      <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                        Open a notebook
                      </MovingBorderButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex flex-col gap-5">
                    {source === "notebook" ? (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-text-dim">
                        Notebook
                      </span>
                      <select
                        value={notebookId}
                        onChange={(event) => setNotebookId(event.target.value)}
                        className="w-full rounded-xl border border-[var(--card-border)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--signal)]"
                      >
                        {(notebooks ?? []).map((notebook) => (
                          <option key={notebook.id} value={notebook.id}>
                            {notebook.name} · {notebook.sourceCount} source
                            {notebook.sourceCount === 1 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                    </label>
                    ) : null}

                    <div>
                      <p className="text-[11px] font-medium text-text-dim">
                        Time allowed
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DURATIONS.map((minutes) => {
                          const active = !customDuration && duration === minutes;
                          return (
                            <button
                              key={minutes}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                setDuration(minutes);
                                setCustomDuration("");
                              }}
                              className={
                                "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors " +
                                (active
                                  ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                                  : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                              }
                            >
                              {minutes} min
                            </button>
                          );
                        })}
                        <label className="flex items-center gap-2 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[12px] text-text-dim focus-within:border-[var(--signal)]">
                          <Clock className="h-3 w-3" />
                          <input
                            type="number"
                            min={5}
                            max={300}
                            value={customDuration}
                            onChange={(event) => setCustomDuration(event.target.value)}
                            placeholder="Custom"
                            aria-label="Custom duration in minutes"
                            className="w-20 bg-transparent text-[12px] text-foreground outline-none placeholder:text-text-dim/70"
                          />
                          <span>min</span>
                        </label>
                      </div>
                      <p className="mt-2 text-[10.5px] text-text-dim">
                        Choose the time a real exam would give you — the clock
                        cannot be paused once it starts.
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-text-dim">Pattern</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {(
                          [
                            {
                              id: "board" as const,
                              title: "Full paper",
                              body: "MCQs, short answers and long answers, marked against a scheme.",
                            },
                            {
                              id: "objective" as const,
                              title: "Objective only",
                              body: "Multiple choice throughout — instant score, no written marking.",
                            },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={pattern === option.id}
                            onClick={() => setPattern(option.id)}
                            className={
                              "rounded-xl border px-3.5 py-3 text-left transition-colors " +
                              (pattern === option.id
                                ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                                : "border-[var(--card-border)] hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)]")
                            }
                          >
                            <span className="block text-[12.5px] font-semibold">
                              {option.title}
                            </span>
                            <span className="mt-0.5 block text-[10.5px] leading-relaxed text-text-dim">
                              {option.body}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-3.5 py-3">
                      <p className="max-w-md text-[11.5px] leading-relaxed text-text-dim">
                        {describePlan(plan, pattern)} · {effectiveDuration} min
                        {source === "syllabus"
                          ? ` · ${syllabusClass?.label ?? ""} ${syllabusSubject?.name ?? ""}`
                          : " · from your notebook"}
                      </p>
                      <button
                        type="button"
                        onClick={() => void createPaper()}
                        disabled={generating || !readyToGenerate}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-40"
                      >
                        {generating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {generating ? "Writing your paper…" : "Generate paper"}
                      </button>
                    </div>
                    {generating ? (
                      <p className="text-[11px] leading-relaxed text-text-dim">
                        {source === "syllabus"
                          ? `Setting ${plan.mcq + plan.short + plan.long} questions one section at a time. A long paper can take a minute or two; the timer has not started yet.`
                          : "Reading your sources and setting the paper. This can take up to a minute; the timer has not started yet."}
                      </p>
                    ) : null}
                  </div>
                )}
              </section>

              {recent && recent.length > 0 ? (
                <section className="mt-7">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-bold tracking-tight">
                      Your papers
                    </h2>
                    <span className="text-[11px] text-text-dim">
                      {recent.length} saved
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {recent.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => chooseExam(row)}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--card-border)] px-4 py-3 text-left transition-colors hover:border-[var(--signal)]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--card-border)] text-[var(--signal)]">
                          {row.status === "graded" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : row.status === "in_progress" ? (
                            <Timer className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">
                            {row.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] text-text-dim">
                            {row.notebookName} · {row.durationMinutes} min ·{" "}
                            {row.questionCount} questions · {examDate(row.createdAt)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {row.status === "graded" && row.score !== null ? (
                            <span className="text-[11px] font-semibold tabular-nums text-[var(--signal)]">
                              {row.score}/{row.totalMarks}
                            </span>
                          ) : (
                            <span className="rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] text-text-dim">
                              {STATUS_LABEL[row.status]}
                            </span>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-text-dim" />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : exam === undefined ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-text-dim">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--signal)]" />
              Opening your paper…
            </div>
          ) : exam === null ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
              <p className="font-display text-xl font-bold">That paper is not available.</p>
              <p className="mt-2 text-sm text-text-dim">
                It may have been deleted with its notebook.
              </p>
              <button
                type="button"
                onClick={resetSetup}
                className="mt-5 rounded-full border border-[var(--card-border)] px-4 py-2 text-[12px]"
              >
                Back to exam setup
              </button>
            </div>
          ) : exam.status === "ready" ? (
            <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
                    Paper ready
                  </p>
                  <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    {exam.title}
                  </h1>
                  <p className="mt-1.5 text-[11.5px] text-text-dim">
                    {exam.notebookName} · {exam.questions.length} questions ·{" "}
                    {exam.totalMarks} marks
                  </p>
                  {exam.syllabus ? (
                    <p className="mt-1 text-[10.5px] leading-relaxed text-text-dim">
                      {exam.syllabus.paperKind === "board"
                        ? exam.syllabus.className === "10"
                          ? "Board simulation"
                          : "Exam simulation"
                        : "Fresh practice"}{" "}
                      ·{" "}
                      {exam.syllabus.chapters.length > 0
                        ? exam.syllabus.chapters.join(" · ")
                        : "Full syllabus"}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={resetSetup}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Setup
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--card-border)] px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                    Time
                  </p>
                  <p className="mt-1 font-display text-xl font-bold tabular-nums">
                    {exam.durationMinutes} min
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--card-border)] px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                    Marks
                  </p>
                  <p className="mt-1 font-display text-xl font-bold tabular-nums">
                    {exam.totalMarks}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--card-border)] px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                    Pattern
                  </p>
                  <p className="mt-1 font-display text-xl font-bold capitalize">
                    {exam.pattern}
                  </p>
                </div>
              </div>

              {exam.instructions ? (
                <div className="mt-5 rounded-xl border border-[var(--card-border)] px-4 py-3 text-[12px] leading-relaxed text-text-dim">
                  {exam.instructions}
                </div>
              ) : null}

              {exam.questions.some((question) =>
                question.source?.startsWith("BOARD"),
              ) ? (
                <p className="mt-5 rounded-xl border border-[var(--signal)]/30 bg-[color-mix(in_srgb,var(--signal)_6%,transparent)] px-4 py-3 text-[11.5px] leading-relaxed text-text-dim">
                  {
                    exam.questions.filter((question) =>
                      question.source?.startsWith("BOARD"),
                    ).length
                  }{" "}
                  of these questions are reproduced from real CBSE board papers
                  (2020–2026). Each one is tagged with its board year; hover the
                  tag to see the paper code.
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border border-[var(--card-border)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                  Sections
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-text-dim">
                  {sections
                    .map(
                      ([name, firstIndex]) =>
                        `${name} (${exam.questions.filter((q) => q.section === name).length} questions, starts at Q${firstIndex + 1})`,
                    )
                    .join(" · ")}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void startPaper()}
                  disabled={starting}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-50"
                >
                  {starting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {starting ? "Starting…" : `Start ${exam.durationMinutes}-minute exam`}
                </button>
                <span className="text-[10.5px] text-text-dim">
                  The timer starts the moment you press this.
                </span>
              </div>
            </section>
          ) : exam.status === "in_progress" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold tracking-tight">
                      {exam.title}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-text-dim">
                      {exam.questions.length} questions · {exam.totalMarks} marks
                    </p>
                  </div>
                  <span className="text-[10.5px] text-text-dim">
                    {answered}/{exam.questions.length} answered
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--signal)] transition-[width] duration-300"
                    style={{
                      width: `${exam.questions.length ? (answered / exam.questions.length) * 100 : 0}%`,
                    }}
                  />
                </div>

                {current ? (
                  <section className="mt-4 rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-semibold text-text-dim">
                        {current.section} · Question {index + 1}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {current.source?.startsWith("BOARD") ? (
                          <span
                            className="rounded-full border border-[var(--signal)]/40 px-2 py-0.5 text-[9.5px] font-medium text-[var(--signal)]"
                            title={current.sourceDetail}
                          >
                            {current.source}
                          </span>
                        ) : null}
                        <span className="text-[10.5px] text-text-dim">
                          {current.marks} mark{current.marks === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>

                    <p className="mt-4 font-display text-lg font-bold leading-snug tracking-tight sm:text-xl">
                      {current.prompt}
                    </p>

                    {current.type === "mcq" ? (
                      <ul className="mt-4 flex flex-col gap-2">
                        {(current.options ?? []).map((option, optionIndex) => {
                          const selected =
                            responses[current.id] === optionIndex;
                          return (
                            <li key={`${current.id}-${optionIndex}`}>
                              <button
                                type="button"
                                onClick={() =>
                                  setResponses((value) => ({
                                    ...value,
                                    [current.id]: optionIndex,
                                  }))
                                }
                                className={
                                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[13.5px] leading-snug transition-colors " +
                                  (selected
                                    ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                                    : "border-[var(--card-border)] hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)]")
                                }
                              >
                                <span
                                  className={
                                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] " +
                                    (selected
                                      ? "border-[color-mix(in_srgb,var(--text-main)_58%,transparent)] text-[var(--text-main)]"
                                      : "border-[var(--card-border)] text-text-dim")
                                  }
                                >
                                  {selected ? (
                                    <Check className="h-3 w-3" />
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
                    ) : (
                      <textarea
                        value={
                          typeof responses[current.id] === "string"
                            ? (responses[current.id] as string)
                            : ""
                        }
                        onChange={(event) =>
                          setResponses((value) => ({
                            ...value,
                            [current.id]: event.target.value,
                          }))
                        }
                        rows={current.type === "long" ? 8 : 5}
                        placeholder="Write your answer here…"
                        className="mt-4 w-full resize-y rounded-xl border border-[var(--card-border)] bg-transparent px-3.5 py-3 text-[14px] leading-relaxed outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                      />
                    )}

                    <div className="mt-5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setIndex((value) => Math.max(0, value - 1))}
                        disabled={index === 0}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-2 text-[11.5px] font-medium text-text-dim transition-colors hover:text-foreground disabled:opacity-40"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setIndex((value) =>
                            Math.min(exam.questions.length - 1, value + 1),
                          )
                        }
                        disabled={index >= exam.questions.length - 1}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-2 text-[11.5px] font-medium transition-colors hover:border-[var(--signal)] disabled:opacity-40"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>

              <aside className="lg:sticky lg:top-20 lg:self-start">
                <div className="rounded-2xl border border-[var(--card-border)] p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                    Question map
                  </p>
                  <div className="mt-2 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
                    {exam.questions.map((question, questionIndex) => {
                      const done = isAnswered(responses[question.id]);
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => setIndex(questionIndex)}
                          aria-label={`Go to question ${questionIndex + 1}`}
                          aria-current={questionIndex === index}
                          className={
                            "flex h-8 items-center justify-center rounded-lg border text-[11px] font-medium tabular-nums transition-colors " +
                            (questionIndex === index
                              ? "border-[var(--text-main)] bg-[var(--text-main)] text-[var(--panel)]"
                              : done
                                ? "border-[var(--signal)]/50 text-[var(--signal)]"
                                : "border-[var(--card-border)] text-text-dim hover:border-[var(--signal)]")
                          }
                        >
                          {questionIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-text-dim">
                    Bold is the current question; a lit border means answered.
                  </p>
                </div>
              </aside>
            </div>
          ) : (
            <ExamResult
              exam={exam}
              grading={grading}
              onGrade={() => void gradeNow()}
              onReset={resetSetup}
            />
          )}
        </main>
        {!inExam ? <Footer /> : null}
      </div>
    </div>
  );
}

function ExamResult({
  exam,
  grading,
  onGrade,
  onReset,
}: {
  exam: Exam;
  grading: boolean;
  onGrade: () => void;
  onReset: () => void;
}) {
  const report = exam.report;
  const score = report?.total ?? exam.score ?? exam.objectiveScore ?? 0;
  const max = report?.max ?? exam.totalMarks;
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-6 text-center sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--signal)]/40 text-[var(--signal)]">
          {exam.status === "graded" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </span>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
          {exam.status === "graded" ? "Paper marked" : "Written answers"}
        </p>
        <p className="mt-2 font-display text-4xl font-bold tracking-tight">
          {score}
          <span className="text-text-dim">/{max}</span>
        </p>
        <p className="mt-1 text-[11px] text-text-dim">
          {percent}% · {exam.title}
        </p>
        <p className="mx-auto mt-3 max-w-lg text-[12.5px] leading-relaxed text-text-dim">
          {exam.status === "graded"
            ? report?.summary
            : "The objective answers are already scored. The written answers still need marking before the final total is ready."}
        </p>
        {exam.status === "submitted" ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onGrade}
              disabled={grading}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[12px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {grading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {grading ? "Marking…" : "Grade written answers"}
            </button>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2.5 text-[12px] font-medium transition-colors hover:border-[var(--signal)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Another paper
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2.5 text-[12px] font-medium text-text-dim transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>
      </section>

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--card-border)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                Objective
              </p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {report.objectiveScore}/{report.objectiveMax}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                Written
              </p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {report.writtenScore}/{report.writtenMax}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--card-border)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                Total
              </p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {report.total}/{report.max}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-[var(--card-border)] p-4 sm:p-5">
            <h2 className="font-display text-base font-bold tracking-tight">
              Question by question
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {report.results.map((result) => {
                const correct =
                  result.type === "mcq"
                    ? result.correct
                    : result.awarded >= result.marks * 0.6;
                return (
                  <div
                    key={result.id}
                    className="rounded-xl border border-[var(--card-border)] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12.5px] font-medium leading-snug">
                        {result.prompt}
                      </p>
                      <span
                        className={
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] tabular-nums " +
                          (correct
                            ? "border-[var(--signal)]/40 text-[var(--signal)]"
                            : "border-rose-400/30 text-rose-300")
                        }
                      >
                        {result.awarded}/{result.marks}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-dim">
                      You: {result.given || "No answer"}
                    </p>
                    {result.type === "mcq" ? (
                      <p className="mt-1 text-[11px] text-text-dim">
                        Correct: {result.correctAnswer ?? "—"}
                      </p>
                    ) : (
                      <>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-text-dim">
                          Model answer: {result.modelAnswer ?? "—"}
                        </p>
                        {result.feedback ? (
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--signal)]">
                            {result.feedback}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {!report && exam.status === "submitted" ? (
        <section className="rounded-2xl border border-[var(--card-border)] p-4 sm:p-5">
          <h2 className="font-display text-base font-bold tracking-tight">
            Model answers while marking is unavailable
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-text-dim">
            The written section could not be marked yet. Read the expected
            answers below, then retry marking when the model is available.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {exam.questions
              .filter((question) => question.type !== "mcq")
              .map((question, questionIndex) => (
                <div
                  key={question.id}
                  className="rounded-xl border border-[var(--card-border)] p-3.5"
                >
                  <p className="text-[12px] font-medium leading-snug">
                    {questionIndex + 1}. {question.prompt}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-dim">
                    {question.modelAnswer ?? "No model answer supplied."}
                  </p>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
