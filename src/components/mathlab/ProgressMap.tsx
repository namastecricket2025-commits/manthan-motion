import { api } from "@/convex/_generated/api";
import { GRADES, type GradeSpec } from "@/components/mathlab/mathlab";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The syllabus, as a map rather than a dropdown.
 *
 * Every chapter in the selected class is visible with its focus line, so a
 * student can see what is left instead of discovering it one menu at a time.
 * A tick is stored on the account (see `convex/progress.ts`), which means the
 * map survives a new phone — and it is deliberately separate from a practice
 * score: "I revised this" is a judgement only the student can make.
 */
export function ProgressMap({
  track,
  gradeId,
  currentChapter,
  onPractice,
}: {
  track: string;
  gradeId: string;
  currentChapter: number;
  onPractice: (chapterIndex: number) => void;
}) {
  const grade = GRADES.find((entry) => entry.id === gradeId) ?? GRADES[0];
  const rows = useQuery(api.progress.list, { track, grade: grade.id });
  const setChapter = useMutation(api.progress.setChapter);
  const [pending, setPending] = useState<number | null>(null);

  const done = new Set((rows ?? []).map((row) => row.chapterIndex));
  const total = grade.chapters.length;
  const revised = grade.chapters.filter((_, index) => done.has(index)).length;
  const percent = total ? Math.round((revised / total) * 100) : 0;
  const circumference = 2 * Math.PI * 26;

  async function toggle(index: number, name: string, next: boolean) {
    if (pending !== null) return;
    setPending(index);
    try {
      await setChapter({
        track,
        grade: grade.id,
        chapterIndex: index,
        chapterName: name,
        done: next,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save that chapter",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--card-border)] p-4">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-[color-mix(in_srgb,var(--text-main)_10%,transparent)]"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="var(--signal)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - percent / 100)}
                style={{ transition: "stroke-dashoffset 500ms ease" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums">
              {percent}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Class {grade.id}</p>
            <p className="mt-0.5 text-[11px] text-text-dim">
              {revised} of {total} chapters revised
            </p>
            <p className="mt-1 text-[10.5px] text-text-dim">{track}</p>
          </div>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-text-dim">
          Ticks are saved to your account, so this map follows you to another
          device. Practice a chapter and come back to mark it.
        </p>

        <div className="rounded-2xl border border-[var(--card-border)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim">
            Other classes
          </p>
          <ul className="mt-2 space-y-0.5">
            {GRADES.map((entry) => (
              <li key={entry.id}>
                <span
                  className={
                    "flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] " +
                    (entry.id === grade.id
                      ? "bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)] font-medium text-foreground"
                      : "text-text-dim")
                  }
                >
                  Class {entry.id}
                  <span className="text-[10.5px] tabular-nums">
                    {entry.chapters.length} ch
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-[10.5px] text-text-dim">
            Switch class from the Practice tab.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {grade.label} · syllabus map
            </h2>
            <p className="mt-1 text-[12px] text-text-dim">{grade.level}</p>
          </div>
        </div>

        <ol className="mt-4 space-y-2">
          {grade.chapters.map((chapter, index) => {
            const isDone = done.has(index);
            const isCurrent = index === currentChapter;
            return (
              <li
                key={chapter.name}
                className={
                  "group flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors " +
                  (isCurrent
                    ? "border-[color-mix(in_srgb,var(--text-main)_40%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)]"
                    : "border-[var(--card-border)] hover:border-[var(--panel-line-strong)]")
                }
              >
                <button
                  type="button"
                  aria-pressed={isDone}
                  aria-label={`${isDone ? "Unmark" : "Mark"} ${chapter.name} as revised`}
                  onClick={() => void toggle(index, chapter.name, !isDone)}
                  disabled={pending === index}
                  className={
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors " +
                    (isDone
                      ? "border-[var(--text-main)] bg-[var(--text-main)] text-[var(--panel)]"
                      : "border-[var(--card-border)] text-transparent hover:border-[color-mix(in_srgb,var(--text-main)_40%,transparent)]")
                  }
                >
                  {pending === index ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={
                        "text-[13.5px] font-medium " +
                        (isDone ? "text-text-dim line-through decoration-[var(--card-border)]" : "text-foreground")
                      }
                    >
                      {index + 1}. {chapter.name}
                    </p>
                    {isCurrent ? (
                      <span className="rounded-full border border-[color-mix(in_srgb,var(--text-main)_30%,transparent)] px-2 py-0.5 text-[9.5px] font-medium text-[var(--text-main)]">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-dim">
                    {chapter.focus}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onPractice(index)}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground"
                >
                  Practise
                  <ArrowRight className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-[11px] text-text-dim">
          A tick means you have revised the chapter — not that you scored well.
          Practice sets live one tab over.
        </p>
      </div>
    </div>
  );
}

export default ProgressMap;
