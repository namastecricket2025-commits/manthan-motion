import { ChevronDown } from "lucide-react";
import { GRADES, type GradeSpec } from "@/components/mathlab/mathlab";
import { PracticePanel } from "@/components/mathlab/PracticePanel";
import type { EngineProblem } from "@/components/mathlab/solution";

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

const TRACKS = ["CBSE", "NCERT", "IB", "IGCSE"] as const;

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

  return (
    <section className="mathlab-card mathlab-viewcard mathlab-practice-tab">
      <header className="mathlab-practice-tab__head">
        <div>
          <p className="mathlab-card__kicker">Practice</p>
          <h2 className="mathlab-card__title">Try one on your own</h2>
          <p className="mathlab-practice-tab__sub">
            Pick the class and chapter you are revising, then check your answer
            against the worked solution.
          </p>
        </div>
      </header>

      <div className="mathlab-practice-tab__selectors">
        <label className="mathlab-picker">
          <span>Curriculum</span>
          <div className="mathlab-select-wrap">
            <select
              value={track}
              onChange={(event) => onTrack(event.target.value)}
              aria-label="Curriculum track"
            >
              {TRACKS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </div>
        </label>

        <label className="mathlab-picker">
          <span>Class</span>
          <div className="mathlab-select-wrap">
            <select
              value={grade.id}
              onChange={(event) => onSelect(event.target.value, 0)}
              aria-label="Class"
            >
              {GRADES.map((entry: GradeSpec) => (
                <option key={entry.id} value={entry.id}>
                  Class {entry.id}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </div>
        </label>

        <label className="mathlab-picker mathlab-picker--wide">
          <span>Chapter</span>
          <div className="mathlab-select-wrap">
            <select
              value={String(chapterIndex)}
              onChange={(event) => onSelect(grade.id, Number(event.target.value))}
              aria-label="Chapter"
            >
              {grade.chapters.map((entry, index) => (
                <option key={entry.name} value={index}>
                  {entry.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </div>
        </label>
      </div>

      <p className="mathlab-practice-tab__chapter">
        <strong>{chapter.name}</strong> · {chapter.focus}
      </p>

      <PracticePanel
        key={`${grade.id}-${chapterIndex}-${seed?.problem ?? "chapter"}`}
        problem={seed?.problem ?? chapter.example}
        steps={seed?.steps ?? []}
        finalAnswer={seed?.finalAnswer ?? ""}
        track={track}
        chapterName={chapter.name}
        chapterFormulas={chapter.formulas}
        autoStart={Boolean(seed)}
      />
    </section>
  );
}

export default PracticeTab;
