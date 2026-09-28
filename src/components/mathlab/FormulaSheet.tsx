import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Search } from "lucide-react";
import { GRADES, type CheatEntry, type GradeId } from "@/components/mathlab/mathlab";
import { MathTex } from "@/components/mathlab/latex";

/**
 * The formula sheet.
 *
 * Every line here comes from the chapter data the Lab already teaches from —
 * the same `cheat` entries the solve pane shows under "chapter reference" — so
 * the sheet can never disagree with the chapters. It is organised two ways at
 * once, because both are how a student actually revises: by curriculum track,
 * and by chapter.
 *
 * The track chips are not decoration. Each one lists the class levels it
 * covers, and the sheet only ever shows the chapters of those classes; Class 11
 * chapters appear under CBSE and NCERT, and not under the tracks whose Class 11
 * lies outside what this workspace holds.
 */

const TRACKS: Array<{ id: string; label: string; covers: GradeId[]; note: string }> = [
  { id: "CBSE", label: "CBSE", covers: ["8", "9", "10", "11"], note: "Classes 8 to 11, as examined in the board papers." },
  { id: "NCERT", label: "NCERT", covers: ["8", "9", "10", "11"], note: "Classes 8 to 11, following the NCERT textbooks." },
  { id: "IB", label: "IB", covers: ["8", "9", "10"], note: "MYP years through Class 10; the Class 11 chapters follow the CBSE sequence." },
  { id: "IGCSE", label: "IGCSE", covers: ["8", "9", "10"], note: "Lower Secondary through IGCSE across Classes 8 to 10." },
];

const KIND_LABEL: Record<CheatEntry["kind"], string> = {
  formula: "Formulas",
  theorem: "Theorems",
  definition: "Definitions",
};

const KIND_ORDER: Array<CheatEntry["kind"]> = ["formula", "theorem", "definition"];

export function FormulaSheet() {
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [gradeFilter, setGradeFilter] = useState<GradeId | "all">("all");
  const [query, setQuery] = useState("");
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const track = TRACKS.find((entry) => entry.id === trackId) ?? TRACKS[0];

  const chapters = useMemo(() => {
    const wanted = track.covers.includes(gradeFilter as GradeId) ? [gradeFilter as GradeId] : track.covers;
    return GRADES.filter((grade) => wanted.includes(grade.id)).flatMap((grade) =>
      grade.chapters.map((chapter) => ({ grade, chapter })),
    );
  }, [track, gradeFilter]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) {
      return chapters.map((entry) => ({ ...entry, hits: entry.chapter.cheat as CheatEntry[] }));
    }
    return chapters
      .map((entry) => ({
        ...entry,
        hits: entry.chapter.cheat.filter(
          (item) =>
            item.title.toLowerCase().includes(needle) ||
            item.latex.toLowerCase().includes(needle) ||
            (item.note ?? "").toLowerCase().includes(needle),
        ),
      }))
      .filter(
        (entry) => entry.hits.length > 0 || entry.chapter.name.toLowerCase().includes(needle),
      );
  }, [chapters, needle]);

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    });
  };

  const totalEntries = chapters.reduce((sum, entry) => sum + entry.chapter.cheat.length, 0);
  const totalChapters = chapters.length;

  return (
    <div className="mathlab-sheet">
      <header className="mathlab-sheet__head">
        <div>
          <p className="mathlab-card__kicker">Formula sheet</p>
          <h2 className="mathlab-card__title">Everything worth memorising, by chapter</h2>
        </div>
        {/* Stated from the data on screen, not a boast: this is how many
            relations the chapters below actually hold. */}
        <span className="mathlab-sheet__count">
          {totalEntries} entries · {totalChapters} chapters
        </span>
      </header>

      <div className="mathlab-sheet__tracks" role="tablist" aria-label="Curriculum track">
        {TRACKS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === trackId}
            className={"mathlab-sheet__track" + (entry.id === trackId ? " is-active" : "")}
            onClick={() => {
              setTrackId(entry.id);
              setGradeFilter("all");
              setOpenChapter(null);
            }}
          >
            <strong>{entry.label}</strong>
            <small>{entry.covers.map((id) => `Class ${id}`).join(" · ")}</small>
          </button>
        ))}
      </div>
      <p className="mathlab-sheet__note">{track.note}</p>

      <div className="mathlab-sheet__filters">
        <div className="mathlab-sheet__classes">
          <button
            type="button"
            className={"mathlab-chip" + (gradeFilter === "all" ? " is-active" : "")}
            onClick={() => setGradeFilter("all")}
          >
            All classes
          </button>
          {track.covers.map((id) => (
            <button
              key={id}
              type="button"
              className={"mathlab-chip" + (gradeFilter === id ? " is-active" : "")}
              onClick={() => setGradeFilter(id)}
            >
              Class {id}
            </button>
          ))}
        </div>
        <label className="mathlab-sheet__search">
          <Search className="h-3.5 w-3.5" aria-hidden />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenChapter(null);
            }}
            placeholder="Search a formula, theorem or definition"
            aria-label="Search the formula sheet"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mathlab-hint">Nothing in these chapters matches “{query}”.</p>
      ) : (
        <div className="mathlab-sheet__chapters">
          {filtered.map(({ grade, chapter, hits }) => {
            const key = `${grade.id}-${chapter.name}`;
            const open = openChapter === key;
            // Searching narrows a chapter to what matched; if the chapter
            // matched by name alone, the whole chapter is still offered.
            const entries: CheatEntry[] = needle && hits.length ? hits : chapter.cheat;
            return (
              <section key={key} className="mathlab-sheet__chapter" data-open={open}>
                <button
                  type="button"
                  className="mathlab-sheet__chapterhead"
                  aria-expanded={open}
                  onClick={() => setOpenChapter(open ? null : key)}
                >
                  <ChevronDown className="mathlab-fold__chev" aria-hidden />
                  <span className="mathlab-sheet__chaptername">{chapter.name}</span>
                  <span className="mathlab-sheet__chaptermeta">
                    Class {grade.id} · {entries.length} entries
                  </span>
                </button>
                {open ? (
                  <div className="mathlab-sheet__chapterbody">
                    <p className="mathlab-sheet__focus">{chapter.focus}</p>
                    {KIND_ORDER.map((kind) => {
                      const group = entries.filter((item) => item.kind === kind);
                      if (!group.length) return null;
                      return (
                        <div key={kind} className="mathlab-sheet__group">
                          <p className="mathlab-sheet__grouplabel">{KIND_LABEL[kind]}</p>
                          <ul className="mathlab-sheet__list">
                            {group.map((entry) => {
                              const entryKey = `${key}-${entry.title}`;
                              return (
                                <li key={entryKey} className="mathlab-sheet__row">
                                  <span className="mathlab-sheet__title">{entry.title}</span>
                                  <span className="mathlab-sheet__formula">
                                    <MathTex source={entry.latex} fallback={entry.latex} display />
                                  </span>
                                  {entry.note ? (
                                    <span className="mathlab-sheet__entrynote">{entry.note}</span>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={"mathlab-sheet__copy" + (copied === entryKey ? " is-done" : "")}
                                    onClick={() => copy(entryKey, entry.latex)}
                                    aria-label={`Copy the LaTeX for ${entry.title}`}
                                  >
                                    {copied === entryKey ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FormulaSheet;
