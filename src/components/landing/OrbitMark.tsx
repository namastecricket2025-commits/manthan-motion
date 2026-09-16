/**
 * The Manthan hero mark — the two geometric circles that anchor the landing
 * page centre:
 *
 *   • the large primary (crimson) circle, locked at the centre of the
 *     viewBox and never transformed, and
 *   • the smaller light satellite circle, riding an infinitely rotating
 *     outer group on a perfect 360° orbital path.
 *
 * The rotation is a pure CSS animation — `@keyframes orbit` bound to
 * `.orbit-group` (`transform-box: view-box` + `transform-origin: 200px
 * 200px` so it pivots on the core), which is why this component needs no
 * effects, no GSAP and no per-frame JavaScript at all. Motionless Mode and
 * the OS reduced-motion flag park it through the global
 * `html[data-motion="reduced"]` rule in settings.css, and the ember halo
 * behind the core scales with the Ambient Intensity setting via
 * `--bg-glow-opacity`.
 */
export default function OrbitMark() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="orbit-mark"
      role="img"
      aria-label="Manthan"
    >
      {/* soft ember halo behind the anchored core */}
      <circle className="orbit-mark__halo" cx="200" cy="200" r="150" />

      {/* large primary circle — locked in place, never rotates */}
      <circle className="orbit-mark__core" cx="200" cy="200" r="58" />

      {/* the orbiting pair: connector + white satellite, pivoting on the core */}
      <g className="orbit-group">
        <line className="orbit-mark__connector" x1="200" y1="200" x2="312" y2="200" />
        <circle className="orbit-mark__satellite" cx="312" cy="200" r="13" />
      </g>
    </svg>
  );
}
