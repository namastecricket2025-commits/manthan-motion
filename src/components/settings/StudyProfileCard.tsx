import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * The onboarding answers, editable.
 *
 * The first-run sheet promises the class and subjects can be changed later;
 * this is where. It writes the same account fields through the same mutation,
 * so there is one source of truth and the first-run gate stays closed.
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

export function StudyProfileCard() {
  const profile = useQuery(api.users.profile);
  const complete = useMutation(api.users.completeOnboarding);
  const [grade, setGrade] = useState("");
  const [board, setBoard] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!profile || seeded.current) return;
    seeded.current = true;
    setGrade(profile.grade ?? "");
    setBoard(profile.board ?? "");
    setSubjects(profile.subjects ?? []);
  }, [profile]);

  const dirty =
    Boolean(profile) &&
    (grade !== (profile?.grade ?? "") ||
      board !== (profile?.board ?? "") ||
      subjects.join("|") !== (profile?.subjects ?? []).join("|"));

  function toggle(subject: string) {
    setSubjects((current) =>
      current.includes(subject)
        ? current.filter((entry) => entry !== subject)
        : [...current, subject].slice(0, 8),
    );
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await complete({ grade, board, subjects });
      toast.success("Study profile updated", {
        description: `Class ${grade} · ${board} · ${subjects.length} subject${
          subjects.length === 1 ? "" : "s"
        }`,
      });
    } catch (error) {
      toast.error("Could not save your study profile", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="set-card">
      <div className="set-card__head">
        <GraduationCap className="h-3.5 w-3.5" />
        Study profile
      </div>
      <p className="mb-3 text-xs leading-relaxed text-text-dim">
        Sets the class and board practice starts from. It never limits which
        notebook, chapter or lab you can open.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-text-dim">Class</span>
          <select
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            className="w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--signal)]"
          >
            <option value="">Choose a class</option>
            {GRADES.map((entry) => (
              <option key={entry} value={entry}>
                Class {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-text-dim">Board</span>
          <select
            value={board}
            onChange={(event) => setBoard(event.target.value)}
            className="w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--signal)]"
          >
            <option value="">Choose a board</option>
            {BOARDS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 text-[11px] font-medium text-text-dim">Subjects</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SUBJECTS.map((entry) => {
          const active = subjects.includes(entry);
          return (
            <button
              key={entry}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(entry)}
              className={
                "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                (active
                  ? "border-[color-mix(in_srgb,var(--text-main)_46%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_11%,transparent)] text-foreground"
                  : "border-[var(--card-border)] text-text-dim hover:text-foreground")
              }
            >
              {entry}
            </button>
          );
        })}
      </div>

      <div className="set-actions">
        <button
          type="button"
          className="set-btn set-btn--primary"
          onClick={() => void save()}
          disabled={!dirty || saving}
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {saving ? "Saving…" : "Save study profile"}
        </button>
      </div>
    </div>
  );
}

export default StudyProfileCard;
