import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lightbulb,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Renderers for the five artefacts the generator produces. Each takes the
 * validated JSON straight out of the `materials` row — no reshaping and no
 * invented content — and shows the `source` fields the model returned so a
 * student can trace a point back to the file it came from.
 */

export interface SummaryPayload {
  title: string;
  overview: string;
  sections: { heading: string; points: string[]; source?: string }[];
  keyTerms?: { term: string; meaning: string }[];
}

export interface FlashcardsPayload {
  cards: { front: string; back: string; source?: string }[];
}

export interface QuizPayload {
  questions: {
    question: string;
    options: string[];
    answer: number;
    explanation?: string;
    source?: string;
  }[];
}

export interface MindmapPayload {
  root: string;
  branches: { title: string; children: string[] }[];
}

export interface SlidesPayload {
  title: string;
  subtitle?: string;
  slides: { title: string; bullets: string[]; notes?: string }[];
}

function SourceTag({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="mt-1 inline-block max-w-full truncate rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-medium text-text-dim">
      {source}
    </span>
  );
}

/* ------------------------------ summary ------------------------------ */

export function SummaryView({ payload }: { payload: SummaryPayload }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-lg font-bold tracking-tight">
          {payload.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          {payload.overview}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {payload.sections.map((section, i) => (
          <div
            key={`${section.heading}-${i}`}
            className="rounded-2xl border border-[var(--card-border)] p-4"
          >
            <p className="font-display text-sm font-bold tracking-tight">
              {section.heading}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {section.points.map((point, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--signal)]"
                  />
                  <span className="text-text-dim">{point}</span>
                </li>
              ))}
            </ul>
            <SourceTag source={section.source} />
          </div>
        ))}
      </div>

      {payload.keyTerms && payload.keyTerms.length > 0 && (
        <div>
          <p className="font-display text-sm font-bold tracking-tight">
            Key terms
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {payload.keyTerms.map((term, i) => (
              <div
                key={`${term.term}-${i}`}
                className="rounded-xl border border-[var(--card-border)] px-3.5 py-2.5"
              >
                <dt className="text-sm font-medium">{term.term}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-text-dim">
                  {term.meaning}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- flashcards ---------------------------- */

export function FlashcardsView({ payload }: { payload: FlashcardsPayload }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = payload.cards[index];
  if (!card) return null;

  const go = (delta: number) => {
    setIndex((index + delta + payload.cards.length) % payload.cards.length);
    setFlipped(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Show answer"}
        className="glass-panel flex min-h-[220px] w-full max-w-xl flex-col items-center justify-center gap-3 px-6 py-8 text-center"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--signal)]">
          {flipped ? "Answer" : "Question"}
        </span>
        <span className="font-display text-lg font-bold leading-snug tracking-tight">
          {flipped ? card.back : card.front}
        </span>
        <span className="text-[11px] text-text-dim">
          {flipped ? "Tap to see the question" : "Tap to reveal the answer"}
        </span>
        <SourceTag source={card.source} />
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          className="glass-chip inline-flex h-10 w-10 items-center justify-center"
          aria-label="Previous card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs tabular-nums text-text-dim">
          {index + 1} / {payload.cards.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="glass-chip inline-flex h-10 w-10 items-center justify-center"
          aria-label="Next card"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- quiz ------------------------------- */

export function QuizView({ payload }: { payload: QuizPayload }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const total = payload.questions.length;
  const question = payload.questions[index];

  if (done) {
    const percent = Math.round((score / total) * 100);
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-display text-4xl font-bold tracking-tight">
          {score}
          <span className="text-text-dim">/{total}</span>
        </p>
        <p className="text-sm text-text-dim">{percent}% correct</p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setPicked(null);
            setScore(0);
            setDone(false);
          }}
          className="glass-chip mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-text-dim">
        <span>
          Question {index + 1} of {total}
        </span>
        <span>Score {score}</span>
      </div>

      <p className="font-display text-base font-bold leading-snug tracking-tight">
        {question.question}
      </p>

      <ul className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const isAnswer = i === question.answer;
          const isPicked = picked === i;
          const revealed = picked !== null;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => {
                  setPicked(i);
                  if (isAnswer) setScore((s) => s + 1);
                }}
                className={
                  "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors " +
                  (revealed && isAnswer
                    ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)]"
                    : revealed && isPicked
                      ? "border-[var(--card-border)] opacity-70"
                      : "border-[var(--card-border)] hover:border-[var(--signal)]")
                }
              >
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] " +
                    (revealed && isAnswer
                      ? "border-[var(--signal)] text-[var(--signal)]"
                      : "border-[var(--card-border)] text-text-dim")
                  }
                >
                  {revealed && isAnswer ? (
                    <Check className="h-3 w-3" />
                  ) : revealed && isPicked ? (
                    <X className="h-3 w-3" />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                <span>{option}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {picked !== null && (
        <div className="rounded-2xl border border-[var(--card-border)] p-4">
          {question.explanation && (
            <p className="flex gap-2 text-sm leading-relaxed text-text-dim">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--signal)]" />
              {question.explanation}
            </p>
          )}
          <SourceTag source={question.source} />
          <button
            type="button"
            onClick={() => {
              if (index + 1 >= total) setDone(true);
              else {
                setIndex(index + 1);
                setPicked(null);
              }
            }}
            className="moving-border mt-3 block w-fit"
          >
            <span className="moving-border__inner inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold">
              {index + 1 >= total ? "See result" : "Next question"}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ mind map ---------------------------- */

/**
 * Radial mind map: the root sits at the centre, its branches ring the core and
 * each branch's children fan outward. The layout is derived from the model's
 * hierarchy — every label on screen came from the sources.
 */
export function MindmapView({ payload }: { payload: MindmapPayload }) {
  const size = 720;
  const cx = size / 2;
  const cy = size / 2;

  const layout = useMemo(() => {
    const branchCount = Math.max(1, payload.branches.length);
    const branchRadius = 190;

    return payload.branches.map((branch, i) => {
      const angle = (i / branchCount) * Math.PI * 2 - Math.PI / 2;
      const bx = cx + Math.cos(angle) * branchRadius;
      const by = cy + Math.sin(angle) * branchRadius;
      const children = branch.children.map((child, j) => {
        const offset = (j - (branch.children.length - 1) / 2) * 0.55;
        const childAngle = angle + offset * 0.32;
        const childRadius = branchRadius + 150 + (j % 2) * 24;
        return {
          label: child,
          x: cx + Math.cos(childAngle) * childRadius,
          y: cy + Math.sin(childAngle) * childRadius,
        };
      });
      return { title: branch.title, x: bx, y: by, children };
    });
  }, [payload.branches, cx, cy]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto block h-auto w-full min-w-[520px] max-w-[720px]"
        role="img"
        aria-label={`Mind map of ${payload.root}`}
      >
        {layout.map((branch, i) => (
          <g key={`${branch.title}-${i}`}>
            <line
              x1={cx}
              y1={cy}
              x2={branch.x}
              y2={branch.y}
              stroke="var(--card-border)"
              strokeWidth="1.5"
            />
            {branch.children.map((child, j) => (
              <g key={j}>
                <line
                  x1={branch.x}
                  y1={branch.y}
                  x2={child.x}
                  y2={child.y}
                  stroke="var(--card-border)"
                  strokeWidth="1"
                />
                <circle cx={child.x} cy={child.y} r="4" fill="var(--signal)" />
                <text
                  x={child.x}
                  y={child.y - 10}
                  textAnchor={
                    Math.abs(child.x - cx) < 40
                      ? "middle"
                      : child.x > cx
                        ? "start"
                        : "end"
                  }
                  className="fill-[var(--text-dim)]"
                  style={{ fontSize: 13 }}
                >
                  {child.label}
                </text>
              </g>
            ))}
            <circle cx={branch.x} cy={branch.y} r="8" fill="var(--signal-2)" />
            <text
              x={branch.x}
              y={branch.y - 16}
              textAnchor="middle"
              className="fill-[var(--text-main)]"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {branch.title}
            </text>
          </g>
        ))}

        <circle cx={cx} cy={cy} r="52" fill="var(--signal)" />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          className="fill-[var(--primary-foreground)]"
          style={{ fontSize: 15, fontWeight: 700 }}
        >
          {payload.root.length > 18
            ? `${payload.root.slice(0, 17)}…`
            : payload.root}
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------- slides ----------------------------- */

export function SlidesView({ payload }: { payload: SlidesPayload }) {
  const [index, setIndex] = useState(0);
  const total = payload.slides.length;
  const slide = payload.slides[index];
  if (!slide) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel overflow-hidden">
        <div className="border-b border-[var(--card-border)] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--signal)]">
            {payload.title}
            {payload.subtitle ? ` · ${payload.subtitle}` : ""}
          </p>
          <h4 className="mt-2 font-display text-xl font-bold tracking-tight">
            {slide.title}
          </h4>
        </div>
        <ul className="flex flex-col gap-2.5 px-6 py-5">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span
                aria-hidden="true"
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--signal)]"
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        {slide.notes && (
          <p className="border-t border-[var(--card-border)] px-6 py-3 text-xs italic leading-relaxed text-text-dim">
            Speaker note — {slide.notes}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="glass-chip inline-flex h-10 w-10 items-center justify-center disabled:opacity-40"
          aria-label="Previous slide"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs tabular-nums text-text-dim">
          Slide {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          disabled={index === total - 1}
          className="glass-chip inline-flex h-10 w-10 items-center justify-center disabled:opacity-40"
          aria-label="Next slide"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
