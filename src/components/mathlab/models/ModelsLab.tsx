import { useEffect, useMemo, useState } from "react";
import { SymmetryStudio } from "@/components/mathlab/models/SymmetryStudio";
import { NetsAndSolids } from "@/components/mathlab/models/NetsAndSolids";
import { MotionGraphs } from "@/components/mathlab/models/MotionGraphs";
import { ConicSections } from "@/components/mathlab/models/ConicSections";
import { VectorsPlanes } from "@/components/mathlab/models/VectorsPlanes";
import "@/components/mathlab/models/models.css";

/**
 * Models — the Math Lab's interactive figures, one per class.
 *
 * These are the ideas that a blackboard cannot move: a fold, a walk, a cut of
 * a cone, a plane in space. Each model is a plate in the same notebook as the
 * rest of the lab — same surfaces, same ink — and each one computes every
 * number it prints from the figure on screen.
 *
 * The rail opens on the model that belongs to the class the lab already has
 * selected, so a Class 8 student lands on Symmetry and a Class 12 student
 * lands on Vectors, without a second picker to learn.
 */

const MODELS = [
  {
    id: "symmetry",
    label: "Symmetry",
    grade: "Class 8",
    gradeId: "8",
    blurb:
      "Turn a mirror line until the reflected half lands on the original — an axis of symmetry is where the two drawings agree exactly. The model counts the axes and the rotational order by scanning, so the parallelogram honestly reports zero.",
    Component: SymmetryStudio,
  },
  {
    id: "nets",
    label: "Nets & solids",
    grade: "Class 8",
    gradeId: "8",
    blurb:
      "A net folds into its solid, face by face, on one slider. Surface area is the sum of the faces you watched move; volume comes from the same dimensions. Euler's F + V − E is tallied from the closed solid.",
    Component: NetsAndSolids,
  },
  {
    id: "motion",
    label: "Motion graphs",
    grade: "Class 9",
    gradeId: "9",
    blurb:
      "A walk becomes a distance–time graph and its velocity twin. The slope you see drawn on one leg is the level of the other, and the area under the velocity graph comes back as the displacement — one journey, two readings.",
    Component: MotionGraphs,
  },
  {
    id: "conics",
    label: "Conic sections",
    grade: "Class 11",
    gradeId: "11",
    blurb:
      "Tilt the cutting plane through a double cone and watch the section change: circle, ellipse, parabola, hyperbola. The eccentricity e = cos β / cos α is computed from the same two angles and draws the curve beside the cone.",
    Component: ConicSections,
  },
  {
    id: "vectors",
    label: "Vectors & planes",
    grade: "Class 12",
    gradeId: "12",
    blurb:
      "Two vectors, the parallelogram they span, and their cross product as the plane's normal. Align the vectors and the plane disappears — a × b = 0 is a missing plane, not just a zero.",
    Component: VectorsPlanes,
  },
] as const;

type ModelId = (typeof MODELS)[number]["id"];

export function ModelsLab({ gradeId }: { gradeId?: string }) {
  const initial = useMemo<ModelId>(() => {
    const match = MODELS.find((m) => m.gradeId === gradeId);
    return match?.id ?? "symmetry";
  }, [gradeId]);

  const [modelId, setModelId] = useState<ModelId>(initial);

  /* A new class selection in the Solve tab re-targets the rail once, so the
     figure follows the student's grade without overriding a deliberate pick. */
  useEffect(() => {
    setModelId(initial);
  }, [initial]);

  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
  const Active = model.Component;

  return (
    <div className="mm-root">
      <div className="mm-rail" role="tablist" aria-label="Models by class">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === modelId}
            className="mm-chip"
            onClick={() => setModelId(m.id)}
          >
            {m.label}
            <span className="mm-chip__grade">{m.grade}</span>
          </button>
        ))}
      </div>

      <div>
        <p className="mm-note" style={{ maxWidth: "64ch" }}>
          <b style={{ color: "var(--text-main)" }}>{model.label}</b> · {model.blurb}
        </p>
      </div>

      <Active />
    </div>
  );
}

export default ModelsLab;
