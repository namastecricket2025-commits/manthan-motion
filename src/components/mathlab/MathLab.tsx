import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { usePlan } from "@/components/plans/PlanProvider";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LabAviaChat } from "@/components/mathlab/LabAviaChat";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  documentSolution,
  GRADES,
  getGrade,
  modelById,
  SOLUTION_BLOCKS,
  solveEquation,
  type CheatEntry,
  type GradeSpec,
  type PlotModel,
  type Solution,
} from "@/components/mathlab/mathlab";
import { MathLine, MathTex, toWorkedStep, type WorkedStep } from "@/components/mathlab/latex";
import { GraphCanvas } from "@/components/mathlab/GraphCanvas";
import {
  ArrowRight,
  Check,
  CornerDownLeft,
  FileUp,
  Loader2,
  Lock,
  Mic,
  RotateCcw,
  SendHorizontal,
  Sigma,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Math Lab — the Class 8 to 11 mathematics workspace.
 *
 * Left: a live coordinate plane whose curve glides to every parameter change,
 * with the plottable models for the selected class. Right: an equation engine
 * that takes a typed formula or a dropped document and returns the four
 * structured blocks a student revises from.
 *
 * The whole lab sits behind the EduVantage plan; Classes 10 and 11 need the
 * full Prime suite.
 */

/** One past turn in the engine conversation. */
interface EngineTurn {
  role: "student" | "lab";
  /** For the student: the question. For the lab: the answer line. */
  text: string;
}

function defaultsFor(model: PlotModel): Record<string, number> {
  const values: Record<string, number> = {};
  for (const param of model.params) values[param.key] = param.value;
  return values;
}

/**
 * One step of the working, as a card: the equation typeset on the left, the
 * rule it applied badged on the right. A plain sentence becomes readable the
 * moment the two are separated.
 */
function StepCard({ step, index }: { step: WorkedStep; index: number }) {
  return (
    <motion.li
      className="mathlab-step"
      data-tone={step.tone}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24), ease: [0.25, 1, 0.5, 1] }}
    >
      <span className="mathlab-step__num" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="mathlab-step__body">
        {step.math ? <MathTex source={step.math} fallback={step.math} display /> : null}
        {step.note ? <p className="mathlab-step__note">{step.note}</p> : null}
      </div>
      <span className="mathlab-rule" data-tone={step.tone}>
        {step.rule}
      </span>
    </motion.li>
  );
}

/** A cheat-sheet line: title, typeset formula, and an optional definition. */
function CheatRow({ entry }: { entry: CheatEntry }) {
  return (
    <li className="mathlab-cheat" data-kind={entry.kind}>
      <span className="mathlab-cheat__kind">{entry.kind}</span>
      <div className="min-w-0">
        <p className="mathlab-cheat__title">{entry.title}</p>
        <MathTex source={entry.latex} fallback={entry.latex} display />
        {entry.note ? <p className="mathlab-cheat__note">{entry.note}</p> : null}
      </div>
    </li>
  );
}

export function MathLab() {
  const navigate = useNavigate();
  const { can, requireAccess } = usePlan();
  const solve = useAction(api.ai.mathSolve);

  const [gradeId, setGradeId] = useState<string>(GRADES[0].id);
  const grade: GradeSpec = useMemo(() => getGrade(gradeId as GradeSpec["id"]), [gradeId]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = grade.chapters[chapterIndex] ?? grade.chapters[0];

  const [modelId, setModelId] = useState<string | null>(null);
  /** The plot this chapter opens on; the model picker can still override it. */
  const chapterModel = useMemo(
    () => modelById(chapter.plot, grade.models[0]),
    [chapter, grade],
  );
  const model = useMemo(
    () => grade.models.find((entry) => entry.id === modelId) ?? chapterModel,
    [chapterModel, grade.models, modelId],
  );
  const [params, setParams] = useState<Record<string, number>>(() => defaultsFor(chapterModel));

  const [formula, setFormula] = useState("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solving, setSolving] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  /** The conversation behind the structured blocks: follow-ups read this. */
  const [turns, setTurns] = useState<EngineTurn[]>([]);
  const [followUp, setFollowUp] = useState("");

  /** True once the engine has answered from the real model this session. */
  const [engineLive, setEngineLive] = useState(false);
  const [engineModel, setEngineModel] = useState<string | null>(null);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);

  const uploadTimer = useRef<number | null>(null);

  const locked = !can("mathLabBasic");

  useEffect(
    () => () => {
      if (uploadTimer.current !== null) window.clearTimeout(uploadTimer.current);
    },
    [],
  );

  const selectGrade = useCallback(
    (next: GradeSpec) => {
      if (next.advanced && !requireAccess("mathLabFull")) return;
      setGradeId(next.id);
      setChapterIndex(0);
      // A class opens on the plot its first chapter asks for.
      const firstChapter = next.chapters[0];
      const first = firstChapter ? modelById(firstChapter.plot, next.models[0]) : next.models[0];
      setModelId(first.id);
      setParams(defaultsFor(first));
      setSolution(null);
      setTurns([]);
      setFollowUp("");
      setEngineError(null);
      setFormula("");
    },
    [requireAccess],
  );

  /**
   * Choosing a chapter re-tunes the whole lab to it: the canvas pre-loads the
   * plot that chapter is about, the engine's hint becomes one of its classic
   * questions, and any working from the previous chapter is cleared so nothing
   * on screen is answering a question the student is no longer looking at.
   */
  const selectChapter = useCallback(
    (index: number) => {
      const next = grade.chapters[index];
      if (!next) return;
      setChapterIndex(index);
      const nextModel = modelById(next.plot, grade.models[0]);
      setModelId(nextModel.id);
      setParams(defaultsFor(nextModel));
      setSolution(null);
      setTurns([]);
      setFollowUp("");
      setEngineError(null);
      setFormula("");
    },
    [grade],
  );

  const selectModel = useCallback((next: PlotModel) => {
    setModelId(next.id);
    setParams(defaultsFor(next));
  }, []);

  const runEngine = useCallback(
    (input: string) => {
      if (!input.trim()) return;
      setSolving(true);
      setEngineError(null);
      // The instant local solve keeps standard equations responsive while
      // the model works; whichever finishes second overwrites the first.
      setSolution(solveEquation(input, grade, chapter));
      setTurns((current) => [...current, { role: "student", text: input.trim() }]);
    },
    [grade, chapter],
  );

  /**
   * Ask the real engine — a first problem, a dropped file, or a follow-up
   * like "is this true?". Returns the model's structured answer and appends
   * it to the conversation the next follow-up reads.
   */
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
        setEngineLive(true);
        setEngineModel(result.model);
        setSolution({
          headline: result.headline,
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
          setTurns((current) => [
            ...current,
            { role: "lab", text: `${result.headline} ${result.answer}` },
          ]);
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "The engine could not reach a model just now. Try again in a minute.";
        setEngineError(message);
      } finally {
        setSolving(false);
      }
    },
    [chapter, grade.label, solve, turns],
  );

  /** Submit the follow-up box: a question about the working just shown. */
  const sendFollowUp = useCallback(() => {
    const text = followUp.trim();
    if (!text || solving) return;
    setFollowUp("");
    setTurns((current) => [...current, { role: "student", text }]);
    void askEngine({ followUp: text });
  }, [askEngine, followUp, solving]);

  const readDocument = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setSolving(true);
      setEngineError(null);
      try {
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        setSolution(null);
        await askEngine({ file: { storageId, name: file.name, mime: file.type } });
      } catch {
        setEngineError(
          "The upload did not make it to the engine. Check your connection and try again — or paste the equation instead.",
        );
        setSolving(false);
      }
    },
    [askEngine, generateUploadUrl],
  );

  const resetEngine = useCallback(() => {
    setSolution(null);
    setTurns([]);
    setFollowUp("");
    setEngineError(null);
    setFormula("");
  }, []);

  const blocks = solution
    ? {
        given: solution.given,
        formulas: solution.formulas,
        steps: solution.steps,
        verification: solution.verification,
      }
    : null;

  /**
   * The cheat-sheet is the lab's floor, not a fallback: with nothing solved
   * yet, the two formula panels show the active chapter's own definitions,
   * theorems and formulae. A solved problem replaces them with its givens.
   */
  const cheatFormulas = useMemo(
    () => chapter.cheat.filter((entry) => entry.kind !== "definition"),
    [chapter],
  );
  const cheatDefinitions = useMemo(
    () => chapter.cheat.filter((entry) => entry.kind === "definition"),
    [chapter],
  );
  const cheatFor: Record<string, CheatEntry[]> = {
    given: cheatDefinitions,
    formulas: cheatFormulas,
  };

  /** The working, decomposed into equation-plus-rule cards. */
  const workedSteps = useMemo(
    () => (blocks?.steps ?? []).map((line) => toWorkedStep(line, chapter.rule)),
    [blocks, chapter.rule],
  );

  return (
    <div className="relative">
      <div
        className={
          "mathlab-root" + (locked ? " pointer-events-none select-none blur-[7px]" : "")
        }
        aria-hidden={locked}
      >
        {/* Grade selector + chapter menu */}
        <div className="flex flex-col gap-4">
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

          <AnimatePresence mode="wait">
            <motion.div
              key={grade.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.38, ease: [0.25, 1, 0.5, 1] }}
              className="premium-glass p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    {grade.level}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold tracking-tight">
                    {grade.label}
                  </h2>
                </div>
                <p className="max-w-md text-xs leading-relaxed text-text-dim">
                  {grade.blurb}
                </p>
              </div>

              <motion.div
                className="mt-4 grid gap-1.5"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
                }}
              >
                {grade.chapters.map((entry, index) => (
                  <motion.button
                    key={entry.name}
                    type="button"
                    variants={{
                      hidden: { opacity: 0, x: -14 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    transition={{ duration: 0.34, ease: [0.25, 1, 0.5, 1] }}
                    onClick={() => selectChapter(index)}
                    aria-current={index === chapterIndex}
                    className={
                      "mathlab-chapter" + (index === chapterIndex ? " is-active" : "")
                    }
                  >
                    <span className="min-w-0 truncate font-medium">{entry.name}</span>
                    <span className="shrink-0 text-[11px] opacity-80">
                      {entry.focus.split(" ").slice(0, 5).join(" ")}…
                    </span>
                    {index === chapterIndex ? (
                      <span className="mathlab-chapter__go" aria-hidden>
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Split workspace */}
        <div className="mathlab-split mt-4">
          {/* ---------------- Left: graphing canvas ---------------- */}
          <div className="premium-glass flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold tracking-tight">
                  Visual graphing canvas
                </h2>
                <p className="mt-0.5 truncate text-[11px] text-text-dim">
                  {chapter.name} — {model.label}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-text-dim">
                {model.formula}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {grade.models.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => selectModel(entry)}
                  className={
                    "mathlab-model" +
                    (entry.id === model.id ? " is-active" : "") +
                    (entry.id === model.id ? "" : " opacity-90")
                  }
                >
                  {entry.id === model.id ? (
                    <Check className="h-3.5 w-3.5 text-[var(--signal)]" />
                  ) : (
                    <Sigma className="h-3.5 w-3.5" />
                  )}
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="mathlab-canvas-wrap">
              <GraphCanvas model={model} params={params} />
            </div>

            <p className="text-[11px] leading-relaxed text-text-dim">{model.note}</p>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {model.params.map((param) => (
                <div key={param.key} className="mathlab-param">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`param-${param.key}`}
                      className="text-[11px] font-medium text-text-dim"
                    >
                      {param.label}
                    </label>
                    <span className="font-display text-xs font-bold tabular-nums">
                      {(params[param.key] ?? param.value).toFixed(1)}
                    </span>
                  </div>
                  <input
                    id={`param-${param.key}`}
                    type="range"
                    className="mathlab-range mt-2.5"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={params[param.key] ?? param.value}
                    onChange={(event) =>
                      setParams((current) => ({
                        ...current,
                        [param.key]: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ---------------- Right: equation engine ---------------- */}
          <div className="premium-glass flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold tracking-tight">
                Step-by-step AI equation engine
              </h2>
              <Sparkles className="h-4 w-4 shrink-0 text-[var(--signal)]" />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const input = formula.trim();
                if (!input || solving) return;
                runEngine(input);
                void askEngine({ question: input });
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                value={formula}
                onChange={(event) => setFormula(event.target.value)}
                placeholder={`Paste or type a problem — ${chapter.example}`}
                /* 16px on phones so iOS Safari does not zoom the page when
                   the field takes focus; the desktop step stays at 14px. */
                className="w-full min-w-0 rounded-full border border-[var(--glass-line)] bg-transparent px-4 py-3 text-base outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)] sm:flex-1 sm:py-2.5 sm:text-sm"
              />
              <MovingBorderButton
                type="submit"
                disabled={solving || !formula.trim()}
                loading={solving}
                className="w-full shrink-0 sm:w-auto"
                innerClassName="w-full px-5 py-3 text-sm sm:w-auto sm:py-2.5 sm:text-[13px]"
              >
                Solve
              </MovingBorderButton>
            </form>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                void readDocument(event.dataTransfer.files?.[0]);
              }}
              className={"tool-dropzone" + (dragOver ? " is-over" : "")}
            >
              {solving ? (
                <Loader2 className="spin-micro h-5 w-5 text-[var(--signal)]" />
              ) : (
                <FileUp className="h-5 w-5 text-[var(--signal)]" />
              )}
              <span className="text-sm font-medium">
                {solving ? "Reading the question…" : "Drop a question sheet or photo"}
              </span>
              <span className="text-xs text-text-dim">
                PDF, Word, PNG or JPG — the engine reads it and solves what it shows
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx,.md,.csv"
                onChange={(event) => void readDocument(event.target.files?.[0] ?? undefined)}
              />
            </label>

            {engineError && (
              <p className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-[12px] leading-relaxed text-amber-200">
                {engineError}
              </p>
            )}

            {solution && (
              <p className="rounded-2xl border border-[var(--glass-line)] px-4 py-3 text-[12px] leading-relaxed">
                <span className="font-semibold text-[var(--signal)]">Result: </span>
                {solution.headline}
              </p>
            )}

            <Accordion
              type="multiple"
              defaultValue={["given", "formulas", "steps", "verification"]}
              className="rounded-2xl border border-[var(--glass-line)] px-4"
            >
              {SOLUTION_BLOCKS.map((block) => (
                <AccordionItem key={block.key} value={block.key}>
                  <AccordionTrigger className="py-3 text-[13px] font-semibold tracking-tight text-foreground hover:no-underline">
                    {block.title}
                    {block.key !== "steps" ? (
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.14em] text-text-dim">
                        {blocks ? "Your working" : "Chapter cheat-sheet"}
                      </span>
                    ) : null}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {/* The working, as equation + rule cards. */}
                    {block.key === "steps" ? (
                      workedSteps.length > 0 ? (
                        <ol className="mathlab-steps">
                          {workedSteps.map((step, index) => (
                            <StepCard key={`step-${index}`} step={step} index={index} />
                          ))}
                        </ol>
                      ) : (
                        <p className="text-[12.5px] leading-relaxed text-text-dim">
                          Solve something and each step appears here as a card: the
                          equation on one side, the rule it used on the other.
                        </p>
                      )
                    ) : blocks ? (
                      <ul className="space-y-2">
                        {blocks[block.key].map((line, lineIndex) => (
                          <li
                            key={`${block.key}-${lineIndex}`}
                            className="mathlab-line"
                          >
                            <span className="mathlab-line__dot" aria-hidden />
                            <MathLine text={line} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      /* Nothing solved yet: the chapter's own cheat-sheet. */
                      (cheatFor[block.key]?.length ?? 0) > 0 ? (
                        <>
                          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-text-dim">
                            {chapter.name} · {grade.label}
                          </p>
                          <ul className="mathlab-cheats">
                            {cheatFor[block.key].map((entry) => (
                              <CheatRow key={`${block.key}-${entry.title}`} entry={entry} />
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-[12.5px] leading-relaxed text-text-dim">
                          Enter an equation or drop a question sheet and this block
                          fills in.
                        </p>
                      )
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Ask back: verify, question a step, or take the answer further */}
            <div className="rounded-2xl border border-[var(--glass-line)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                Ask about this solution
              </p>
              {turns.length > 0 && (
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                  {turns.map((turn, index) => (
                    <p
                      key={`turn-${index}`}
                      className={
                        "text-[12px] leading-relaxed " +
                        (turn.role === "student" ? "font-medium text-foreground" : "text-text-dim")
                      }
                    >
                      <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--signal)]">
                        {turn.role === "student" ? "You" : "Engine"}
                      </span>
                      {turn.text}
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Is this correct?", "Explain step 2 slower", "Give a similar question"].map(
                  (prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={solving || !solution}
                      onClick={() => {
                        setFollowUp("");
                        setTurns((current) => [...current, { role: "student", text: prompt }]);
                        void askEngine({ followUp: prompt });
                      }}
                      className="rounded-full border border-[var(--glass-line)] px-3 py-1 text-[11px] text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground disabled:opacity-40"
                    >
                      {prompt}
                    </button>
                  ),
                )}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  sendFollowUp();
                }}
                className="mt-2 flex items-center gap-2"
              >
                <input
                  value={followUp}
                  onChange={(event) => setFollowUp(event.target.value)}
                  placeholder={solution ? "Ask whether it is true, or about any step…" : "Solve something first, then ask here"}
                  disabled={!solution || solving}
                  className="min-w-0 flex-1 rounded-full border border-[var(--glass-line)] bg-transparent px-3.5 py-2 text-[13px] outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  aria-label="Send follow-up"
                  disabled={!solution || solving || !followUp.trim()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--signal-strong)] text-white transition-transform active:scale-95 disabled:opacity-40"
                >
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Avia, in the lab: talk or type about this problem */}
            <LabAviaChat context={solution ? `Math Lab, ${grade.label}, chapter ${chapter.name}. Current result: ${solution.headline} Answer: ${blocks?.verification.at(-1) ?? ""}` : undefined} />
          </div>
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
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              Math Lab
            </h2>
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
