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
  solveEquation,
  type CheatEntry,
  type GradeSpec,
  type PlotModel,
  type Solution,
} from "@/components/mathlab/mathlab";
import { GraphCanvas } from "@/components/mathlab/GraphCanvas";
import { MathTex, toWorkedSteps, type WorkedStep } from "@/components/mathlab/latex";
import { isMathLine, toLatex } from "@/components/mathlab/mathformat";
import { pickAviaVoice, speakText, stopSpeaking } from "@/components/voice/avia";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerDownLeft,
  Expand,
  Loader2,
  Lock,
  Mic,
  Minimize,
  Play,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { parse as parseMath } from "mathjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

interface EngineTurn {
  role: "student" | "lab";
  text: string;
}

type SolveMethod = "standard" | "visual" | "analogy";

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

function Typeset({ text }: { text: string }) {
  if (!isMathLine(text)) return <>{text}</>;
  return <MathTex source={toLatex(text)} fallback={text} display />;
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

function CheatPanel({ title, entries }: { title: string; entries: CheatEntry[] }) {
  return (
    <section className="mathlab-panel">
      <h3 className="mathlab-panel__title">{title}</h3>
      <ul className="mathlab-panel__list">
        {entries.map((entry) => (
          <li key={entry.title} className="mathlab-panel__row">
            <span className="mathlab-panel__name">{entry.title}</span>
            <MathTex source={entry.latex} fallback={entry.latex} display />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotebookLine({ step, index }: { step: WorkedStep; index: number }) {
  return (
    <li className="mathlab-stream__line" data-tone={step.tone}>
      <div className="mathlab-stream__number" aria-hidden>{String(index + 1).padStart(2, "0")}</div>
      <div className="mathlab-stream__equation">
        {step.math ? (
          <MathTex source={step.math} fallback={step.math} display />
        ) : (
          <p>{step.note}</p>
        )}
      </div>
      <div className="mathlab-stream__note">
        <span className="mathlab-stream__rule">{step.rule}</span>
        {step.math && step.note ? <span>{step.note}</span> : null}
      </div>
    </li>
  );
}

export function MathLab() {
  const navigate = useNavigate();
  const { can } = usePlan();
  const solve = useAction(api.ai.mathSolve);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);
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
  const [solution, setSolution] = useState<Solution | null>(null);
  const [method, setMethod] = useState<SolveMethod>("standard");
  const [solving, setSolving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [turns, setTurns] = useState<EngineTurn[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [walking, setWalking] = useState(false);
  const [copied, setCopied] = useState(false);
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
    setSpeakingIndex(null);
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
      setSolution({ headline: result.headline, answer: result.answer, given: result.given, formulas: result.formulas, steps: result.steps, verification: result.verification });
      if (parts.followUp) setTurns((current) => [...current, { role: "student", text: parts.followUp! }, { role: "lab", text: result.answer }]);
      else if (parts.question) setTurns((current) => [...current, { role: "lab", text: result.answer }]);
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
    setSolution(solveEquation(input, grade, chapter));
    setTurns((current) => [...current, { role: "student", text: input }]);
    void askEngine({ question: input });
  }, [askEngine, chapter, formula, grade, hush, solving]);
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

  const workedSteps = useMemo(() => (solution?.steps ?? []).flatMap((line) => toWorkedSteps(line, chapter.rule)), [chapter.rule, solution]);
  const readAll = useCallback(() => {
    if (walking) { hush(); return; }
    const script = [...workedSteps.map((step) => step.raw)];
    if (solution?.answer) script.push(`And the final answer is: ${solution.answer}`);
    if (!script.length) return;
    let cursor = 0;
    setWalking(true);
    const next = () => {
      if (cursor >= script.length) { setWalking(false); setSpeakingIndex(null); return; }
      const index = cursor++;
      setSpeakingIndex(index < workedSteps.length ? index : null);
      speakText(script[index], aviaVoice(), next, index === 0);
    };
    next();
  }, [aviaVoice, hush, solution, workedSteps, walking]);
  const copySolution = useCallback(() => {
    if (!solution) return;
    const text = [solution.headline, "", ...workedSteps.map((step, index) => `${index + 1}. [${step.rule}] ${step.math || step.note}`), "", `Final answer: ${solution.answer}`].join("\n");
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => setEngineError("Your browser blocked the copy. Select the text instead."));
  }, [solution, workedSteps]);
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
  const lastCheck = solution?.verification.at(-1);

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

        <motion.div layout className={"mathlab-split" + (fullScreen ? " is-fullscreen" : "")} transition={{ duration: 0.4, ease: "easeInOut", layout: { type: "spring", stiffness: 260, damping: 30 } }}>
          <AnimatePresence initial={false} mode="popLayout">
            {!fullScreen && <motion.section key="mathlab-graph" layout className="mathlab-card mathlab-graph-card" initial={{ opacity: 0, x: 0, scale: 1 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -60, scale: 0.98 }} transition={{ duration: 0.4, ease: "easeInOut" }}>
              <header className="mathlab-card__head"><div className="min-w-0"><p className="mathlab-card__kicker">{track} · {chapter.focus}</p><h2 className="mathlab-card__title">{model.label}</h2></div><span className="mathlab-card__formula">{model.formula}</span></header>
              <AnimatePresence mode="wait"><motion.div key={model.id} className="mathlab-canvas-wrap" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .99 }} transition={{ duration: .35, ease: [0.25, 1, 0.5, 1] }}><GraphCanvas model={model} params={params} /></motion.div></AnimatePresence>
              <p className="mathlab-caption">{model.note}</p>
            </motion.section>}
          </AnimatePresence>

          <motion.section layout className="mathlab-card mathlab-notebook" transition={{ duration: 0.4, ease: "easeInOut", layout: { type: "spring", stiffness: 260, damping: 30 } }}>
            <div className="mathlab-utilitybar">
              <div className="mathlab-utilitybar__status"><span className="mathlab-live-dot" />{solving ? "Working through it" : solution ? "Notebook ready" : "Ready when you are"}</div>
              <div className="mathlab-utilitybar__controls">
                <motion.button type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }} className={"mathlab-utility" + (walking ? " is-active" : "")} onClick={readAll} disabled={!solution}>{walking ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{walking ? "Stop walkthrough" : "Listen"}</motion.button>
                <motion.button type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }} className="mathlab-utility" onClick={() => { if (solution) speakText([...workedSteps.map((step) => step.raw), solution.answer].join(". "), aviaVoice(), undefined, true); }} disabled={!solution}><Volume2 className="h-3.5 w-3.5" />Audio reader</motion.button>
                <motion.button type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }} className={"mathlab-utility" + (copied ? " is-active" : "")} onClick={copySolution} disabled={!solution}><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}</motion.button>
              </div>
            </div>
            <div className="mathlab-utilitybar__progress" aria-live="polite"><span>{solution ? `${Math.min((speakingIndex ?? 0) + 1, workedSteps.length)} of ${workedSteps.length} steps` : "Your solution will play here"}</span><span>{solution ? `${Math.round(((speakingIndex ?? 0) / Math.max(workedSteps.length, 1)) * 100)}%` : "0%"}</span></div>

            <header className="mathlab-notebook__head"><div><p className="mathlab-card__kicker">Solution notebook</p><h2 className="mathlab-card__title">{solution?.headline ?? "A calm place to work"}</h2><p className="mathlab-structure">{structure}</p></div><span className="mathlab-exact-badge"><Check className="h-3 w-3" />Exact arithmetic</span></header>

            <div className="mathlab-methods" role="tablist" aria-label="Solve method selector">
              {METHOD_OPTIONS.map((option) => <motion.button key={option.id} type="button" role="tab" aria-selected={method === option.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }} className={"mathlab-method" + (method === option.id ? " is-active" : "")} onClick={() => chooseMethod(option.id)}><span>{option.label}</span><small>{option.note}</small></motion.button>)}
            </div>

            <form className="mathlab-input" onSubmit={(event) => { event.preventDefault(); onSubmit(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void readPhoto(event.dataTransfer.files?.[0]); }}>
              <input value={formula} onChange={(event) => setFormula(event.target.value)} placeholder={`e.g. ${chapter.example}`} aria-label="Your maths problem" className="mathlab-input__field" />
              <div className="mathlab-input__tools"><button type="button" className={"mathlab-tool" + (listening ? " is-live" : "")} onClick={toggleMic} aria-label={listening ? "Stop dictating" : "Dictate the problem"}><Mic className="h-4 w-4" /></button><button type="button" className="mathlab-tool" onClick={() => fileInputRef.current?.click()} aria-label="Photograph the question"><Camera className="h-4 w-4" /></button></div>
              <button type="submit" className="mathlab-solve" disabled={solving || !formula.trim()}>{solving ? <Loader2 className="spin-micro h-4 w-4" /> : null}Solve</button>
            </form>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(event) => void readPhoto(event.target.files?.[0] ?? undefined)} />
            {engineError && <p className="mathlab-error">{engineError}</p>}

            {workedSteps.length > 0 && solution ? <div className="mathlab-notebook__body"><div className="mathlab-stream" aria-label="Continuous mathematical solution">{workedSteps.map((step, index) => <NotebookLine key={`${index}-${step.raw}`} step={step} index={index} />)}</div><div className="mathlab-answer"><div className="mathlab-answer__label">Final answer</div><div className="mathlab-answer__value"><Typeset text={solution.answer} /></div>{lastCheck ? <p className="mathlab-answer__check"><Check className="h-3 w-3 shrink-0" />{lastCheck}</p> : null}</div></div> : <p className="mathlab-hint">{solving ? "Reading the problem…" : `A ${chapter.name} question is already in the box. Press Solve, or speak and photograph your own.`}</p>}

            <div className="mathlab-panels"><CheatPanel title="Given Data" entries={givens} /><CheatPanel title="Governing Formulas" entries={formulas} /></div>
            <div className="mathlab-ask"><input value={followUp} onChange={(event) => setFollowUp(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendFollowUp(); } }} placeholder={solution ? "Is this correct? Ask about any step…" : "Solve something first, then ask here"} disabled={!solution || solving} aria-label="Ask about this solution" className="mathlab-ask__field" /><button type="button" className="mathlab-ask__send" disabled={!solution || solving || !followUp.trim()} onClick={sendFollowUp} aria-label="Send"><CornerDownLeft className="h-3.5 w-3.5" /></button></div>
          </motion.section>
        </motion.div>
      </div>

      {locked && <div className="absolute inset-0 z-20 flex items-start justify-center pt-16"><div className="premium-glass max-w-md p-7 text-center"><span className="lock-orb mx-auto"><Lock className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">Premium workspace</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Math Lab</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-dim">A connected mathematics notebook with exact arithmetic, focused reading and three ways to understand every method.</p><div className="mt-6 flex justify-center"><MovingBorderButton onClick={() => navigate("/pricing")} innerClassName="px-6 py-3 text-sm">View plans<ArrowRight className="h-4 w-4" /></MovingBorderButton></div></div></div>}
    </div>
  );
}

export default MathLab;
