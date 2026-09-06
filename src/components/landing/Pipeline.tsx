import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useEffect, useRef } from "react";

const STEPS = [
  {
    title: "Parse",
    desc: "Files, links and pasted notes are cleaned into plain text — sources stay visible in the queue the whole time.",
  },
  {
    title: "Summarise",
    desc: "Core ideas are condensed into a crisp outline, flagging the concepts worth drilling.",
  },
  {
    title: "Structure",
    desc: "Material is organised by chapter, topic and weight so the mix knows what to emphasise.",
  },
  {
    title: "Distill",
    desc: "Summaries, flashcards, question banks and concept maps are generated from the structured outline.",
  },
  {
    title: "Deliver",
    desc: "A study kit lands in your dashboard — every card labelled, every source cited back to the original.",
  },
];

const STATUS = [
  "Parsing sources…",
  "Summarising core ideas…",
  "Structuring by topic…",
  "Distilling flashcards & questions…",
  "Delivering study kit…",
];

const DONE_STATUS = "Study kit ready — labelled and cited. Open it in your dashboard.";

/**
 * The 5-step "generation pipeline" (mp-node walkthrough): one GSAP timeline
 * keeps node states, connector lines, step rows and status text perfectly in
 * sync. Fires once when scrolled into view.
 */
export default function Pipeline() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-row]"));
    const segments = Array.from(
      root.querySelectorAll<HTMLElement>("[data-segment]"),
    );
    const status = root.querySelector<HTMLElement>("[data-status]");

    const activate = (i: number) => {
      const done = i === -1;
      nodes.forEach((node, j) => {
        const isActive = j === i;
        node.style.borderColor = done || j <= i ? "var(--signal)" : "var(--card-border)";
        node.style.background =
          done || j < i ? "var(--signal)" : isActive ? "color-mix(in srgb, var(--signal) 22%, transparent)" : "transparent";
        node.style.color = done || j < i ? "var(--ink)" : isActive ? "var(--text-main)" : "var(--text-dim)";
        node.style.boxShadow =
          isActive && !done
            ? "0 0 0 5px color-mix(in srgb, var(--signal) 18%, transparent)"
            : "none";
      });
      segments.forEach((seg, j) => {
        seg.style.background =
          done || j < i ? "var(--signal)" : "var(--card-border)";
      });
      rows.forEach((row, j) => {
        const isActive = j === i;
        row.style.borderColor =
          done || j <= i ? "var(--signal)" : "var(--card-border)";
        row.style.background =
          done || isActive
            ? "color-mix(in srgb, var(--signal) 7%, transparent)"
            : "transparent";
      });
      if (status) status.textContent = done ? DONE_STATUS : STATUS[i] ?? "";
    };

    if (prefersReducedMotion()) {
      gsap.set([...nodes, ...rows], { opacity: 1 });
      gsap.set(segments, { scaleY: 1 });
      activate(-1);
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(root.querySelectorAll<HTMLElement>(
        "[data-reveal-heading], [data-reveal-visual]",
      ), { opacity: 0, y: 24 });
      gsap.set(nodes, { scale: 0.5, opacity: 0.4 });
      gsap.set(segments, { scaleY: 0 });
      gsap.set(rows, { opacity: 0.45 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: "top 72%", toggleActions: "play none none none" },
        defaults: { ease: "power2.inOut" },
      });

      tl.to(
        root.querySelectorAll<HTMLElement>(
          "[data-reveal-heading], [data-reveal-visual]",
        ),
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1 },
        0,
      );

      STEPS.forEach((_, i) => {
        if (i > 0) {
          tl.to(segments[i - 1], { scaleY: 1, duration: 0.4 }, ">-0.25");
        }
        tl.call(() => activate(i), [], "<0.05");
        tl.fromTo(
          nodes[i],
          { scale: 0.5, opacity: 0.4 },
          { scale: 1, opacity: 1, duration: 0.45 },
          "<0.1",
        );
        tl.fromTo(
          rows[i],
          { opacity: 0.45 },
          { opacity: 1, duration: 0.35 },
          "<",
        );
        tl.to({}, { duration: 0.9 });
      });
      tl.call(() => activate(-1), [], ">-0.4");
      tl.to({}, { duration: 0.3 });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="pipeline"
      ref={ref}
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 md:py-28"
    >
      <div className="mx-auto max-w-2xl text-center" data-reveal-heading>
        <span className="kicker">How it works</span>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-[42px] md:leading-[1.15]">
          One pipeline, <span className="gradient-text">five guided steps</span>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-text-dim">
          Watch a generation run live: every node, connector and status line is
          driven by a single timeline, so what you see is exactly what the
          pipeline is doing.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 items-start gap-10 md:mt-16 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] min-[900px]:gap-14">
        {/* ---- Visual: vertical rail (identical on mobile & desktop) ---- */}
        <div className="glass-panel p-5 sm:p-7" data-reveal-visual>
          <div className="relative flex h-[300px] flex-col items-stretch">
            {/* connectors (vertical, between node slots) */}
            {STEPS.map((_, i) =>
              i === 0 ? null : (
                <span
                  key={`seg${i}`}
                  data-segment
                  className="absolute w-0.5 origin-top bg-[var(--card-border)]"
                  style={{
                    left: "calc(50% - 1px)",
                    top: `${(i - 0.5) * 20}%`,
                    height: "20%",
                  }}
                />
              ),
            )}
            {/* node slots */}
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-1 items-center justify-center"
              >
                <span
                  data-node
                  className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--card-border)] font-display text-sm font-bold"
                >
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          <p
            data-status
            className="mt-6 min-h-6 text-center text-sm font-medium text-foreground"
          >
            Scroll in to run the pipeline
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {STEPS.map((step, i) => (
              <span
                key={step.title}
                className="glass-chip px-3 py-1 text-[11px] font-medium text-text-dim"
              >
                {i + 1} · {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* ---- Step list ---- */}
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              data-row
              className="rounded-2xl border border-[var(--card-border)] p-5 transition-[background,border-color] duration-300 sm:p-6"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-display text-sm font-bold text-[var(--signal)]">
                  0{i + 1}
                </span>
                <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                  {step.title}
                </h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}