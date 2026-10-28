import { gsap, prefersReducedMotion, refreshOnLoad } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The page's one long moment: a paragraph being distilled, in front of you.
 *
 * Everything above this section says what the pipeline does, and everything
 * below it shows what came out. This is the part in between — the actual
 * transformation — and it is the one place on the page where the content
 * itself is the animation instead of a picture of it:
 *
 *   1. Read    — a real chapter is on the sheet. The three sentences that
 *                carry marks are washed amber as the scroll reaches them.
 *   2. Distil  — those three ideas are ranked and handed their page numbers;
 *                everything else was restatement and is gone.
 *   3. Deliver — the cards settle with their citations, and the words of the
 *                source converge into their edges (the canvas underneath).
 *
 * Why scroll and not a loop: a loop is decoration you learn to ignore after
 * one pass, and it keeps moving while you read. Scrubbed motion does exactly
 * what the reader's hand does and rewinds cleanly — so the section reads as
 * something you are doing, not something playing at you.
 *
 * Under reduced motion, or on a narrow screen where a pinned stage would eat
 * the whole viewport, the three beats simply stack and the amber wash is
 * already on. Same content, no pin, no canvas.
 */

type Sentence = { text: string; key: boolean };

const SOURCE: Sentence[] = [
  {
    text: "When light strikes a polished surface, the ray that arrives and the ray that leaves make equal angles with the normal.",
    key: true,
  },
  {
    text: "In a plane mirror the normal is the same all across the glass, so those angles stay equal however far the ray travels.",
    key: false,
  },
  {
    text: "A concave mirror brings parallel rays together at its focus, and the distance from the pole to that focus is half the radius of curvature.",
    key: true,
  },
  {
    text: "A plane mirror forms an image that cannot be caught on a screen: the reflected rays only appear to come from behind the glass.",
    key: true,
  },
  {
    text: "The silvering is on the back of the glass, which is why the image sits slightly further away than the surface you look at.",
    key: false,
  },
];

const OUTLINE = [
  {
    idea: "The angle of incidence equals the angle of reflection, both measured from the normal.",
    weight: 100,
    page: "p. 168",
  },
  {
    idea: "A concave mirror's focal length is half its radius of curvature: f = R/2.",
    weight: 76,
    page: "p. 169",
  },
  {
    idea: "A plane mirror's image is virtual and erect — it cannot be caught on a screen.",
    weight: 54,
    page: "p. 171",
  },
];

const CARDS = [
  {
    tag: "Flashcard",
    front: "A concave mirror has a radius of curvature of 20 cm. Its focal length is",
    back: "f = R/2 = 10 cm, in front of the mirror.",
    cite: "p. 169",
  },
  {
    tag: "Question",
    front: "The image formed by a plane mirror is",
    back: "virtual and erect — the rays only appear to meet behind it.",
    cite: "p. 171",
  },
  {
    tag: "Summary",
    front: "Three ideas carry this chapter",
    back: "the reflection law · the mirror formula · virtual images",
    cite: "p. 168–171",
  },
];

/* ------------------------------------------------------------------ */
/* The canvas: the source's own words, converging into the cards       */
/* ------------------------------------------------------------------ */

type Fragment = {
  word: string;
  /** Which of the three kept ideas the word came from — and therefore which
   *  artefact ink it carries. */
  ink: number;
  /** Resting position and shape, all stable across reloads. */
  x: number;
  y: number;
  size: number;
  /** Where along the target card's edge this word lands, and how late. */
  edge: number;
  slot: number;
  rot: number;
};

/** The three artefact inks, in the order the kept sentences appear. These are
 *  the same tokens the dashboard uses for each artefact kind, so the canvas is
 *  a legend rather than confetti: amber was the summary, teal the flashcards,
 *  plum the question. Both themes carry their own values, and the palette is
 *  already tuned to sit beside the brand rather than fight it. */
const INK_TOKENS = ["--kind-summary", "--kind-flashcards", "--kind-quiz"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Only the sentences that were kept appear on the canvas — the words you
 *  watched being chosen are the words that go into the kit — and each word
 *  keeps the ink of the idea it belonged to. */
const KEY_WORDS = SOURCE.filter((sentence) => sentence.key).flatMap(
  (sentence, ink) =>
    sentence.text
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9=/\-.]/g, ""))
      .filter((word) => word.length > 3)
      .map((word) => ({ word, ink })),
);

const FRAGMENTS: Fragment[] = (() => {
  const rnd = mulberry32(20261028);
  return Array.from({ length: 104 }, (_, index) => ({
    word: KEY_WORDS[index % KEY_WORDS.length].word,
    ink: KEY_WORDS[index % KEY_WORDS.length].ink,
    x: rnd(),
    y: rnd(),
    size: 10 + Math.round(rnd() * 4),
    edge: rnd(),
    slot: rnd(),
    rot: (rnd() - 0.5) * 0.45,
  }));
})();

/**
 * One frame, drawn for a given scroll progress. Called only when the scroll
 * actually changes (rAF-coalesced), so a still page paints nothing.
 *
 * The card edges are measured from the real DOM cards rather than hard-coded,
 * so the convergence always lands exactly on the artifact it is building —
 * at any width, in either theme.
 */
function paintStage(canvas: HTMLCanvasElement, stage: HTMLElement, progress: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextW = Math.round(width * dpr);
  const nextH = Math.round(height * dpr);
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // Inks come from the artefact tokens, not literals, so the field is correct
  // in both themes and matches the cards it is building.
  const style = getComputedStyle(canvas);
  const inks = INK_TOKENS.map(
    (token) => style.getPropertyValue(token).trim() || "#e8a410",
  );
  const scale = Math.min(1.28, Math.max(0.86, width / 1080));
  const box = stage.getBoundingClientRect();
  const targets = Array.from(stage.querySelectorAll<HTMLElement>("[data-converge]"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    })
    .filter((r) => r.w > 8 && r.h > 8);

  for (const fragment of FRAGMENTS) {
    // Words gather late, one after another, so the field arrives as a wave
    // rather than snapping into place all at once.
    const local = Math.min(
      1,
      Math.max(0, (progress - 0.76 - fragment.edge * 0.09) / 0.17),
    );
    const eased = local * local * (3 - 2 * local);

    // Resting drift is a function of progress, not of time: the field only
    // moves while the reader moves it.
    let x = fragment.x * width + Math.sin(progress * 5 + fragment.edge * 9) * 12;
    let y = fragment.y * height + Math.cos(progress * 4 + fragment.slot * 7) * 9;

    if (targets.length) {
      const target = targets[Math.floor(fragment.slot * targets.length) % targets.length];
      const perimeter = 2 * (target.w + target.h);
      let d = fragment.edge * perimeter;
      let tx: number;
      let ty: number;
      if (d < target.w) {
        tx = target.x + d;
        ty = target.y;
      } else if ((d -= target.w) < target.h) {
        tx = target.x + target.w;
        ty = target.y + d;
      } else if ((d -= target.h) < target.w) {
        tx = target.x + target.w - d;
        ty = target.y + target.h;
      } else {
        d -= target.w;
        tx = target.x;
        ty = target.y + target.h - d;
      }
      x += (tx - x) * eased;
      y += (ty - y) * eased;
    }

    // Faint while the sheet is being read, brightest as the kit is written,
    // then gone — the words have become the cards.
    const alpha = (0.09 + 0.22 * Math.min(1, progress * 2.4)) * (1 - 0.95 * eased);
    if (alpha <= 0.004) continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = inks[fragment.ink] ?? inks[0];
    ctx.font = `${Math.round(fragment.size * scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.translate(x, y);
    ctx.rotate(fragment.rot);
    ctx.fillText(fragment.word, 0, 0);
    ctx.restore();
  }
}

export default function DistillStage() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const railRef = useRef<HTMLOListElement | null>(null);
  const progressRef = useRef(0);
  const redrawRef = useRef<() => void>(() => {});
  const [isStatic, setIsStatic] = useState(false);

  /* A pinned stage needs a viewport tall enough to hold three beats and a
     screen wide enough to put the rail beside them. Below that — or with
     reduced motion on — the same three beats stack instead. */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const update = () => setIsStatic(prefersReducedMotion() || !mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* Canvas bookkeeping: one frame on mount, one per size change, and one per
     scroll step (the scroll trigger calls `redrawRef`). */
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || isStatic) return;

    let frame = 0;
    const draw = () => {
      frame = 0;
      paintStage(canvas, stage, progressRef.current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    redrawRef.current = schedule;
    schedule();

    const observer = new ResizeObserver(schedule);
    observer.observe(stage);
    window.addEventListener("resize", schedule);
    return () => {
      redrawRef.current = () => {};
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isStatic]);

  useEffect(() => {
    if (isStatic) return;
    const root = sectionRef.current;
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (!root || !viewport || !stage) return;

    const read = stage.querySelector<HTMLElement>('[data-beat="read"]');
    const distil = stage.querySelector<HTMLElement>('[data-beat="distil"]');
    const deliver = stage.querySelector<HTMLElement>('[data-beat="deliver"]');
    if (!read || !distil || !deliver) return;

    const keys = read.querySelectorAll<HTMLElement>(".distill-key");
    const rows = distil.querySelectorAll<HTMLElement>("[data-row]");
    const cards = deliver.querySelectorAll<HTMLElement>("[data-converge]");
    const steps = Array.from(railRef.current?.children ?? []) as HTMLElement[];

    let frame = 0;
    const ctx = gsap.context(() => {
      gsap.set([distil, deliver], { autoAlpha: 0, y: 16 });
      /* The artifact cards carry the movement, not their beat: the canvas
         aims at these boxes before they are visible, so they have to be laid
         out where they will end up. */
      gsap.set(deliver, { y: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: viewport,
          start: "top top",
          /* Two-thirds of a screen of scroll per beat: long enough to read a
             sentence on the way through, short enough to stay one moment. */
          end: () => `+=${Math.round(window.innerHeight * 1.8)}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progressRef.current = self.progress;
            if (!frame) {
              frame = requestAnimationFrame(() => {
                frame = 0;
                redrawRef.current();
              });
            }
            const current = self.progress < 0.5 ? 0 : self.progress < 0.87 ? 1 : 2;
            steps.forEach((step, index) => {
              if (index === current) step.setAttribute("data-active", "true");
              else step.removeAttribute("data-active");
            });
          },
        },
      });

      tl.fromTo(read, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0)
        .to(keys, { backgroundSize: "100% 1.4em", duration: 0.55, stagger: 0.32 }, 0.9)
        .to(read, { autoAlpha: 0, y: -14, duration: 0.6 }, 4)
        .fromTo(distil, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 4.6)
        .fromTo(
          rows,
          { autoAlpha: 0, x: -10 },
          { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.26 },
          4.9,
        )
        .to(distil, { autoAlpha: 0, y: -14, duration: 0.6 }, 7.2)
        .to(deliver, { autoAlpha: 1, duration: 0.5 }, 7.9)
        .fromTo(
          cards,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.2 },
          8.1,
        );
    }, root);

    const stopRefresh = refreshOnLoad();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ctx.revert();
      stopRefresh();
    };
  }, [isStatic]);

  return (
    <section
      id="distill"
      ref={sectionRef}
      className="relative scroll-mt-24 py-12 sm:py-20 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px] md:text-[46px]">
            One paragraph,{" "}
            <span className="gradient-text">distilled</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-dim">
            Scroll through it. A real chapter is read, the three sentences that
            carry marks are kept, and the kit is written from those and nothing
            else.
          </p>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          "relative mt-8 sm:mt-12",
          isStatic ? "" : "flex h-[100svh] min-h-[560px] items-center overflow-hidden",
        )}
      >
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6">
          <div
            className={cn(
              "grid gap-5",
              !isStatic && "md:grid-cols-[minmax(0,184px)_minmax(0,1fr)] md:gap-10",
            )}
          >
            {!isStatic && (
              <ol ref={railRef} aria-hidden="true" className="hidden self-center md:block">
                {["Read", "Distil", "Deliver"].map((label, index) => (
                  <li
                    key={label}
                    className="distill-step py-1.5"
                    data-active={index === 0 ? "true" : undefined}
                  >
                    {label}
                  </li>
                ))}
              </ol>
            )}

            <div
              ref={stageRef}
              data-static={isStatic ? "true" : undefined}
              className={cn(
                "distill-stage relative",
                isStatic ? "space-y-4" : "h-[clamp(470px,58svh,620px)]",
              )}
            >
              {!isStatic && (
                <canvas
                  ref={canvasRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              )}

              {/* 1 — the source */}
              <article data-beat="read" className="distill-beat">
                <div className="glass-panel card-surface mx-auto w-full max-w-[720px] p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-line)] pb-3">
                    <span className="inline-flex items-center gap-2 text-[12px] text-foreground">
                      <FileText className="h-3.5 w-3.5 text-[var(--brand)]" />
                      Physics-Ch4.pdf
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                      pages 168–171
                    </span>
                  </div>
                  <p className="mt-5 space-y-3 text-[14px] leading-relaxed text-text-dim sm:text-[15px]">
                    {SOURCE.map((sentence) => (
                      <span key={sentence.text} className="block">
                        <span
                          className={cn(
                            sentence.key && "distill-key text-foreground",
                          )}
                        >
                          {sentence.text}
                        </span>
                      </span>
                    ))}
                  </p>
                  <p className="mt-5 flex items-center gap-2 border-t border-[var(--panel-line)] pt-3.5 text-[12px] text-text-dim">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--brand)]" />
                    Reading — five paragraphs in, three carry marks.
                  </p>
                </div>
              </article>

              {/* 2 — what survived the read */}
              <article data-beat="distil" className="distill-beat">
                <div className="glass-panel card-surface mx-auto w-full max-w-[680px] p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-line)] pb-3">
                    <span className="text-[12px] text-foreground">Ranked outline</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">
                      17 ideas in · 3 kept
                    </span>
                  </div>
                  <ul className="mt-5 space-y-4">
                    {OUTLINE.map((row) => (
                      <li key={row.idea} data-row>
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[14px] leading-relaxed text-foreground sm:text-[14.5px]">
                            {row.idea}
                          </span>
                          <span className="shrink-0 font-display text-[12px] tabular-nums text-text-dim">
                            {row.page}
                          </span>
                        </div>
                        <span className="mt-2.5 block h-[4px] w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)]">
                          <span
                            className="block h-full rounded-full bg-[var(--brand)] opacity-80"
                            style={{ width: `${row.weight}%` }}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 border-t border-[var(--panel-line)] pt-3.5 text-[12px] text-text-dim">
                    Ranked by how much of the chapter depends on each idea — the
                    other fourteen were restatement.
                  </p>
                </div>
              </article>

              {/* 3 — what is handed back */}
              <article data-beat="deliver" className="distill-beat">
                <div className="mx-auto w-full max-w-[860px]">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {CARDS.map((card) => (
                      <div
                        key={card.tag}
                        data-converge
                        className="rounded-[12px] border border-[var(--panel-line)] bg-[var(--panel)] p-4 sm:p-5"
                      >
                        <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--brand)]">
                          {card.tag}
                        </span>
                        <p className="mt-2.5 text-[13.5px] font-medium leading-snug text-foreground sm:text-[14px]">
                          {card.front}
                        </p>
                        <p className="mt-2.5 border-t border-[var(--panel-line)] pt-2.5 text-[12.5px] leading-relaxed text-text-dim sm:text-[13px]">
                          {card.back}
                        </p>
                        <span className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] text-text-dim">
                          <FileText className="h-3 w-3 shrink-0 text-[var(--brand)]" />
                          {card.cite}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-center text-[12px] text-text-dim">
                    Delivered — three artifacts, every line keeping the page it
                    was read from.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
