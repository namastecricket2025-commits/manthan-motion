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
import { MathTex, toWorkedStep, type WorkedStep } from "@/components/mathlab/latex";
import { isMathLine, toLatex } from "@/components/mathlab/mathformat";
import { pickAviaVoice, speakText, stopSpeaking } from "@/components/voice/avia";
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  Lock,
  Mic,
  Play,
  Square,
  Volume2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Math Lab — the Class 8 to 11 mathematics workspace.
 *
 * One click and the whole room changes. Choosing a chapter swaps the curve on
 * the canvas, the two cheat-sheet panels and the question sitting in the input
 * box; there is nothing else to configure and no sliders to hunt for.
 *
 * The engine answers in a notebook, not a paragraph: each step is a card with
 * the equation typeset on one side and the rule that produced it badged on the
 * other, and the last card is the answer. Avia is woven into the input line —
 * the microphone dictates, and every step can be read aloud on demand. Nothing
 * ever plays by itself.
 */

/** One past turn in the engine conversation: follow-ups read this. */
interface EngineTurn {
  role: "student" | "lab";
  text: string;
}

function defaultsFor(model: PlotModel): Record<string, number> {
  const values: Record<string, number> = {};
  for (const param of model.params) values[param.key] = param.value;
  return values;
}

/** Typeset when the line is an expression, plain text when it is a sentence. */
function Typeset({ text }: { text: string }) {
  if (!isMathLine(text)) return <>{text}</>;
  return <MathTex source={toLatex(text)} fallback={text} />;
}

/** One cheat-sheet panel: a title and the two or three relations that matter. */
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

/**
 * One step of the working.
 *
 * Strictly two columns: the equation, centred in its own formula box on the
 * left; the rule it used, with whatever the step had to say, on the right. The
 * speaker sits in the corner and reads only this step.
 */
function StepCard({
  step,
  index,
  speaking,
  onSpeak,
}: {
  step: WorkedStep;
  index: number;
  speaking: boolean;
  onSpeak: () => void;
}) {
  return (
    <motion.li
      className="mathlab-step"
      data-tone={step.tone}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: Math.min(index * 0.05, 0.3), ease: [0.25, 1, 0.5, 1] }}
    >
      <span className="mathlab-step__index" aria-hidden>
        {index + 1}
      </span>

      <div className="mathlab-step__formula">
        {step.math ? (
          <MathTex source={step.math} fallback={step.math} display />
        ) : (
          <p className="mathlab-step__prose">{step.note}</p>
        )}
      </div>

      <div className="mathlab-step__side">
        <span className="mathlab-rule" data-tone={step.tone}>
          {step.rule}
        </span>
        {step.math && step.note ? <p className="mathlab-step__note">{step.note}</p> : null}
      </div>

      <button
        type="button"
        className={"mathlab-speak" + (speaking ? " is-speaking" : "")}
        onClick={onSpeak}
        aria-label={`Read step ${index + 1} aloud`}
        title="Read this step aloud"
      >
        <Volume2 className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

export function MathLab() {
  const navigate = useNavigate();
  const { can, requireAccess } = usePlan();
  const solve = useAction(api.ai.mathSolve);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);

  /* ---- curriculum position ---- */
  const [gradeId, setGradeId] = useState<string>(GRADES[0].id);
  const grade: GradeSpec = useMemo(() => getGrade(gradeId as GradeSpec["id"]), [gradeId]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = grade.chapters[chapterIndex] ?? grade.chapters[0];

  /** The curve this chapter is about. Nothing to configure — it is just drawn. */
  const model = useMemo(
    () => modelById(chapter.plot, grade.models[0]),
    [chapter, grade],
  );
  const params = useMemo(() => defaultsFor(model), [model]);

  /* ---- engine state ---- */
  const [formula, setFormula] = useState(chapter.example);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solving, setSolving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [turns, setTurns] = useState<EngineTurn[]>([]);
  const [followUp, setFollowUp] = useState("");

  /* ---- voice ---- */
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [walking, setWalking] = useState(false);
  const [copied, setCopied] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copiedTimer = useRef<number | null>(null);

  const locked = !can("mathLabBasic");

  /** Avia's voice, resolved lazily — the voice list is empty on first paint. */
  const aviaVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voiceRef.current || !voices.includes(voiceRef.current)) {
      voiceRef.current = pickAviaVoice(voices) ?? voices[0] ?? null;
    }
    return voiceRef.current;
  }, []);

  /** Silence everything and clear the voice flags — used on every chapter change. */
  const hush = useCallback(() => {
    stopSpeaking();
    setSpeakingIndex(null);
    setWalking(false);
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      stopSpeaking();
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  /* ---- one click retunes the whole page ---- */
  const selectGrade = useCallback(
    (next: GradeSpec) => {
      if (next.advanced && !requireAccess("mathLabFull")) return;
      hush();
      setGradeId(next.id);
      setChapterIndex(0);
      setSolution(null);
      setTurns([]);
      setFollowUp("");
      setEngineError(null);
      // The first question of the class is already waiting in the box.
      setFormula(next.chapters[0].example);
    },
    [hush, requireAccess],
  );

  const selectChapter = useCallback(
    (index: number) => {
      const next = grade.chapters[index];
      if (!next || index === chapterIndex) return;
      hush();
      setChapterIndex(index);
      setSolution(null);
      setTurns([]);
      setFollowUp("");
      setEngineError(null);
      // A sample problem from this chapter, ready to solve.
      setFormula(next.example);
    },
    [chapterIndex, grade, hush],
  );

  /* ---- the engine ---- */
  const askEngine = useCallback(
    async (parts: {
      question?: string;
      file?: { storageId: Id<"_storage">; name: string; mime?: string };
      followUp?: string;
    }) => {
      setSolving(true);
      setEngineError(null);
      try {
        const result = await solve({
          question: parts.question,
          storageId: parts.file?.storageId,
          name: parts.file?.name,
          mime: parts.file?.mime,
          gradeLabel: grade.label,
          chapterName: chapter.name,
          chapterFormulas: chapter.formulas,
          history: parts.followUp ? turns.slice(-6) : undefined,
        });
        setSolution({
          headline: result.headline,
          answer: result.answer,
          given: result.given,
          formulas: result.formulas,
          steps: result.steps,
          verification: result.verification,
        });
        if (parts.followUp) {
          setTurns((current) => [
            ...current,
            { role: "student", text: parts.followUp! },
            { role: "lab", text: result.answer },
          ]);
        } else if (parts.question) {
          setTurns((current) => [...current, { role: "lab", text: result.answer }]);
        }
      } catch (err) {
        setEngineError(
          err instanceof Error && err.message
            ? err.message
            : "The engine could not reach a model just now. Try again in a minute.",
        );
      } finally {
        setSolving(false);
      }
    },
    [chapter.formulas, chapter.name, grade.label, solve, turns],
  );

  /** Solve: the local engine answers instantly, the model refines after. */
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

  /** A photo of the question, read and solved by the engine. */
  const readPhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      hush();
      setSolving(true);
      setEngineError(null);
      setSolution(null);
      try {
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("upload rejected");
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        await askEngine({ file: { storageId, name: file.name, mime: file.type } });
      } catch {
        setEngineError(
          "That photo did not reach the engine. Check your connection, or type the problem instead.",
        );
        setSolving(false);
      }
    },
    [askEngine, generateUploadUrl, hush],
  );

  /* ---- speech to text: dictate the problem into the box ---- */
  const toggleMic = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setEngineError("This browser has no speech recognition — type the problem instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: AviaSpeechRecognitionEvent) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i += 1) {
        heard += event.results[i][0].transcript;
      }
      setFormula(heard.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      setEngineError("I did not catch that. Tap the microphone again, or type the problem.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setEngineError(null);
    setListening(true);
    recognition.start();
  }, [listening]);

  /* ---- text to speech: one step, or the whole walkthrough ---- */
  const workedSteps = useMemo(
    () => (solution?.steps ?? []).map((line) => toWorkedStep(line, chapter.rule)),
    [chapter.rule, solution],
  );

  const readStep = useCallback(
    (index: number) => {
      const step = workedSteps[index];
      if (!step) return;
      setWalking(false);
      setSpeakingIndex(index);
      speakText(step.raw, aviaVoice(), () => setSpeakingIndex(null), true);
    },
    [aviaVoice, workedSteps],
  );

  const readAll = useCallback(() => {
    if (walking) {
      hush();
      return;
    }
    const script = [...workedSteps.map((step) => step.raw)];
    if (solution?.answer) script.push(`And the final answer is: ${solution.answer}`);
    if (script.length === 0) return;
    let cursor = 0;
    setWalking(true);
    const next = () => {
      if (cursor >= script.length) {
        setWalking(false);
        setSpeakingIndex(null);
        return;
      }
      const index = cursor;
      cursor += 1;
      setSpeakingIndex(index < workedSteps.length ? index : null);
      // The first line interrupts anything already playing; the rest queue.
      speakText(script[index], aviaVoice(), next, index === 0);
    };
    next();
  }, [aviaVoice, hush, solution, workedSteps, walking]);

  const copySolution = useCallback(() => {
    if (!solution) return;
    const text = [
      solution.headline,
      "",
      ...workedSteps.map(
        (step, index) => `${index + 1}. [${step.rule}] ${step.math || step.note}`,
      ),
      "",
      `Final answer: ${solution.answer}`,
    ].join("\n");
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => setEngineError("Your browser blocked the copy. Select the text instead."));
  }, [solution, workedSteps]);

  const givens = useMemo(() => coreDefinitions(chapter), [chapter]);
  const formulas = useMemo(() => coreFormulas(chapter), [chapter]);
  const lastCheck = solution?.verification.at(-1);

  return (
    <div className="relative">
      <div
        className={
          "mathlab-root" + (locked ? " pointer-events-none select-none blur-[7px]" : "")
        }
        aria-hidden={locked}
      >
        {/* ---------------- Class selector ---------------- */}
        <div className="mathlab-grades" role="tablist" aria-label="Class selector">
          {GRADES.map((entry) => {
            const active = entry.id === grade.id;
            const needsPrime = entry.advanced && !can("mathLabFull");
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectGrade(entry)}
                className={"mathlab-grade" + (active ? " is-active" : "")}
              >
                {active && (
                  <motion.span
                    layoutId="mathlab-grade-pill"
                    className="mathlab-grade__pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {entry.label}
                  {needsPrime && <Lock className="h-3 w-3 opacity-70" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* ---------------- Chapters: one click changes everything ---------------- */}
        <div className="mathlab-chapterbar" role="tablist" aria-label={`${grade.label} chapters`}>
          {grade.chapters.map((entry, index) => {
            const active = index === chapterIndex;
            return (
              <button
                key={entry.name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectChapter(index)}
                className={"mathlab-chapter" + (active ? " is-active" : "")}
              >
                {active && (
                  <motion.span
                    layoutId="mathlab-chapter-pill"
                    className="mathlab-grade__pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="mathlab-chapter__name">{entry.name}</span>
                {active ? <Check className="mathlab-chapter__tick h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>

        {/* ---------------- Workspace ---------------- */}
        <div className="mathlab-split">
          {/* ---- the curve this chapter is about ---- */}
          <section className="mathlab-card">
            <header className="mathlab-card__head">
              <div className="min-w-0">
                <p className="mathlab-card__kicker">{grade.label}</p>
                <h2 className="mathlab-card__title">{chapter.name}</h2>
              </div>
              <span className="mathlab-card__formula">{model.formula}</span>
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={model.id}
                className="mathlab-canvas-wrap"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              >
                <GraphCanvas model={model} params={params} />
              </motion.div>
            </AnimatePresence>

            <p className="mathlab-caption">
              {model.label} — {model.note}
            </p>
          </section>

          {/* ---- the engine ---- */}
          <section className="mathlab-card">
            <header className="mathlab-card__head">
              <div className="min-w-0">
                <h2 className="mathlab-card__title">AI equation engine</h2>
                <p className="mathlab-voice" data-on={listening}>
                  <span className="mathlab-wave" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  AVIA AI Voice Tutor
                </p>
              </div>
              <AnimatePresence>
                {solving ? (
                  <motion.span
                    key="solving"
                    className="mathlab-solving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="spin-micro h-3.5 w-3.5" />
                    Working
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </header>

            {/* one line: type it, say it, or photograph it */}
            <form
              className="mathlab-input"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void readPhoto(event.dataTransfer.files?.[0]);
              }}
            >
              <input
                value={formula}
                onChange={(event) => setFormula(event.target.value)}
                placeholder={`e.g. ${chapter.example}`}
                aria-label="Your maths problem"
                className="mathlab-input__field"
              />
              <div className="mathlab-input__tools">
                <button
                  type="button"
                  className={"mathlab-tool" + (listening ? " is-live" : "")}
                  onClick={toggleMic}
                  aria-label={listening ? "Stop dictating" : "Dictate the problem"}
                  title={listening ? "Stop" : "Speak the problem"}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="mathlab-tool"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Photograph the question"
                  title="Photograph or upload the question"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <button
                type="submit"
                className="mathlab-solve"
                disabled={solving || !formula.trim()}
              >
                {solving ? <Loader2 className="spin-micro h-4 w-4" /> : null}
                Solve
              </button>
            </form>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(event) => void readPhoto(event.target.files?.[0] ?? undefined)}
            />

            {engineError && <p className="mathlab-error">{engineError}</p>}

            {/* ---- the notebook ---- */}
            {workedSteps.length > 0 && solution ? (
              <div className="mathlab-flow">
                <div className="mathlab-flow__bar">
                  <button
                    type="button"
                    className={"mathlab-listen" + (walking ? " is-on" : "")}
                    onClick={readAll}
                  >
                    {walking ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    {walking ? "Stop walkthrough" : "Listen to Full Walkthrough"}
                  </button>
                  <span className="mathlab-flow__meta">
                    {workedSteps.length} {workedSteps.length === 1 ? "step" : "steps"}
                  </span>
                </div>

                <ol className="mathlab-steps">
                  {workedSteps.map((step, index) => (
                    <StepCard
                      key={`step-${index}`}
                      step={step}
                      index={index}
                      speaking={speakingIndex === index}
                      onSpeak={() => readStep(index)}
                    />
                  ))}
                </ol>

                <motion.div
                  className="mathlab-final"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, ease: [0.25, 1, 0.5, 1] }}
                >
                  <div className="mathlab-final__label">Final Answer</div>
                  <div className="mathlab-final__value">
                    <Typeset text={solution.answer} />
                  </div>
                  {lastCheck ? (
                    <p className="mathlab-final__check">
                      <Check className="h-3 w-3 shrink-0" />
                      {lastCheck}
                    </p>
                  ) : null}
                  <div className="mathlab-final__actions">
                    <button type="button" className="mathlab-copy" onClick={copySolution}>
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? "Copied" : "Copy Solution"}
                    </button>
                    <button
                      type="button"
                      className="mathlab-copy mathlab-copy--quiet"
                      onClick={() => {
                        hush();
                        const script = [...workedSteps.map((step) => step.raw), solution.answer];
                        speakText(script.join(". "), aviaVoice(), undefined, true);
                      }}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      Read it aloud
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : (
              <p className="mathlab-hint">
                {solving
                  ? "Reading the problem…"
                  : `A ${chapter.name} question is already in the box. Press Solve, or speak and photograph your own.`}
              </p>
            )}

            {/* ---- the chapter's cheat-sheet ---- */}
            <div className="mathlab-panels">
              <CheatPanel title="Given Data" entries={givens} />
              <CheatPanel title="Governing Formulas" entries={formulas} />
            </div>

            {/* ---- ask about the answer ---- */}
            <div className="mathlab-ask">
              <input
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendFollowUp();
                  }
                }}
                placeholder={solution ? "Is this correct? Ask about any step…" : "Solve something first, then ask here"}
                disabled={!solution || solving}
                aria-label="Ask about this solution"
                className="mathlab-ask__field"
              />
              <button
                type="button"
                className="mathlab-ask__send"
                disabled={!solution || solving || !followUp.trim()}
                onClick={sendFollowUp}
                aria-label="Send"
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Locked preview for accounts without the EduVantage plan. */}
      {locked && (
        <div className="absolute inset-0 z-20 flex items-start justify-center pt-16">
          <div className="premium-glass max-w-md p-7 text-center">
            <span className="lock-orb mx-auto">
              <Lock className="h-5 w-5" />
            </span>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">
              Premium workspace
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Math Lab</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-text-dim">
              Live graphs and the step-by-step engine for Classes 8 to 11. Unlock
              basic graphs with EduVantage, and the full suite with Manthan Prime.
            </p>
            <div className="mt-6 flex justify-center">
              <MovingBorderButton
                onClick={() => navigate("/pricing")}
                innerClassName="px-6 py-3 text-sm"
              >
                View plans
                <ArrowRight className="h-4 w-4" />
              </MovingBorderButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MathLab;
