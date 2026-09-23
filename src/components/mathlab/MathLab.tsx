import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { usePlan } from "@/components/plans/PlanProvider";
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
  SOLUTION_BLOCKS,
  solveEquation,
  type GradeSpec,
  type PlotModel,
  type Solution,
} from "@/components/mathlab/mathlab";
import { GraphCanvas } from "@/components/mathlab/GraphCanvas";
import {
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Lock,
  Sigma,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

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

function defaultsFor(model: PlotModel): Record<string, number> {
  const values: Record<string, number> = {};
  for (const param of model.params) values[param.key] = param.value;
  return values;
}

export function MathLab() {
  const navigate = useNavigate();
  const { can, requireAccess } = usePlan();

  const [gradeId, setGradeId] = useState<string>(GRADES[0].id);
  const grade: GradeSpec = useMemo(() => getGrade(gradeId as GradeSpec["id"]), [gradeId]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = grade.chapters[chapterIndex] ?? grade.chapters[0];

  const [modelId, setModelId] = useState(grade.models[0].id);
  const model = grade.models.find((entry) => entry.id === modelId) ?? grade.models[0];
  const [params, setParams] = useState<Record<string, number>>(() =>
    defaultsFor(grade.models[0]),
  );

  const [formula, setFormula] = useState("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solving, setSolving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const timer = useRef<number | null>(null);

  const locked = !can("mathLabBasic");

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const selectGrade = useCallback(
    (next: GradeSpec) => {
      if (next.advanced && !requireAccess("mathLabFull")) return;
      setGradeId(next.id);
      setChapterIndex(0);
      const first = next.models[0];
      setModelId(first.id);
      setParams(defaultsFor(first));
      setSolution(null);
      setFormula("");
    },
    [requireAccess],
  );

  const selectModel = useCallback((next: PlotModel) => {
    setModelId(next.id);
    setParams(defaultsFor(next));
  }, []);

  const runEngine = useCallback(
    (input: string) => {
      if (!input.trim()) return;
      setSolving(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setSolution(solveEquation(input, grade, chapter));
        setSolving(false);
      }, 420);
    },
    [grade, chapter],
  );

  const readDocument = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setSolving(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setSolution(documentSolution(file.name, grade, chapter));
        setSolving(false);
      }, 900);
    },
    [grade, chapter],
  );

  const blocks = solution
    ? {
        given: solution.given,
        formulas: solution.formulas,
        steps: solution.steps,
        verification: solution.verification,
      }
    : null;

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
                    onClick={() => setChapterIndex(index)}
                    className={
                      "mathlab-chapter" + (index === chapterIndex ? " is-active" : "")
                    }
                  >
                    <span className="min-w-0 truncate font-medium">{entry.name}</span>
                    <span className="shrink-0 text-[11px] opacity-80">
                      {entry.focus.split(" ").slice(0, 5).join(" ")}…
                    </span>
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
              <h2 className="font-display text-base font-bold tracking-tight">
                Visual graphing canvas
              </h2>
              <span className="text-[11px] font-medium text-text-dim">
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
                runEngine(formula);
              }}
              className="flex gap-2"
            >
              <input
                value={formula}
                onChange={(event) => setFormula(event.target.value)}
                placeholder="Type an equation — e.g. 2x^2 - 5x + 3 = 0"
                className="min-w-0 flex-1 rounded-full border border-[var(--glass-line)] bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
              />
              <MovingBorderButton
                type="submit"
                disabled={solving || !formula.trim()}
                loading={solving}
                className="shrink-0"
                innerClassName="px-5 py-2.5 text-[13px]"
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
                readDocument(event.dataTransfer.files?.[0]);
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
                PDF, PNG or JPG — the chapter framework below is built from it
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                onChange={(event) => readDocument(event.target.files?.[0] ?? undefined)}
              />
            </label>

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
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {blocks ? (
                      <ul className="space-y-2">
                        {blocks[block.key].map((line) => (
                          <li
                            key={line}
                            className="flex gap-2.5 text-[12.5px] leading-relaxed text-text-dim"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--signal)]" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12.5px] leading-relaxed text-text-dim">
                        Enter an equation or drop a question sheet and this block
                        fills in.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
