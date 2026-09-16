/**
 * Manthan blob field — the signature crimson backdrop, driven entirely by CSS.
 *
 * There is no JavaScript here: no canvas, no requestAnimationFrame loop and no
 * pointer listeners. This component renders one permanent full-viewport layer
 * (100vw × 100vh, `position: fixed`, `top/left: 0`, `z-index: 1`,
 * `pointer-events: none`, `overflow: hidden`) containing two large crimson
 * blobs, and the motion comes from a single infinite `@keyframes fluidGlow`
 * loop (25s, linear) declared in the global stylesheet.
 *
 * Because the keyframes only ever animate `transform`, each blurred blob is
 * rasterised once and then merely composited as it drifts across the canvas —
 * the cheapest possible way to keep a moving background, and it keeps running
 * off the main thread while the page scrolls.
 *
 * Everything else still applies for free through the global tokens:
 * `--bg-glow-opacity` (the settings Ambient Intensity slider) scales the whole
 * layer, `html[data-ambient="flat"]` hides it at 0%, and Motionless Mode /
 * `prefers-reduced-motion` park the loop via the global
 * `html[data-motion="reduced"]` rule in settings.css.
 *
 * Blob 1 is anchored top-left and sweeps right and down; blob 2 is anchored
 * bottom-right and runs the same loop in reverse, half a cycle out of phase,
 * so the two cross the middle from opposite corners.
 */
export default function MeshBackground() {
  return (
    <div className="mesh-field" aria-hidden="true">
      <span className="mesh-blob mesh-blob--a" />
      <span className="mesh-blob mesh-blob--b" />
    </div>
  );
}
