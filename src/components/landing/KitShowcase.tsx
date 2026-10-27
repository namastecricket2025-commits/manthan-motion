import { useAuth } from "@/hooks/use-auth";
import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { ArrowRight, BookOpen, Check, FileText, GitBranch, Layers, ListChecks } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { RevealWords } from "./RevealWords";
import { useSpotlight } from "./use-spotlight";

/**
 * What the pipeline actually hands back.
 *
 * The rest of the page says what the product does; this section shows the
 * OUTPUT, which is the thing a student is really deciding about, and it is the
 * part a landing page normally replaces with three feature cards. Four tabs,
 * four artifacts — a chapter summary, a flashcard deck, a question bank and a
 * concept map — all written for one real chapter (Class 10 Physics, Light:
 * reflection and refraction), so the sample is checkable rather than a lorem
 * ipsum screenshot.
 *
 * The interaction is a proper tablist, not a set of toggled divs: roving
 * tabindex, arrow/Home/End keys, `aria-selected` and `aria-controls`, so it
 * reads correctly to a screen reader and works from the keyboard.
 */

interface KitTab {
  id: string;
  label: string;
  icon: typeof BookOpen;
  title: string;
  body: string;
  /** What the tab proves, in one line, under the prose. */
  proof: string;
  panel: ReactNode;
}

/** The small citation chip every artifact carries. */
function Cite({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[10px] text-[var(--brand-ink)]">
      <FileText className="h-3 w-3 shrink-0 text-[var(--signal)]" />
      {children}
    </span>
  );
}

/** One flashcard: the prompt, then the answer the syllabus expects. */
function Card({ front, back, cite }: { front: string; back: string; cite: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--panel-line)] bg-[var(--panel)] p-3.5">
      <p className="text-[13px] font-medium text-foreground">{front}</p>
      <p className="mt-2 border-t border-[var(--panel-line)] pt-2 text-[13px] leading-relaxed text-text-dim">
        {back}
      </p>
      <div className="mt-2.5">
        <Cite>{cite}</Cite>
      </div>
    </div>
  );
}

const SUMMARY_POINTS = [
  "The angle of incidence equals the angle of reflection, each measured from the normal.",
  "A concave mirror converges parallel rays at its focus, where the focal length is half the radius: f = R/2.",
  "Magnification is the ratio of image height to object height: m = h′/h, which equals −v/u for a mirror.",
];

const FLASHCARDS = [
  {
    front: "State the mirror formula.",
    back: "1/v + 1/u = 1/f, with each distance signed by the sign convention.",
    cite: "p. 168",
  },
  {
    front: "A concave mirror has a radius of curvature of 20 cm. Find its focal length.",
    back: "f = R/2 = 20/2 = 10 cm, measured in front of the mirror.",
    cite: "p. 169",
  },
  {
    front: "What is the sign of m for a real, inverted image?",
    back: "Negative. For a real image v is on the same side as the incident light, so m = −v/u is negative.",
    cite: "p. 171",
  },
];

const QUESTIONS = [
  {
    q: "A concave mirror has a radius of curvature of 30 cm. Its focal length is",
    options: ["15 cm", "30 cm", "60 cm", "7.5 cm"],
    answer: "15 cm",
    why: "The focal length of a spherical mirror is half its radius of curvature: f = R/2 = 30/2.",
  },
  {
    q: "The image formed by a plane mirror is",
    options: ["virtual and erect", "real and inverted", "real and erect", "virtual and inverted"],
    answer: "virtual and erect",
    why: "The reflected rays only appear to meet behind the mirror, so the image cannot be caught on a screen.",
  },
];

const MAP_BRANCHES = [
  { parent: "Reflection", child: "Mirror formula", detail: "1/v + 1/u = 1/f" },
  { parent: "Refraction", child: "Snell's law", detail: "n₁ sin i = n₂ sin r" },
  { parent: "Lenses", child: "Thin lens formula", detail: "1/v − 1/u = 1/f" },
];

const TABS: KitTab[] = [
  {
    id: "summary",
    label: "Summary",
    icon: BookOpen,
    title: "A chapter on one screen",
    body: "Forty pages become the handful of ideas that carry marks, ranked by how much of the chapter depends on them. Nothing is rewritten from memory — each line is drawn from a passage you can open.",
    proof: "Every line keeps the page it was read from.",
    panel: (
      <div className="rounded-[10px] border border-[var(--panel-line)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-[15px] font-semibold text-foreground">
            Light — Reflection and Refraction
          </p>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)] px-2 py-1 text-[10px] text-text-dim">
            Class 10 · 4 pages
          </span>
        </div>
        <ul className="mt-3.5 space-y-2.5">
          {SUMMARY_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5 text-[13px] leading-relaxed text-text-dim">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--panel-line)] pt-3">
          <Cite>Physics-Ch4.pdf · pages 168–171</Cite>
          <span className="text-[10px] text-text-dim">3 key ideas kept · 11 dropped as restatement</span>
        </div>
      </div>
    ),
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: Layers,
    title: "Front, back, and where it came from",
    body: "Cards are written from the source rather than from a term list, so the back states what the syllabus expects — the formula with its sign convention, not just the formula's name.",
    proof: "Each card cites the passage it was written from.",
    panel: (
      <div className="space-y-2.5">
        {FLASHCARDS.map((card) => (
          <Card key={card.front} {...card} />
        ))}
      </div>
    ),
  },
  {
    id: "questions",
    label: "Question bank",
    icon: ListChecks,
    title: "Practice with the working shown",
    body: "Questions are generated per topic with an answer key and the reason for it, so a question you got wrong teaches the step you missed instead of only marking you down.",
    proof: "Answers arrive with the step they come from, not just a tick.",
    panel: (
      <div className="space-y-2.5">
        {QUESTIONS.map((question, index) => (
          <div
            key={question.q}
            className="rounded-[10px] border border-[var(--panel-line)] bg-[var(--panel)] p-3.5"
          >
            <p className="text-[13px] font-medium text-foreground">
              <span className="mr-1.5 tabular-nums text-text-dim">{index + 1}.</span>
              {question.q}
            </p>
            <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
              {question.options.map((option) => {
                const correct = option === question.answer;
                return (
                  <li
                    key={option}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]",
                      correct
                        ? "border-[color-mix(in_srgb,var(--brand)_45%,transparent)] bg-[var(--brand-soft)] text-foreground"
                        : "border-[var(--panel-line)] text-text-dim",
                    )}
                  >
                    {correct ? (
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--primary-foreground)]">
                        <Check className="h-2 w-2" strokeWidth={3.5} />
                      </span>
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--panel-line-strong)]" />
                    )}
                    {option}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 border-t border-[var(--panel-line)] pt-2.5 text-[12px] leading-relaxed text-text-dim">
              <span className="text-foreground">Why: </span>
              {question.why}
            </p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "map",
    label: "Concept map",
    icon: GitBranch,
    title: "The shape of the chapter",
    body: "A map of how a chapter hangs together, which is the part a topic list cannot show: which idea the others are built on, and which formulas are the same relation written twice.",
    proof: "Relations are grouped under the idea they belong to.",
    panel: (
      <div className="rounded-[10px] border border-[var(--panel-line)] bg-[var(--panel)] p-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-line-strong)] px-3 py-1.5 text-[12px] font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
          Light
        </span>
        <div className="relative mt-3.5 pl-4">
          {/* The spine and its elbows: a plain vertical hairline with one
              horizontal per branch, so the diagram is drawn with the same
              panel hairlines as everything else. */}
          <span
            aria-hidden="true"
            className="absolute bottom-3 left-1 top-0 w-px bg-[var(--panel-line-strong)]"
          />
          <ul className="space-y-2.5">
            {MAP_BRANCHES.map((branch) => (
              <li key={branch.parent} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-3 top-1/2 h-px w-3 bg-[var(--panel-line-strong)]"
                />
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)] px-2.5 py-2">
                  <span className="text-[12px] font-medium text-foreground">{branch.parent}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-text-dim" />
                  <span className="text-[12px] text-text-dim">{branch.child}</span>
                  <span className="ml-auto shrink-0 font-display text-[12px] tabular-nums text-foreground">
                    {branch.detail}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
];

export default function KitShowcase() {
  const ref = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const { isAuthenticated } = useAuth();
  useSpotlight(ref);

  // One fade per tab change rather than a mounted transition: the panel is the
  // same element throughout, so nothing re-mounts and the artifact never
  // flashes empty.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (prefersReducedMotion()) {
      gsap.set(panel, { opacity: 1, y: 0 });
      return;
    }
    const tween = gsap.fromTo(
      panel,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.24, ease: "power2.out", clearProps: "transform" },
    );
    return () => {
      tween.kill();
    };
  }, [active]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll<HTMLElement>("[data-reveal]"),
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  const select = (index: number, focus = false) => {
    setActive(index);
    if (focus) tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = TABS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (active + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (active - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  };

  const tab = TABS[active];

  return (
    <section id="kit" ref={ref} className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center" data-reveal>
        <RevealWords className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px] md:text-[46px]">
          What actually lands in your{" "}
          <span className="gradient-text">dashboard</span>
        </RevealWords>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-dim">
          Not a promise about output — the output. Four artifacts from one
          chapter of Class 10 Physics, exactly as the pipeline writes them.
        </p>
      </div>

      <div
        data-reveal
        className="glass-panel card-surface spot-card mt-12 overflow-hidden md:mt-16"
      >
        <div
          role="tablist"
          aria-label="Study kit artifacts"
          onKeyDown={onKeyDown}
          className="flex flex-wrap gap-1.5 border-b border-[var(--panel-line)] p-3 sm:p-4"
        >
          {TABS.map((item, index) => {
            const selected = index === active;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                id={`kit-tab-${item.id}`}
                aria-selected={selected}
                /* One panel element serves every tab, so every tab points at
                   that one id rather than at four ids of which three would
                   never exist in the DOM. */
                aria-controls="kit-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-150",
                  selected
                    ? "bg-[var(--text-main)] text-[var(--ink)]"
                    : "text-text-dim hover:bg-[color-mix(in_srgb,var(--text-main)_7%,transparent)] hover:text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          ref={panelRef}
          role="tabpanel"
          id="kit-panel"
          aria-labelledby={`kit-tab-${tab.id}`}
          className="grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-10 lg:p-8"
        >
          <div>
            <h3 className="font-display text-xl font-normal tracking-[-0.02em] text-foreground sm:text-2xl">
              {tab.title}
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-text-dim">{tab.body}</p>
            <p className="mt-4 flex items-start gap-2 text-[13px] text-foreground">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--primary-foreground)]">
                <Check className="h-2 w-2" strokeWidth={3.5} />
              </span>
              {tab.proof}
            </p>
            <Link
              to={isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard"}
              className="btn-ghost mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--panel-line)] px-4 py-2 text-[13px] font-medium text-foreground"
            >
              Generate a kit from your own notes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="min-w-0">{tab.panel}</div>
        </div>
      </div>
    </section>
  );
}
