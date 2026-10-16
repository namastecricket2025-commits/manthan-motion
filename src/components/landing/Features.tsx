import { gsap, prefersReducedMotion, refreshOnLoad, revealConfig } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { Check, FileText, Plus } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useSpotlight } from "./use-spotlight";

/**
 * What the product does, as six tiles that each SHOW it.
 *
 * The grid used to be six identical panels carrying icon + title + paragraph,
 * which is the one card shape that says nothing a bulleted list wouldn't — the
 * icon was a 20px glyph standing in for a screenshot. Both references do the
 * opposite: Linear's feature blocks are product UI doing the talking, and
 * Vercel's carry a capability list beside the claim. So every tile here leads
 * with a surface from the actual app — the upload queue, the pipeline's status
 * list, the material-mix donut, the activity bars, the same card in both
 * themes, the phone layout — and the prose sits underneath it as a caption
 * rather than as the whole tile.
 *
 * The grid is six columns so the tiles can be unequal (3+3, then 2+2+2, then
 * the wide phone tile) — an even 3×2 of same-sized boxes is what makes a grid
 * read as generated. Every tile takes the shared card language: `.card-surface`
 * for the corner, `.spot-card` for the pointer light, `.feature-card` for the
 * 1px lift.
 */

/** The recessed inner surface each tile's art sits on. One step off the card's
 *  own fill, so the art reads as a screen inside the tile rather than as more
 *  card. */
function Art({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--text-main)_3%,var(--panel))] p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tag — the small state pill used inside the art surfaces. */
function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        tone === "brand"
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : "bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)] text-text-dim",
      )}
    >
      {children}
    </span>
  );
}

/** The upload queue: a drop row and three sources, two read and one waiting. */
function SourceArt() {
  const rows = [
    { name: "Physics-Ch4.pdf", meta: "2.4 MB", state: "Read" },
    { name: "Chem-notes.jpg", meta: "photo · OCR", state: "Read" },
    { name: "Ch6-slides.pptx", meta: "18 slides", state: "Queued" },
  ];
  return (
    <Art>
      <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--panel-line-strong)] px-2.5 py-2 text-[11px] text-text-dim">
        <Plus className="h-3.5 w-3.5 shrink-0" />
        Drop a PDF, a link, or pasted notes
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)] px-2.5 py-1.5"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-text-dim" />
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{row.name}</span>
            <span className="hidden shrink-0 text-[11px] text-text-dim sm:block">{row.meta}</span>
            <Tag tone={row.state === "Read" ? "brand" : "muted"}>{row.state}</Tag>
          </li>
        ))}
      </ul>
    </Art>
  );
}

/** The five steps with their real states, the running one carrying its bar. */
function PipelineArt() {
  const rows: { label: string; state: string; progress?: number }[] = [
    { label: "Parse", state: "Done" },
    { label: "Summarise", state: "Done" },
    { label: "Structure", state: "Running", progress: 62 },
    { label: "Distill", state: "Queued" },
    { label: "Deliver", state: "Queued" },
  ];
  return (
    <Art>
      <ol className="space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.label} className="flex items-center gap-2.5">
            <span className="w-4 shrink-0 font-display text-[11px] tabular-nums text-text-dim">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] leading-5 text-foreground">{row.label}</span>
              {row.progress != null ? (
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]">
                  <span
                    className="block h-full rounded-full bg-[var(--brand)]"
                    style={{ width: `${row.progress}%` }}
                  />
                </span>
              ) : null}
            </span>
            <Tag tone={row.state === "Running" ? "brand" : "muted"}>{row.state}</Tag>
          </li>
        ))}
      </ol>
    </Art>
  );
}

/** The material mix as one donut plus its legend — the weight is the point. */
function MixArt() {
  const legend = [
    { label: "Summary", count: 14, swatch: "var(--brand)" },
    { label: "Flashcards", count: 48, swatch: "var(--text-main)" },
    { label: "Question bank", count: 36, swatch: "color-mix(in srgb, var(--text-main) 46%, transparent)" },
    { label: "Concept map", count: 6, swatch: "color-mix(in srgb, var(--text-main) 20%, transparent)" },
  ];
  return (
    <Art className="flex items-center gap-4">
      <div
        className="relative h-[74px] w-[74px] shrink-0 rounded-full"
        style={{
          background:
            "conic-gradient(var(--brand) 0 30%, var(--text-main) 30% 62%, color-mix(in srgb, var(--text-main) 46%, transparent) 62% 86%, color-mix(in srgb, var(--text-main) 20%, transparent) 86% 100%)",
        }}
      >
        {/* The hole is the art surface's own colour, not `--panel`, or the
            donut would sit on a ring of a different grey. */}
        <div className="absolute inset-[13px] rounded-full bg-[color-mix(in_srgb,var(--text-main)_3%,var(--panel))]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[15px] leading-none text-foreground">104</span>
          <span className="mt-0.5 text-[10px] text-text-dim">items</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {legend.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: row.swatch }}
            />
            <span className="min-w-0 flex-1 truncate text-text-dim">{row.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </Art>
  );
}

/** Seven days of study as bars, with the busiest day in the brand crimson. */
function ActivityArt() {
  const days = [
    { day: "M", value: 34 },
    { day: "T", value: 58 },
    { day: "W", value: 41 },
    { day: "T", value: 76 },
    { day: "F", value: 92 },
    { day: "S", value: 63 },
    { day: "S", value: 28 },
  ];
  return (
    <Art>
      <div className="flex h-[72px] items-end gap-1.5">
        {days.map((bar, index) => (
          <span key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="flex h-full w-full items-end">
              <span
                className={cn(
                  "w-full rounded-[3px]",
                  bar.value > 88
                    ? "bg-[var(--brand)]"
                    : "bg-[color-mix(in_srgb,var(--text-main)_22%,transparent)]",
                )}
                style={{ height: `${bar.value}%` }}
              />
            </span>
            <span className="text-[10px] text-text-dim">{bar.day}</span>
          </span>
        ))}
      </div>
    </Art>
  );
}

/**
 * The same card in both themes, side by side.
 *
 * These two swatches are the only places on the site that hard-code literal
 * colours, and they have to: their whole job is to show the two themes at
 * once, so neither may follow the active one.
 */
function ThemeArt() {
  const themes = [
    { label: "Day", surface: "#ffffff", ink: "#171717", dim: "#52525b" },
    { label: "Night", surface: "#0a0a0a", ink: "#f7f7f8", dim: "rgba(255, 255, 255, 0.62)" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {themes.map((theme) => (
        <div
          key={theme.label}
          className="overflow-hidden rounded-[10px] border border-[var(--panel-line)] p-3"
          style={{ background: theme.surface }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: theme.dim }}>
            {theme.label}
          </p>
          <span className="mt-3 block h-1.5 w-12 rounded-full" style={{ background: theme.ink }} />
          <span
            className="mt-2 block h-1.5 w-20 rounded-full"
            style={{ background: theme.dim, opacity: 0.5 }}
          />
          <span className="mt-3 flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-[4px]" style={{ background: "#c81f27" }} />
            <span
              className="h-3.5 flex-1 rounded-[4px]"
              style={{ background: theme.dim, opacity: 0.22 }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The phone: the same app, stacked, with the off-canvas bar at the bottom. */
function PhoneArt() {
  return (
    <div className="mx-auto w-[168px] shrink-0 rounded-[26px] border border-[var(--panel-line-strong)] bg-[var(--panel)] p-2">
      <div className="rounded-[18px] bg-[color-mix(in_srgb,var(--text-main)_4%,var(--panel))] p-2.5">
        <span className="mx-auto mb-2.5 block h-1 w-8 rounded-full bg-[var(--panel-line-strong)]" />
        <div className="space-y-1.5">
          <div className="rounded-md bg-[var(--panel)] p-2">
            <span className="block h-1.5 w-12 rounded-full bg-[var(--text-main)] opacity-85" />
            <span className="mt-1.5 block h-1.5 w-20 rounded-full bg-[var(--text-dim)] opacity-35" />
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--panel)] p-2">
            <span className="h-4 w-4 rounded-[4px] bg-[var(--brand-soft)]" />
            <span className="h-1.5 flex-1 rounded-full bg-[var(--text-dim)] opacity-35" />
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--panel)] p-2">
            <span className="h-4 w-4 rounded-[4px] bg-[var(--brand-soft)]" />
            <span className="h-1.5 flex-1 rounded-full bg-[var(--text-dim)] opacity-35" />
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1">
          <span className="h-1.5 rounded-full bg-[var(--brand)]" />
          <span className="h-1.5 rounded-full bg-[var(--panel-line-strong)]" />
          <span className="h-1.5 rounded-full bg-[var(--panel-line-strong)]" />
          <span className="h-1.5 rounded-full bg-[var(--panel-line-strong)]" />
        </div>
      </div>
    </div>
  );
}

const TILES: { title: string; body: string; art: ReactNode; span: string }[] = [
  {
    title: "Source anything",
    body: "PDFs, slides, a link or pasted notes. Every source stays in the upload queue, and you can pull any of them out before you generate.",
    art: <SourceArt />,
    span: "sm:col-span-2 lg:col-span-3",
  },
  {
    title: "A pipeline you can watch",
    body: "Parse, summarise, structure, distill, deliver — each step reports its own status while it runs, so a whole textbook is never a black box.",
    art: <PipelineArt />,
    span: "sm:col-span-2 lg:col-span-3",
  },
  {
    title: "The mix you choose",
    body: "Summaries for the first pass, flashcards for drilling, question banks for practice, maps for the shape of a chapter — weighted per topic.",
    art: <MixArt />,
    span: "lg:col-span-2",
  },
  {
    title: "Streaks you can see",
    body: "Seven days of work as bars, twelve weeks as a calendar. Coverage stays visible instead of living in your head.",
    art: <ActivityArt />,
    span: "lg:col-span-2",
  },
  {
    title: "Night and day",
    body: "Two themes built from one token set, so the app looks deliberate at 9am and at 1am without a second stylesheet.",
    art: <ThemeArt />,
    span: "lg:col-span-2",
  },
];

const MOBILE_POINTS = [
  "Off-canvas navigation instead of a squeezed sidebar",
  "Stacked cards that read at thumb width",
  "A background tuned for mid-range devices",
];

export default function Features() {
  const ref = useRef<HTMLElement | null>(null);
  useSpotlight(ref);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>("[data-card]");
    const heading = root.querySelectorAll<HTMLElement>("[data-reveal]");

    if (prefersReducedMotion()) {
      gsap.set([...cards, ...heading], { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        heading,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.07,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
      gsap.fromTo(
        cards,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "transform",
          scrollTrigger: { trigger: root, start: "top 78%", toggleActions: "play none none none" },
        },
      );
    }, root);

    const stopRefresh = refreshOnLoad();
    return () => {
      ctx.revert();
      stopRefresh();
    };
  }, []);

  return (
    <section
      id="features"
      ref={ref}
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-2xl text-center" data-reveal>
        <h2 className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px] md:text-[46px]">
          Everything you need to go from{" "}
          <span className="gradient-text">notes</span> to study material
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-dim">
          One upload queue, one guided pipeline, and a study kit that matches how
          you revise — summaries when you're scanning, flashcards when you're
          drilling.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-6">
        {TILES.map((tile) => (
          <article
            key={tile.title}
            data-card
            className={cn(
              "feature-card glass-panel card-surface spot-card flex flex-col p-4 sm:p-5",
              tile.span,
            )}
          >
            <div className="flex-1">{tile.art}</div>
            <div className="mt-4">
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                {tile.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-dim">{tile.body}</p>
            </div>
          </article>
        ))}

        {/* The wide tile: the app as it is actually used, next to what that
            costs the layout. It spans the full row so the phone can sit at
            its own width and the copy gets a measure instead of a column. */}
        <article
          data-card
          className="feature-card glass-panel card-surface spot-card flex flex-col gap-6 p-4 sm:col-span-2 sm:p-5 lg:col-span-6 lg:flex-row lg:items-center lg:gap-8 lg:p-6"
        >
          <PhoneArt />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-foreground sm:text-lg">
              Built for the phone it will be used on
            </h3>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-dim">
              Most revision happens on a phone, at night, in a hurry — so that is
              the layout the app is designed from and the desktop is the widened
              version of it.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {MOBILE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2 text-[13px] text-text-dim">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
