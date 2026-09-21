import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lightbulb,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";

/**
 * Renderers for the five artefacts the generator produces. Each takes the
 * validated JSON straight out of the `materials` row — no reshaping and no
 * invented content.
 *
 * Provenance lives in the artefact header ("from N sources · model"), not on
 * every item: a filename chip under each flashcard and quiz explanation read
 * as clutter, so per-item source tags are deliberately shown only in the
 * summary, where a section genuinely traces to one source.
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

/** Summary sections carry quiet two-digit ordinals instead of icons —
 *  formal, and stable per position across regenerations. */
const sectionOrdinal = (i: number) => String(i + 1).padStart(2, "0");

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
            <p className="flex items-baseline gap-2 font-display text-sm font-bold tracking-tight">
              <span
                aria-hidden="true"
                className="text-[11px] font-semibold tabular-nums text-[var(--signal)]"
              >
                {sectionOrdinal(i)}
              </span>
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
            {section.source && (
              <span className="mt-1 inline-block max-w-full truncate rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[10px] font-medium text-text-dim">
                {section.source}
              </span>
            )}
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

/**
 * A real card: the question sits on the front face and the answer on the
 * back, and tapping flips the card in 3D instead of swapping text in place.
 * No per-card source chip — the deck header already names the sources.
 */
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
        className={
          "flip-card block h-[260px] w-full max-w-xl cursor-pointer select-none text-left sm:h-[280px] " +
          (flipped ? "flip-card--flipped" : "")
        }
      >
        <span className="flip-card__inner block h-full w-full">
          {/* front — the question */}
          <span className="flip-card__face glass-panel flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--signal)]">
              Question
            </span>
            <span className="font-display text-lg font-bold leading-snug tracking-tight">
              {card.front}
            </span>
            <span className="text-[11px] text-text-dim">
              Tap to reveal the answer
            </span>
          </span>
          {/* back — the answer */}
          <span className="flip-card__face flip-card__face--back glass-panel flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--signal)]">
              Answer
            </span>
            <span className="font-display text-lg font-bold leading-snug tracking-tight">
              {card.back}
            </span>
            <span className="text-[11px] text-text-dim">
              Tap to flip back to the question
            </span>
          </span>
        </span>
      </button>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          className="glass-chip cd-pill inline-flex h-10 w-10 items-center justify-center"
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
          className="glass-chip cd-pill inline-flex h-10 w-10 items-center justify-center"
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
    const message =
      percent >= 80
        ? "Excellent — that's exam-ready recall."
        : percent >= 50
          ? "Solid — another pass will lock it in."
          : "Good start — run it again and watch the score climb.";
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-display text-4xl font-bold tracking-tight">
          {score}
          <span className="text-text-dim">/{total}</span>
        </p>
        <p className="text-sm text-text-dim">
          {percent}% correct — {message}
        </p>
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
          <MovingBorderButton
            onClick={() => {
              if (index + 1 >= total) setDone(true);
              else {
                setIndex(index + 1);
                setPicked(null);
              }
            }}
            className="mt-3"
            innerClassName="px-4 py-2 text-[13px] font-semibold"
          >
            {index + 1 >= total ? "See result" : "Next question"}
            <ArrowRight className="h-3.5 w-3.5" />
          </MovingBorderButton>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ mind map ---------------------------- */

const TAU = Math.PI * 2;

/** Greedy word-wrap for SVG labels (SVG has no automatic text wrapping). */
function wrapLabel(label: string, maxChars: number): string[] {
  const text = label.trim();
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

interface LeafNode {
  label: string;
  lines: string[];
  x: number;
  y: number;
  px: number;
  py: number;
}

interface BranchNode {
  title: string;
  lines: string[];
  x: number;
  y: number;
  r: number;
  children: LeafNode[];
}

/**
 * Radial mind map, drawn in a centre-origin coordinate system.
 *
 * Layout is measured, not hand-tuned: labels render once, their real rendered
 * width is read back via `getBBox()`, and the viewBox grows to enclose every
 * label — so nothing ever clips at an edge regardless of how long the model's
 * wording is. The user can nudge the type size, and the frame re-fits.
 */
export function MindmapView({ payload }: { payload: MindmapPayload }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [fontStep, setFontStep] = useState(1);
  const [frame, setFrame] = useState({ hw: 448, hh: 448 });
  const [fontTick, setFontTick] = useState(0);

  const baseFont = [12, 13.5, 15][fontStep];

  const layout = useMemo(() => {
    const branches = payload.branches;
    const n = Math.max(1, branches.length);

    const rootLines = wrapLabel(payload.root, 16);
    const rootRadius = Math.min(
      96,
      Math.max(56, 13 + Math.max(...rootLines.map((l) => l.length)) * 4.4),
    );

    const radius = 205 + Math.max(0, n - 5) * 18;
    // Spread branches evenly; start angles chosen so small maps read well
    // (2 branches left/right, 4 on the diagonals, otherwise from the top).
    const startAngle = n === 2 ? Math.PI / 2 : n === 4 ? Math.PI / 4 : -Math.PI / 2;

    const nodes: BranchNode[] = branches.map((branch, i) => {
      const angle = startAngle + (i / n) * TAU;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const bx = cos * radius;
      const by = sin * radius;

      const titleLines = wrapLabel(branch.title, 22);
      const labelR = Math.min(
        104,
        Math.max(58, 12 + Math.max(...titleLines.map((l) => l.length)) * 4.3),
      );

      // Children fan around their branch's ray, stacked outward so siblings
      // never overlap: each successive child sits a step further from the core.
      const count = branch.children.length;
      const spread = count > 1 ? 0.18 + count * 0.05 : 0;
      const children: LeafNode[] = branch.children.map((child, j) => {
        const offset = count === 1 ? 0 : (j / (count - 1) - 0.5) * spread;
        const cAngle = angle + offset;
        const cCos = Math.cos(cAngle);
        const cSin = Math.sin(cAngle);
        const cRadius = radius + labelR + 66 + j * 19;
        const cx = cCos * cRadius;
        const cy = cSin * cRadius;
        return {
          label: child,
          lines: wrapLabel(child, 26),
          x: cx,
          y: cy,
          // the link starts at the branch node's rim, aimed at the leaf
          px: bx + cCos * (labelR + 4),
          py: by + cSin * (labelR + 4),
        };
      });

      return { title: branch.title, lines: titleLines, x: bx, y: by, r: labelR, children };
    });

    return { rootLines, rootRadius, nodes };
  }, [payload.root, payload.branches]);

  // Re-measure once webfonts land — text metrics change when Space Grotesk
  // swaps in, and the frame must fit the final metrics, not the fallback's.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) setFontTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Grow the frame until every rendered label fits inside it with margin.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const texts = svg.querySelectorAll<SVGTextElement>("text[data-label]");
    if (texts.length === 0) return;
    let need = 0;
    texts.forEach((text) => {
      const box = text.getBBox();
      const mx = box.x + box.width / 2;
      const my = box.y + box.height / 2;
      need = Math.max(
        need,
        Math.abs(mx) + box.width / 2 + 18,
        Math.abs(my) + box.height / 2 + 18,
      );
    });
    const target = Math.ceil(need / 16) * 16;
    // Symmetric re-fit, but only on a meaningful delta — the guard is what
    // stops this effect (which reads `frame`) from re-triggering itself.
    if (Math.abs(target - frame.hw) > 8 || Math.abs(target - frame.hh) > 8) {
      setFrame({ hw: target, hh: target });
    }
  }, [layout, fontStep, fontTick, frame.hw, frame.hh]);

  const vb = {
    x: -frame.hw,
    y: -frame.hh,
    w: frame.hw * 2,
    h: frame.hh * 2,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-dim">
          Root idea at the centre — branches ring it, leaves fan outward.
        </p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Mind map text size">
          {["A−", "A", "A+"].map((label, step) => (
            <button
              key={label}
              type="button"
              aria-pressed={fontStep === step}
              onClick={() => setFontStep(step)}
              className={
                "glass-chip inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold transition-colors " +
                (fontStep === step ? "text-[var(--signal)]" : "text-text-dim")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="mx-auto block h-auto w-full min-w-[560px] max-w-[860px]"
          role="img"
          aria-label={`Mind map of ${payload.root}`}
        >
          {/* links first so nodes and labels paint on top */}
          {layout.nodes.map((branch, i) => {
            const d = Math.hypot(branch.x, branch.y) || 1;
            const ux = branch.x / d;
            const uy = branch.y / d;
            const sx = ux * layout.rootRadius;
            const sy = uy * layout.rootRadius;
            const ex = branch.x - ux * branch.r;
            const ey = branch.y - uy * branch.r;
            const mx = (sx + ex) / 2 + uy * 26;
            const my = (sy + ey) / 2 - ux * 26;
            return (
              <path
                key={`link-${i}`}
                d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                fill="none"
                stroke="var(--card-border)"
                strokeWidth="1.6"
              />
            );
          })}
          {layout.nodes.map((branch, i) =>
            branch.children.map((child, j) => {
              const dx = child.x - branch.x;
              const dy = child.y - branch.y;
              const d = Math.hypot(dx, dy) || 1;
              const ux = dx / d;
              const uy = dy / d;
              const sx = branch.x + ux * (branch.r + 2);
              const sy = branch.y + uy * (branch.r + 2);
              const ex = child.x - ux * 7;
              const ey = child.y - uy * 7;
              const mx = (sx + ex) / 2 + uy * 16;
              const my = (sy + ey) / 2 - ux * 16;
              return (
                <path
                  key={`leaf-${i}-${j}`}
                  d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                  fill="none"
                  stroke="var(--card-border)"
                  strokeWidth="1"
                  opacity="0.85"
                />
              );
            }),
          )}

          {/* leaves */}
          {layout.nodes.map((branch, i) =>
            branch.children.map((child, j) => {
              const anchor =
                child.x > 30 ? "start" : child.x < -30 ? "end" : "middle";
              const tx =
                anchor === "start"
                  ? child.x + 10
                  : anchor === "end"
                    ? child.x - 10
                    : child.x;
              const ty =
                anchor === "middle"
                  ? child.y - 12
                  : child.y - (child.lines.length - 1) * baseFont * 0.62;
              return (
                <g key={`leafnode-${i}-${j}`}>
                  <circle cx={child.x} cy={child.y} r="4" fill="var(--signal)" />
                  <text
                    data-label={`c-${i}-${j}`}
                    x={tx}
                    y={ty}
                    textAnchor={anchor}
                    dominantBaseline="central"
                    className="fill-[var(--text-dim)]"
                    style={{ fontSize: baseFont }}
                  >
                    {child.lines.map((line, k) => (
                      <tspan key={k} x={tx} dy={k === 0 ? 0 : baseFont * 1.22}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            }),
          )}

          {/* branch nodes + labels */}
          {layout.nodes.map((branch, i) => {
            const cos = branch.x / (Math.hypot(branch.x, branch.y) || 1);
            const anchor =
              cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
            const nx =
              anchor === "start"
                ? branch.x + branch.r + 10
                : anchor === "end"
                  ? branch.x - branch.r - 10
                  : branch.x;
            const ny =
              anchor === "middle"
                ? branch.y + (branch.y >= 0 ? branch.r + 16 : -branch.r - 16)
                : branch.y - (branch.lines.length - 1) * baseFont * 0.62;
            return (
              <g key={`branch-${i}`}>
                <circle
                  cx={branch.x}
                  cy={branch.y}
                  r={branch.r * 0.34}
                  fill="var(--signal-2)"
                />
                <circle
                  cx={branch.x}
                  cy={branch.y}
                  r={branch.r * 0.34}
                  fill="none"
                  stroke="var(--card-border)"
                  strokeWidth="1"
                />
                <text
                  data-label={`b-${i}`}
                  x={nx}
                  y={ny}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  className="fill-[var(--text-main)]"
                  style={{ fontSize: baseFont + 1.5, fontWeight: 650 }}
                >
                  {branch.lines.map((line, k) => (
                    <tspan key={k} x={nx} dy={k === 0 ? 0 : (baseFont + 1.5) * 1.22}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {/* the core */}
          <circle cx="0" cy="0" r={layout.rootRadius} fill="var(--signal)" />
          <text
            data-label="root"
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-[var(--primary-foreground)]"
            style={{ fontSize: baseFont + 1, fontWeight: 700 }}
          >
            {layout.rootLines.map((line, k) => (
              <tspan
                key={k}
                x="0"
                dy={k === 0 ? -((layout.rootLines.length - 1) * (baseFont + 1) * 1.2) / 2 : (baseFont + 1) * 1.2}
              >
                {line}
              </tspan>
            ))}
          </text>
        </svg>
      </div>
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
          <div className="mt-2 flex items-baseline gap-3">
            <span
              aria-hidden="true"
              className="font-display text-2xl font-bold tabular-nums text-[var(--signal)]"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <h4 className="font-display text-xl font-bold tracking-tight">
              {slide.title}
            </h4>
          </div>
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

      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="glass-chip cd-pill inline-flex h-10 w-10 items-center justify-center disabled:opacity-40"
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
            className="glass-chip cd-pill inline-flex h-10 w-10 items-center justify-center disabled:opacity-40"
            aria-label="Next slide"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {payload.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              tabIndex={-1}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === index
                  ? "w-5 bg-[var(--signal)]"
                  : "w-1.5 bg-[var(--card-border)] hover:bg-[var(--text-dim)]")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
