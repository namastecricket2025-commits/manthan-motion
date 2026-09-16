/**
 * Manthan background mesh — the site's signature atmosphere.
 *
 * Four oversized crimson / ruby radial shapes drift on slow, prime-length
 * loops behind one heavy 140px blur. The layer is fixed to the viewport,
 * pointer-transparent and sits at z-index 0, so every route (landing,
 * dashboard, settings, about, STEM Lab) shares the same deep-red depth.
 *
 * Both the shape alphas and the layer's opacity ceiling live in the theme
 * tokens (`--mesh-hue-*`, `--mesh-ceiling`), which is what keeps the glow an
 * aura rather than a wall — even with the Ambient Intensity slider at 100%.
 * Motionless Mode (`html[data-motion="reduced"]`) and the OS
 * `prefers-reduced-motion` query both park the drift on a static frame.
 */
export default function MeshBackground() {
  return (
    <div className="mesh-field" aria-hidden="true">
      <span className="mesh-blob mesh-blob--a" />
      <span className="mesh-blob mesh-blob--b" />
      <span className="mesh-blob mesh-blob--c" />
      <span className="mesh-blob mesh-blob--d" />
    </div>
  );
}
