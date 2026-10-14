import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useEffect, useRef } from "react";

const STEPS = [
  { short: "Parsing", status: "Parsing sources…" },
  { short: "Summarising", status: "Condensing core ideas…" },
  { short: "Structuring", status: "Organising by topic…" },
  { short: "Distilling", status: "Building flashcards & questions…" },
  { short: "Delivering", status: "Assembling your study kit…" },
];

const DONE = "Study kit ready — 24 flashcards · 12 question prompts";

/** A compact, looping version of the 5-step pipeline, used as the hero focal. */
export default function HeroPreview() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));
    const segments = Array.from(
      root.querySelectorAll<HTMLElement>("[data-segment]"),
    );
    const status = root.querySelector<HTMLElement>("[data-status]");

    const activate = (i: number) => {
      nodes.forEach((node, j) => {
        if (i === -1 || j < i) {
          node.style.borderColor = "var(--signal)";
          node.style.background = "var(--signal)";
          node.style.color = "var(--ink)";
        } else if (j === i) {
          node.style.borderColor = "var(--signal)";
          node.style.background = "color-mix(in srgb, var(--signal) 22%, transparent)";
          node.style.color = "var(--text-main)";
          node.style.boxShadow =
            "0 0 0 5px color-mix(in srgb, var(--signal) 18%, transparent)";
        } else {
          node.style.borderColor = "var(--card-border)";
          node.style.background = "transparent";
          node.style.color = "var(--text-dim)";
          node.style.boxShadow = "none";
        }
      });
      segments.forEach((seg, j) => {
        seg.style.background = j < i || i === -1 ? "var(--signal)" : "var(--card-border)";
      });
      if (status) {
        status.textContent = i === -1 ? DONE : STEPS[i]?.status ?? "";
      }
    };

    if (prefersReducedMotion()) {
      activate(-1);
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(nodes, { scale: 0.6, opacity: 0 });
      gsap.set(segments, { scaleX: 0, scaleY: 0 });
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 2.2,
        defaults: { ease: "power2.out" },
      });
      STEPS.forEach((_, i) => {
        tl.call(() => activate(i), [], ">-0.35");
        if (i > 0) {
          tl.to(segments[i - 1], { scaleX: 1, scaleY: 1, duration: 0.35 }, "<");
        }
        tl.fromTo(
          nodes[i],
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.4 },
          "<0.1",
        );
        tl.to({}, { duration: 0.75 });
      });
      tl.call(() => activate(-1), [], ">-0.4");
      tl.to(nodes, { scale: 1, duration: 0.2 }, "<");
      tl.fromTo(
        status,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.in" },
        "<",
      );
      tl.to({}, { duration: 1.6 });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      /* No border of its own: the frame above owns the hairline and the
         radius, so the screenshot reads as one plate instead of a card
         inside a card. */
      className="relative overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--text-main)_3%,var(--panel))] p-5 sm:p-6"
      data-hero-fade
    >
      {/* card chrome */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--signal)] opacity-80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--signal-2)] opacity-70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--card-border)]" />
        </div>
        <span className="font-mono text-[11px] tracking-wider text-text-dim">
          generation_07
        </span>
        <span className="glass-chip inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--signal)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--signal)] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
          </span>
          Live
        </span>
      </div>

      {/* mini pipeline — flex-1 slots so node centres sit at exact 20% steps */}
      <div className="relative mt-7 flex h-14 items-center">
        {/* connectors */}
        {STEPS.map((_, i) =>
          i === 0 ? null : (
            <span
              key={i}
              data-segment
              className="absolute h-0.5 origin-left bg-[var(--card-border)]"
              style={{ left: `${(i - 0.5) * 20}%`, width: "20%", top: "calc(50% - 1px)" }}
            />
          ),
        )}
        {STEPS.map((step, i) => (
          <span key={step.short} className="flex h-14 flex-1 items-center justify-center">
            <span
              data-node
              className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] font-display text-xs font-bold"
            >
              {i + 1}
            </span>
          </span>
        ))}
      </div>

      {/* status */}
      <p
        data-status
        className="mt-4 min-h-5 text-center text-[13px] font-medium text-text-main"
      >
        Parsing sources…
      </p>

      {/* output chips */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Summary", "24 flashcards", "12 prompts"].map((chip) => (
          <span
            key={chip}
            className="glass-chip px-3 py-1 text-[11px] font-medium text-text-dim"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}