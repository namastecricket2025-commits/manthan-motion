import { GRADES, type GradeSpec } from "@/components/mathlab/mathlab";
import { PracticePanel } from "@/components/mathlab/PracticePanel";
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
          <h2 className="mathlab-card__title">Try one on your own</h2>
          <p className="mathlab-practice-tab__sub">
            Pick the class and chapter you are revising, then check your answer
            against the worked solution.
          </p>
        </div>
      </header>

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
