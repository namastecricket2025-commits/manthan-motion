import { useState } from "react";
import { GRADES, type GradeSpec } from "@/components/mathlab/mathlab";
import { PracticePanel } from "@/components/mathlab/PracticePanel";
import { ErrorHunt } from "@/components/mathlab/ErrorHunt";
import { MarkSteps } from "@/components/mathlab/MarkSteps";
import type { EngineProblem } from "@/components/mathlab/solution";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Practice, as its own tab.
 *
 * The curriculum and chapter selectors live here now: a chapter only matters
 * where it is actually used — a practice problem, and the formula sheet. The
 * Solve tab no longer makes a student pick a syllabus before typing a question.
 *
 * The panel is seeded with the chapter's own example, which gives the tutor the
 * topic, the formulas and the difficulty to write one fresh problem from; its
 * answer is checked by the same independent engine as a real solve.
 */

/**
 * Boards the lab is written for. NCERT is deliberately absent: it publishes the
 * textbooks CBSE prescribes rather than being a separate syllabus, so listing
 * both as tracks asked students to make a choice that does not exist.
 */
const TRACKS = ["CBSE", "ICSE", "IB", "IGCSE"] as const;

/** The three ways to practise: fresh questions, error-spotting, marking. */
type PracticeMode = "set" | "error" | "marks";

const MODES: Array<{ id: PracticeMode; label: string; hint: string }> = [
  { id: "set", label: "Question set", hint: "Fresh questions, checked answers" },
  { id: "error", label: "Find the error", hint: "One corrupted line per solution" },
  { id: "marks", label: "Step marking", hint: "Your own working, marked per step" },
];

export function PracticeTab({
  track,
  onTrack,
  gradeId,
  chapterIndex,
  seed,
  onSelect,
}: {
  track: string;
  onTrack: (track: string) => void;
  gradeId: string;
  chapterIndex: number;
  /** A problem carried over from Solve for "Another similar problem". */
  seed?: EngineProblem | null;
  onSelect: (gradeId: string, chapterIndex: number) => void;
}) {
  const grade = GRADES.find((entry) => entry.id === gradeId) ?? GRADES[0];
  const chapter = grade.chapters[chapterIndex] ?? grade.chapters[0];
  /* Board papers exist for Class 10 in this lab. Class 8 and 9 have school
     exams, not a board, so the option is not shown rather than explained. */
  const boardYear = grade.id === "10";
  const [mode, setMode] = useState<PracticeMode>("set");

  return (
    <section className="mathlab-card mathlab-viewcard mathlab-practice-tab">
      <header className="mathlab-practice-tab__head">
        <div>
          <h2 className="mathlab-card__title">
            {mode === "set" ? "Practice set" : mode === "error" ? "Find the error" : "Step marking"}
          </h2>
          <p className="mathlab-practice-tab__sub">
            {mode === "set"
              ? boardYear
                ? "Choose the chapter, how many questions you want and how hard they should be — or generate a board-paper set tagged with the year it follows."
                : "Choose the chapter, how many questions you want and how hard they should be."
              : mode === "error"
                ? "A worked solution with one line corrupted. Every other line is sound — find the one that isn't."
                : "Write a solution the way you would on paper and have each line marked against a scheme."}
          </p>
        </div>

      </header>

      <div className="mathlab-detail mathlab-practice-modes" role="group" aria-label="Practice mode">
        {MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-active={mode === entry.id}
            aria-pressed={mode === entry.id}
            title={entry.hint}
            onClick={() => setMode(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mathlab-practice-tab__selectors">
        <div className="mathlab-picker">
          <span>Curriculum</span>
          <Select value={track} onValueChange={onTrack}>
            <SelectTrigger className="mathlab-picker__trigger w-full" aria-label="Curriculum track">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="mathlab-picker__menu bg-[var(--menu-bg)] text-[var(--menu-ink)]">
              {TRACKS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mathlab-picker">
          <span>Class</span>
          <Select value={grade.id} onValueChange={(next) => onSelect(next, 0)}>
            <SelectTrigger className="mathlab-picker__trigger w-full" aria-label="Class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="mathlab-picker__menu bg-[var(--menu-bg)] text-[var(--menu-ink)]">
              {GRADES.map((entry: GradeSpec) => (
                <SelectItem key={entry.id} value={entry.id}>
                  Class {entry.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mathlab-picker mathlab-picker--wide">
          <span>Chapter</span>
          <Select
            value={String(chapterIndex)}
            onValueChange={(next) => onSelect(grade.id, Number(next))}
          >
            <SelectTrigger className="mathlab-picker__trigger w-full" aria-label="Chapter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="mathlab-picker__menu bg-[var(--menu-bg)] text-[var(--menu-ink)]">
              {grade.chapters.map((entry, index) => (
                <SelectItem key={entry.name} value={String(index)}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mathlab-practice-tab__chapter">
        <strong>{chapter.name}</strong> · {chapter.focus}
      </p>

      {mode === "set" ? (
        <PracticePanel
          key={`${grade.id}-${chapterIndex}-${seed?.problem ?? "chapter"}`}
          problem={seed?.problem ?? chapter.example}
          steps={seed?.steps ?? []}
          finalAnswer={seed?.finalAnswer ?? ""}
          track={track}
          gradeId={grade.id}
          chapterName={chapter.name}
          chapterFormulas={chapter.formulas}
          autoStart={Boolean(seed)}
        />
      ) : mode === "error" ? (
        <ErrorHunt
          key={grade.id}
          gradeId={grade.id}
          chapterName={chapter.name}
        />
      ) : (
        <MarkSteps
          key={`${grade.id}-${chapterIndex}`}
          gradeId={grade.id}
          track={track}
          chapterName={chapter.name}
          defaultQuestion={seed?.problem ?? chapter.example}
        />
      )}
    </section>
  );
}

export default PracticeTab;
