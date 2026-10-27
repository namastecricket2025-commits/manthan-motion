import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import {
  isValidElement,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * The section-heading beat.
 *
 * The hero assembles word by word (see `TextGenerate`); this is the same beat
 * for the headings below the fold, with one difference — it fires when the
 * heading reaches the reading line instead of on mount, so a section is never
 * finished animating before it is on screen. Same numbers as the hero, because
 * it should read as the same material: ~14px of travel, ~500ms, `power3.out`,
 * a 60ms stagger between words, then the heading is still. Nothing loops
 * here and nothing waits for the pointer.
 *
 * Why a heading gets this and a paragraph does not: a heading is the one line
 * the eye always reads on the way down, and a line that has already arrived by
 * the time you reach it is the flattest thing on a page. Body copy stays put —
 * text you are about to *read* should not move.
 *
 * Two rules, both taken from bugs already fixed in `TextGenerate`:
 *
 *   visible by default      the words are rendered readable, and the hidden
 *                           state is written by GSAP in a layout effect
 *                           (before paint). A missed or failed trigger leaves
 *                           the heading readable rather than invisible, and
 *                           reduced motion never hides it at all.
 *   the clip on the span    `text-fade` / `gradient-text` sits on the animated
 *                           span, never on an ancestor above it:
 *                           `background-clip: text` stops following separately
 *                           composited descendants, which is what painted
 *                           gradient words invisible before. An accent element
 *                           therefore keeps its own span and moves as one unit.
 *                           (It cannot be split per word: its gradient is a
 *                           105° sweep sized to its own box, so every word
 *                           would restart the sweep.)
 */
export function RevealWords({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Some headings are named by `aria-labelledby` on their section. */
  id?: string;
}) {
  const ref = useRef<HTMLHeadingElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll<HTMLElement>(".rw-word");
    if (!words.length) return;
    /* Reduced motion: the final state is what the markup already renders. */
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0, y: 14, filter: "blur(5px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.5,
          ease: "power3.out",
          stagger: 0.06,
          /* Leave nothing composited behind: a promo'd span under a clipped
             ancestor is the one state that mispaints (see the note above). */
          clearProps: "transform,filter,opacity",
          scrollTrigger: { trigger: el, ...revealConfig },
        },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <h2 ref={ref} id={id} className={className}>
      {wordSpans(children)}
    </h2>
  );
}

/**
 * Split a heading's mixed children into word spans.
 *
 * Whitespace is kept as whitespace in the flow rather than as a box, so the
 * heading breaks its lines exactly where the plain text would and nothing
 * about its rhythm changes. An element child (the accent gradient span) is
 * wrapped as one unit rather than split, because its gradient is a 105° sweep
 * sized to its own box — see the note on that branch below.
 */
function wordSpans(children: ReactNode): ReactNode {
  const out: ReactNode[] = [];
  let key = 0;

  const word = (text: string) => {
    out.push(
      <span key={key++} className="rw-word inline-block whitespace-pre text-fade">
        {text}
      </span>,
    );
  };

  const split = (text: string) => {
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) out.push(part);
      else word(part);
    });
  };

  const walk = (node: ReactNode) => {
    if (node === null || node === undefined || typeof node === "boolean") return;
    if (typeof node === "string" || typeof node === "number") {
      split(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isValidElement(node)) return;

    const el = node as ReactElement<{ className?: string; children?: ReactNode }>;
    if (el.type === "br") {
      out.push(<br key={key++} />);
      return;
    }
    /* An accent element is animated as ONE unit, never split word by word:
       `gradient-text` is a 105° sweep sized to its own box, so splitting a
       phrase into word spans would restart the sweep on every word instead of
       running it once across the phrase. The wrapper keeps `text-fade` so the
       phrase still paints even if the accent's own clipped fill is refused
       under the animation. */
    out.push(
      <span key={key++} className="rw-word inline-block whitespace-pre text-fade">
        {el}
      </span>,
    );
  };

  walk(children);
  return out;
}

export default RevealWords;
