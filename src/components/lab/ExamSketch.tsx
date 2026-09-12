import { useEffect } from "react";
import * as THREE from "three";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { SPRING } from "./use-canvas";

/* ============================================================
   Exam Sketch Mode.

   Turns any 3D anatomy model into the schematic a student would
   actually pencil onto an answer sheet:

     • every surface is ghosted to ~35 % opacity so overlapping
       structures stay legible,
     • high-contrast ink outlines are drawn over each mesh
       (EdgesGeometry above a 32° crease angle, so smooth surfaces
       stay clean instead of turning into noise),
     • a step-by-step panel lists the drawing order to copy.

   Everything is reversible: original material flags are cached on
   the material itself and fully restored when the mode is switched
   off.
   ============================================================ */

interface SavedFlags {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

const OUTLINE_MAT = new THREE.LineBasicMaterial({ color: 0x0b1120, transparent: true, opacity: 0.9 });

/** Purely-additive edge buffer cap: skip sprites and ultra-dense meshes. */
const MAX_EDGE_VERTS = 26000;

export function setExamSketch(root: THREE.Object3D | null, on: boolean) {
  if (!root) return;
  root.traverse((obj) => {
    const line = obj as THREE.LineSegments;
    if (line.isLineSegments && line.userData.__examEdge) {
      line.visible = on;
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of materials) {
      const mat = m as THREE.Material & { __exam?: SavedFlags; opacity: number; depthWrite: boolean };
      if (on) {
        if (!mat.__exam) {
          mat.__exam = { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite };
        }
        // leave already-ghosted helpers (translucent shells, glows) alone
        if (mat.transparent && mat.__exam.opacity <= 0.5) continue;
        mat.transparent = true;
        mat.opacity = Math.min(mat.__exam.opacity, 0.35);
        mat.depthWrite = false;
        mat.needsUpdate = true;
      } else if (mat.__exam) {
        mat.opacity = mat.__exam.opacity;
        mat.transparent = mat.__exam.transparent;
        mat.depthWrite = mat.__exam.depthWrite;
        delete mat.__exam;
        mat.needsUpdate = true;
      }
    }

    const verts = mesh.geometry.attributes?.position?.count ?? 0;
    if (verts === 0 || verts > MAX_EDGE_VERTS) return;

    let edges = mesh.userData.__examEdge as THREE.LineSegments | undefined;
    if (!edges && on) {
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 32), OUTLINE_MAT);
      edges.userData.__examEdge = true;
      edges.raycast = () => undefined; // never steal a hover
      mesh.userData.__examEdge = edges;
      mesh.add(edges);
    }
    if (edges) edges.visible = on;
  });
}

/** Applies exam mode whenever the toggle (or the model itself) changes. */
export function useExamSketch(rootRef: { current: THREE.Object3D | null }, on: boolean, modelKey?: unknown) {
  useEffect(() => {
    setExamSketch(rootRef.current, on);
  }, [rootRef, on, modelKey]);
}

export interface ExamStep {
  t: string;
  d: string;
}

export function ExamSketchPanel({
  open,
  title,
  steps,
  onClose,
}: {
  open: boolean;
  title: string;
  steps: ExamStep[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="exam-panel"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={SPRING}
          className="lab-screen lab-dark-surface fixed bottom-3 left-3 right-3 z-50 max-h-[40dvh] overflow-y-auto rounded-2xl p-3.5 lg:bottom-4 lg:left-auto lg:right-4 lg:max-h-[62dvh] lg:w-[352px]"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="lab-label">Exam sketch mode</p>
              <p className="text-xs font-bold text-slate-100">{title}</p>
            </div>
            <button type="button" onClick={onClose} className="lab-btn !p-1.5" title="Exit exam sketch mode">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ol className="mt-2.5 space-y-2">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#ff3b5c]/40 bg-[#ff3b5c]/10 text-[10px] font-bold text-[#ff8a9a]">
                  {i + 1}
                </span>
                <span>
                  <span className="text-[11px] font-bold text-slate-200">{s.t}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-400">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[10px] leading-relaxed text-slate-400">
            Ink outlines follow the crease lines of the model — copy those lines exactly and the proportions will come out right.
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
