import { useCallback, useState } from "react";
import type { RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING } from "./use-canvas";

export interface TipData {
  title: string;
  body?: string;
  accent?: string;
  x: number;
  y: number;
}

/**
 * Pointer-anchored tooltip state. Feed it the *client* coordinates of the
 * hover/tap so the bubble lands right next to the cursor or finger.
 */
export function useCursorTip() {
  const [tip, setTip] = useState<TipData | null>(null);
  const show = useCallback(
    (data: Omit<TipData, "x" | "y">, x: number, y: number) => setTip({ ...data, x, y }),
    [],
  );
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

/**
 * Floating bubble that pops up beside the cursor / touch point, flipping
 * away from the viewport edges so it never runs off the canvas.
 */
export function CursorTip({
  tip,
  hostRef,
  width = 250,
}: {
  tip: TipData | null;
  hostRef: RefObject<HTMLElement | null>;
  width?: number;
}) {
  const host = hostRef.current;
  const rect = host?.getBoundingClientRect() ?? null;
  const W = rect?.width ?? 420;
  const H = rect?.height ?? 320;
  const px = rect ? tip ? tip.x - rect.left : 0 : 0;
  const py = rect ? tip ? tip.y - rect.top : 0 : 0;
  const bw = Math.min(width, Math.max(170, W - 24));
  const bh = tip?.body ? 118 : 52;

  const left = Math.max(6, Math.min(px + 16, W - bw - 6));
  const flipUp = py > H * 0.5;
  const top = flipUp ? Math.max(6, py - bh - 10) : Math.min(Math.max(6, H - bh - 6), py + 16);

  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          key="cursor-tip"
          className="lab-tip"
          initial={{ opacity: 0, scale: 0.94, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={SPRING}
          style={{ left, top, width: bw }}
        >
          <span
            className="lab-tip__dot"
            style={{ background: tip.accent ?? "#ff3b5c", boxShadow: `0 0 10px ${tip.accent ?? "#ff3b5c"}` }}
          />
          <p className="lab-tip__title" style={{ color: tip.accent ?? "#ff8a9a" }}>
            {tip.title}
          </p>
          {tip.body && <p className="lab-tip__body">{tip.body}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
