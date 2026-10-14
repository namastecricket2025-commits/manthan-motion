import { useRef } from "react";

/**
 * A ref hook for the compact secondary pills (Regenerate / Delete, deck
 * pagers) that carry the `cd-pill` class.
 *
 * These pills used to be wired into the shared CD engine — a rAF loop that
 * rotated a conic sheen behind the pill and spun it up under the cursor. The
 * pills are flat surfaces now (see `.cd-pill` in index.css), so there is no
 * angle to drive and nothing for the hook to register. It keeps its signature
 * and returns a ref, which is all every call site actually needs, and it no
 * longer installs a permanent animation loop on the pages that use it.
 *
 * `busy` is still accepted so existing call sites keep type-checking; it no
 * longer changes anything visual, because a flat pill has no spin speed.
 */
export function useCdPill<T extends HTMLElement>(_busy = false) {
  return useRef<T | null>(null);
}
