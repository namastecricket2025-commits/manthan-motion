import { prefersReducedMotion } from "@/lib/gsap";
import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate, type NavigateOptions, type To } from "react-router";

/**
 * Route changes as one continuous screen, not two cuts.
 *
 * The app runs in declarative router mode, where React Router's own
 * `viewTransition` flag is ignored — so the browser's View Transitions API is
 * driven here directly. The pieces that make it work:
 *
 *   - `document.startViewTransition(cb)` freezes the current page, runs `cb`,
 *     then animates between the old snapshot and the new DOM.
 *   - `flushSync` is what guarantees there IS a new DOM. React Router updates
 *     state, and without flushing, the API would take its "after" snapshot
 *     before the route had rendered.
 *   - Named elements (`view-transition-name: manthan-mark` in index.css) are
 *     matched by name across the two snapshots, so the mark travels between
 *     the header, the auth card and the sidebar instead of crossfading.
 *
 * Anything unsupported, and anyone who asked for less motion, gets the plain
 * navigation — the transition is an enhancement, never a dependency.
 */

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

export function viewTransitionNavigate(update: () => void) {
  const doc = document as ViewTransitionDocument;

  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    return;
  }

  try {
    doc.startViewTransition(() => {
      flushSync(update);
    });
  } catch {
    // A transition that cannot start must never swallow the navigation.
    update();
  }
}

/** `navigate`, wrapped so the target route is rendered inside a transition. */
export function useViewTransitionNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: To, options?: NavigateOptions) => {
      viewTransitionNavigate(() => navigate(to, options));
    },
    [navigate],
  );
}
