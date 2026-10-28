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
  const sessionClockRef = useRef<HTMLSpanElement | null>(null);
  const nextCardRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));
    const segments = Array.from(
      root.querySelectorAll<HTMLElement>("[data-segment]"),
    );
    const status = root.querySelector<HTMLElement>("[data-status]");

    /* Three states, one neutral ink. The tones come from `--text-main` (white
       in dark, near-black in light) over `--panel` for the labels, so the
       diagram is crisp in both themes without a single accent colour: a
       finished step is a solid dot, the running step is an outlined dot with
       a hairline ring, and a waiting step is a faint hairline. Previously a
       finished step filled with `--signal` and the running one got a tinted
       wash plus a 5px blurred-looking ring — colour on a 40px circle with no
       defined edge, which is exactly the "undefined borders" read. */
    const activate = (i: number) => {
      nodes.forEach((node, j) => {
        if (i === -1 || j < i) {
          node.style.borderColor = "var(--text-main)";
          node.style.background = "var(--text-main)";
          node.style.color = "var(--panel)";
          node.style.boxShadow = "none";
        } else if (j === i) {
          node.style.borderColor = "var(--text-main)";
          node.style.background = "transparent";
          node.style.color = "var(--text-main)";
          node.style.boxShadow =
            "0 0 0 6px color-mix(in srgb, var(--text-main) 8%, transparent)";
        } else {
          node.style.borderColor = "var(--panel-line)";
          node.style.background = "transparent";
          node.style.color = "var(--text-dim)";
          node.style.boxShadow = "none";
        }
      });
      segments.forEach((seg, j) => {
        seg.style.background =
          j < i || i === -1 ? "var(--text-main)" : "var(--panel-line)";
      });
      if (status) {
        status.textContent = i === -1 ? DONE : STEPS[i]?.status ?? "";
      }
    };

    /* The strip under the diagram keeps its own time. The pipeline above it
       is a replay, so the two are deliberately independent: a run resetting
       must not reset the session that says the app is running. */
    let elapsed = 0;
    let remaining = 12;
    let clockTimer: number | undefined;
    let cardTimer: number | undefined;

    const paintClock = () => {
      if (!sessionClockRef.current) return;
      const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const seconds = String(elapsed % 60).padStart(2, "0");
      sessionClockRef.current.textContent = `${minutes}:${seconds}`;
    };
    const paintCountdown = () => {
      if (nextCardRef.current) nextCardRef.current.textContent = `${remaining}s`;
    };
    const startSession = () => {
      if (clockTimer === undefined) {
        clockTimer = window.setInterval(() => {
          elapsed += 1;
          paintClock();
        }, 1000);
      }
      if (cardTimer === undefined) {
        cardTimer = window.setInterval(() => {
          remaining = remaining > 1 ? remaining - 1 : 12;
          paintCountdown();
        }, 1000);
      }
    };
    const stopSession = () => {
      if (clockTimer !== undefined) {
        window.clearInterval(clockTimer);
        clockTimer = undefined;
      }
      if (cardTimer !== undefined) {
        window.clearInterval(cardTimer);
        cardTimer = undefined;
      }
    };

    if (prefersReducedMotion()) {
      activate(-1);
      if (sessionClockRef.current) sessionClockRef.current.textContent = "00:42";
      if (nextCardRef.current) nextCardRef.current.textContent = "9s";
      return;
    }

    let timeline: gsap.core.Timeline | null = null;
    const ctx = gsap.context(() => {
      gsap.set(nodes, { scale: 0.6, opacity: 0 });
      gsap.set(segments, { scaleX: 0, scaleY: 0 });
      const tl = gsap.timeline({
        paused: true,
        repeat: -1,
        repeatDelay: 2.2,
        defaults: { ease: "power2.out" },
      });
      timeline = tl;
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

    /* Nothing runs until the panel is actually on screen. It sits below the
       first screen, so without this the loop has already played twice by the
       time anyone sees it — and the session would be a clock ticking in an
       empty room. */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startSession();
          timeline?.play();
        } else {
          stopSession();
          timeline?.pause();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      stopSession();
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      /* No border of its own: the frame above owns the hairline and the
         radius, so the screenshot reads as one plate instead of a card
         inside a card. */
      className="relative overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--text-main)_3%,var(--panel))] p-5 sm:p-6"
      data-hero-fade
      data-frame-inner
    >
      {/* The panel is a diagram, not a mocked-up application window.

          It used to carry fake window chrome: three traffic-light dots in the
          accent, a monospace `generation_07` build tag and a pulsing "Live"
          pill with an uppercase letterspaced label. None of it was real — the
          dots coloured nothing, the tag named nothing, and the pill claimed a
          liveness the panel can't have — and three borrowed UI clichés in a
          row is exactly what makes a mockup read as decoration. One plain
          label says everything the chrome was pretending to. */}
      <p className="text-sm font-medium text-foreground">Pipeline</p>

      {/* mini pipeline — flex-1 slots so node centres sit at exact 20% steps */}
      <div className="relative mt-6 flex h-14 items-center">
        {/* connectors */}
        {STEPS.map((_, i) =>
          i === 0 ? null : (
            <span
              key={i}
              data-segment
              className="absolute h-px origin-left bg-[var(--panel-line)]"
              style={{ left: `${(i - 0.5) * 20}%`, width: "20%", top: "calc(50% - 0.5px)" }}
            />
          ),
        )}
        {STEPS.map((step, i) => (
          <span key={step.short} className="flex h-14 flex-1 items-center justify-center">
            <span
              data-node
              className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--panel-line)] font-display text-xs font-semibold"
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

      {/* The output of the run, as plain text rather than three bordered
          pills stacked under the diagram. */}
      <p className="mt-4 text-center text-[13px] text-text-dim">
        Summary · 24 flashcards · 12 prompts
      </p>

      {/* Two readouts that are actually live, not a "Live" pill claiming it.
          The clock starts when the panel enters the viewport; the countdown
          is the spaced-repetition schedule the product really runs. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--panel-line)] pt-3 text-[11px] text-text-dim">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]"
          />
          Session{" "}
          <span
            ref={sessionClockRef}
            className="tabular-nums text-foreground"
          >
            00:00
          </span>
        </span>
        <span>
          Next card in{" "}
          <span ref={nextCardRef} className="tabular-nums text-foreground">
            12s
          </span>
        </span>
      </div>
    </div>
  );
}