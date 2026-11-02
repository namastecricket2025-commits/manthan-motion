import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Nets & solids — Class 8 mensuration.
 *
 * A net is a solid that has been unfolded, and the two halves of that sentence
 * are usually taught in different weeks. Here one object owns both states: the
 * fold slider runs every face from its place on the flat net to its place on
 * the closed solid, by rotating it about the crease it shares with its parent.
 * Nothing is crossfaded — the faces *move*, so "this rectangle becomes that
 * wall" is something you watch happen.
 *
 * The first version interpolated each face's outline in a straight line to a
 * fixed isometric silhouette. That is not a fold: the lid slid through the
 * walls, the box never closed, and the cylinder's curved surface ended as two
 * straight lines. The box here is real 3D geometry rotated about its hinges;
 * the cylinder is a strip of the net rolled around its axis; the cone is a
 * sector whose generators are wrapped around the base. The cylinder is
 * therefore closed, with both rims drawn, when the fold reaches 100%.
 *
 * The projection starts top-down (a net should look like the page in the book)
 * and tilts to isometric once the folding begins, so the flat state is legible
 * and the closed state has depth.
 *
 * Surface area is the sum of the face areas, measured from the dimensions;
 * volume is computed from the same numbers. Euler's characteristic is tallied
 * only for the box, where it applies.
 */

type SolidId = "cube" | "cuboid" | "cylinder" | "cone";

const SOLIDS: Array<{ id: SolidId; label: string; grade: string }> = [
  { id: "cube", label: "Cube", grade: "a × a × a" },
  { id: "cuboid", label: "Cuboid", grade: "l × b × h" },
  { id: "cylinder", label: "Cylinder", grade: "πr(r + 2h)" },
  { id: "cone", label: "Cone", grade: "πr(r + l)" },
];

type P2 = [number, number];
type V3 = [number, number, number];

const W = 640;
const H = 396;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Translucent ink, for the faces of a net over the stage. */
const tint = (alpha: number) => `color-mix(in srgb, var(--text-main) ${alpha}%, transparent)`;
/** An opaque-ish surface, for a disc or a lid that must cover what is behind it. */
const surface = (alpha: number) =>
  `color-mix(in srgb, var(--panel) ${100 - alpha}%, var(--text-main) ${alpha}%)`;

const poly = (pts: P2[]) =>
  `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

const segment = (a: P2, b: P2) => ({
  d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
});

const screenArea = (pts: P2[]) => {
  let sum = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

const centroid = (v: V3[]): V3 => [
  v.reduce((sum, p) => sum + p[0], 0) / v.length,
  v.reduce((sum, p) => sum + p[1], 0) / v.length,
  v.reduce((sum, p) => sum + p[2], 0) / v.length,
];

type Piece = {
  d: string;
  fill: string;
  stroke: string;
  width: number;
  dash?: string;
  opacity?: number;
};

type FigureLabel = { x: number; y: number; text: string; opacity: number };

type Figure = {
  pieces: Piece[];
  labels: FigureLabel[];
  caption: string;
  hint: string;
};

/* ---- Box: every wall turns 90° about the crease it shares with the base -- */

type BoxFace = { id: string; points: V3[]; fill: number; labelOpacity: (fold: number) => number };

function boxFigure(l: number, b: number, h: number, fold: number): Figure {
  const netW = l + 2 * h;
  const netD = 2 * b + 2 * h;
  /* The camera tilts from plan view (fold = 0) to isometric as it closes. */
  const k = smooth(Math.min(1, fold / 0.32));
  /* Two scales, because a flat net and its closed box are different sizes on
     the page. The net is fitted to its own extents; the solid is fitted to
     l + b wide and h tall, not to the net's much larger footprint. Blending
     them is the camera easing in as the shape closes. */
  const topScale = Math.min(58, 500 / netW, 300 / netD);
  const solidScale = Math.min(
    58,
    470 / ((l + b) * 0.86),
    300 / ((l + b) * 0.46 + h * 0.9),
  );
  /* Zoom only once the footprint has shrunk. Halfway through the fold the lid
     still sticks out behind the box; applying the closed-box scale there made
     the plate overflow at the corners. */
  const zoom = smooth(Math.max(0, (fold - 0.6) / 0.4));
  const S = Math.max(6, topScale + (solidScale - topScale) * zoom);

  const project = (p: V3): P2 => {
    const x = p[0] - l / 2;
    const y = p[1];
    const z = p[2] - b / 2;
    const tx = x;
    /* The net's bounding box sits half a breadth behind the base centre;
       shift it back to the middle of the plate while the net is flat. */
    const ty = z + (1 - k) * (b / 2);
    const ix = (x - z) * 0.86;
    const iy = (x + z) * 0.46 - y * 0.9 + h * 0.45;
    return [320 + (tx * (1 - k) + ix * k) * S, 194 + (ty * (1 - k) + iy * k) * S];
  };

  const th = (fold * Math.PI) / 2;
  const sin = Math.sin(th);
  const cos = Math.cos(th);
  const sin2 = Math.sin(2 * th);
  const cos2 = Math.cos(2 * th);

  const wallTop = h * sin;
  const wallBack = -h * cos;
  const lidFarY = wallTop + b * sin2;
  const lidFarZ = wallBack - b * cos2;

  const faces: BoxFace[] = [
    {
      id: "base",
      fill: 8,
      points: [
        [0, 0, 0],
        [l, 0, 0],
        [l, 0, b],
        [0, 0, b],
      ],
      labelOpacity: (t) => 1 - smooth(t * 1.8),
    },
    {
      id: "back",
      fill: 5,
      points: [
        [0, 0, 0],
        [l, 0, 0],
        [l, wallTop, wallBack],
        [0, wallTop, wallBack],
      ],
      labelOpacity: (t) => 1 - smooth(t * 1.8),
    },
    {
      id: "lid",
      fill: 10,
      points: [
        [0, wallTop, wallBack],
        [l, wallTop, wallBack],
        [l, lidFarY, lidFarZ],
        [0, lidFarY, lidFarZ],
      ],
      labelOpacity: () => 1,
    },
    {
      id: "left",
      fill: 4,
      points: [
        [0, 0, 0],
        [0, 0, b],
        [-h * cos, wallTop, b],
        [-h * cos, wallTop, 0],
      ],
      labelOpacity: (t) => (t > 0.72 ? 0 : 0.9),
    },
    {
      id: "right",
      fill: 6,
      points: [
        [l, 0, 0],
        [l, 0, b],
        [l + h * cos, wallTop, b],
        [l + h * cos, wallTop, 0],
      ],
      labelOpacity: (t) => (t > 0.72 ? 0 : 0.9),
    },
    {
      id: "front",
      fill: 11,
      points: [
        [0, 0, b],
        [l, 0, b],
        [l, wallTop, b + h * cos],
        [0, wallTop, b + h * cos],
      ],
      labelOpacity: () => 1,
    },
  ];

  const projected = faces.map((face) => ({
    ...face,
    pts: face.points.map(project),
  }));

  /* Painter order: the camera looks from +x, +z and above, so a face with a
     larger x + z + y is nearer and is drawn later. */
  const ordered = [...projected].sort((p, q) => {
    const a = centroid(p.points);
    const bb = centroid(q.points);
    return a[0] + a[2] + a[1] * 0.6 - (bb[0] + bb[2] + bb[1] * 0.6);
  });

  const pieces: Piece[] = ordered.map((face) => ({
    d: poly(face.pts),
    fill: tint(face.fill),
    stroke: tint(46),
    width: 1.4,
  }));

  /* The creases. These are the actual hinge lines — the faces rotate about
     them, which is what makes a net a net rather than a jigsaw. */
  const creases: Array<[V3, V3]> = [
    [
      [0, 0, 0],
      [l, 0, 0],
    ],
    [
      [0, 0, b],
      [l, 0, b],
    ],
    [
      [0, 0, 0],
      [0, 0, b],
    ],
    [
      [l, 0, 0],
      [l, 0, b],
    ],
    [
      [0, wallTop, wallBack],
      [l, wallTop, wallBack],
    ],
  ];
  for (const [from, to] of creases) {
    const a = project(from);
    const bb = project(to);
    pieces.push({
      d: segment(a, bb).d,
      fill: "none",
      stroke: "var(--signal)",
      width: 1.7,
      dash: "5 4",
      opacity: 0.75,
    });
  }

  const labels: FigureLabel[] = [];
  for (const face of projected) {
    const opacity = face.labelOpacity(fold);
    if (opacity < 0.05) continue;
    if (screenArea(face.pts) < 760) continue;
    const [x, y] = project(centroid(face.points));
    labels.push({ x, y: y + 3.5, text: face.id, opacity });
  }

  return {
    pieces,
    labels,
    caption:
      fold < 0.02
        ? "flat net — the gold lines are the creases"
        : fold > 0.985
          ? "closed solid — every face is the same face, moved"
          : `folding · ${Math.round(fold * 100)}% closed`,
    hint: fold > 0.02 && fold < 0.985 ? "each wall turns about a gold crease" : "hinges in gold",
  };
}

/* ---- Cylinder: roll the rectangle around its own axis ------------------- */function cylinderFigure(r: number, h: number, fold: number): Figure {
  /* Fit the *flat net* to the plate: the rectangle is 2πr wide and the two
     circles add 2r above and below it. The old 65px cap drew a cylinder whose
     height was set by an arbitrary constant, not by the space available. */
  const S = Math.min(70, 500 / (2 * Math.PI * r), 330 / (h + 3.4 * r));
  const R = r * S;
  const Hh = h * S;
  const netW = 2 * Math.PI * R;
  const cx = 320;
  const cy = 196;
  const N = 72;

  const topMid = cy - Hh / 2;
  const botMid = cy + Hh / 2;
  const topFlat = topMid - R - 18;
  const botFlat = botMid + R + 18;
  const topY = topFlat + (topMid - topFlat) * fold;
  const botY = botFlat + (botMid - botFlat) * fold;
  const ry = R + (0.28 * R - R) * fold;

  type Strip = { pts: P2[]; depth: number; fill: string; opacity: number };
  const strips: Strip[] = [];
  for (let i = 0; i < N; i += 1) {
    const u0 = i / N;
    const u1 = (i + 1) / N;
    const a0 = u0 * Math.PI * 2;
    const a1 = u1 * Math.PI * 2;
    const flat0 = (u0 - 0.5) * netW;
    const flat1 = (u1 - 0.5) * netW;
    const x0 = flat0 + (R * Math.sin(a0) - flat0) * fold;
    const x1 = flat1 + (R * Math.sin(a1) - flat1) * fold;
    const z0 = fold * R * Math.cos(a0);
    const z1 = fold * R * Math.cos(a1);
    const depth = (z0 + z1) / 2;
    const shade = 6 + (6 * (depth / Math.max(1, R) + 1)) / 2;
    strips.push({
      pts: [
        [cx + x0, topMid + z0 * 0.3],
        [cx + x1, topMid + z1 * 0.3],
        [cx + x1, botMid + z1 * 0.3],
        [cx + x0, botMid + z0 * 0.3],
      ],
      depth,
      fill: surface(shade),
      /* The far half is a ghost, not a second sheet: it gives the curl depth
         without 72 translucent panels crossing each other in the middle. */
      opacity: depth < -0.5 ? 0.26 : 1,
    });
  }
  strips.sort((a, b) => a.depth - b.depth);

  const pieces: Piece[] = [];

  /* The base disc is behind the tube at every angle. */
  pieces.push({
    d: poly(
      Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        return [cx + R * Math.cos(a), botY + ry * Math.sin(a)] as P2;
      }),
    ),
    fill: surface(9),
    stroke: tint(45),
    width: 1.3,
  });

  /* Opaque strips, far half first. Adjacent strips share an edge and carry
     no stroke, so the front reads as one solid curved surface instead of a
     wireframe of 72 panels. */
  for (const strip of strips) {
    pieces.push({
      d: poly(strip.pts),
      fill: strip.fill,
      stroke: "none",
      width: 0,
      opacity: strip.opacity,
    });
  }

  /* The top lid sits over the front strips, because it is the lid. */
  pieces.push({
    d: poly(
      Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        return [cx + R * Math.cos(a), topY + ry * Math.sin(a)] as P2;
      }),
    ),
    fill: surface(13),
    stroke: tint(52),
    width: 1.4,
  });

  /* One continuous outline around the rolled band. At 100% this is the
     silhouette of a closed cylinder, with both rims visible. */
  const outline: P2[] = [];
  for (let i = 0; i <= N; i += 1) {
    const u = i / N;
    const a = u * Math.PI * 2;
    const flat = (u - 0.5) * netW;
    const x = flat + (R * Math.sin(a) - flat) * fold;
    const z = fold * R * Math.cos(a);
    outline.push([cx + x, topMid + z * 0.3]);
  }
  for (let i = N; i >= 0; i -= 1) {
    const u = i / N;
    const a = u * Math.PI * 2;
    const flat = (u - 0.5) * netW;
    const x = flat + (R * Math.sin(a) - flat) * fold;
    const z = fold * R * Math.cos(a);
    outline.push([cx + x, botMid + z * 0.3]);
  }
  pieces.push({ d: poly(outline), fill: "none", stroke: tint(55), width: 1.7 });

  /* The seam where the rectangle's two short edges meet. */
  if (fold > 0.5) {
    const seamOpacity = smooth((fold - 0.5) / 0.2);
    pieces.push({
      d: `M${cx} ${topMid + 0.3 * R} L${cx} ${botMid + 0.3 * R}`,
      fill: "none",
      stroke: tint(42),
      width: 1,
      dash: "3 5",
      opacity: 0.7 * seamOpacity,
    });
  }

  /* Only while the net is still flat: once the sheet is rolling, these names
     would sit on a curved surface and point at nothing. */
  const labels: FigureLabel[] = [];
  const flatLabel = 1 - smooth(fold / 0.32);
  if (flatLabel > 0.04) {
    labels.push({
      x: cx,
      y: topFlat + R * 0.53,
      text: "top face",
      opacity: flatLabel,
    });
    labels.push({
      x: cx,
      y: botFlat - R * 0.42,
      text: "base",
      opacity: flatLabel,
    });
    labels.push({
      x: cx,
      y: (topMid + botMid) / 2 + 4,
      text: "curved surface · 2πr × h",
      opacity: flatLabel,
    });
  }

  return {
    pieces,
    labels,
    caption:
      fold < 0.02
        ? "flat net — one rectangle and two circles"
        : fold > 0.985
          ? "rolled closed — both rims are drawn"
          : `rolling · ${Math.round(fold * 100)}%`,
    hint: "the rectangle's width is the circumference 2πr",
  };
}

/* ---- Cone: wrap the sector's generators around the base --------------- */

function coneFigure(r: number, l: number, fold: number): Figure {
  /* Fit the flat net: the sector of radius l sits on the left, the base circle
     of radius r beside it on the right. The old scale left a folded cone
     under 140px tall in a 640px plate. */
  const S = Math.min(58, 328 / (l + 2 * r), 300 / (l + 1.5 * r));
  const L = l * S;
  const smallR = r * S;
  const gamma = (2 * Math.PI * r) / l;
  const N = 72;

  const cx = 300;
  const flatApexY = 128;
  const foldedApexY = 96;
  const apexY = flatApexY + (foldedApexY - flatApexY) * fold;
  const baseY = foldedApexY + Math.sqrt(Math.max(1, L * L - smallR * smallR));
  const start = Math.PI / 2 - gamma / 2;

  type Point = { x: number; y: number; front: number };
  const base: Point[] = [];
  for (let i = 0; i <= N; i += 1) {
    const u = i / N;
    const fa = start + gamma * u;
    const flatX = cx + L * Math.cos(fa);
    const flatY = flatApexY + L * Math.sin(fa);
    const az = -Math.PI / 2 + Math.PI * 2 * u;
    const foldX = cx + smallR * Math.sin(az);
    const foldY = baseY + 0.3 * smallR * Math.cos(az);
    base.push({
      x: flatX + (foldX - flatX) * fold,
      y: flatY + (foldY - flatY) * fold,
      front: Math.cos(az),
    });
  }

  const pieces: Piece[] = [];

  /* Base circle: beside the sector in the net, under the cone once wrapped.
     Drawn first, so the cone covers its back half. */
  const discFlatX = cx + L + smallR + 12;
  const discFlatY = flatApexY + L * 0.58;
  const discX = discFlatX + (cx - discFlatX) * fold;
  const discY = discFlatY + (baseY - discFlatY) * fold;
  const discRy = smallR + (0.3 * smallR - smallR) * fold;
  pieces.push({
    d: poly(
      Array.from({ length: 52 }, (_, i) => {
        const a = (i / 52) * Math.PI * 2;
        return [discX + smallR * Math.cos(a), discY + discRy * Math.sin(a)] as P2;
      }),
    ),
    fill: surface(9),
    stroke: tint(46),
    width: 1.3,
  });

  /* One sheet, not 72 translucent triangles: the sector's arc is traced once
     and the whole lateral surface is a single opaque path. */
  const lateral = `M${cx} ${apexY} L${base
    .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" L")} Z`;
  pieces.push({ d: lateral, fill: surface(7), stroke: tint(48), width: 1.5 });

  if (fold > 0.02) {
    /* The half of the sheet facing the viewer catches more light; the change
       grows in as the paper leaves the page. */
    const frontPts = base.filter((p) => p.front > 0);
    if (frontPts.length > 2) {
      pieces.push({
        d: `M${cx} ${apexY} L${frontPts
          .map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" L")} Z`,
        fill: surface(12),
        stroke: "none",
        width: 0,
        opacity: 0.5 * smooth(fold * 1.6),
      });
    }
    /* Generators: the straight slant lines that wrap into the surface. */
    for (let i = 0; i <= N; i += 9) {
      const p = base[i];
      pieces.push({
        d: `M${cx} ${apexY} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
        fill: "none",
        stroke: tint(30),
        width: 1,
        opacity: 0.55 * smooth(fold * 1.8),
      });
    }
  }

  /* The sector's two straight edges; they meet as the seam at 100%. */
  pieces.push({
    d: `M${cx} ${apexY} L${base[0].x} ${base[0].y} M${cx} ${apexY} L${base[N].x} ${base[N].y}`,
    fill: "none",
    stroke: "var(--signal)",
    width: 1.4,
    dash: "5 4",
    opacity: 0.6,
  });

  const labels: FigureLabel[] = [];
  const flatLabel = 1 - smooth(fold / 0.35);
  if (flatLabel > 0.04) {
    labels.push({
      x: cx,
      y: apexY + L * 0.45,
      text: "curved surface",
      opacity: flatLabel,
    });
    labels.push({
      x: discX,
      y: discY + 4,
      text: "base",
      opacity: flatLabel,
    });
  }

  return {
    pieces,
    labels,
    caption:
      fold < 0.02
        ? "flat net — a sector and its base circle"
        : fold > 0.985
          ? "wrapped cone — the arc has become the rim"
          : `wrapping · ${Math.round(fold * 100)}%`,
    hint: "the sector's arc is the base circumference 2πr",
  };
}

export function NetsAndSolids() {
  const [solidId, setSolidId] = useState<SolidId>("cuboid");
  const [l, setL] = useState(3);
  const [b, setB] = useState(2);
  const [h, setH] = useState(1.5);
  const [r, setR] = useState(1.2);
  const [ch, setCh] = useState(3);
  const [slant, setSlant] = useState(3.2);
  const [fold, setFold] = useState(0);
  const [playing, setPlaying] = useState(false);

  const liveSlant = Math.max(r + 0.2, slant);

  const figure = useMemo(() => {
    if (solidId === "cube") return boxFigure(l, l, l, fold);
    if (solidId === "cuboid") return boxFigure(l, b, h, fold);
    if (solidId === "cylinder") return cylinderFigure(r, ch, fold);
    return coneFigure(r, liveSlant, fold);
  }, [solidId, l, b, h, r, ch, liveSlant, fold]);

  const surfaceArea = useMemo(() => {
    if (solidId === "cube") return 6 * l * l;
    if (solidId === "cuboid") return 2 * (l * b + b * h + l * h);
    if (solidId === "cylinder") return 2 * Math.PI * r * (r + ch);
    return Math.PI * r * (r + liveSlant);
  }, [solidId, l, b, h, r, ch, liveSlant]);

  const volume =
    solidId === "cube"
      ? l ** 3
      : solidId === "cuboid"
        ? l * b * h
        : solidId === "cylinder"
          ? Math.PI * r * r * ch
          : (1 / 3) * Math.PI * r * r * Math.sqrt(Math.max(0.01, liveSlant ** 2 - r ** 2));

  const euler =
    solidId === "cube" || solidId === "cuboid"
      ? { F: 6, V: 8, E: 12 }
      : solidId === "cylinder"
        ? { F: 3, V: 0, E: 2 }
        : { F: 2, V: 1, E: 1 };

  const rows: Array<[string, string]> =
    solidId === "cube"
      ? [
          ["Side a", `${l.toFixed(2)} u`],
          ["Surface area", `${surfaceArea.toFixed(2)} u²`],
          ["Volume", `${volume.toFixed(2)} u³`],
        ]
      : solidId === "cuboid"
        ? [
            ["l, b, h", `${l.toFixed(1)}, ${b.toFixed(1)}, ${h.toFixed(1)} u`],
            ["Surface area", `${surfaceArea.toFixed(2)} u²`],
            ["Volume", `${volume.toFixed(2)} u³`],
          ]
        : solidId === "cylinder"
          ? [
              ["r, h", `${r.toFixed(1)}, ${ch.toFixed(1)} u`],
              ["Surface area", `${surfaceArea.toFixed(2)} u²`],
              ["Volume", `${volume.toFixed(2)} u³`],
            ]
          : [
              ["r, slant l", `${r.toFixed(1)}, ${liveSlant.toFixed(1)} u`],
              ["Surface area", `${surfaceArea.toFixed(2)} u²`],
              ["Volume", `${volume.toFixed(2)} u³`],
            ];

  /* A gentle automatic fold, so the motion is visible without dragging. The
     clock reads a ref, not the state updater: calling setPlaying from inside
     setFold's updater is a side effect during render and React may run it
     twice. */
  const foldRef = useRef(fold);
  useEffect(() => {
    foldRef.current = fold;
  }, [fold]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const next = Math.min(1, foldRef.current + dt / 2400);
      foldRef.current = next;
      setFold(next);
      if (next >= 1) setPlaying(false);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const chooseSolid = (id: SolidId) => {
    setSolidId(id);
    setFold(0);
    setPlaying(false);
  };

  return (
    <div className="mm-root">
      <div className="mm-rail" role="group" aria-label="Solid">
        {SOLIDS.map((solid) => (
          <button
            key={solid.id}
            type="button"
            className="mm-chip"
            aria-pressed={solid.id === solidId}
            onClick={() => chooseSolid(solid.id)}
          >
            {solid.label}
            <span className="mm-chip__grade">{solid.grade}</span>
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-stage">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Net of a ${solidId}, folding into the solid`}
          >
            {figure.pieces.map((piece, index) => (
              <path
                key={index}
                d={piece.d}
                fill={piece.fill}
                stroke={piece.stroke}
                strokeWidth={piece.width}
                strokeDasharray={piece.dash}
                strokeLinejoin="round"
                opacity={piece.opacity ?? 1}
              />
            ))}

            {figure.labels.map((label, index) => (
              <text
                key={`${label.text}-${index}`}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                letterSpacing="0.08em"
                fill="var(--text-main)"
                opacity={0.55 * label.opacity}
                paintOrder="stroke"
                stroke="var(--panel)"
                strokeWidth={3}
                strokeLinejoin="round"
                style={{ textTransform: "uppercase" }}
              >
                {label.text}
              </text>
            ))}

            <text x={16} y={24} fontSize={11} fill="var(--text-dim)">
              {figure.caption}
            </text>
            <text x={W - 16} y={24} textAnchor="end" fontSize={10.5} fill="var(--text-dim)">
              {figure.hint}
            </text>
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">Fold</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="mm-chip"
                aria-pressed={playing}
                onClick={() => {
                  if (playing) {
                    setPlaying(false);
                    return;
                  }
                  if (fold > 0.995) setFold(0);
                  setPlaying(true);
                }}
              >
                {playing ? "Pause" : fold > 0.995 ? "Fold again" : "Fold it"}
              </button>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-main)",
                  fontWeight: 700,
                }}
              >
                {Math.round(fold * 100)}%
              </span>
            </div>
            <input
              className="mm-range"
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={fold}
              aria-label="Fold the net"
              onChange={(event) => {
                setPlaying(false);
                setFold(Number(event.target.value));
              }}
              style={{ marginTop: 10 }}
            />
            <p className="mm-note" style={{ marginTop: 8, fontSize: 11.5 }}>
              The gold lines are creases, not cuts. Drag to stop halfway and watch
              each face turn about the edge it shares with the base.
            </p>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Dimensions</p>
            {(solidId === "cube" || solidId === "cuboid") && (
              <>
                {solidId === "cuboid" && <DimRow label="Length l" value={l} set={setL} />}
                {solidId === "cuboid" && <DimRow label="Breadth b" value={b} set={setB} />}
                {solidId === "cuboid" && <DimRow label="Height h" value={h} set={setH} />}
                {solidId === "cube" && <DimRow label="Side a" value={l} set={setL} />}
              </>
            )}
            {solidId === "cylinder" && (
              <>
                <DimRow label="Radius r" value={r} set={setR} min={0.4} max={3} />
                <DimRow label="Height h" value={ch} set={setCh} />
              </>
            )}
            {solidId === "cone" && (
              <>
                <DimRow label="Radius r" value={r} set={setR} min={0.4} max={2.4} />
                <DimRow label="Slant l" value={slant} set={setSlant} min={1.2} max={6} />
              </>
            )}
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Measured from the figure</p>
            {rows.map(([key, value]) => (
              <div className="mm-row" key={key}>
                <span>{key}</span>
                <b>{value}</b>
              </div>
            ))}
            {(solidId === "cube" || solidId === "cuboid") && (
              <>
                <div className="mm-row">
                  <span>Faces · vertices · edges</span>
                  <b>
                    {euler.F} · {euler.V} · {euler.E}
                  </b>
                </div>
                <div className="mm-row">
                  <span>F + V − E</span>
                  <b>{euler.F + euler.V - euler.E}</b>
                </div>
              </>
            )}
          </div>

          <p className="mm-note">
            Surface area is measured from the dimensions, not typed in. A cylinder
            and a cone have no straight edges to count, so the Euler tally is
            shown only for the box.
          </p>
        </div>
      </div>
    </div>
  );
}

function DimRow({
  label,
  value,
  set,
  min = 0.5,
  max = 5,
}: {
  label: string;
  value: number;
  set: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label style={{ display: "block", marginTop: 8 }}>
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-dim)",
        }}
      >
        {label}{" "}
        <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>
          {value.toFixed(1)} u
        </b>
      </span>
      <input
        className="mm-range"
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
      />
    </label>
  );
}

export default NetsAndSolids;
