import { useEffect, useRef } from "react";
import { settingsRuntime } from "@/lib/app-settings";

/**
 * Manthan background — the signature interactive layer.
 *
 * Two systems share one fixed, pointer-transparent field:
 *
 *  1. AMBIENT MESH — four oversized crimson/ruby radial shapes drifting on
 *     slow loops (CSS, see `.mesh-blob--*`). Pure atmosphere.
 *  2. CURSOR BLOB — one *giant* diffused crimson blob (a little wider than
 *     the viewport) that glides after the pointer with spring + friction
 *     inertia (this file). It is deliberately *not* a solid bright red: a
 *     120px blur over a translucent crimson gradient (0.15 → 0.05 →
 *     transparent), so the pointer drags a whole pool of ambient light
 *     across the canvas and it glints under the frosted glass panels
 *     rather than becoming a wall of colour.
 *
 * The follow maths is a damped spring integrated per frame with friction
 * decay, which is what gives the original floating, weighty feel:
 *
 *     v = (v + (target − pos) · stiffness · k) · friction^k
 *     pos += v · k
 *
 * `k` normalises the step to 60fps so the motion is identical on a 144Hz
 * display and on a 30fps device. When the pointer rests, the blob eases into
 * a slow elliptical drift so the field is never dead. Everything is written
 * straight to the element's transform from a rAF loop — no React state, so
 * pointer movement never re-renders the page.
 */

/** Resting spot, as a fraction of the viewport, before the first pointer move. */
const REST = { x: 0.3, y: 0.32 };
/** Spring pull toward the pointer (lower = floatier, heavier). Tuned low
 *  because the shape is huge: a big mass should track lazily, not snap. */
const STIFFNESS = 0.0095;
/** Velocity retained per 60fps step — the "friction" that keeps it gliding. */
const FRICTION = 0.93;
/** How long the pointer must be still before the blob drifts on its own. */
const IDLE_AFTER = 2.2;

function CursorBlob() {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reduced = settingsRuntime.reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pos = { x: window.innerWidth * REST.x, y: window.innerHeight * REST.y };
    const target = { ...pos };
    const vel = { x: 0, y: 0 };

    const place = () => {
      el.style.transform =
        `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0) ` +
        `translate(-50%, -50%)`;
    };

    place();
    // Fade the blob in after the first paint so it arrives gracefully.
    const reveal = window.setTimeout(() => el.classList.add("is-live"), 80);

    // Touch devices and reduced-motion users get the same blob, parked: a
    // static pool of light instead of a moving one.
    if (!finePointer || reduced) {
      return () => {
        window.clearTimeout(reveal);
        el.classList.remove("is-live");
      };
    }

    let raf = 0;
    let last = performance.now();
    let idle = 0;
    let acc = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      idle = 0;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Motionless Mode can be toggled live from the settings dashboard:
      // freeze in place (the ambient CSS mesh parks itself too).
      if (settingsRuntime.reduceMotion) return;

      // Honour the 30fps render budget without changing the follow feel.
      if (settingsRuntime.frameTarget === 30) {
        acc += dt;
        if (acc < 1 / 30) return;
        acc = 0;
      }

      // No pointer for a while → drift on a slow ellipse so it keeps floating.
      idle += dt;
      if (idle > IDLE_AFTER) {
        const t = now / 1000;
        target.x = window.innerWidth * (0.5 + 0.17 * Math.sin(t * 0.13));
        target.y = window.innerHeight * (0.5 + 0.12 * Math.cos(t * 0.11));
      }

      // Frame-rate independent damped spring.
      const k = Math.min(dt * 60, 3);
      const decay = Math.pow(FRICTION, k);
      vel.x = (vel.x + (target.x - pos.x) * STIFFNESS * k) * decay;
      vel.y = (vel.y + (target.y - pos.y) * STIFFNESS * k) * decay;
      pos.x += vel.x * k;
      pos.y += vel.y * k;

      // Let it hang a little past the edges, but never wander off-screen.
      const margin = Math.min(window.innerWidth, window.innerHeight) * 0.2;
      pos.x = Math.max(-margin, Math.min(window.innerWidth + margin, pos.x));
      pos.y = Math.max(-margin, Math.min(window.innerHeight + margin, pos.y));

      place();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(reveal);
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <span ref={ref} className="mesh-blob mesh-blob--cursor" />;
}

export default function MeshBackground() {
  return (
    <div className="mesh-field" aria-hidden="true">
      <span className="mesh-blob mesh-blob--a" />
      <span className="mesh-blob mesh-blob--b" />
      <span className="mesh-blob mesh-blob--c" />
      <span className="mesh-blob mesh-blob--d" />
      <CursorBlob />
    </div>
  );
}
