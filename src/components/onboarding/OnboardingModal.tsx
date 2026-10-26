import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen, Check, GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";

/**
 * First-run questions.
 *
 * Two screens, not a tour: who the student is and which class they are in,
 * then which subjects they actually study. The answers are stored on the
 * account row so they survive a new device.
 *
 * This is a gate, not a suggestion: a brand-new Google account arrives with a
 * name and an email but no class, so the workspace cannot open on the right
 * level until the student says which class they are in. The sheet therefore
 * has no skip and no close — completing the two screens is the way in. The
 * answers remain editable from Settings.
 *
 * It is deliberately absent from /auth: a sign-in form behind a modal is not a
 * first-run experience.
 */

const GRADES = ["8", "9", "10", "11", "12"] as const;
const BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "State board"] as const;
const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Social Science",
  "Computer Science",
  "Hindi",
  "Accountancy",
  "Business Studies",
  "Economics",
  "History",
  "Political Science",
  "Geography",
  "Psychology",
  "Sociology",
] as const;

export function OnboardingModal() {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.profile);
  const complete = useMutation(api.users.completeOnboarding);
  const location = useLocation();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  /* No default class. A Google account supplies a name but never a class, and
     defaulting to 10 would silently open an eight-grader's workspace at the
     wrong level if they tapped through. The student has to choose. */
  const [grade, setGrade] = useState<string>("");
  const [board, setBoard] = useState<string>("CBSE");
  const [subjects, setSubjects] = useState<string[]>([
    "Mathematics",
    "Physics",
    "Chemistry",
  ]);
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState(false);

  /* Once the mutation has landed, keep the sheet closed even if the profile
     query is still catching up; the profile prop is the durable truth. */
  useEffect(() => {
    setClosed(false);
    setStep(0);
  }, [profile?.onboardedAt]);

  /* Google already knows the name, so the field starts filled — the student
     confirms or corrects it rather than typing it again. Once they edit it,
     a later profile refresh must not overwrite what they typed. */
  useEffect(() => {
    if (!nameTouched && profile?.name) setName(profile.name);
  }, [profile?.name, nameTouched]);

  const shouldShow =
    isAuthenticated &&
    profile !== undefined &&
    profile !== null &&
    profile.onboardedAt === null &&
    !closed &&
    location.pathname !== "/auth";

  /* The sheet is the only thing that can be touched while it is up; without
     this, a thumb swipe scrolls the workspace behind it on a phone. */
  useEffect(() => {
    if (!shouldShow) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shouldShow]);

  function toggleSubject(subject: string) {
    setSubjects((current) =>
      current.includes(subject)
        ? current.filter((entry) => entry !== subject)
        : [...current, subject].slice(0, 8),
    );
  }

  async function save() {
    if (saving || !name.trim() || !grade) return;
    setSaving(true);
    try {
      await complete({
        name: name.trim(),
        grade,
        board,
        subjects,
      });
      setClosed(true);
      toast.success("Workspace personalised", {
        description: `Class ${grade} · ${board} · ${subjects.length} subject${
          subjects.length === 1 ? "" : "s"
        }`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your answers",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {shouldShow ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-[var(--card-border)] bg-[var(--panel)] p-6 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-8"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--signal)]/10 blur-3xl"
            />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--card-border)] text-[var(--signal)]">
                  {step === 0 ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : (
                    <BookOpen className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
                    Step {step + 1} of 2
                  </p>
                  <p className="text-[11px] text-text-dim">
                    {step === 0 ? "Where you study" : "What you study"}
                  </p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {step === 0 ? (
                <motion.div
                  key="class"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.2 }}
                  className="relative mt-6"
                >
                  <h2
                    id="onboarding-title"
                    className="font-display text-2xl font-bold tracking-[-0.02em]"
                  >
                    Who are we teaching?
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
                    Your name and class set how the workspace greets you and the
                    level every practice set opens on. You can change them in
                    Settings, but both are needed before the workspace opens.
                  </p>

                  <label
                    htmlFor="onboarding-name"
                    className="mt-5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim"
                  >
                    Your name
                  </label>
                  <input
                    id="onboarding-name"
                    value={name}
                    onChange={(event) => {
                      setNameTouched(true);
                      setName(event.target.value);
                    }}
                    maxLength={60}
                    autoComplete="name"
                    placeholder="e.g. Aarav Sharma"
                    className="mt-2 w-full rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)] px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-colors focus:border-[color-mix(in_srgb,var(--text-main)_40%,transparent)]"
                  />

                  <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                    Class
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {GRADES.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        aria-pressed={grade === entry}
                        onClick={() => setGrade(entry)}
                        className={
                          "rounded-xl border py-3 text-sm font-semibold transition-colors " +
                          (grade === entry
                            ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                            : "border-[var(--card-border)] text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
                        }
                      >
                        {entry}
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                    Board
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BOARDS.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        aria-pressed={board === entry}
                        onClick={() => setBoard(entry)}
                        className={
                          "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors " +
                          (board === entry
                            ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                            : "border-[var(--card-border)] text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
                        }
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="subjects"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.2 }}
                  className="relative mt-6"
                >
                  <h2
                    id="onboarding-title"
                    className="font-display text-2xl font-bold tracking-[-0.02em]"
                  >
                    What are you studying?
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
                    Pick everything you have an exam in. These become the default
                    chips in your workspace — not a limit on what you can open.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {SUBJECTS.map((entry) => {
                      const active = subjects.includes(entry);
                      return (
                        <button
                          key={entry}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleSubject(entry)}
                          className={
                            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors " +
                            (active
                              ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                              : "border-[var(--card-border)] text-text-dim hover:border-[color-mix(in_srgb,var(--text-main)_32%,transparent)] hover:text-foreground")
                          }
                        >
                          {active ? <Check className="h-3.5 w-3.5" /> : null}
                          {entry}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-4 text-[11px] text-text-dim">
                    {subjects.length === 0
                      ? "No subjects selected — that is fine, you can add them later."
                      : `${subjects.length} selected · Class ${grade} · ${board}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative mt-7 flex items-center justify-between gap-3 border-t border-[var(--card-border)] pt-5">
              {step === 0 ? (
                <span className="text-xs text-text-dim">
                  Two quick questions, then your workspace opens.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  disabled={saving}
                  className="text-xs font-medium text-text-dim transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Back
                </button>
              )}

              <div className="flex items-center gap-3">
                <span className="flex gap-1.5" aria-hidden="true">
                  {[0, 1].map((dot) => (
                    <span
                      key={dot}
                      className={
                        "h-1.5 rounded-full transition-all " +
                        (dot === step
                          ? "w-5 bg-[var(--signal)]"
                          : "w-1.5 bg-[var(--card-border)]")
                      }
                    />
                  ))}
                </span>
                {step === 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={!name.trim() || !grade}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-main)] px-5 py-2.5 text-[13px] font-semibold text-[var(--panel)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !name.trim() || !grade}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-main)] px-5 py-2.5 text-[13px] font-semibold text-[var(--panel)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Start studying
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default OnboardingModal;
