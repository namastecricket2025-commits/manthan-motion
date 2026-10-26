import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import {
  Camera,
  Check,
  ClipboardCheck,
  HelpCircle,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Explanation } from "@/components/mathlab/parts";
import { MathTex } from "@/components/mathlab/latex";
import { enhancePhotoToFile } from "@/lib/enhance-photo";
import type { EngineStep } from "@/components/mathlab/solution";

/**
 * Check My Work.
 *
 * A student pastes or photographs their own attempt; the tutor marks each of
 * the official steps and, more usefully, names the FIRST move that went wrong
 * and explains it. Everything after the first wrong move is a consequence, so
 * piling on there would only obscure the one thing worth fixing.
 *
 * Every step the check marks wrong is written to the mistake log — linked to
 * the saved solution when there is one — so the summary on the History tab is
 * a grouping of what actually happened rather than a score this panel made up.
 */

type Verdict = "correct" | "wrong" | "unclear";

interface Result {
  steps: { index: number; verdict: Verdict; comment: string }[];
  firstWrongIndex: number | null;
  mistake: string;
  summary: string;
}

const VERDICT_ICON: Record<Verdict, typeof Check> = {
  correct: Check,
  wrong: X,
  unclear: HelpCircle,
};

const VERDICT_LABEL: Record<Verdict, string> = {
  correct: "Correct",
  wrong: "Wrong",
  unclear: "Could not read",
};

export function CheckMyWork({
  problem,
  steps,
  finalAnswer,
  solutionId,
}: {
  problem: string;
  steps: EngineStep[];
  finalAnswer: string;
  solutionId?: string | null;
}) {
  const checkWork = useAction(api.mathTutor.checkWork);
  const recordAttempt = useMutation(api.mathHistory.recordAttempt);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);

  const [open, setOpen] = useState(false);
  const [work, setWork] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{
    storageId: Id<"_storage">;
    name: string;
    mime: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const attachPhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        // The page is sharpened before it is uploaded: marking working from a
        // soft photo reads a 3 as an 8 and fails the student for the camera.
        const upload = await enhancePhotoToFile(file);
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": upload.type || "application/octet-stream" },
          body: upload,
        });
        if (!response.ok) throw new Error(`The upload was refused (${response.status}).`);
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        setPendingPhoto({ storageId, name: upload.name, mime: upload.type });
        setPhotoName(upload.name);
      } catch {
        setError("That photo did not reach the tutor. Type your working instead.");
      } finally {
        setBusy(false);
      }
    },
    [generateUploadUrl],
  );

  const mark = useCallback(async () => {
    if (busy) return;
    if (!work.trim() && !pendingPhoto) {
      setError("Write or photograph your working first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await checkWork({
        problem,
        steps: steps.map((step) => ({
          title: step.title,
          expression: step.expression,
          rule: step.rule,
        })),
        finalAnswer,
        work: work.trim() || undefined,
        storageId: pendingPhoto?.storageId,
        name: pendingPhoto?.name,
        mime: pendingPhoto?.mime,
      });
      setResult(response);
      setPendingPhoto(null);
      setPhotoName(null);

      // Only the steps the checker marked wrong are logged, and only when
      // somebody is signed in — a signed-out visitor gets the feedback without
      // a history row.
      const wrong = response.steps.filter((entry) => entry.verdict === "wrong");
      if (wrong.length) {
        void recordAttempt({
          solutionId: (solutionId ?? undefined) as Id<"mathSolutions"> | undefined,
          problem,
          mistakes: wrong.map((entry) => ({
            stepIndex: entry.index,
            stepTitle: steps[entry.index]?.title ?? `Step ${entry.index + 1}`,
            rule: steps[entry.index]?.rule ?? "",
            note: entry.comment,
          })),
        }).catch(() => {
          // A history write that fails must never take the marking with it.
        });
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The tutor could not read that just now. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, checkWork, finalAnswer, pendingPhoto, problem, recordAttempt, solutionId, steps, work]);

  return (
    <div className="mathlab-check">
      <button
        type="button"
        className={"mathlab-tab-action" + (open ? " is-active" : "")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        {open ? "Close check" : "Check my work"}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="mathlab-check__panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          >
            <p className="mathlab-check__intro">
              Write your working below, or photograph the page. The tutor marks each move, then
              explains the first one that went wrong rather than every line after it.
            </p>

            <textarea
              value={work}
              onChange={(event) => setWork(event.target.value)}
              rows={4}
              placeholder={"Step 1: …\nStep 2: …"}
              aria-label="Your working"
              className="mathlab-check__input"
            />

            <div className="mathlab-check__actions">
              <button
                type="button"
                className="mathlab-tab-action"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <Camera className="h-3.5 w-3.5" />
                {photoName ? "Photo attached" : "Photograph it"}
              </button>
              {photoName ? <span className="mathlab-check__file">{photoName}</span> : null}
              <button
                type="button"
                className="mathlab-solve mathlab-solve--small"
                onClick={() => void mark()}
                disabled={busy || (!work.trim() && !pendingPhoto)}
              >
                {busy ? <Loader2 className="spin-micro h-4 w-4" /> : null}
                Mark my working
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(event) => void attachPhoto(event.target.files?.[0] ?? undefined)}
            />
            {error ? <p className="mathlab-error">{error}</p> : null}

            {result ? (
              <div className="mathlab-check__result">
                <p className="mathlab-check__summary">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <Explanation text={result.summary} />
                  </span>
                </p>

                <ol className="mathlab-check__steps">
                  {result.steps.map((entry) => {
                    const Icon = VERDICT_ICON[entry.verdict];
                    const firstWrong = entry.index === result.firstWrongIndex;
                    return (
                      <li
                        key={entry.index}
                        className={
                          "mathlab-check__step" +
                          ` is-${entry.verdict}` +
                          (firstWrong ? " is-first" : "")
                        }
                      >
                        <span className="mathlab-check__badge">
                          <Icon className="h-3.5 w-3.5" />
                          {VERDICT_LABEL[entry.verdict]}
                        </span>
                        <div className="mathlab-check__stepbody">
                          <span className="mathlab-check__steptitle">
                            Step {entry.index + 1} · {steps[entry.index]?.title ?? "Working"}
                          </span>
                          {steps[entry.index]?.expression ? (
                            <span className="mathlab-check__stepexpr">
                              <MathTex
                                source={steps[entry.index]!.expression}
                                fallback={steps[entry.index]!.expression}
                              />
                            </span>
                          ) : null}
                          {entry.comment ? (
                            <p className="mathlab-check__comment">
                              <Explanation text={entry.comment} />
                            </p>
                          ) : null}
                          {firstWrong ? (
                            <p className="mathlab-check__firstwrong">First step that went wrong</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {result.mistake ? (
                  <div className="mathlab-check__mistake">
                    <p className="mathlab-check__mistakelabel">What to fix</p>
                    <p>
                      <Explanation text={result.mistake} />
                    </p>
                  </div>
                ) : result.firstWrongIndex === null ? (
                  <p className="mathlab-check__clean">
                    No step was marked wrong. Every move in the official working lines up with
                    yours.
                  </p>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default CheckMyWork;
