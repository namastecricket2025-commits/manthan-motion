import { useEffect, useRef } from "react";
import { installCdEngine } from "./cd-engine";

/**
 * Wire a plain element (anything with the `cd-pill` class) into the shared CD
 * engine: registered on mount, hover speed-up on pointerenter, smooth revert
 * on pointerleave, optional fast spin while `busy`.
 */
export function useCdPill<T extends HTMLElement>(busy = false) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    installCdEngine();
    const el = ref.current;
    if (!el) return;
    const engine = window.__cdEngine;
    if (!engine) return;
    engine.register(el);
    const enter = () => engine.setHover(el, true);
    const leave = () => engine.setHover(el, false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      engine.setHover(el, false);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (el) window.__cdEngine?.setBusy(el, busy);
  }, [busy]);

  return ref;
}
