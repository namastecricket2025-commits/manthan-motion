import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * A wide vector figure with a phone-sized reading control.
 *
 * The circuit, magnet and optics plates are drawn in 560–900-unit view boxes.
 * Fitting all of that into a 360px column makes the labels a few pixels tall,
 * and keeping the drawing at its natural 680px width pushed half of it past
 * the right edge. The phone therefore starts at "fit" — the whole drawing is
 * visible — and the + control grows it inside its own scrollable window. The
 * desktop layout is unchanged: no toolbar, and the figure keeps its size.
 */
export function LabFigure({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const canShrink = zoom > 1;
  const canGrow = zoom < 2.5;

  return (
    <div className={cn("lab-figure", className)} role="group" aria-label={label}>
      <div className="lab-figure-bar">
        <span className="lab-figure-hint">
          {zoom > 1 ? "Drag to move" : "Whole diagram · tap + to zoom"}
        </span>
        <div className="lab-figure-zoom">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
            disabled={!canShrink}
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="lab-figure-percent" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
            disabled={!canGrow}
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="lab-figure-viewport">
        <div className="lab-figure-plane" style={{ width: `${zoom * 100}%` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
