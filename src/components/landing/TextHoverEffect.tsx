import { prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Aceternity-style Text Hover Effect, dressed in Manthan's tokens:
 *
 * - The word renders as a stroked outline (theme text colour) that draws
 *   itself in once on mount.
 * - On pointer devices, a signal-red gradient stroke is revealed through a
 *   radial mask that follows the cursor — move across the word to paint it
 *   red.
 * - On touch devices (most of Manthan's traffic) there is no cursor to
 *   follow, so the mask widens to cover the whole word and the gradient
 *   stroke simply sits underneath the outline — the headline still reads as
 *   a gradient word with zero interaction required.
 * - Reduced motion skips the draw-in and renders the finished state.
 *
 * The base outline is always visible (it never depends on a hover trigger),
 * so the text can never render invisible above the fold.
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
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
  const [isTouch, setIsTouch] = useState(false);
  const reduced = prefersReducedMotion();
  const uid = useId();

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);

  useEffect(() => {
    if (!cursor || !svgRef.current || isTouch) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const cx = ((cursor.x - svgRect.left) / svgRect.width) * 100;
    const cy = ((cursor.y - svgRect.top) / svgRect.height) * 100;
    setMaskPosition({ cx: `${cx}%`, cy: `${cy}%` });
  }, [cursor, isTouch]);

  // Wide viewBox so longer phrases fit: ~52 units per char at the 72px
  // display font (the Aceternity default 300×100 only fits 4–5 letters).
  const viewBoxW = Math.max(300, text.length * 52);
  const dash = viewBoxW * 4; // generous dash length for the draw-in sweep

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBoxW} 100`}
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setCursor(null);
      }}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      role="img"
      aria-label={text}
      className={cn("select-none", className)}
    >
      <defs>
        <linearGradient
          id={`${uid}-textGradient`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={viewBoxW}
          y2="0"
        >
          <stop offset="0%" stopColor="var(--signal)" />
          <stop offset="45%" stopColor="var(--signal)" />
          <stop offset="100%" stopColor="var(--signal-2)" />
        </linearGradient>

        <motion.radialGradient
          id={`${uid}-revealMask`}
          gradientUnits="userSpaceOnUse"
          r={isTouch || reduced ? "65%" : "24%"}
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
            width="100%"
            height="100%"
            fill={`url(#${uid}-revealMask)`}
          />
        </mask>
      </defs>

      {/* Base outline — always visible, brightens on hover */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="var(--text-dim)"
        strokeWidth="1.4"
        className="fill-transparent font-display text-[72px] font-bold"
        style={{ opacity: hovered ? 0.85 : 0.5 }}
      >
        {text}
      </text>

      {/* Draw-in outline (skipped for reduced motion) */}
      {reduced ? (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          stroke="var(--text-main)"
          strokeWidth="1.4"
          className="fill-transparent font-display text-[72px] font-bold"
        >
          {text}
        </text>
      ) : (
        <motion.text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          stroke="var(--text-main)"
          strokeWidth="1.4"
          className="fill-transparent font-display text-[72px] font-bold"
          initial={{ strokeDashoffset: dash, strokeDasharray: dash }}
          animate={{ strokeDashoffset: 0, strokeDasharray: dash }}
          transition={{ duration: 3, ease: "easeInOut" }}
        >
          {text}
        </motion.text>
      )}

      {/* Gradient stroke revealed under the cursor (or the whole word on
          touch / reduced motion, where there's no cursor to track) */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke={`url(#${uid}-textGradient)`}
        strokeWidth="1.4"
        mask={`url(#${uid}-textMask)`}
        className="fill-transparent font-display text-[72px] font-bold"
      >
        {text}
      </text>
    </svg>
  );
}