import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { usePlan } from "@/components/plans/PlanProvider";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  getGrade,
  GRADES,
  type GradeSpec,
} from "@/components/mathlab/mathlab";
import { MathTex } from "@/components/mathlab/latex";
import { MathInput, type MathInputHandle } from "@/components/mathlab/MathInput";
import { StepList } from "@/components/mathlab/StepList";
import { CheckMyWork } from "@/components/mathlab/CheckMyWork";
import { NarrationPlayer } from "@/components/mathlab/NarrationPlayer";
import { useNarration, type NarrationLine } from "@/components/mathlab/useNarration";
import { GraphingCalculator } from "@/components/mathlab/GraphingCalculator";
import { ScientificCalculator } from "@/components/mathlab/ScientificCalculator";
import { FormulaSheet } from "@/components/mathlab/FormulaSheet";
import { MathHistory } from "@/components/mathlab/MathHistory";
import { PrintSheet } from "@/components/mathlab/PrintSheet";
import { PracticeTab } from "@/components/mathlab/PracticeTab";
import { splitProblems, uprightWords } from "@/components/mathlab/problems";
import { DetailList, Fold, InlineMath, ProblemStatement } from "@/components/mathlab/parts";
import {
  plainProse,
  solutionToLatex,
  solutionToText,
  spokenMath,
  stepTransitionFor,
  type EngineProblem,
  type EngineSolution,
  type EngineStep,
  type EngineTurn,
} from "@/components/mathlab/solution";
import "@/components/mathlab/mathlab.css";
import { stopSpeaking } from "@/components/voice/avia";
import {
  ArrowRight,
  Calculator,
  Camera,
  Check,
  Code,
  Copy,
  CornerDownLeft,
  FileDown,
  History,
  Lightbulb,
  LineChart,
  Loader2,
  Lock,
  Mic,
  MoreHorizontal,
  Pause,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

type CurriculumTrack = "CBSE" | "ICSE" | "IB" | "IGCSE";

/* How much working the sheet shows. Simple is the default; Detailed keeps the
   full proof, including the rule names. The engine writes both from the same
   mathematics, so switching never changes the answer. */
const DETAIL_OPTIONS = [
  { id: "simple" as const, label: "Simple" },  { id: "detailed" as const, label: "Detailed" },
];

const VIEW_TABS = [
  { id: "solve", label: "Solve", icon: PenLine },
  { id: "graph", label: "Graph", icon: LineChart },
  { id: "tools", label: "Calculator & Formulas", icon: Calculator },
  { id: "history", label: "History", icon: History },
  { id: "practice", label: "Practice", icon: Sparkles },] as const;
type ViewId = (typeof VIEW_TABS)[number]["id"];

/** Three real entry points, one per kind of question the lab is good at. */
const EXAMPLES: Array<{ label: string; value: string }> = [
  { label: "2/3 + 1/6", value: "\\frac{2}{3} + \\frac{1}{6}" },
  { label: "3x + 5 = 20", value: "3x + 5 = 20" },
  { label: "x² − 5x + 6 = 0", value: "x^{2} - 5x + 6 = 0" },
];

/**
 * A sentence a voice can read: symbols become words, never letters.
 *
 * `plainProse` already typesets the inline maths into speech, so this only has
 * to finish the job for symbols that live in the prose itself.
 */
function speechText(text: string) {
  return plainProse(text)
    .replace(/×/g, " times ")
    .replace(/÷/g, " divided by ")
    .replace(/=/g, " equals ")
    .replace(/\+/g, " plus ")
    .replace(/−/g, " minus ")
    .replace(/(?<=\d)\s*-\s*(?=\d)/g, " minus ")
    .replace(/²/g, " squared ")
    .replace(/√/g, " the square root of ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* A picture of the actual numbers                                     */
/* ------------------------------------------------------------------ */

interface Fraction {
  numerator: number;
  denominator: number;
}

/**
 * Fractions mentioned by a problem or its answer.
 *
 * A fraction question gets a picture of its own numbers, and a question with no
 * fractions gets no picture at all rather than an empty panel.
 */
function fractionsIn(sources: string[]): Fraction[] {
  const found = new Map<string, Fraction>();
  const push = (numerator: number, denominator: number) => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return;
    if (denominator < 2 || denominator > 12) return;
    if (numerator < 1 || numerator > denominator * 3) return;
    const key = `${numerator}/${denominator}`;
    if (!found.has(key)) found.set(key, { numerator, denominator });
  };
  for (const source of sources) {
    for (const match of source.matchAll(/\\frac\{(\d+)\}\{(\d+)\}/g)) {
      push(Number(match[1]), Number(match[2]));
    }
    for (const match of source.matchAll(/(^|[^\d./])(\d+)\s*\/\s*(\d+)/g)) {
      push(Number(match[2]), Number(match[3]));
    }
  }
  return [...found.values()].slice(0, 3);
}

/**
 * The simple reading of the working: a numbered list, one sentence a step.
 *
 * The engine puts the whole calculation in `explanation` for this mode, so the
 * list reads like the target the student asked for — "Split 22 into 20 + 2" —
 * instead of a card with a title, a rule chip and a separate expression line.
 */
function SimpleSteps({
  problemIndex,
  steps,
  speakingKey,
}: {
  problemIndex: number;
  steps: EngineStep[];
  speakingKey: string | null;
}) {
  return (
    <ol className="mathlab-simplesteps">
      {steps.map((step, index) => {
        const text = step.explanation || step.title;
        return (
          <li
            key={`${problemIndex}-${index}-${step.expression || text}`}
            className="mathlab-simplesteps__step"
            data-speaking={speakingKey === `p${problemIndex}s${index}`}
          >
            <span className="mathlab-simplesteps__num" aria-hidden>
              {index + 1}.
            </span>
            <span className="mathlab-simplesteps__text">
              <InlineMath text={text} />
              {step.expression ? (
                <>
                  {" — "}
                  <MathTex
                    source={step.expression.replace(/^\s*=\s*/, "")}
                    fallback={step.expression.replace(/^\s*=\s*/, "")}
                  />
                </>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FractionBars({ fractions }: { fractions: Fraction[] }) {
  if (!fractions.length) return null;
  return (
    <section className="mathlab-bars" aria-label="Fraction bars for this question">
      <p className="mathlab-bars__title">The numbers in this question, drawn to scale</p>
      {fractions.map((fraction) => {
        const bars = Math.ceil(fraction.numerator / fraction.denominator);
        return (
          <div key={`${fraction.numerator}/${fraction.denominator}`} className="mathlab-bar">
            <span className="mathlab-bar__label">
              <MathTex
                source={`\\frac{${fraction.numerator}}{${fraction.denominator}}`}
                fallback={`${fraction.numerator}/${fraction.denominator}`}
              />
            </span>
            <div className="mathlab-bar__stack">
              {Array.from({ length: bars }, (_, barIndex) => {
                const filledHere = Math.max(
                  0,
                  Math.min(fraction.denominator, fraction.numerator - barIndex * fraction.denominator),
                );
                return (
                  <div key={barIndex} className="mathlab-bar__track" aria-hidden>
                    {Array.from({ length: fraction.denominator }, (_, cellIndex) => (
                      <span
                        key={cellIndex}
                        className={"mathlab-bar__cell" + (cellIndex < filledHere ? " is-filled" : "")}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <span className="mathlab-bar__caption">
              {fraction.denominator} equal parts, {fraction.numerator} shaded
            </span>
          </div>
        );
      })}
    </section>
  );
}

export function MathLab() {
  const navigate = useNavigate();
  const { can } = usePlan();
  const solve = useAction(api.mathLab.mathSolve);
  const recordSolution = useMutation(api.mathHistory.record);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<ViewId>("solve");
  const [track, setTrack] = useState<CurriculumTrack>("CBSE");
  const [gradeId, setGradeId] = useState<string>(GRADES[0].id);
  const grade: GradeSpec = useMemo(() => getGrade(gradeId as GradeSpec["id"]), [gradeId]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = grade.chapters[chapterIndex] ?? grade.chapters[0];
  /** Empty on purpose: the first screen asks the student for their problem,
   *  it does not put a demo problem there for them. */
  const [formula, setFormula] = useState("");
  const [solution, setSolution] = useState<EngineSolution | null>(null);
  const [detail, setDetail] = useState<"simple" | "detailed">("simple");
  const [solving, setSolving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [turns, setTurns] = useState<EngineTurn[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState<"plain" | "latex" | null>(null);
  const [showWorked, setShowWorked] = useState(true);
  const [hintMode, setHintMode] = useState(false);
  const [practiceSeed, setPracticeSeed] = useState<EngineProblem | null>(null);
  const [printing, setPrinting] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [historyId, setHistoryId] = useState<Id<"mathSolutions"> | null>(null);
  const mathInputRef = useRef<MathInputHandle | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copiedTimer = useRef<number | null>(null);
  const locked = !can("mathLabBasic");

  /* Every spoken line, tagged so the step being read can light up. Maths is
     flattened to words first: a synthesiser must never spell out a LaTeX
     command or read a symbol letter by letter. */
  const speechScript = useMemo<NarrationLine[]>(() => {
    if (!solution) return [];
    const lines: NarrationLine[] = [];
    solution.problems.forEach((problem, problemIndex) => {
      lines.push({
        key: `p${problemIndex}q`,
        label: solution.problems.length > 1 ? `Problem ${problemIndex + 1}` : "Problem",
        text: speechText(problem.problem),
      });
      problem.steps.forEach((step, stepIndex) => {
        lines.push({
          key: `p${problemIndex}s${stepIndex}`,
          label: `Step ${stepIndex + 1}`,
          text: speechText(
            [step.explanation || step.title, step.expression ? `That is, ${spokenMath(step.expression)}` : ""].filter(Boolean).join(". "),
          ),
        });
      });
      lines.push({
        key: `p${problemIndex}a`,
        label: "Final answer",
        text: `The final answer is ${speechText(problem.finalAnswer)}.`,
      });
    });
    return lines;
  }, [solution]);

  const narration = useNarration(speechScript);
  const stopNarration = narration.stop;

  const hush = useCallback(() => {
    stopNarration();
    stopSpeaking();
  }, [stopNarration]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);

  /* Audio belongs to the Solve tab. Switching tabs stops the voice at once
     instead of letting it read over the Graph or Practice screen. */
  useEffect(() => {
    if (view !== "solve") stopNarration();
  }, [stopNarration, view]);

  /* Escape closes the calculator from anywhere in the lab — the drawer is the
     only floating surface here, and it should never trap the keyboard. */
  useEffect(() => {
    if (!calcOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalcOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [calcOpen]);

  const selectTrack = (next: CurriculumTrack) => {
    setTrack(next);
    setPracticeSeed(null);
    hush();
    setSolution(null);
    setTurns([]);
    setEngineError(null);
    setHistoryId(null);
  };
  const selectSkill = (nextGradeId: string, nextIndex: number) => {
    setPracticeSeed(null);
    const nextGrade = getGrade(nextGradeId as GradeSpec["id"]);
    const next = nextGrade.chapters[nextIndex];
    if (!next || (nextGrade.id === grade.id && nextIndex === chapterIndex)) return;
    hush();
    setGradeId(nextGrade.id);
    setChapterIndex(nextIndex);
    setSolution(null);
    setTurns([]);
    setEngineError(null);
    setHistoryId(null);
  };

  const askEngine = useCallback(async (parts: {
    question?: string;
    file?: { storageId: Id<"_storage">; name: string; mime?: string };
    /** A photo sent straight to the solver, so it can see the page itself. */
    image?: { base64: string; mimeType: string; name: string };
    followUp?: string;
    detail?: "simple" | "detailed";
  }) => {
    setSolving(true);
    setEngineError(null);
    try {
      const result = await solve({
        question: parts.question,
        imageBase64: parts.image?.base64,
        mimeType: parts.image?.mimeType,
        storageId: parts.file?.storageId,
        name: parts.file?.name,
        mime: parts.file?.mime,
        gradeLabel: `${track} curriculum track`,
        chapterName: chapter.name,
        chapterFormulas: chapter.formulas,
        detail: parts.detail ?? detail,
        history: parts.followUp ? turns.slice(-6) : undefined,
      });
      setSolution({ headline: result.headline, problems: result.problems, model: result.model });
        const spoken = result.problems.map((problem) => problem.finalAnswer).join(", ");
      if (parts.followUp) setTurns((current) => [...current, { role: "student", text: parts.followUp! }, { role: "lab", text: spoken }]);
      else if (parts.question) setTurns((current) => [...current, { role: "lab", text: spoken }]);

      // A fresh solve is a new entry in the history. A follow-up is the same
      // question answered again, so it does not create a second row.
      if (!parts.followUp) {
        setHistoryId(null);
        void recordSolution({
          question:
            parts.question ??
            parts.image?.name ??
            (parts.file ? parts.file.name : "A photographed question"),
          headline: result.headline,
          track,
          chapterName: chapter.name,
          method: "standard",
          problems: result.problems,
          model: result.model,
        })
          .then((id) => {
            if (id) setHistoryId(id);
          })
          .catch(() => {
            // Signed out, or the write failed: the solution is still on screen.
          });
      }
    } catch (err) {
      setEngineError(err instanceof Error && err.message ? err.message : "The engine could not reach a model just now. Try again in a minute.");
    } finally {
      setSolving(false);
    }
  }, [chapter.formulas, chapter.name, detail, recordSolution, solve, track, turns]);

  const onSubmit = useCallback(() => {
    // One box can hold several questions. Split them before asking, so each
    // arrives as its own problem with its own answer card.
    const parts = splitProblems(formula);
    if (!parts.length || solving) return;
    const question = parts.map((part) => uprightWords(part)).join("\n");
    hush();
    setSolution(null);
    setTurns((current) => [...current, { role: "student", text: question }]);
    void askEngine({ question });
  }, [askEngine, formula, hush, solving]);
  const sendFollowUp = useCallback(() => {
    const text = followUp.trim();
    if (!text || solving) return;
    // A follow-up is a new solve: the old answer must not keep being read.
    hush();
    setFollowUp("");
    setTurns((current) => [...current, { role: "student", text }]);
    void askEngine({ followUp: text });
  }, [askEngine, followUp, hush, solving]);

  const readPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    hush();
    setSolving(true);
    setEngineError(null);
    setSolution(null);
    try {
      /* A photograph goes to the solver as an image, not as text extracted by
         a separate pass. The old upload path transcribed it first, so the model
         that solved the question never saw the printed page — and a `cos` the
         transcription read as `csc` was then solved as a different problem.
         With the image in hand, the reading rules in the system prompt have
         something to apply to. */
      if (file.type.startsWith("image/") && file.size <= 3_600_000) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            const comma = result.indexOf(",");
            resolve(comma >= 0 ? result.slice(comma + 1) : "");
          };
          reader.onerror = () => reject(new Error("That photo could not be read. Try another one."));
          reader.readAsDataURL(file);
        });
        if (base64) {
          await askEngine({
            image: { base64, mimeType: file.type, name: file.name },
          });
          return;
        }
      }

      // Upload URLs from Convex are one-shot POST endpoints; a PUT is rejected
      // before the bytes are stored, which is what used to make every photo
      // fail with "did not reach the engine".
      const url = await generateUploadUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error(`The upload was refused (${response.status}).`);
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await askEngine({ file: { storageId, name: file.name, mime: file.type } });
    } catch (err) {
      setEngineError(
        err instanceof Error && err.message
          ? err.message
          : "That photo did not reach the engine. Check your connection, or type the problem instead.",
      );
      setSolving(false);
    }
  }, [askEngine, generateUploadUrl, hush]);

  const toggleMic = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setEngineError("This browser has no speech recognition — type the problem instead."); return; }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: AviaSpeechRecognitionEvent) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i += 1) heard += event.results[i][0].transcript;
      setFormula(heard.trim());
    };
    recognition.onerror = () => { setListening(false); setEngineError("I did not catch that. Tap the microphone again, or type the problem."); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setEngineError(null);
    setListening(true);
    recognition.start();
  }, [listening]);

  const totalSteps = useMemo(
    () => (solution ? solution.problems.reduce((sum, problem) => sum + problem.steps.length, 0) : 0),
    [solution],
  );
  const activeLine = speechScript.find((line) => line.key === narration.activeKey) ?? null;

  const flashCopied = useCallback((kind: "plain" | "latex") => {
    setCopied(kind);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(null), 1800);
  }, []);

  const copySolution = useCallback(() => {
    if (!solution) return;
    void navigator.clipboard?.writeText(solutionToText(solution))
      .then(() => flashCopied("plain"))
      .catch(() => setEngineError("Your browser blocked the copy. Select the text instead."));
  }, [flashCopied, solution]);

  const copyLatex = useCallback(() => {
    if (!solution) return;
    void navigator.clipboard?.writeText(solutionToLatex(solution))
      .then(() => flashCopied("latex"))
      .catch(() => setEngineError("Your browser blocked the copy. Select the text instead."));
  }, [flashCopied, solution]);

  const chooseDetail = (next: "simple" | "detailed") => {
    if (next === detail) return;
    setDetail(next);
    hush();
    const parts = splitProblems(formula);
    if (parts.length) {
      void askEngine({
        question: parts.map((part) => uprightWords(part)).join("\n"),
        detail: next,
      });
    }
  };
  const stepTransition = useCallback(
    (index: number) => stepTransitionFor(index, reduceMotion),
    [reduceMotion],
  );

  /** Open a stored solution from the history tab in the notebook. */
  const openStored = useCallback((stored: { headline: string; problems: EngineProblem[] }) => {
    hush();
    setSolution({ headline: stored.headline, problems: stored.problems, model: "history" });
    setView("solve");
    setTurns([]);
  }, [hush]);

  return (
    <div className="mathlab-page">
      <div className={"mathlab-root" + (locked ? " pointer-events-none select-none blur-[7px]" : "")} aria-hidden={locked}>
        {/* One bar: the lab's own tabs, and the search for whatever is
            currently in front of the student. The button belongs here rather
            than in the page header — this is where the question lives, and it
            is the same row on every tab. */}
        <div className="mathlab-viewbar">
          <div className="mathlab-viewbar__row">
            <nav className="mathlab-views" role="tablist" aria-label="Math Lab views">
              {VIEW_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = view === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={"mathlab-view" + (active ? " is-active" : "")}
                    onClick={() => {
                      // A carried-over practice seed belongs to the visit that
                      // created it; returning to Practice later starts fresh.
                      if (tab.id !== "practice") setPracticeSeed(null);
                      setView(tab.id);
                    }}
                  >
                    <span className="mathlab-view__icon" aria-hidden>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <SearchWithGoogle
              topic={formula.trim() || "Maths problem — NCERT CBSE explained"}
              label="Search ideas on the web"
              compact
            />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          className="mathlab-viewbody"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 32 } }
          }
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: -12, transition: { duration: 0.16, ease: "easeOut" } }
          }
        >

        {view === "solve" ? (
          <div className="mathlab-solvepage">
            <motion.section className={"mathlab-card mathlab-notebook mathlab-solvecard" + (solution ? " is-solved" : "")}>
              {solution ? (
                <header className="mathlab-notebook__head">
                  <div>
                    <p className="mathlab-card__kicker">Solution</p>
                    <h2 className="mathlab-card__title">{solution.headline}</h2>
                  </div>
                </header>
              ) : (
                <header className="mathlab-solvecard__intro">
                  <h2 className="mathlab-card__title">What are we working through?</h2>
                  <p className="mathlab-solvecard__sub">
                    Ask in maths or in words — a fraction, an equation, or a
                    question from a worksheet.
                  </p>
                </header>
              )}

              <form
                className="mathlab-input mathlab-input--hero"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmit();
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void readPhoto(event.dataTransfer.files?.[0]);
                }}
                onPaste={(event) => {
                  // A screenshot is usually copied, not saved first. Reading it
                  // straight off the clipboard is the shortest path there is.
                  const image = Array.from(event.clipboardData.files).find((file) =>
                    file.type.startsWith("image/"),
                  );
                  if (!image) return;
                  event.preventDefault();
                  void readPhoto(image);
                }}
              >
                <MathInput
                  ref={mathInputRef}
                  value={formula}
                  onChange={setFormula}
                  placeholder="Type or snap a math problem"
                  ariaLabel="Your maths problem"
                />
                <div className="mathlab-input__row">
                  <button type="button" className={"mathlab-tool" + (listening ? " is-live" : "")} onClick={toggleMic} aria-label={listening ? "Stop dictating" : "Dictate the problem"}><Mic className="h-4 w-4" /></button>
                  <button type="button" className="mathlab-tool" onClick={() => fileInputRef.current?.click()} aria-label="Photograph the question"><Camera className="h-4 w-4" /></button>
                  <motion.button
                    type="submit"
                    className="mathlab-solve"
                    disabled={solving || splitProblems(formula).length === 0}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                    whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  >
                    {solving ? <Loader2 className="spin-micro h-4 w-4" /> : null}Solve
                  </motion.button>
                </div>
              </form>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Clear the value so picking the same photo again still fires.
                  event.target.value = "";
                  void readPhoto(file ?? undefined);
                }}
              />
              {engineError && <p className="mathlab-error">{engineError}</p>}

              {!solution && !solving ? (
                <div className="mathlab-examples">
                  <span className="mathlab-examples__label">Try an example</span>
                  <div className="mathlab-examples__list">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        className="mathlab-example"
                        onClick={() => setFormula(example.value)}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {solution ? (
                <>
                  {/* One compact toolbar: Listen, Copy and a menu for the
                      actions a student reaches for less often. */}
                  <div className="mathlab-toolbar">
                    <div className="mathlab-toolbar__status">
                      <span className="mathlab-live-dot" />
                      {`${solution.problems.length > 1 ? `${solution.problems.length} problems` : "One problem"} · ${totalSteps} steps`}
                    </div>
                    <div className="mathlab-toolbar__controls">
                      <button
                        type="button"
                        className={"mathlab-tab-action" + (narration.state === "playing" ? " is-active" : "")}
                        onClick={narration.toggle}
                      >
                        {narration.state === "playing" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {narration.state === "playing" ? "Pause" : narration.state === "paused" ? "Resume" : "Listen"}
                      </button>
                      <button type="button" className={"mathlab-tab-action" + (copied === "plain" ? " is-active" : "")} onClick={copySolution}>
                        {copied === "plain" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === "plain" ? "Copied" : "Copy"}
                      </button>
                      <details className="mathlab-more">
                        <summary className="mathlab-tab-action" aria-label="More actions">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </summary>
                        <div className="mathlab-more__panel">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              copyLatex();
                            }}
                          >
                            <Code className="h-3.5 w-3.5" />
                            {copied === "latex" ? "Copied LaTeX" : "Copy LaTeX"}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              setPrinting(true);
                            }}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Export as PDF
                          </button>
                          <button
                            type="button"
                            className={hintMode ? "is-active" : undefined}
                            aria-pressed={hintMode}
                            onClick={() => setHintMode((value) => !value)}
                          >
                            <Lightbulb className="h-3.5 w-3.5" />
                            {hintMode ? "Try first: on" : "Try first"}
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>

                  {narration.state !== "idle" ? (
                    <NarrationPlayer
                      state={narration.state}
                      label={activeLine?.label ?? ""}
                      rate={narration.rate}
                      onToggle={narration.toggle}
                      onStop={narration.stop}
                      onRate={narration.setRate}
                    />
                  ) : null}

                  <div className="mathlab-sheet">
                    {solution.problems.map((problem, problemIndex) => {
                      const fractions = fractionsIn([problem.problem, problem.finalAnswer, ...problem.steps.map((step) => step.expression)]);
                      /* Problems arrive one after the other, not as one slab —
                         the reading order is the solve order. */
                      return (
                        <motion.section
                          key={`${problemIndex}-${problem.problem}`}
                          className="mathlab-sheet__problem"
                          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 260, damping: 30, delay: reduceMotion ? 0 : problemIndex * 0.09 }}
                        >
                          {solution.problems.length > 1 ? (
                            <p className="mathlab-sheet__problemno">Problem {problemIndex + 1}</p>
                          ) : null}

                          <ProblemStatement text={problem.problem} />

                          {/* Answer first. In hint mode it stays covered until
                              the student has revealed the whole method — a hint
                              that hands over the answer is not a hint. */}
                          {!hintMode || problem.steps.length === 0 ? (
                            <div className="mathlab-answer" data-corrected={problem.corrected}>
                              <span className="mathlab-answer__label">Final answer</span>
                              <div className="mathlab-answer__value">
                                <MathTex source={problem.finalAnswer} fallback={problem.finalAnswer} display />
                                {problem.verified ? (
                                  <span className="mathlab-verified" title={problem.verification || "Recomputed by the maths engine"}>
                                    <Check className="h-3.5 w-3.5" />
                                    Verified
                                  </span>
                                ) : null}
                              </div>
                              {problem.verification || problem.checkNote ? (
                                <p className="mathlab-answer__note">
                                  <ShieldCheck className="h-3 w-3 shrink-0" />
                                  <span><InlineMath text={problem.verification || problem.checkNote} /></span>
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mathlab-answer mathlab-answer--hidden">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Final answer hidden while you try it first.
                            </p>
                          )}

                          <FractionBars fractions={fractions} />

                          <div className="mathlab-steps">
                            <div className="mathlab-steps__head">
                              <span className="mathlab-steps__label">
                                {hintMode ? "Try each move" : "Working"}
                              </span>
                              <div className="mathlab-detail" role="group" aria-label="Detail level">
                                {DETAIL_OPTIONS.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    data-active={detail === option.id}
                                    aria-pressed={detail === option.id}
                                    disabled={solving}
                                    onClick={() => chooseDetail(option.id)}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {showWorked ? (
                              hintMode ? (
                                <StepList
                                  key={`hint-${problemIndex}-${problem.steps.length}`}
                                  problemIndex={problemIndex}
                                  problem={problem.problem}
                                  steps={problem.steps}
                                  reduceMotion={Boolean(reduceMotion)}
                                  speakingKey={narration.activeKey}
                                  hintMode
                                  track={track}
                                  chapterName={chapter.name}
                                  stepTransition={stepTransition}
                                />
                              ) : detail === "simple" ? (
                                <SimpleSteps
                                  problemIndex={problemIndex}
                                  steps={problem.steps}
                                  speakingKey={narration.activeKey}
                                />
                              ) : (
                                <StepList
                                  key={`plain-${problemIndex}-${problem.steps.length}`}
                                  problemIndex={problemIndex}
                                  problem={problem.problem}
                                  steps={problem.steps}
                                  reduceMotion={Boolean(reduceMotion)}
                                  speakingKey={narration.activeKey}
                                  hintMode={false}
                                  track={track}
                                  chapterName={chapter.name}
                                  stepTransition={stepTransition}
                                />
                              )
                            ) : (
                              <p className="mathlab-steps__hidden">
                                The worked solution is hidden. Use “Show the worked
                                solution” below to bring it back.
                              </p>
                            )}
                          </div>

                          <div className="mathlab-sheet__actions">
                            <CheckMyWork
                              problem={problem.problem}
                              steps={problem.steps}
                              finalAnswer={problem.finalAnswer}
                              solutionId={historyId}
                            />
                            <button
                              type="button"
                              className="mathlab-tab-action"
                              onClick={() => {
                                // The Practice tab owns the "Your problem" box;
                                // carry this problem there as the seed so the new
                                // question is genuinely similar to it.
                                setPracticeSeed(problem);
                                setView("practice");
                              }}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Another similar problem
                            </button>                            
                            <button
                              type="button"
                              className="mathlab-tab-action"
                              onClick={() => {
                                // Photographs are read by a model; a reciprocal
                                // pair (cos / csc) is the classic misread. This
                                // hands the transcription back to the student
                                // for a one-word correction instead of making
                                // them retake the picture. Only the maths is
                                // carried into the editor — prose would be set
                                // as a run of italic letters.
                                const maths = [...problem.problem.matchAll(/\$([^$]+)\$/g)].map(
                                  (match) => match[1],
                                );
                                setFormula(maths.length ? maths.join(" ") : problem.problem);
                                hush();
                                setSolution(null);
                                setTurns([]);
                                setEngineError(null);
                              }}
                            >
                              <PenLine className="h-3.5 w-3.5" />
                              Edit this question
                            </button>
                            <button type="button" className="mathlab-tab-action" onClick={() => setShowWorked((value) => !value)}>
                              {showWorked ? "Hide the worked solution" : "Show the worked solution"}
                            </button>
                          </div>

                          {problem.given.length || problem.formulas.length ? (
                            <Fold label="Given data and governing formulas" defaultOpen={false}>
                              <div className="mathlab-fold__grid">
                                <div>
                                  <p className="mathlab-fold__label">Given data</p>
                                  <DetailList entries={problem.given} />
                                </div>
                                <div>
                                  <p className="mathlab-fold__label">Governing formulas</p>
                                  <DetailList entries={problem.formulas} latex />
                                </div>
                              </div>
                            </Fold>
                          ) : null}
                        </motion.section>
                      );
                    })}

                  </div>
                </>
              ) : null}

              {solution ? (
                <div className="mathlab-ask">
                  <input value={followUp} onChange={(event) => setFollowUp(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendFollowUp(); } }} placeholder="Is this correct? Ask about any step…" disabled={solving} aria-label="Ask about this solution" className="mathlab-ask__field" />
                  <button type="button" className="mathlab-ask__send" disabled={solving || !followUp.trim()} onClick={sendFollowUp} aria-label="Send"><CornerDownLeft className="h-3.5 w-3.5" /></button>
                </div>
              ) : null}
            </motion.section>
          </div>
        ) : view === "graph" ? (
          <section className="mathlab-card mathlab-viewcard">
            <GraphingCalculator />
          </section>
        ) : view === "tools" ? (
          <section className="mathlab-card mathlab-viewcard">
            <FormulaSheet />
          </section>
        ) : view === "practice" ? (
          <PracticeTab
            track={track}
            onTrack={(next) => selectTrack(next as CurriculumTrack)}
            gradeId={grade.id}
            chapterIndex={chapterIndex}
            seed={practiceSeed}
            onSelect={(nextGradeId, nextIndex) => selectSkill(nextGradeId, nextIndex)}
          />
        ) : (
          <section className="mathlab-card mathlab-viewcard">
            <MathHistory onOpen={openStored} />
          </section>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* The calculator, parked bottom-left. Avia's tutor orb owns the
          bottom-right corner of every page and sat directly on top of this
          button; the tool now lives in the empty corner, above the drawer it
          opens. */}
      {!locked ? (
        <>
          <motion.button
            type="button"
            className={"mathlab-calc-fab" + (calcOpen ? " is-open" : "")}
            onClick={() => setCalcOpen((value) => !value)}
            aria-expanded={calcOpen}
            aria-label={calcOpen ? "Hide the calculator" : "Open the calculator"}
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            transition={{ type: "spring", stiffness: 340, damping: 24 }}
          >
            <span className="mathlab-calc-fab__halo" aria-hidden />
            <span className="mathlab-calc-fab__ring" aria-hidden />
            <span className="mathlab-calc-fab__core">
              <Calculator className="h-5 w-5" />
            </span>
            <span className="mathlab-calc-fab__label" aria-hidden>
              {calcOpen ? "Hide calculator" : "Calculator"}
            </span>
          </motion.button>
          <AnimatePresence>
            {calcOpen ? (
              <motion.aside
                className="mathlab-calc-drawer"
                initial={reduceMotion ? { opacity: 0 } : { y: 26, opacity: 0, scale: 0.94 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { y: 20, opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 330, damping: 30, mass: 0.9 }}
                style={{ transformOrigin: "0% 100%" }}
                aria-label="Scientific calculator"
              >
                <ScientificCalculator onClose={() => setCalcOpen(false)} />
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}

      <PrintSheet
        solution={printing ? solution : null}
        meta={`${track} · ${chapter.name}`}
        onDone={() => setPrinting(false)}
      />

      {locked && <div className="absolute inset-0 z-20 flex items-start justify-center pt-16"><div className="premium-glass max-w-md p-7 text-center"><span className="lock-orb mx-auto"><Lock className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">Premium workspace</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Math Lab</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-dim">A connected mathematics notebook with exact arithmetic, focused reading and simple or detailed working for every method.</p><div className="mt-6 flex justify-center"><MovingBorderButton onClick={() => navigate("/pricing")} innerClassName="px-6 py-3 text-sm">View plans<ArrowRight className="h-4 w-4" /></MovingBorderButton></div></div></div>}
    </div>
  );
}

export default MathLab;


