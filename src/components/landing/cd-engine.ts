/**
 * The CD engine — one rAF loop that drives every spinning-disc button.
 *
 * Why JS instead of a CSS animation: the request was that the spin *speeds up*
 * under the cursor and *smoothly reverts* when it leaves — no snap, no jitter.
 * A CSS `animation-duration` change restarts the keyframes (a visible jump),
 * so instead each registered button keeps a numeric `speed` state that lerps
 * toward its target every frame (fast ≈ 0.9s/turn on hover or while loading,
 * slow ≈ 8s/turn at rest). The accumulated angle is written to two CSS custom
 * properties on the element:
 *
 *   --cd-angle   drives the sheen wedge (a transform rotate — GPU-composited)
 *   --cd-angle-r drives the conic-gradient rim (`@property`-registered angle)
 *
 * The loop pauses itself when nothing is registered and nothing is moving,
 * so idle pages cost zero frames.
 */

const FAST_TURN_S = 0.9; // seconds per turn on hover / while loading
const SLOW_TURN_S = 8; // seconds per turn at rest
const LERP_UP = 0.14; // approach rate while accelerating (snappy but soft)
const LERP_DOWN = 0.055; // approach rate while decelerating (the smooth revert)

interface Disc {
  el: HTMLElement;
  hovering: boolean;
  busy: boolean;
  angle: number;
  /** Current seconds-per-turn; the lerp state. */
  turn: number;
  target: number;
}

const discs = new Set<Disc>();
let raf = 0;
let last = 0;

function frame(now: number) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;

  // Motionless Mode / prefers-reduced-motion: skip all angle writes. The
  // CSS already renders the static gradient; the engine just goes quiet.
  const motionless =
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const disc of discs) {
    // Disabled buttons freeze outright; hover/busy race; the rest drift slow.
    const frozen = disc.el.hasAttribute("disabled");
    const target = frozen
      ? Infinity
      : disc.hovering || disc.busy
        ? FAST_TURN_S
        : SLOW_TURN_S;

    if (disc.turn !== target) {
      if (!Number.isFinite(target)) {
        // Freeze immediately — lerping toward Infinity produces NaN.
        disc.turn = Infinity;
      } else if (!Number.isFinite(disc.turn)) {
        // Coming out of a freeze: resume from the slow drift, not from Inf.
        disc.turn = SLOW_TURN_S;
      } else {
        // Exponential approach: k near 1 snaps, small k glides. Accelerating
        // uses the snappier rate; the revert deliberately glides so the
        // slow-down reads as fluid, never as a jitter or a snap.
        const k = target < disc.turn ? LERP_UP : LERP_DOWN;
        const next = disc.turn + (target - disc.turn) * k;
        // Settle exactly on the target so the state is stable.
        disc.turn = Math.abs(next - target) < 0.01 ? target : next;
      }
    }

    if (Number.isFinite(disc.turn) && !motionless) {
      disc.angle = (disc.angle + (dt * 360) / disc.turn) % 360;
      disc.el.style.setProperty("--cd-angle", `${disc.angle.toFixed(2)}deg`);
      disc.el.style.setProperty("--cd-angle-r", `${disc.angle.toFixed(2)}deg`);
    }
  }

  // Registered discs keep the loop alive — at rest they are still slowly
  // turning, which is the design. One loop for the whole page.
  raf = discs.size > 0 ? requestAnimationFrame(frame) : 0;
  if (discs.size === 0) last = 0;
}

function wake() {
  if (!raf) {
    last = 0;
    raf = requestAnimationFrame(frame);
  }
}

function engine() {
  return {
    register(el: HTMLElement) {
      if ((el as HTMLElement & { __cd?: Disc }).__cd) return;
      const disc: Disc = {
        el,
        hovering: false,
        busy: false,
        angle: 0,
        turn: SLOW_TURN_S,
        target: SLOW_TURN_S,
      };
      (el as HTMLElement & { __cd?: Disc }).__cd = disc;
      discs.add(disc);
      wake();
    },
    setHover(el: HTMLElement, hovering: boolean) {
      const disc = (el as HTMLElement & { __cd?: Disc }).__cd;
      if (!disc) return;
      disc.hovering = hovering;
      wake();
    },
    setBusy(el: HTMLElement, busy: boolean) {
      const disc = (el as HTMLElement & { __cd?: Disc }).__cd;
      if (!disc) return;
      disc.busy = busy;
      wake();
    },
  };
}

/** Idempotent global install; components read `window.__cdEngine`. */
export function installCdEngine() {
  if (typeof window === "undefined") return;
  if (!window.__cdEngine) window.__cdEngine = engine();
}

export { engine as createCdEngine };
