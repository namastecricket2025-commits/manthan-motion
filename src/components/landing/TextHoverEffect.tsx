import { prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/**
 * Filled display word with a cursor-tracked ember reveal, dressed in
 * Manthan's tokens:
 *
 * - "STUDY MATERIAL" renders in Outfit 800 — a solid geometric poster face,
 *   FILLED with an ember gradient (pale gold → amber → signal red in dark
 *   mode; honey gold → coral → signal in light mode). No hollow strokes.
 * - Three layers build the glow: a blurred gradient halo behind the glyphs,
 *   a soft base gradient, and a crisp gradient fill revealed under the
 *   cursor through a radial mask (a faint full-word ember stays visible so
 *   the un-hovered state still looks intentional).
 * - On touch devices there is no cursor, so the mask widens to cover the
 *   whole word — mobile gets the full glowing gradient with zero
 *   interaction.
 * - The viewBox is measured from the rendered glyphs (after webfonts load),
 *   so the word always fills its container edge-to-edge without clipping.
 * - Reduced motion renders the finished state with no entrance animation.
 */
export function TextHoverEffect({
  text,
  duration = 0.25,
  className,
}: {
  text: string;
  duration?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const textRef = useRef<SVGTextElement | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
  const [isTouch, setIsTouch] = useState(false);
  const [viewW, setViewW] = useState(0);
  const reduced = prefersReducedMotion();
  const uid = useId();

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);

  // Measure the real glyph box so the viewBox hugs the text. Runs once on
  // mount and again once webfonts are ready (first measure uses the
  // fallback face), plus on size changes.
  useLayoutEffect(() => {
    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      try {
        const b = el.getBBox();
        if (b.width > 0 && b.height > 0) {
          setViewW(Math.max(160, Math.ceil(b.width + 14)));
        }
      } catch {
        // getBBox can throw if the element isn't rendered yet — retry via
        // the fonts.ready callback below.
      }
    };
    measure();
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    const ro = new ResizeObserver(() => measure());
    if (textRef.current) ro.observe(textRef.current);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [text]);

  useEffect(() => {
    if (!cursor || !svgRef.current || isTouch) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const cx = ((cursor.x - svgRect.left) / svgRect.width) * 100;
    const cy = ((cursor.y - svgRect.top) / svgRect.height) * 100;
    setMaskPosition({ cx: `${cx}%`, cy: `${cy}%` });
  }, [cursor, isTouch]);

  const w = viewW || 320; // pre-measure fallback; corrected immediately after

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} 100`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setCursor(null);
      }}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      role="img"
      aria-label={text}
      style={{ aspectRatio: `${w} / 100` }}
      className={cn("stroke-glow-wrap w-full select-none overflow-visible", className)}
    >
      <defs>
        {/* Ember sweep across the word — themed via tokens */}
        <linearGradient
          id={`${uid}-textGradient`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={w}
          y2="0"
        >
          <stop offset="0%" stopColor="var(--stroke-a)" />
          <stop offset="52%" stopColor="var(--stroke-b)" />
          <stop offset="100%" stopColor="var(--stroke-c)" />
        </linearGradient>

        <motion.radialGradient
          id={`${uid}-revealMask`}
          gradientUnits="userSpaceOnUse"
          r={isTouch || reduced ? "70%" : "26%"}
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id={`${uid}-textMask`}>
          <rect
            x="0"
            y="0"
            width={w}
            height="100"
            fill={`url(#${uid}-revealMask)`}
          />
        </mask>
      </defs>

      {/* 1 — blurred ember halo behind everything (the glow) */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="stroke-display stroke-glow-layer text-[84px]"
        style={{ fill: `url(#${uid}-textGradient)` }}
      >
        {text}
      </text>

      {/* 2 — soft full-word ember base (never hollow, never invisible) */}
      <motion.text
        ref={textRef}
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={`url(#${uid}-textGradient)`}
        className="stroke-display text-[84px]"
        style={{ opacity: 0.28 }}
        initial={reduced ? false : { opacity: 0, y: 10, filter: "blur(8px)" }}
        animate={{ opacity: 0.28, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      >
        {text}
      </motion.text>

      {/* 3 — vivid ember revealed under the cursor (whole word on touch) */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={`url(#${uid}-textGradient)`}
        mask={`url(#${uid}-textMask)`}
        className="stroke-display stroke-fill-layer text-[84px]"
      >
        {text}
      </text>
    </svg>
  );
}
