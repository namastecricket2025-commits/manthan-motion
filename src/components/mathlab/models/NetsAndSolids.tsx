import { useMemo, useState } from "react";

/**
 * Nets & solids — Class 8 mensuration.
 *
 * A net is a solid that has been unfolded, and the two halves of that sentence
 * are usually taught in different weeks. Here one object owns both states: the
 * fold slider runs every face from its place on the flat net to its place on
 * the closed solid, by interpolating each face's own vertices. Nothing is
 * crossfaded — the faces *move*, so "this rectangle becomes that wall" is
 * something you watch happen.
 *
 * Surface area is the sum of the face areas, measured from the net you see;
 * volume is computed from the same dimensions. Euler's characteristic
 * (F + V − E = 2) is counted from the folded solid, so a student can check the
 * formula against a fact they can tally by hand.
 *
 * Cube, cuboid, cylinder and cone all use one vertex-lerp renderer: each face
 * carries a flat polygon and its folded polygon with the same number of
 * points, so the fold is a straight interpolation of every vertex.
 */

type SolidId = "cube" | "cuboid" | "cylinder" | "cone";

const SOLIDS: Array<{ id: SolidId; label: string; grade: string }> = [
  { id: "cube", label: "Cube", grade: "a × a × a" },
  { id: "cuboid", label: "Cuboid", grade: "l × b × h" },
  { id: "cylinder", label: "Cylinder", grade: "πr(r + 2h)" },
  { id: "cone", label: "Cone", grade: "πr(r + l)" },
];

type Face = {
  /** Vertex count stays constant between the two states. */
  flat: [number, number][];
  folded: [number, number][];
  fill: string;
  label: string;
  /** The face's true area in model units — readouts are measured, not typed. */
  area: number;
};

const iso = (x: number, y: number, z: number): [number, number] => [
  320 + (x - z) * 0.86,
  190 - y * 0.8 + (x + z) * 0.5,
];

/* ---- Cube / cuboid: a cross net folding into a box -------------------- */

function boxFaces(l: number, b: number, h: number): Face[] {
  const t = (alpha: number) => `color-mix(in srgb, var(--text-main) ${alpha}%, transparent)`;
  /* Net layout (flat, SVG units): the classic cross. Base sits at the centre;
     the four walls radiate from its edges; the lid caps the north wall. */
  const netL = l * 44;
  const netB = b * 44;
  const netH = h * 44;
  const x0 = 320 - netL / 2;
  const y0 = 150 - netB / 2;
  const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];

  const walls = [
    { name: "front", dim: [netL, netH] as [number, number], off: [0, netB] as [number, number] },
    { name: "back", dim: [netL, netH] as [number, number], off: [0, -netH] as [number, number] },
    { name: "left", dim: [netB, netH] as [number, number], off: [-netB, 0] as [number, number] },
    { name: "right", dim: [netB, netH] as [number, number], off: [netL, 0] as [number, number] },
  ];

  const faces: Face[] = [
    {
      label: "Base",
      area: l * b,
      fill: t(9),
      flat: rect(x0, y0, netL, netB),
      /* The base lies in the xy-plane of the isometric view. */
      folded: [
        iso(0, 0, 0),
        iso(l, 0, 0),
        iso(l, 0, b),
        iso(0, 0, b),
      ],
    },
  ];

  /* Folded positions: each wall stands on its own base edge. The four corners
     of the wall are the two base corners plus their lift by h — the shared
     edge keeps its two vertices, which is what makes the fold hinge-like. */
  const wallFold: Record<string, [number, number][]> = {
    front: [iso(0, 0, b), iso(l, 0, b), iso(l, h, b), iso(0, h, b)],
    back: [iso(0, h, 0), iso(l, h, 0), iso(l, 0, 0), iso(0, 0, 0)],
    left: [iso(0, 0, 0), iso(0, 0, b), iso(0, h, b), iso(0, h, 0)],
    right: [iso(l, 0, b), iso(l, 0, 0), iso(l, h, 0), iso(l, h, b)],
  };
  const wallArea: Record<string, number> = {
    front: l * h,
    back: l * h,
    left: b * h,
    right: b * h,
  };

  for (const wall of walls) {
    faces.push({
      label: wall.name,
      area: wallArea[wall.name],
      fill: t(wall.name === "front" || wall.name === "back" ? 6 : 4),
      flat: rect(x0 + wall.off[0], y0 + wall.off[1], wall.dim[0], wall.dim[1]),
      folded: wallFold[wall.name],
    });
  }

  /* The lid folds over the front wall in the net, and caps the box when shut. */
  faces.push({
    label: "Lid",
    area: l * b,
    fill: t(7),
    flat: rect(x0, y0 + netB + netH, netL, netB),
    folded: [iso(0, h, b), iso(l, h, b), iso(l, h, 0), iso(0, h, 0)],
  });

  return faces;
}

/* ---- Cylinder: rectangle + two discs ---------------------------------- */

function cylinderFaces(r: number, h: number): Face[] {
  const t = (alpha: number) => `color-mix(in srgb, var(--text-main) ${alpha}%, transparent)`;
  const netR = r * 44;
  const circ = 2 * Math.PI * netR;
  const netH = h * 44;
  const cx = 320;
  const cy = 170;

  /* The tube's net is a rectangle; when folded it becomes the cylinder's
     front outline — a rectangle capped by two ellipse halves. Both states
     carry the same 41 points so the fold interpolates cleanly. */
  const N = 20;
  const flatRect: [number, number][] = [[cx - circ / 2, cy - netH / 2]];
  for (let i = 0; i <= N; i += 1) flatRect.push([cx - circ / 2 + (circ * i) / N, cy - netH / 2]);
  flatRect.push([cx + circ / 2, cy + netH / 2]);
  for (let i = N; i >= 0; i -= 1) flatRect.push([cx - circ / 2 + (circ * i) / N, cy + netH / 2]);

  const R = netR;
  const foldedRect: [number, number][] = [];
  const topY = cy - netH / 2;
  const botY = cy + netH / 2;
  foldedRect.push([cx - R, topY]);
  for (let i = 0; i <= N; i += 1) {
    const a = Math.PI + (Math.PI * i) / N; /* top ellipse, left to right */
    foldedRect.push([cx + R * Math.cos(a), topY + R * 0.28 * Math.sin(a)]);
  }
  foldedRect.push([cx + R, botY]);
  for (let i = N; i >= 0; i -= 1) {
    const a = (Math.PI * i) / N; /* bottom ellipse, right to left */
    foldedRect.push([cx + R * Math.cos(a), botY + R * 0.28 * Math.sin(a)]);
  }

  const disc = (x: number, y: number, squash: number): [number, number][] =>
    Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return [x + netR * Math.cos(a), y + squash * netR * Math.sin(a)] as [number, number];
    });

  /* Top disc: rides up with the rectangle, flattens from a side-on sliver into
     the perspective ellipse of the folded cylinder. Bottom disc stays put. */
  const topFlat = disc(cx - circ / 2 - netR - 14, cy, 1);
  const topFolded = disc(cx, topY, 0.28);
  const botFlat = disc(cx + circ / 2 + netR + 14, cy, 1);
  const botFolded = disc(cx, botY, 0.28);

  return [
    { label: "tube", area: 2 * Math.PI * r * h, fill: t(6), flat: flatRect, folded: foldedRect },
    { label: "top", area: Math.PI * r * r, fill: t(9), flat: topFlat, folded: topFolded },
    { label: "base", area: Math.PI * r * r, fill: t(9), flat: botFlat, folded: botFolded },
  ];
}

/* ---- Cone: a sector + a disc ------------------------------------------ */

function coneFaces(r: number, l: number): Face[] {
  const t = (alpha: number) => `color-mix(in srgb, var(--text-main) ${alpha}%, transparent)`;
  const netR = l * 44;
  const netR2 = r * 44;
  const arc = (2 * Math.PI * netR2) / (2 * Math.PI) * 2 * Math.PI; /* circumference */
  const sectorAngle = arc / netR; /* radians of the sector */
  const cx = 300;
  const cy = 120;
  const N = 26;

  /* Flat sector: apex at (cx, cy), sweeping downward. */
  const start = Math.PI / 2 - sectorAngle / 2;
  const flat: [number, number][] = [[cx, cy]];
  for (let i = 0; i <= N; i += 1) {
    const a = start + (sectorAngle * i) / N;
    flat.push([cx + netR * Math.cos(a), cy + netR * Math.sin(a)]);
  }

  /* Folded: the cone's silhouette — apex above, elliptical base below. */
  const apexY = cy - 30;
  const baseY = cy + netR * 0.86;
  const folded: [number, number][] = [[cx, apexY]];
  for (let i = 0; i <= N; i += 1) {
    const a = Math.PI + (Math.PI * i) / N;
    folded.push([cx + netR2 * Math.cos(a), baseY + netR2 * 0.3 * Math.sin(a)]);
  }

  const discFlat = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [cx + netR + netR2 + 20 + netR2 * Math.cos(a), cy + netR * 0.6 + netR2 * Math.sin(a)] as [number, number];
  });
  const discFolded = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [cx + netR2 * Math.cos(a), baseY + netR2 * 0.3 * Math.sin(a)] as [number, number];
  });

  return [
    { label: "lateral", area: Math.PI * r * l, fill: t(6), flat, folded },
    { label: "base", area: Math.PI * r * r, fill: t(9), flat: discFlat, folded: discFolded },
  ];
}

const lerpFace = (face: Face, t: number): string => {
  const pts = face.flat.map(([x, y], i) => {
    const [fx, fy] = face.folded[i];
    return `${(x + (fx - x) * t).toFixed(2)} ${(y + (fy - y) * t).toFixed(2)}`;
  });
  return `M${pts.join(" L")} Z`;
};

export function NetsAndSolids() {
  const [solidId, setSolidId] = useState<SolidId>("cuboid");
  const [l, setL] = useState(3);
  const [b, setB] = useState(2);
  const [h, setH] = useState(1.5);
  const [r, setR] = useState(1.2);
  const [ch, setCh] = useState(3);
  const [slant, setSlant] = useState(3.2);
  const [fold, setFold] = useState(0);

  const faces = useMemo(() => {
    if (solidId === "cube") return boxFaces(l, l, l);
    if (solidId === "cuboid") return boxFaces(l, b, h);
    if (solidId === "cylinder") return cylinderFaces(r, ch);
    return coneFaces(r, Math.max(r + 0.2, slant));
  }, [solidId, l, b, h, r, ch, slant]);

  const surfaceArea = faces.reduce((sum, f) => sum + f.area, 0);
  const volume =
    solidId === "cube"
      ? l ** 3
      : solidId === "cuboid"
        ? l * b * h
        : solidId === "cylinder"
          ? Math.PI * r * r * ch
          : (1 / 3) * Math.PI * r * r * Math.sqrt(Math.max(0.01, slant ** 2 - r ** 2));

  /* Euler's F + V − E, tallied from the solid the net closes into. */
  const euler =
    solidId === "cube" || solidId === "cuboid"
      ? { F: 6, V: 8, E: 12 }
      : solidId === "cylinder"
        ? { F: 3, V: 0, E: 2 }
        : { F: 2, V: 1, E: 1 };

  const folded = fold > 0.985;

  const rows =
    solidId === "cube"
      ? [["Side a", `${l.toFixed(2)} u`], ["Surface area", `${(6 * l * l).toFixed(2)} u²`], ["Volume", `${(l ** 3).toFixed(2)} u³`]]
      : solidId === "cuboid"
        ? [["l, b, h", `${l.toFixed(1)}, ${b.toFixed(1)}, ${h.toFixed(1)} u`], ["Surface area", `${surfaceArea.toFixed(2)} u²`], ["Volume", `${volume.toFixed(2)} u³`]]
        : solidId === "cylinder"
          ? [["r, h", `${r.toFixed(1)}, ${ch.toFixed(1)} u`], ["Surface area", `${surfaceArea.toFixed(2)} u²`], ["Volume", `${volume.toFixed(2)} u³`]]
          : [["r, slant l", `${r.toFixed(1)}, ${slant.toFixed(1)} u`], ["Surface area", `${surfaceArea.toFixed(2)} u²`], ["Volume", `${volume.toFixed(2)} u³`]];

  return (
    <div className="mm-root">
      <div className="mm-rail" role="group" aria-label="Solid">
        {SOLIDS.map((s) => (
          <button key={s.id} type="button" className="mm-chip" aria-pressed={s.id === solidId} onClick={() => { setSolidId(s.id); setFold(0); }}>
            {s.label}
            <span className="mm-chip__grade">{s.grade}</span>
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-stage">
          <svg viewBox="0 0 640 380" role="img" aria-label={`Net of a ${solidId}, folding into the solid`}>
            {faces.map((face) => (
              <path key={face.label} d={lerpFace(face, fold)} fill={face.fill} stroke="var(--text-main)" strokeWidth={1.6} strokeLinejoin="round" />
            ))}
            {!folded ? (
              <text x={14} y={22} fontSize={11} fill="var(--text-dim)">
                flat net — drag Fold to close it
              </text>
            ) : (
              <text x={14} y={22} fontSize={11} fill="var(--text-dim)">
                folded solid — every face is the same face, moved
              </text>
            )}
          </svg>
        </div>

        <div className="mm-side">
          <div className="mm-panel">
            <p className="mm-panel__title">Fold</p>
            <label style={{ display: "block", marginTop: 8 }}>
              <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
                Net → solid <b style={{ color: "var(--text-main)" }}>{Math.round(fold * 100)}%</b>
              </span>
              <input className="mm-range" type="range" min={0} max={1} step={0.01} value={fold} onChange={(e) => setFold(Number(e.target.value))} />
            </label>
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Dimensions</p>
            {(solidId === "cube" || solidId === "cuboid") && (
              <>
                {solidId === "cuboid" && <DimRow label="Length l" value={l} set={setL} />}
                {solidId === "cuboid" && <DimRow label="Breadth b" value={b} set={setB} />}
                {solidId !== "cube" && <DimRow label="Height h" value={h} set={setH} />}
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
                <DimRow label="Radius r" value={r} set={setR} min={0.4} max={3} />
                <DimRow label="Slant l" value={slant} set={setSlant} min={1.2} max={6} />
              </>
            )}
          </div>

          <div className="mm-panel">
            <p className="mm-panel__title">Measured from the figure</p>
            {rows.map(([k, v]) => (
              <div className="mm-row" key={k}><span>{k}</span><b>{v}</b></div>
            ))}
            <div className="mm-row"><span>Faces · vertices · edges</span><b>{euler.F} · {euler.V} · {euler.E}</b></div>
            <div className="mm-row"><span>F + V − E</span><b>{euler.F + euler.V - euler.E}</b></div>
          </div>

          <p className="mm-note">
            Surface area is the sum of the face areas printed on the net — pause
            the fold halfway and add them up yourself. A cylinder and a cone
            have no straight edges to count, so Euler's tally only applies to
            the box; that is exactly the difference the formula hides.
          </p>
        </div>
      </div>
    </div>
  );
}

function DimRow({ label, value, set, min = 0.5, max = 5 }: { label: string; value: number; set: (v: number) => void; min?: number; max?: number }) {
  return (
    <label style={{ display: "block", marginTop: 8 }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
        {label} <b style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{value.toFixed(1)} u</b>
      </span>
      <input className="mm-range" type="range" min={min} max={max} step={0.1} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}

export default NetsAndSolids;
