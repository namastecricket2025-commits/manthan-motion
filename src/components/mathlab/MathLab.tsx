import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { usePlan } from "@/components/plans/PlanProvider";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  coreDefinitions,
  coreFormulas,
  getGrade,
  GRADES,
  modelById,
  type CheatEntry,
  type GradeSpec,
  type PlotModel,
} from "@/components/mathlab/mathlab";
import { GraphCanvas } from "@/components/mathlab/GraphCanvas";
import { MathTex } from "@/components/mathlab/latex";
import "@/components/mathlab/mathlab.css";
import { pickAviaVoice, speakText, stopSpeaking } from "@/components/voice/avia";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  CornerDownLeft,
  Expand,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mic,
  Minimize,
  Play,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { parse as parseMath } from "mathjs";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

interface EngineTurn {
  role: "student" | "lab";
  text: string;
}

type SolveMethod = "standard" | "visual" | "analogy";

/** One move of a solution, exactly as the engine and the checker return it. */
interface EngineStep {
  title: string;
  explanation: string;
  expression: string;
  rule: string;
}

/** One question, with its own working and its own answer card. */
interface EngineProblem {
  problem: string;
  title: string;
  given: string[];
  formulas: string[];
  steps: EngineStep[];
  finalAnswer: string;
  verification: string;
  /** True when an independent engine confirmed or corrected this answer. */
  verified: boolean;
  /** True when the checker's own value replaced the engine's. */
  corrected: boolean;
  /** What the independent engine found, in one sentence. */
  checkNote: string;
}

interface EngineSolution {
  headline: string;
  problems: EngineProblem[];
  model: string;
}

const CURRICULUM_TRACKS = ["CBSE", "NCERT", "IB", "IGCSE"] as const;
type CurriculumTrack = (typeof CURRICULUM_TRACKS)[number];

const METHOD_OPTIONS: Array<{ id: SolveMethod; label: string; note: string }> = [
  { id: "standard", label: "Standard Algebraic Proof", note: "Symbols, identities and exact manipulation" },
  { id: "visual", label: "Visual Fraction Blocks / Number Lines", note: "See the quantities move on a bar or line" },
  { id: "analogy", label: "Step-by-step Real World Analogy", note: "Map the problem to something familiar" },
];

function defaultsFor(model: PlotModel): Record<string, number> {
  const values: Record<string, number> = {};
  for (const param of model.params) values[param.key] = param.value;
  return values;
}

/** MathJS is used only for a local shape check; the answer still comes from the exact backend checker. */
function inspectStructure(input: string) {
  const source = input.replace(/−|–|—/g, "-").replace(/÷/g, "/").replace(/×/g, "*");
  const sides = source.split("=");
  const expression = sides[0]?.trim() || source;
  try {
    const node = parseMath(expression);
    const terms = String(node.toString());
    const exponentCount = (terms.match(/\^/g) ?? []).length;
    const variableCount = (terms.match(/\b[a-zA-Z]\b/g) ?? []).length;
    if (exponentCount > 0) return "Quadratic or higher-power expression detected";
    if (variableCount > 0) return "Linear expression detected";
    return "Numeric expression detected";
  } catch {
    return "Word problem detected — the tutor will name the structure";
  }
}

/* ------------------------------------------------------------------ */
/* Rendering the structured solution                                   */
/* ------------------------------------------------------------------ */

/**
 * Inline maths inside prose.
 *
 * Everything outside a `$...$` run is ordinary text and is rendered as such —
 * the bug this replaces was feeding whole English sentences to KaTeX, which
 * dropped the spaces and turned the words into italic mush. Only the runs the
 * engine explicitly marked as maths ever reach the typesetter.
 */
function InlineMath({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/\$([^$]+)\$/g), [text]);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <MathTex key={index} source={part} fallback={part} />
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function Explanation({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mathlab-walk__prose">
      <InlineMath text={text} />
    </p>
  );
}

/**
 * One expression, in display mode.
 *
 * A step that carries several equivalent lines arrives separated by `\\` or a
 * newline; each line is typeset on its own so nothing is squashed into one
 * unreadable row. A line KaTeX cannot parse falls back to its own characters
 * (see `MathTex`) rather than garbling the step.
 */
function Expression({ source }: { source: string }) {
  const lines = useMemo(
    () => source.split(/\\\\|\n/).map((line) => line.trim()).filter(Boolean),
    [source],
  );
  if (!lines.length) return null;
  return (
    <div className="mathlab-walk__math">
      {lines.map((line, index) => (
        <MathTex key={`${index}-${line}`} source={line} fallback={line} display />
      ))}
    </div>
  );
}

/** A rule name, or a short prose note, kept as plain text. */
function InlineFormula({ source }: { source: string }) {
  return <MathTex source={source} fallback={source} />;
}

/**
 * A `Given data` / `Governing formulas` list, read off the question itself.
 *
 * Inline maths only, wrapped rather than scrolled: the old panel scrolled
 * sideways because each formula was typeset in display mode inside a narrow
 * column.
 */
function DetailList({ entries, latex = false }: { entries: string[]; latex?: boolean }) {
  if (!entries.length) return null;
  return (
    <ul className="mathlab-note-list">
      {entries.map((entry) => (
        <li key={entry} className="mathlab-note-list__row">
          {latex ? <InlineFormula source={entry} /> : <InlineMath text={entry} />}
        </li>
      ))}
    </ul>
  );
}

function Fold({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mathlab-fold" data-open={open}>
      <button
        type="button"
        className="mathlab-fold__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className="mathlab-fold__chev" aria-hidden />
        <span>{label}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="mathlab-fold__body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
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
 * The left-hand graph used to be shown for every question, always plotting the
 * chapter's `y = k/x` whether or not a curve had anything to do with the work.
 * A fraction question gets a picture of its own numbers instead, and a question
 * with no fractions gets no picture at all rather than an empty panel.
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

/* ------------------------------------------------------------------ */
/* Reading the solution aloud, and copying it                          */
/* ------------------------------------------------------------------ */

/** LaTeX that reads sensibly when a speech synthesiser says it. */
function spokenMath(source: string) {
  return source
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 over $2")
    .replace(/\\sqrt\{([^{}]+)\}/g, "the square root of $1")
    .replace(/\\times/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\le/g, " is less than or equal to ")
    .replace(/\\ge/g, " is greater than or equal to ")
    .replace(/\^{2}/g, " squared ")
    .replace(/\^\{?(\d+)\}?/g, " to the power $1 ")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prose with its inline maths flattened for the clipboard. */
function plainProse(text: string) {
  return text.replace(/\$([^$]+)\$/g, (_match, inner: string) => spokenMath(inner));
}

/** One line of a solution as clean, readable text. */
function plainLine(source: string) {
  return spokenMath(source);
}

export function MathLab() {
  const navigate = useNavigate();
  const { can } = usePlan();
  const solve = useAction(api.mathLab.mathSolve);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);
  const reduceMotion = useReducedMotion();
  const [track, setTrack] = useState<CurriculumTrack>("CBSE");
  const [gradeId, setGradeId] = useState<string>(GRADES[0].id);
  const grade: GradeSpec = useMemo(() => getGrade(gradeId as GradeSpec["id"]), [gradeId]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = grade.chapters[chapterIndex] ?? grade.chapters[0];
  const skillChapters = useMemo(
    () => GRADES.flatMap((entry) => entry.chapters.map((item, index) => ({ grade: entry, chapter: item, index }))),
    [],
  );
  const model = useMemo(() => modelById(chapter.plot, grade.models[0]), [chapter, grade]);
  const params = useMemo(() => defaultsFor(model), [model]);
  const [formula, setFormula] = useState(chapter.example);
  const [solution, setSolution] = useState<EngineSolution | null>(null);
  const [method, setMethod] = useState<SolveMethod>("standard");
  const [solving, setSolving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [turns, setTurns] = useState<EngineTurn[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [copied, setCopied] = useState<"plain" | "latex" | null>(null);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skillPathRef = useRef<HTMLDivElement | null>(null);
  const copiedTimer = useRef<number | null>(null);
  const locked = !can("mathLabBasic");
  const structure = useMemo(() => inspectStructure(formula), [formula]);

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

  const selectTrack = (next: CurriculumTrack) => {
    setTrack(next);
    hush();
    setSolution(null);
    setTurns([]);
    setEngineError(null);
    setOpenSteps({});
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
    setFormula(next.example);
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
    } catch (err) {
      setEngineError(err instanceof Error && err.message ? err.message : "The engine could not reach a model just now. Try again in a minute.");
    } finally {
      setSolving(false);
    }
  }, [chapter.formulas, chapter.name, method, solve, track, turns]);

  const onSubmit = useCallback(() => {
    const input = formula.trim();
    if (!input || solving) return;
    hush();
    setSolution(null);
    setOpenSteps({});
    setTurns((current) => [...current, { role: "student", text: input }]);
    void askEngine({ question: input });
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

  /** The whole solution as plain, readable text. */
  const copySolution = useCallback(() => {
    if (!solution) return;
    const lines: string[] = [solution.headline, ""];
    solution.problems.forEach((problem, problemIndex) => {
      if (solution.problems.length > 1) lines.push(`Problem ${problemIndex + 1}`);
      lines.push(problem.title, plainLine(problem.problem), "");
      problem.steps.forEach((step, stepIndex) => {
        lines.push(`${stepIndex + 1}. [${step.rule}] ${plainProse(step.explanation)}`);
        if (step.expression) lines.push(`   ${plainLine(step.expression)}`);
      });
      lines.push("", `FINAL ANSWER: ${plainLine(problem.finalAnswer)}`);
      if (problem.verification) lines.push(`Check: ${plainProse(problem.verification)}`);
      lines.push("");
    });
    void navigator.clipboard?.writeText(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim())
      .then(() => flashCopied("plain"))
      .catch(() => setEngineError("Your browser blocked the copy. Select the text instead."));
  }, [flashCopied, solution]);

  /** The same solution as LaTeX source, for pasting into notes or a paper. */
  const copyLatex = useCallback(() => {
    if (!solution) return;
    const chunks: string[] = [`% ${solution.headline}`];
    solution.problems.forEach((problem, problemIndex) => {
      if (solution.problems.length > 1) chunks.push(`% Problem ${problemIndex + 1}`);
      chunks.push("\\begin{aligned}", problem.problem, "\\end{aligned}");
      problem.steps.forEach((step) => {
        if (step.rule) chunks.push(`% ${step.rule}`);
        if (step.expression) chunks.push("\\begin{aligned}", step.expression, "\\end{aligned}");
      });
      chunks.push("% Final answer", `\\boxed{${problem.finalAnswer}}`, "");
    });
    void navigator.clipboard?.writeText(chunks.join("\n"))
      .then(() => flashCopied("latex"))
      .catch(() => setEngineError("Your browser blocked the copy. Select the text instead."));
  }, [flashCopied, solution]);

  const chooseMethod = (next: SolveMethod) => {
    setMethod(next);
    hush();
    if (formula.trim()) void askEngine({ question: formula.trim(), method: next });
  };
  const scrollSkills = useCallback((direction: -1 | 1) => {
    skillPathRef.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
  }, []);
  const givens = useMemo(() => coreDefinitions(chapter), [chapter]);
  const formulas = useMemo(() => coreFormulas(chapter), [chapter]);
  const everyVerified = Boolean(solution && solution.problems.length > 0 && solution.problems.every((problem) => problem.verified));
  const stepTransition = useCallback(
    (index: number) => ({
      type: "tween" as const,
      duration: 0.34,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      delay: reduceMotion ? 0 : Math.min(index, 8) * 0.05,
    }),
    [reduceMotion],
  );

  return (
    <div className="relative">
      <div className={"mathlab-root" + (locked ? " pointer-events-none select-none blur-[7px]" : "")} aria-hidden={locked}>
        <div className="mathlab-commandbar">
          <div className="mathlab-track">
            <span className="mathlab-commandbar__label">Curriculum Track</span>
            <div className="mathlab-select-wrap">
              <select value={track} onChange={(event) => selectTrack(event.target.value as CurriculumTrack)} aria-label="Curriculum Track">
                {CURRICULUM_TRACKS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </div>
          </div>
          <div className="mathlab-commandbar__path">
            <span>Skill path</span>
            <span className="mathlab-commandbar__crumb">{chapter.focus}</span>
            <span className="mathlab-commandbar__slash">/</span>
            <span>{chapter.name}</span>
          </div>
          <div className="mathlab-focus-toggle">
            <button type="button" className="mathlab-focus" onClick={() => setFullScreen((value) => !value)} aria-pressed={fullScreen}>
              {fullScreen ? <Minimize className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
              {fullScreen ? "Exit Full Screen" : "Full Screen View"}
            </button>
          </div>
        </div>

        <div className="mathlab-skillpath-shell">
          <button type="button" className="mathlab-skillpath-arrow mathlab-skillpath-arrow--left" onClick={() => scrollSkills(-1)} aria-label="Scroll chapters left"><ChevronLeft aria-hidden /></button>
          <div ref={skillPathRef} className="mathlab-skillpath" aria-label="Unified mathematics skill path">
            <div className="mathlab-skillpath__intro"><Sparkles className="h-3.5 w-3.5" /><span>One connected path</span></div>
            {skillChapters.map((entry, index) => (
              <button key={`${entry.grade.id}-${entry.chapter.name}`} type="button" className={"mathlab-skill" + (entry.grade.id === grade.id && entry.index === chapterIndex ? " is-active" : "")} onClick={() => selectSkill(entry.grade.id, entry.index)}>
                <span className="mathlab-skill__node">{index + 1}</span><span>{entry.chapter.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className="mathlab-skillpath-arrow mathlab-skillpath-arrow--right" onClick={() => scrollSkills(1)} aria-label="Scroll chapters right"><ChevronRight aria-hidden /></button>
        </div>

        <div className={"mathlab-split" + (fullScreen ? " is-fullscreen" : "") + (solution ? " is-solution" : "")}>
          <AnimatePresence initial={false}>
            {!fullScreen && !solution && !solving ? (
              <motion.section key="mathlab-graph" className="mathlab-card mathlab-graph-card" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}>
                <header className="mathlab-card__head"><div className="min-w-0"><p className="mathlab-card__kicker">{track} · {chapter.focus}</p><h2 className="mathlab-card__title">{model.label}</h2></div><span className="mathlab-card__formula">{model.formula}</span></header>
                <div className="mathlab-canvas-wrap"><GraphCanvas model={model} params={params} /></div>
                <p className="mathlab-caption">{model.note}</p>
              </motion.section>
            ) : null}
          </AnimatePresence>

          <motion.section className="mathlab-card mathlab-notebook">
            <header className="mathlab-notebook__head">
              <div>
                <p className="mathlab-card__kicker">Solution notebook</p>
                <h2 className="mathlab-card__title">{solution?.headline ?? "A calm place to work"}</h2>
                <p className="mathlab-structure">{structure}</p>
              </div>
              <span className="mathlab-exact-badge" data-state={everyVerified ? "verified" : "pending"}>
                <ShieldCheck className="h-3 w-3" />
                {solution ? (everyVerified ? "Recomputed and verified" : "Checked where possible") : "Exact arithmetic"}
              </span>
            </header>

            <div className="mathlab-methods" role="tablist" aria-label="Solve method selector">
              {METHOD_OPTIONS.map((option) => (
                <motion.button key={option.id} type="button" role="tab" aria-selected={method === option.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }} className={"mathlab-method" + (method === option.id ? " is-active" : "")} onClick={() => chooseMethod(option.id)}>
                  <span>{option.label}</span><small>{option.note}</small>
                </motion.button>
              ))}
            </div>

            <form className="mathlab-input" onSubmit={(event) => { event.preventDefault(); onSubmit(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void readPhoto(event.dataTransfer.files?.[0]); }}>
              <input value={formula} onChange={(event) => setFormula(event.target.value)} placeholder={`e.g. ${chapter.example}`} aria-label="Your maths problem" className="mathlab-input__field" />
              <div className="mathlab-input__tools">
                <button type="button" className={"mathlab-tool" + (listening ? " is-live" : "")} onClick={toggleMic} aria-label={listening ? "Stop dictating" : "Dictate the problem"}><Mic className="h-4 w-4" /></button>
                <button type="button" className="mathlab-tool" onClick={() => fileInputRef.current?.click()} aria-label="Photograph the question"><Camera className="h-4 w-4" /></button>
              </div>
              <button type="submit" className="mathlab-solve" disabled={solving || !formula.trim()}>{solving ? <Loader2 className="spin-micro h-4 w-4" /> : null}Solve</button>
            </form>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(event) => void readPhoto(event.target.files?.[0] ?? undefined)} />
            {engineError && <p className="mathlab-error">{engineError}</p>}

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
                    <button type="button" className={"mathlab-tab-action" + (copied === "plain" ? " is-active" : "")} onClick={copySolution}>
                      {copied === "plain" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === "plain" ? "Copied" : "Copy"}
                    </button>
                    <button type="button" className={"mathlab-tab-action" + (copied === "latex" ? " is-active" : "")} onClick={copyLatex}>
                      {copied === "latex" ? <Check className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                      {copied === "latex" ? "Copied" : "Copy LaTeX"}
                    </button>
                  </div>
                </div>

                <div className="mathlab-solution">
                  {solution.problems.map((problem, problemIndex) => {
                    const expanded = openSteps[problemIndex] !== false;
                    const fractions = fractionsIn([problem.problem, problem.finalAnswer, ...problem.steps.map((step) => step.expression)]);
                    return (
                      <section key={`${problemIndex}-${problem.problem}`} className="mathlab-problem">
                        <header className="mathlab-problem__head">
                          <span className="mathlab-problem__index">{solution.problems.length > 1 ? `Problem ${problemIndex + 1}` : "Problem"}</span>
                          <h3 className="mathlab-problem__title">{problem.title}</h3>
                        </header>

                        <div className="mathlab-problem__statement">
                          <MathTex source={problem.problem} fallback={problem.problem} display />
                        </div>

                        {/* The answer sits directly under the heading, before the
                            working — the one thing a student checks first. */}
                        <div className="mathlab-verdict" data-corrected={problem.corrected}>
                          <span className="mathlab-verdict__label">Final answer</span>
                          <div className="mathlab-verdict__value">
                            <MathTex source={problem.finalAnswer} fallback={problem.finalAnswer} display />
                          </div>
                          {problem.verification || problem.checkNote ? (
                            <p className="mathlab-verdict__note">
                              <ShieldCheck className="h-3 w-3 shrink-0" />
                              <span><InlineMath text={problem.verification || problem.checkNote} /></span>
                            </p>
                          ) : null}
                        </div>

                        <FractionBars fractions={fractions} />

                        <div className="mathlab-work">
                          <button type="button" className="mathlab-work__toggle" aria-expanded={expanded} onClick={() => setOpenSteps((current) => ({ ...current, [problemIndex]: !expanded }))}>
                            {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {expanded ? "Hide steps" : `Show steps (${problem.steps.length})`}
                          </button>
                          <AnimatePresence initial={false}>
                            {expanded ? (
                              <motion.ol
                                className="mathlab-walk"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
                              >
                                {problem.steps.map((step, stepIndex) => {
                                  const key = `p${problemIndex}s${stepIndex}`;
                                  return (
                                    <motion.li
                                      key={`${key}-${step.expression || step.explanation}`}
                                      className="mathlab-walk__step"
                                      data-speaking={speakingKey === key}
                                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={stepTransition(stepIndex)}
                                    >
                                      <span className="mathlab-walk__index" aria-hidden>{String(stepIndex + 1).padStart(2, "0")}</span>
                                      <div className="mathlab-walk__body">
                                        <p className="mathlab-walk__title">{step.title}</p>
                                        <Explanation text={step.explanation} />
                                        <Expression source={step.expression} />
                                      </div>
                                      <span className="mathlab-walk__rule">{step.rule}</span>
                                    </motion.li>
                                  );
                                })}
                              </motion.ol>
                            ) : null}
                          </AnimatePresence>
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
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mathlab-hint">
                {solving ? "Reading the problem…" : `A ${chapter.name} question is already in the box. Press Solve, or speak and photograph your own.`}
              </p>
            )}

            <Fold label={`${chapter.name} reference`}>
              <div className="mathlab-fold__grid">
                <div>
                  <p className="mathlab-fold__label">Given data</p>
                  <ul className="mathlab-note-list">
                    {givens.map((entry: CheatEntry) => (
                      <li key={entry.title} className="mathlab-note-list__row">
                        <span className="mathlab-note-list__name">{entry.title}</span>
                        <InlineFormula source={entry.latex} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mathlab-fold__label">Governing formulas</p>
                  <ul className="mathlab-note-list">
                    {formulas.map((entry: CheatEntry) => (
                      <li key={entry.title} className="mathlab-note-list__row">
                        <span className="mathlab-note-list__name">{entry.title}</span>
                        <InlineFormula source={entry.latex} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Fold>

            <div className="mathlab-ask">
              <input value={followUp} onChange={(event) => setFollowUp(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendFollowUp(); } }} placeholder={solution ? "Is this correct? Ask about any step…" : "Solve something first, then ask here"} disabled={!solution || solving} aria-label="Ask about this solution" className="mathlab-ask__field" />
              <button type="button" className="mathlab-ask__send" disabled={!solution || solving || !followUp.trim()} onClick={sendFollowUp} aria-label="Send"><CornerDownLeft className="h-3.5 w-3.5" /></button>
            </div>
          </motion.section>
        </div>
      </div>

      {locked && <div className="absolute inset-0 z-20 flex items-start justify-center pt-16"><div className="premium-glass max-w-md p-7 text-center"><span className="lock-orb mx-auto"><Lock className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">Premium workspace</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Math Lab</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-dim">A connected mathematics notebook with exact arithmetic, focused reading and three ways to understand every method.</p><div className="mt-6 flex justify-center"><MovingBorderButton onClick={() => navigate("/pricing")} innerClassName="px-6 py-3 text-sm">View plans<ArrowRight className="h-4 w-4" /></MovingBorderButton></div></div></div>}
    </div>
  );
}

export default MathLab;
