import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import {
  pickAviaVoice,
  speakText,
  stopSpeaking,
} from "@/components/voice/avia";
import {
  createDictation,
  studyTerms,
  type Dictation,
} from "@/components/voice/dictation";
import { CLASSES, findClass, findSubject } from "@/lib/curriculum";
import { useAction, useQuery } from "convex/react";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Loader2,
  Mic,
  NotebookPen,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Turn = {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  missed: string[];
};

type StartResult = {
  question: string;
  focus: string;
  expected: string[];
  sources: string[];
};

/**
 * How long the room has to stay quiet before the take counts as finished.
 *
 * Four and a half seconds: a student who pauses to think mid-answer is not
 * done, and cutting them off at two seconds is what sent half a sentence to
 * the examiner. Shorter than this and the viva submits itself mid-answer.
 */
const SILENCE_MS = 4500;

export default function Viva() {
  const notebooks = useQuery(api.notebooks.list);
  const startViva = useAction(api.notebookStudio.vivaStart);
  const answerViva = useAction(api.notebookStudio.vivaRespond);

  const [notebookId, setNotebookId] = useState<string>("");
  /** Where the examiner draws its questions from. */
  const [mode, setMode] = useState<"notebook" | "syllabus">("syllabus");
  const [classId, setClassId] = useState<string>("10");
  const [subjectId, setSubjectId] = useState<string>("science");
  const [chapters, setChapters] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<"setup" | "active" | "done">("setup");
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [started, setStarted] = useState<StartResult | null>(null);
  const [question, setQuestion] = useState("");
  const [focus, setFocus] = useState("");
  const [expected, setExpected] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [feedback, setFeedback] = useState<Turn | null>(null);
  const [overall, setOverall] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const dictationRef = useRef<Dictation | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  const selectedNotebook = (notebooks ?? []).find(
    (notebook) => notebook.id === notebookId,
  );
  const readied = selectedNotebook?.sourceCount ?? 0;

  const activeClass = findClass(classId) ?? CLASSES[2];
  const activeSubject = findSubject(classId, subjectId) ?? activeClass.subjects[0];

  /**
   * What the examiner is told it is examining on, in one block of text.
   * The class and subject are always named; chapters are named when the student
   * picked any, so an empty selection means the whole subject.
   */
  const scope = useMemo(() => {
    const lines = [`${activeClass.label} · ${activeSubject.name}`];
    lines.push(
      chapters.length
        ? `Chapters: ${chapters.join("; ")}`
        : `Chapters: the whole ${activeSubject.name} syllabus for ${activeClass.label}`,
    );
    return lines.join("\n");
  }, [activeClass.label, activeSubject.name, chapters]);

  const canStart =
    mode === "syllabus" ? Boolean(activeSubject) : Boolean(notebookId) && readied > 0;

  useEffect(() => {
    if (!notebookId && notebooks && notebooks.length > 0) {
      setNotebookId(notebooks[0].id);
    }
  }, [notebookId, notebooks]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voiceRef.current = pickAviaVoice(synth.getVoices());
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    const late = window.setTimeout(load, 800);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      window.clearTimeout(late);
    };
  }, []);

  const say = (text: string) => {
    if (!text || !soundOn) return;
    speakText(text, voiceRef.current);
  };

  useEffect(() => {
    if (phase === "active" && question) say(question);
    // The question is the only trigger: `say` reads the current voice and sound
    // preference, and re-speaking on every render would talk over the student.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, phase]);

  useEffect(
    () => () => {
      dictationRef.current?.abort();
      dictationRef.current = null;
      stopSpeaking();
    },
    [],
  );

  function stopListening() {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setListening(false);
  }

  /**
   * The vocabulary this answer is likely to contain: the topic the student set,
   * the examiner's focus, and the points the answer is expected to make. It
   * both biases the recogniser ("eye lens" instead of "islands") and powers the
   * repair pass for near misses.
   */
  function lexicon(): string[] {
    // The question itself is the strongest hint: a viva asking about the eye
    // lens should repair "islands" even if the examiner's focus line is short.
    const phrases = [topic, focus, question, ...expected];
    const words = phrases
      .join(" ")
      .split(/[^A-Za-z0-9'-]+/)
      .filter((word) => word.length > 3);
    return [...phrases.filter(Boolean), ...words];
  }

  function startListening() {
    if (dictationRef.current) {
      stopListening();
      return;
    }
    stopSpeaking();
    setNote(null);
    // Speaking again after a pause continues the answer instead of wiping it.
    const seed = answer.trim();

    const dictation = createDictation({
      lang: "en-IN",
      silenceMs: SILENCE_MS,
      terms: () => [...studyTerms(), ...lexicon()],
      repair: lexicon,
      onText: (text) => setAnswer(text),
      onListening: (on) => setListening(on),
      onStop: (reason) => {
        dictationRef.current = null;
        setListening(false);
        if (reason === "unsupported") {
          setNote(
            "This browser cannot listen in. Chrome, Edge and Safari can. You can still type your answer.",
          );
        } else if (reason === "error") {
          setNote(
            "The microphone stopped. Allow access in the address bar, or type your answer.",
          );
        }
      },
    });

    dictationRef.current = dictation;
    dictation.start();
    if (seed) dictation.setSeed(seed);
  }

  async function begin() {
    if (starting || (mode === "notebook" && !notebookId)) return;
    setStarting(true);
    setNote(null);
    try {
      const result = await startViva({
        notebookId:
          mode === "notebook" ? (notebookId as Id<"notebooks">) : undefined,
        scope: mode === "syllabus" ? scope : undefined,
        topic: topic.trim() || undefined,
      });
      setStarted(result);
      setQuestion(result.question);
      setFocus(result.focus);
      setExpected(result.expected);
      setAnswer("");
      setTurns([]);
      setFeedback(null);
      setOverall(null);
      setPhase("active");
    } catch (error) {
      toast.error("Could not start the viva", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setStarting(false);
    }
  }

  async function submit() {
    if (!answer.trim() || checking || !started) return;
    setChecking(true);
    setNote(null);
    stopListening();
    try {
      const result = await answerViva({
        notebookId:
          mode === "notebook" ? (notebookId as Id<"notebooks">) : undefined,
        scope: mode === "syllabus" ? scope : undefined,
        topic: topic.trim() || undefined,
        question,
        expected,
        answer,
        turn: turns.length + 1,
        history: turns.map((turn) => ({
          question: turn.question,
          answer: turn.answer,
          score: turn.score,
          feedback: turn.feedback,
        })),
      });
      const turn: Turn = {
        question,
        answer,
        score: result.score,
        feedback: result.feedback,
        missed: result.missed,
      };
      setTurns((current) => [...current, turn]);
      setFeedback(turn);
      setAnswer("");
      if (result.nextQuestion) {
        setQuestion(result.nextQuestion);
        setFocus(result.nextFocus ?? "");
        setExpected(result.nextExpected);
      } else {
        setOverall(result.overall ?? result.feedback);
        setPhase("done");
        stopSpeaking();
      }
    } catch (error) {
      toast.error("Could not check that answer", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setChecking(false);
    }
  }

  function restart() {
    stopListening();
    stopSpeaking();
    setPhase("setup");
    setStarted(null);
    setQuestion("");
    setFocus("");
    setExpected([]);
    setAnswer("");
    setTurns([]);
    setFeedback(null);
    setOverall(null);
    setNote(null);
  }

  const score = turns.reduce((total, turn) => total + turn.score, 0);
  const maxScore = 15;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--signal)]">
            Teach it back
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            Say it in your own words.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-dim">
            A short oral viva. Pick a class, subject and chapter — or examine
            one of your own notebooks. Explain the idea aloud; the examiner
            asks two follow-ups, then tells you what was missing. Speaking is
            the point, and typing works too when you need it.
          </p>

          {phase === "setup" ? (
            <section className="mt-8 rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-5 sm:p-7">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                <GraduationCap className="h-3.5 w-3.5 text-[var(--signal)]" />
                Set the viva
              </div>

              {/* Same two sources of questions as the mock exam: the school
                  syllabus, or the student's own notebook. The syllabus is the
                  default because a new account has no notebook yet. */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "syllabus" as const,
                      title: "Class 8–12 syllabus",
                      body: "Class, subject and chapters. No sources needed.",
                      icon: BookOpen,
                    },
                    {
                      id: "notebook" as const,
                      title: "From my notebook",
                      body: "A viva grounded only in sources you added.",
                      icon: NotebookPen,
                    },
                  ]
                ).map((option) => {
                  const OptionIcon = option.icon;
                  const chosen = mode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => setMode(option.id)}
                      className={
                        "rounded-xl border px-3.5 py-3 text-left transition-colors " +
                        (chosen
                          ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                          : "border-[var(--card-border)] hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)]")
                      }
                    >
                      <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                        <OptionIcon className="h-4 w-4 text-[var(--signal)]" />
                        {option.title}
                      </span>
                      <span className="mt-1 block text-[10.5px] leading-relaxed text-text-dim">
                        {option.body}
                      </span>
                    </button>
                  );
                })}
              </div>

              {mode === "syllabus" ? (
                <div className="mt-5 flex flex-col gap-5">
                  <div>
                    <p className="text-[11px] font-medium text-text-dim">Class</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {CLASSES.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          aria-pressed={classId === entry.id}
                          onClick={() => {
                            setClassId(entry.id);
                            setSubjectId(entry.subjects[0].id);
                            setChapters([]);
                          }}
                          className={
                            "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors " +
                            (classId === entry.id
                              ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                              : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                          }
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10.5px] leading-relaxed text-text-dim">
                      {activeClass.note}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium text-text-dim">
                      Subject
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {activeClass.subjects.map((subject) => (
                        <button
                          key={subject.id}
                          type="button"
                          aria-pressed={subjectId === subject.id}
                          onClick={() => {
                            setSubjectId(subject.id);
                            setChapters([]);
                          }}
                          className={
                            "rounded-xl border px-3 py-2 text-left text-[11.5px] font-medium transition-colors " +
                            (subjectId === subject.id
                              ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_9%,transparent)]"
                              : "border-[var(--card-border)] text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
                          }
                        >
                          {subject.name}
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
                          onClick={() => setChapters(activeSubject.chapters)}
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
                      {activeSubject.chapters.map((chapter) => {
                        const chosen = chapters.includes(chapter);
                        return (
                          <button
                            key={chapter}
                            type="button"
                            aria-pressed={chosen}
                            onClick={() =>
                              setChapters((current) =>
                                chosen
                                  ? current.filter((entry) => entry !== chapter)
                                  : [...current, chapter],
                              )
                            }
                            className={
                              "rounded-full border px-2.5 py-1 text-[10.5px] transition-colors " +
                              (chosen
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
                      Leave every chapter off to be examined across the whole
                      subject.
                    </p>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-text-dim">
                      Narrow it down{" "}
                      <span className="opacity-60">(optional)</span>
                    </span>
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder={`e.g. just the numericals in ${activeSubject.name}`}
                      className="w-full rounded-xl border border-[var(--card-border)] bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-3.5 py-3">
                    <p className="max-w-md text-[11.5px] leading-relaxed text-text-dim">
                      One question, then two follow-ups, marked against the
                      points a full answer needs.
                    </p>
                    <button
                      type="button"
                      onClick={() => void begin()}
                      disabled={starting || !canStart}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-40"
                    >
                      {starting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                      {starting ? "Setting the first question…" : "Start viva"}
                    </button>
                  </div>

                  <p className="text-[10.5px] leading-relaxed text-text-dim">
                    The examiner waits for about five seconds of quiet before it
                    takes your answer, so a pause mid-sentence does not cut it
                    short. Listening uses your browser's speech recognition;
                    audio is not stored, and you can always type instead.
                  </p>
                </div>
              ) : notebooks === undefined ? (
                <p className="mt-5 flex items-center gap-2 text-sm text-text-dim">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading notebooks…
                </p>
              ) : notebooks.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-[var(--card-border)] px-4 py-8 text-center">
                  <p className="text-sm font-medium">No notebook to examine yet.</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-dim">
                    Add sources to a notebook first. The viva asks only about the
                    text in that notebook.
                  </p>
                  <div className="mt-4">
                    <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                      Open a notebook
                    </MovingBorderButton>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-text-dim">
                      Notebook
                    </span>
                    <select
                      value={notebookId}
                      onChange={(event) => setNotebookId(event.target.value)}
                      className="w-full rounded-xl border border-[var(--card-border)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--signal)]"
                    >
                      {notebooks.map((notebook) => (
                        <option key={notebook.id} value={notebook.id}>
                          {notebook.name} · {notebook.sourceCount} source
                          {notebook.sourceCount === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-text-dim">
                      Topic to be examined on <span className="opacity-60">(optional)</span>
                    </span>
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder={`e.g. the main idea of ${selectedNotebook?.name ?? "this notebook"}`}
                      className="w-full rounded-xl border border-[var(--card-border)] bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-3.5 py-3">
                    <p className="max-w-md text-[11.5px] leading-relaxed text-text-dim">
                      {readied > 0
                        ? "The examiner will ask one question, then two follow-ups. Each answer is graded against the source."
                        : "This notebook has no sources yet, so there is nothing to examine."}
                    </p>
                    <button
                      type="button"
                      onClick={() => void begin()}
                      disabled={starting || !notebookId || readied === 0}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-40"
                    >
                      {starting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                      {starting ? "Setting the first question…" : "Start viva"}
                    </button>
                  </div>

                  <p className="text-[10.5px] leading-relaxed text-text-dim">
                    Listening uses your browser's speech recognition. Audio is
                    not stored; only the transcript you submit is sent for
                    marking. You can always type instead.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {phase === "active" && started ? (
            <div className="mt-7 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim">
                    Turn {Math.min(3, turns.length + 1)} of 3
                  </span>
                  <span className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim">
                    {score} / {maxScore} so far
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundOn;
                      setSoundOn(next);
                      if (!next) stopSpeaking();
                      else say(question);
                    }}
                    aria-pressed={soundOn}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim transition-colors hover:text-foreground"
                  >
                    {soundOn ? (
                      <Volume2 className="h-3 w-3" />
                    ) : (
                      <VolumeX className="h-3 w-3" />
                    )}
                    {soundOn ? "Sound on" : "Sound off"}
                  </button>
                  <button
                    type="button"
                    onClick={restart}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Exit
                  </button>
                </div>
              </div>

              <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-5 sm:p-7">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Examiner
                </p>
                {focus ? (
                  <p className="mt-2 text-[10.5px] text-text-dim">{focus}</p>
                ) : null}
                <p className="mt-4 font-display text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                  {question}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => say(question)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3 py-1.5 text-[11px] text-text-dim transition-colors hover:text-foreground"
                  >
                    <Volume2 className="h-3 w-3" />
                    Hear it again
                  </button>
                  <span className="text-[10.5px] text-text-dim">
                    from {started.sources.join(" · ")}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--card-border)] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                      Your answer
                    </p>
                    <p className="mt-1 text-[11px] text-text-dim">
                      {listening
                        ? "Listening — pause when you are done."
                        : supported
                          ? "Tap the mic and explain it aloud, or type below."
                          : "Type your answer below."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => (listening ? stopListening() : startListening())}
                    aria-pressed={listening}
                    className={
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-medium transition-colors " +
                      (listening
                        ? "border-rose-400/50 bg-rose-500/10 text-rose-300"
                        : "border-[var(--card-border)] text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
                    }
                  >
                    {listening ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : supported ? (
                      <Mic className="h-3.5 w-3.5" />
                    ) : (
                      <Mic className="h-3.5 w-3.5 opacity-40" />
                    )}
                    {listening ? "Stop" : "Speak"}
                  </button>
                </div>

                <textarea
                  value={answer}
                  onChange={(event) => {
                    // Typing over a live transcript edits the take, not the mic.
                    dictationRef.current?.setSeed(event.target.value);
                    setAnswer(event.target.value);
                  }}
                  rows={5}
                  placeholder="Explain the idea in your own words…"
                  className="mt-3 w-full resize-y rounded-xl border border-[var(--card-border)] bg-transparent px-3.5 py-3 text-[14px] leading-relaxed outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
                />

                {note ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-400">{note}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={checking || answer.trim().length < 12}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--signal-strong)] px-5 py-2.5 text-[12.5px] font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-40"
                  >
                    {checking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {checking ? "The examiner is thinking…" : "Submit answer"}
                  </button>
                  <span className="text-[10.5px] text-text-dim">
                    One full sentence is enough to begin.
                  </span>
                </div>
              </section>

              {feedback ? (
                <section
                  className={
                    "rounded-2xl border p-5 " +
                    (feedback.score >= 4
                      ? "border-[var(--signal)]/40 bg-[color-mix(in_srgb,var(--signal)_6%,transparent)]"
                      : "border-[var(--card-border)]")
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--signal)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      Examiner feedback
                    </p>
                    <span className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] tabular-nums text-text-dim">
                      {feedback.score} / 5
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed">{feedback.feedback}</p>
                  {feedback.missed.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {feedback.missed.map((point) => (
                        <li key={point} className="flex gap-2 text-[11.5px] leading-relaxed text-text-dim">
                          <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {turns.length > 0 ? (
                <details className="rounded-2xl border border-[var(--card-border)] p-4">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                    Earlier answers in this viva
                  </summary>
                  <ol className="mt-3 flex flex-col gap-3">
                    {turns.slice(0, -1).map((turn, index) => (
                      <li key={`${turn.question}-${index}`} className="border-t border-[var(--card-border)] pt-3 first:border-0 first:pt-0">
                        <p className="text-[12px] font-medium">{turn.question}</p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-text-dim">
                          You: {turn.answer}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--signal)]">
                          {turn.score}/5 · {turn.feedback}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          ) : null}

          {phase === "done" ? (
            <section className="mt-7 rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-6 text-center sm:p-8">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--signal)]/40 text-[var(--signal)]">
                <Check className="h-5 w-5" />
              </span>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                Viva complete
              </p>
              <p className="mt-2 font-display text-4xl font-bold tracking-tight">
                {score}
                <span className="text-text-dim">/{maxScore}</span>
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-text-dim">
                {overall ??
                  "You explained the idea aloud. Read the notes below, then try the same topic again in a few days."}
              </p>

              <div className="mt-6 flex flex-col gap-3 text-left">
                {turns.map((turn, index) => (
                  <div key={`${turn.question}-${index}`} className="rounded-xl border border-[var(--card-border)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12.5px] font-medium">{turn.question}</p>
                      <span className="shrink-0 rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] tabular-nums text-text-dim">
                        {turn.score}/5
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-dim">
                      You: {turn.answer}
                    </p>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--signal)]">
                      {turn.feedback}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-4 py-2.5 text-[12px] font-medium transition-colors hover:border-[var(--signal)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Another viva
                </button>
                <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[12px]">
                  Back to dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </MovingBorderButton>
              </div>
            </section>
          ) : null}

          <p className="mt-8 flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--signal)]" />
            Oral recall exposes gaps that rereading hides. The score is a guide,
            not a grade — the missing points are the useful part.
          </p>
        </main>
        <Footer />
      </div>
    </div>
  );
}
