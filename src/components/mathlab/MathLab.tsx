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
import { PracticePanel } from "@/components/mathlab/PracticePanel";
import { GraphingCalculator } from "@/components/mathlab/GraphingCalculator";
import { ScientificCalculator } from "@/components/mathlab/ScientificCalculator";
import { FormulaSheet } from "@/components/mathlab/FormulaSheet";
import { MathHistory } from "@/components/mathlab/MathHistory";
import { PrintSheet } from "@/components/mathlab/PrintSheet";
import { PracticeTab } from "@/components/mathlab/PracticeTab";
import { splitProblems, uprightWords } from "@/components/mathlab/problems";
import { DetailList, Fold, InlineMath } from "@/components/mathlab/parts";
import {
  plainProse,
  solutionToLatex,
  solutionToText,
  spokenMath,
  stepTransitionFor,
  type EngineProblem,
  type EngineSolution,
  type EngineTurn,
  type SolveMethod,
} from "@/components/mathlab/solution";
import "@/components/mathlab/mathlab.css";
import { pickAviaVoice, speakText, stopSpeaking } from "@/components/voice/avia";
import {
  ArrowRight,
  Calculator,
  Camera,
  Check,
  Code,
  Copy,
  CornerDownLeft,
  Eye,
  EyeOff,
  FileDown,
  History,
  Lightbulb,
  LineChart,
  Loader2,
  Lock,
  Mic,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

type CurriculumTrack = "CBSE" | "NCERT" | "IB" | "IGCSE";

/* The three ways the same solution can be explained, as tabs INSIDE the
   solved paper. The cards these replace used to sit above the input, so a
   student had to choose a teaching style before typing a question. */
const METHOD_OPTIONS: Array<{ id: SolveMethod; label: string }> = [
  { id: "standard", label: "Steps" },
  { id: "visual", label: "Visual" },
  { id: "analogy", label: "Real-world" },
];

const VIEW_TABS = [
  { id: "solve", label: "Solve", icon: PenLine },
  { id: "graph", label: "Graph", icon: LineChart },
  { id: "tools", label: "Calculator & Formulas", icon: Calculator },
  { id: "history", label: "History", icon: History },
  { id: "practice", label: "Practice", icon: Sparkles },
] as const;
type ViewId = (typeof VIEW_TABS)[number]["id"];

/** Three real entry points, one per kind of question the lab is good at. */
const EXAMPLES: Array<{ label: string; value: string }> = [
  { label: "2/3 + 1/6", value: "\\frac{2}{3} + \\frac{1}{6}" },
  { label: "3x + 5 = 20", value: "3x + 5 = 20" },
  { label: "x² − 5x + 6 = 0", value: "x^{2} - 5x + 6 = 0" },
];

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
  const [method, setMethod] = useState<SolveMethod>("standard");
  const [solving, setSolving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [turns, setTurns] = useState<EngineTurn[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [copied, setCopied] = useState<"plain" | "latex" | null>(null);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const [hintMode, setHintMode] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [historyId, setHistoryId] = useState<Id<"mathSolutions"> | null>(null);
  const mathInputRef = useRef<MathInputHandle | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copiedTimer = useRef<number | null>(null);
  const locked = !can("mathLabBasic");

  const aviaVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voiceRef.current || !voices.includes(voiceRef.current)) voiceRef.current = pickAviaVoice(voices) ?? voices[0] ?? null;
    return voiceRef.current;
  }, []);
  const hush = useCallback(() => {
    stopSpeaking();
    setSpeakingKey(null);
    setWalking(false);
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    stopSpeaking();
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);

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
    hush();
    setSolution(null);
    setTurns([]);
    setEngineError(null);
    setOpenSteps({});
    setHistoryId(null);
  };
  const selectSkill = (nextGradeId: string, nextIndex: number) => {
    const nextGrade = getGrade(nextGradeId as GradeSpec["id"]);
    const next = nextGrade.chapters[nextIndex];
    if (!next || (nextGrade.id === grade.id && nextIndex === chapterIndex)) return;
    hush();
    setGradeId(nextGrade.id);
    setChapterIndex(nextIndex);
    setSolution(null);
    setTurns([]);
    setEngineError(null);
    setOpenSteps({});
    setHistoryId(null);
  };

  const askEngine = useCallback(async (parts: { question?: string; file?: { storageId: Id<"_storage">; name: string; mime?: string }; followUp?: string; method?: SolveMethod }) => {
    setSolving(true);
    setEngineError(null);
    try {
      const result = await solve({
        question: parts.question,
        storageId: parts.file?.storageId,
        name: parts.file?.name,
        mime: parts.file?.mime,
        gradeLabel: `${track} curriculum track`,
        chapterName: chapter.name,
        chapterFormulas: chapter.formulas,
        method: parts.method ?? method,
        history: parts.followUp ? turns.slice(-6) : undefined,
      });
      setSolution({ headline: result.headline, problems: result.problems, model: result.model });
      setOpenSteps({});
      const spoken = result.problems.map((problem) => problem.finalAnswer).join(", ");
      if (parts.followUp) setTurns((current) => [...current, { role: "student", text: parts.followUp! }, { role: "lab", text: spoken }]);
      else if (parts.question) setTurns((current) => [...current, { role: "lab", text: spoken }]);

      // A fresh solve is a new entry in the history. A follow-up is the same
      // question answered again, so it does not create a second row.
      if (!parts.followUp) {
        setHistoryId(null);
        void recordSolution({
          question: parts.question ?? (parts.file ? parts.file.name : "A photographed question"),
          headline: result.headline,
          track,
          chapterName: chapter.name,
          method: parts.method ?? method,
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
  }, [chapter.formulas, chapter.name, method, recordSolution, solve, track, turns]);

  const onSubmit = useCallback(() => {
    // One box can hold several questions. Split them before asking, so each
    // arrives as its own problem with its own answer card.
    const parts = splitProblems(formula);
    if (!parts.length || solving) return;
    const question = parts.map((part) => uprightWords(part)).join("\n");
    hush();
    setSolution(null);
    setOpenSteps({});
    setTurns((current) => [...current, { role: "student", text: question }]);
    void askEngine({ question });
  }, [askEngine, formula, hush, solving]);
  const sendFollowUp = useCallback(() => {
    const text = followUp.trim();
    if (!text || solving) return;
    setFollowUp("");
    setTurns((current) => [...current, { role: "student", text }]);
    void askEngine({ followUp: text });
  }, [askEngine, followUp, solving]);

  const readPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    hush();
    setSolving(true);
    setEngineError(null);
    setSolution(null);
    try {
      const url = await generateUploadUrl();
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!response.ok) throw new Error("upload rejected");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await askEngine({ file: { storageId, name: file.name, mime: file.type } });
    } catch {
      setEngineError("That photo did not reach the engine. Check your connection, or type the problem instead.");
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

  /** Every spoken line, tagged so the step being read can light up. */
  const speechScript = useMemo(() => {
    if (!solution) return [] as { key: string; text: string }[];
    const lines: { key: string; text: string }[] = [];
    solution.problems.forEach((problem, problemIndex) => {
      lines.push({
        key: `p${problemIndex}q`,
        text: solution.problems.length > 1
          ? `Problem ${problemIndex + 1}. ${spokenMath(problem.problem)}`
          : spokenMath(problem.problem),
      });
      problem.steps.forEach((step, stepIndex) => {
        lines.push({
          key: `p${problemIndex}s${stepIndex}`,
          text: [step.title, plainProse(step.explanation), spokenMath(step.expression), `${step.rule}.`].filter(Boolean).join(". "),
        });
      });
      lines.push({ key: `p${problemIndex}a`, text: `And the final answer is ${spokenMath(problem.finalAnswer)}.` });
    });
    return lines;
  }, [solution]);
  const totalSteps = useMemo(
    () => (solution ? solution.problems.reduce((sum, problem) => sum + problem.steps.length, 0) : 0),
    [solution],
  );
  const readAll = useCallback(() => {
    if (walking) { hush(); return; }
    if (!speechScript.length) return;
    let cursor = 0;
    setWalking(true);
    const next = () => {
      if (cursor >= speechScript.length) { setWalking(false); setSpeakingKey(null); return; }
      const entry = speechScript[cursor];
      cursor += 1;
      setSpeakingKey(entry.key);
      speakText(entry.text, aviaVoice(), next, cursor === 1);
    };
    next();
  }, [aviaVoice, hush, speechScript, walking]);

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

  const chooseMethod = (next: SolveMethod) => {
    setMethod(next);
    hush();
    const parts = splitProblems(formula);
    if (parts.length) {
      void askEngine({
        question: parts.map((part) => uprightWords(part)).join("\n"),
        method: next,
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
    setOpenSteps({});
    setView("solve");
    setTurns([]);
  }, [hush]);

  return (
    <div className="mathlab-page">
      <div className={"mathlab-root" + (locked ? " pointer-events-none select-none blur-[7px]" : "")} aria-hidden={locked}>
        <nav className="mathlab-views" role="tablist" aria-label="Math Lab views">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={"mathlab-view" + (active ? " is-active" : "")}
                onClick={() => setView(tab.id)}
                whileHover={reduceMotion ? undefined : { y: -1.5 }}
                whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
              >
                {/* One pill travels between the tabs, so switching views reads
                    as moving the same object rather than lighting a new one. */}
                {active ? (
                  <motion.span
                    layoutId="mathlab-view-pill"
                    className="mathlab-view__pill"
                    aria-hidden
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                ) : null}
                <motion.span
                  className="mathlab-view__icon"
                  aria-hidden
                  animate={reduceMotion ? undefined : { rotate: active ? -8 : 0, scale: active ? 1.08 : 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </motion.span>
                {tab.label}
              </motion.button>
            );
          })}
        </nav>

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
                  <p className="mathlab-card__kicker">Solve</p>
                  <h2 className="mathlab-card__title">What are we working through?</h2>
                  <p className="mathlab-solvecard__sub">
                    Ask in maths or in words — a fraction, an equation, or a
                    question from a worksheet.
                  </p>
                </header>
              )}

              <form className="mathlab-input mathlab-input--hero" onSubmit={(event) => { event.preventDefault(); onSubmit(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void readPhoto(event.dataTransfer.files?.[0]); }}>
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
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(event) => void readPhoto(event.target.files?.[0] ?? undefined)} />
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
                  {/* A compact toolbar, never sticky: it used to float over the
                      method cards and cover them. */}
                  <div className="mathlab-toolbar">
                    <div className="mathlab-toolbar__status">
                      <span className="mathlab-live-dot" />
                      {walking ? "Reading it aloud" : `${solution.problems.length > 1 ? `${solution.problems.length} problems` : "One problem"} · ${totalSteps} steps`}
                    </div>
                    <div className="mathlab-toolbar__controls">
                      <button type="button" className={"mathlab-tab-action" + (walking ? " is-active" : "")} onClick={readAll}>
                        {walking ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {walking ? "Stop walkthrough" : "Listen"}
                      </button>
                      <button type="button" className="mathlab-tab-action" onClick={() => speakText(speechScript.map((entry) => entry.text).join(". "), aviaVoice(), undefined, true)}>
                        <Volume2 className="h-3.5 w-3.5" />Audio reader
                      </button>
                      <button type="button" className={"mathlab-tab-action" + (hintMode ? " is-active" : "")} onClick={() => setHintMode((value) => !value)} aria-pressed={hintMode}>
                        <Lightbulb className="h-3.5 w-3.5" />
                        {hintMode ? "Try first: on" : "Try first"}
                      </button>
                      <button type="button" className={"mathlab-tab-action" + (copied === "plain" ? " is-active" : "")} onClick={copySolution}>
                        {copied === "plain" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === "plain" ? "Copied" : "Copy"}
                      </button>
                      <button type="button" className={"mathlab-tab-action" + (copied === "latex" ? " is-active" : "")} onClick={copyLatex}>
                        {copied === "latex" ? <Check className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                        {copied === "latex" ? "Copied" : "Copy LaTeX"}
                      </button>
                      <button type="button" className="mathlab-tab-action" onClick={() => setPrinting(true)}>
                        <FileDown className="h-3.5 w-3.5" />
                        Export as PDF
                      </button>
                    </div>
                  </div>

                  {/* The three ways of explaining the SAME answer, as tabs —
                      they belong to the solved paper, not to the question. */}
                  <div className="mathlab-explain" role="tablist" aria-label="Explain it as">
                    <span className="mathlab-explain__label">Explain it as</span>
                    {METHOD_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={method === option.id}
                        className={"mathlab-explain__tab" + (method === option.id ? " is-active" : "")}
                        onClick={() => chooseMethod(option.id)}
                        disabled={solving}
                      >
                        {option.label}
                      </button>
                    ))}
                    {solving ? <Loader2 className="spin-micro h-3.5 w-3.5" aria-hidden /> : null}
                  </div>

                  <div className="mathlab-solution">
                    {solution.problems.map((problem, problemIndex) => {
                      const expanded = openSteps[problemIndex] !== false;
                      const fractions = fractionsIn([problem.problem, problem.finalAnswer, ...problem.steps.map((step) => step.expression)]);
                      /* Problems arrive one after the other, not as one slab —
                         the reading order is the solve order. */
                      return (
                        <motion.section
                          key={`${problemIndex}-${problem.problem}`}
                          className="mathlab-problem"
                          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 260, damping: 30, delay: reduceMotion ? 0 : problemIndex * 0.09 }}
                        >
                          <header className="mathlab-problem__head">
                            <span className="mathlab-problem__index">{solution.problems.length > 1 ? `Problem ${problemIndex + 1}` : "Problem"}</span>
                            <h3 className="mathlab-problem__title">{problem.title}</h3>
                          </header>

                          <div className="mathlab-problem__statement">
                            <MathTex source={problem.problem} fallback={problem.problem} display />
                          </div>

                          {/* In hint mode the answer stays covered until the
                              student has revealed the whole method — a hint
                              that hands over the answer is not a hint. */}
                          {!hintMode || problem.steps.length === 0 ? (
                            <div className="mathlab-verdict" data-corrected={problem.corrected}>
                              <span className="mathlab-verdict__label">Final answer</span>
                              <div className="mathlab-verdict__value">
                                <MathTex source={problem.finalAnswer} fallback={problem.finalAnswer} display />
                                {problem.verified ? (
                                  <span className="mathlab-verified" title={problem.verification || "Recomputed by the maths engine"}>
                                    <Check className="h-3.5 w-3.5" />
                                    Verified
                                  </span>
                                ) : null}
                              </div>
                              {problem.verification || problem.checkNote ? (
                                <p className="mathlab-verdict__note">
                                  <ShieldCheck className="h-3 w-3 shrink-0" />
                                  <span><InlineMath text={problem.verification || problem.checkNote} /></span>
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mathlab-verdict mathlab-verdict--hidden">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Final answer hidden while you try it first.
                            </p>
                          )}

                          <FractionBars fractions={fractions} />

                          {hintMode ? (
                            <StepList
                              key={`hint-${problemIndex}-${problem.steps.length}`}
                              problemIndex={problemIndex}
                              problem={problem.problem}
                              steps={problem.steps}
                              reduceMotion={Boolean(reduceMotion)}
                              speakingKey={speakingKey}
                              hintMode
                              track={track}
                              chapterName={chapter.name}
                              stepTransition={stepTransition}
                            />
                          ) : (
                            <div className="mathlab-work">
                              <button type="button" className="mathlab-work__toggle" aria-expanded={expanded} onClick={() => setOpenSteps((current) => ({ ...current, [problemIndex]: !expanded }))}>
                                {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                {expanded ? "Hide steps" : `Show steps (${problem.steps.length})`}
                              </button>
                              <AnimatePresence initial={false}>
                                {expanded ? (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
                                  >
                                    <StepList
                                      key={`plain-${problemIndex}-${problem.steps.length}`}
                                      problemIndex={problemIndex}
                                      problem={problem.problem}
                                      steps={problem.steps}
                                      reduceMotion={Boolean(reduceMotion)}
                                      speakingKey={speakingKey}
                                      hintMode={false}
                                      track={track}
                                      chapterName={chapter.name}
                                      stepTransition={stepTransition}
                                    />
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          )}

                          <CheckMyWork
                            problem={problem.problem}
                            steps={problem.steps}
                            finalAnswer={problem.finalAnswer}
                            solutionId={historyId}
                          />

                          <PracticePanel
                            problem={problem.problem}
                            steps={problem.steps}
                            finalAnswer={problem.finalAnswer}
                            track={track}
                            chapterName={chapter.name}
                            chapterFormulas={chapter.formulas}
                          />

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

      {locked && <div className="absolute inset-0 z-20 flex items-start justify-center pt-16"><div className="premium-glass max-w-md p-7 text-center"><span className="lock-orb mx-auto"><Lock className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">Premium workspace</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Math Lab</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-dim">A connected mathematics notebook with exact arithmetic, focused reading and three ways to understand every method.</p><div className="mt-6 flex justify-center"><MovingBorderButton onClick={() => navigate("/pricing")} innerClassName="px-6 py-3 text-sm">View plans<ArrowRight className="h-4 w-4" /></MovingBorderButton></div></div></div>}
    </div>
  );
}

export default MathLab;
