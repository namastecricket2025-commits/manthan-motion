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
 * One scale per solid is shared by the net and the isometric projection, which
 * is what keeps a face the same size at both ends of the fold. Without that,
 * the solid would shrink into the net's middle instead of closing.
 */

type SolidId = "cube" | "cuboid" | "cylinder" | "cone";

const SOLIDS: Array<{ id: SolidId; label: string; grade: string }> = [
  { id: "cube", label: "Cube", grade: "a × a × a" },
  { id: "cuboid", label: "Cuboid", grade: "l × b × h" },
  { id: "cylinder", label: "Cylinder", grade: "πr(r + 2h)" },
  { id: "cone", label: "Cone", grade: "πr(r + l)" },
];

type Pt = [number, number];

type Face = {
  /** Vertex count stays constant between the two states. */
  flat: Pt[];
  folded: Pt[];
  fill: string;
  label: string;
  /** The face's true area in model units — readouts are measured, not typed. */
  area: number;
};

/** Isometric projection at the same pixels-per-unit as the flat net. */
const iso = (x: number, y: number, z: number, S: number): Pt => [
  320 + (x - z) * S * 0.86,
  198 - y * S * 0.92 + (x + z) * S * 0.48,
];

const tint = (alpha: number) => `color-mix(in srgb, var(--text-main) ${alpha}%, transparent)`;

/* ---- Cube / cuboid: a cross net folding into a box -------------------- */

function boxFaces(l: number, b: number, h: number): Face[] {
  const S = Math.min(30, 560 / (l + 2 * h), 300 / (2 * (b + h)));
  const netL = l * S;
  const netB = b * S;
  const netH = h * S;

  /* Four stacked rows: back wall, base, front wall, lid. Side walls hinge on
     the base's left and right edges, each `netH` wide once unfolded. */
  const totalH = 2 * netB + 2 * netH;
  const topY = 198 - totalH / 2;
  const x0 = 320 - netL / 2;
  const baseY = topY + netH;

  const rect = (x: number, y: number, w: number, hh: number): Pt[] => [
    [x, y],
    [x + w, y],
    [x + w, y + hh],
    [x, y + hh],
  ];

  return [
    {
      label: "base",
      area: l * b,
      fill: tint(9),
      flat: rect(x0, baseY, netL, netB),
      folded: [iso(0, 0, 0, S), iso(l, 0, 0, S), iso(l, 0, b, S), iso(0, 0, b, S)],
    },
    {
      label: "back",
      area: l * h,
      fill: tint(6),
      flat: rect(x0, topY, netL, netH),
      folded: [iso(0, h, 0, S), iso(l, h, 0, S), iso(l, 0, 0, S), iso(0, 0, 0, S)],
    },
    {
      label: "front",
      area: l * h,
      fill: tint(6),
      flat: rect(x0, baseY + netB, netL, netH),
      folded: [iso(0, 0, b, S), iso(l, 0, b, S), iso(l, h, b, S), iso(0, h, b, S)],
    },
    {
      label: "left",
      area: b * h,
      fill: tint(4),
      flat: rect(x0 - netH, baseY, netH, netB),
      folded: [iso(0, 0, 0, S), iso(0, 0, b, S), iso(0, h, b, S), iso(0, h, 0, S)],
    },
    {
      label: "right",
      area: b * h,
      fill: tint(4),
      flat: rect(x0 + netL, baseY, netH, netB),
      folded: [iso(l, 0, b, S), iso(l, 0, 0, S), iso(l, h, 0, S), iso(l, h, b, S)],
    },
    {
      label: "lid",
      area: l * b,
      fill: tint(7),
      flat: rect(x0, baseY + netB + netH, netL, netB),
      folded: [iso(0, h, b, S), iso(l, h, b, S), iso(l, h, 0, S), iso(0, h, 0, S)],
    },
  ];
}

/* ---- Cylinder: rectangle + two discs ---------------------------------- */

function cylinderFaces(r: number, h: number): Face[] {
  const S = Math.min(26, 560 / (2 * Math.PI * r + 4 * r), 250 / (h + 4 * r));
  const R = r * S;
  const netH = h * S;
  const circ = 2 * Math.PI * R;
  const cx = 320;
  const cy = 190;
  const N = 20;

  /* Flat: a rectangle. Folded: the cylinder's silhouette, a rectangle capped by
     two ellipse halves. Both carry the same 42 points. */
  const flatRect: Pt[] = [[cx - circ / 2, cy - netH / 2]];
  for (let i = 0; i <= N; i += 1) flatRect.push([cx - circ / 2 + (circ * i) / N, cy - netH / 2]);
  flatRect.push([cx + circ / 2, cy + netH / 2]);
  for (let i = N; i >= 0; i -= 1) flatRect.push([cx - circ / 2 + (circ * i) / N, cy + netH / 2]);

  const foldedRect: Pt[] = [];
  const topY = cy - netH / 2;
  const botY = cy + netH / 2;
  foldedRect.push([cx - R, topY]);
  for (let i = 0; i <= N; i += 1) {
    const a = Math.PI + (Math.PI * i) / N;
    foldedRect.push([cx + R * Math.cos(a), topY + R * 0.28 * Math.sin(a)]);
  }
  foldedRect.push([cx + R, botY]);
  for (let i = N; i >= 0; i -= 1) {
    const a = (Math.PI * i) / N;
    foldedRect.push([cx + R * Math.cos(a), botY + R * 0.28 * Math.sin(a)]);
  }

  const disc = (x: number, y: number, squash: number): Pt[] =>
    Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return [x + R * Math.cos(a), y + squash * R * Math.sin(a)] as Pt;
    });

  return [
    { label: "tube", area: 2 * Math.PI * r * h, fill: tint(6), flat: flatRect, folded: foldedRect },
    {
      label: "lid",
      area: Math.PI * r * r,
      fill: tint(9),
      flat: disc(cx, topY - R - 10, 1),
      folded: disc(cx, topY, 0.28),
    },
    {
      label: "base",
      area: Math.PI * r * r,
      fill: tint(9),
      flat: disc(cx, botY + R + 10, 1),
      folded: disc(cx, botY, 0.28),
    },
  ];
}

/* ---- Cone: a sector + a disc ------------------------------------------ */

function coneFaces(r: number, l: number): Face[] {
  const S = Math.min(24, 180 / l, 520 / (l + 2 * r + 1));
  const bigR = l * S;
  const smallR = r * S;
  const sectorAngle = (2 * Math.PI * r) / l; /* radians, always < 2π */
  const cx = 300;
  const cy = 118;
  const N = 26;

  const start = Math.PI / 2 - sectorAngle / 2;
  const flat: Pt[] = [[cx, cy]];
  for (let i = 0; i <= N; i += 1) {
    const a = start + (sectorAngle * i) / N;
    flat.push([cx + bigR * Math.cos(a), cy + bigR * Math.sin(a)]);
  }

  /* Folded silhouette: apex, then the elliptical base. */
  const apexY = cy - 18;
  const baseY = cy + Math.max(96, bigR * 0.7);
  const folded: Pt[] = [[cx, apexY]];
  for (let i = 0; i <= N; i += 1) {
    const a = Math.PI + (Math.PI * i) / N;
    folded.push([cx + smallR * Math.cos(a), baseY + smallR * 0.3 * Math.sin(a)]);
  }

  const discFlat = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [cx + bigR + smallR + 24 + smallR * Math.cos(a), cy + bigR * 0.55 + smallR * Math.sin(a)] as Pt;
  });
  const discFolded = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return [cx + smallR * Math.cos(a), baseY + smallR * 0.3 * Math.sin(a)] as Pt;
  });

  return [
    { label: "lateral", area: Math.PI * r * l, fill: tint(6), flat, folded },
    { label: "base", area: Math.PI * r * r, fill: tint(9), flat: discFlat, folded: discFolded },
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

  const liveSlant = Math.max(r + 0.2, slant);

  const faces = useMemo(() => {
    if (solidId === "cube") return boxFaces(l, l, l);
    if (solidId === "cuboid") return boxFaces(l, b, h);
    if (solidId === "cylinder") return cylinderFaces(r, ch);
    return coneFaces(r, liveSlant);
  }, [solidId, l, b, h, r, ch, liveSlant]);

  const surfaceArea = faces.reduce((sum, f) => sum + f.area, 0);
  const volume =
    solidId === "cube"
      ? l ** 3
      : solidId === "cuboid"
        ? l * b * h
        : solidId === "cylinder"
          ? Math.PI * r * r * ch
          : (1 / 3) * Math.PI * r * r * Math.sqrt(Math.max(0.01, liveSlant ** 2 - r ** 2));

  /* Euler's F + V − E, tallied from the solid the net closes into. */
  const euler =
    solidId === "cube" || solidId === "cuboid"
      ? { F: 6, V: 8, E: 12 }
      : solidId === "cylinder"
        ? { F: 3, V: 0, E: 2 }
        : { F: 2, V: 1, E: 1 };

  const rows: Array<[string, string]> =
    solidId === "cube"
      ? [["Side a", `${l.toFixed(2)} u`], ["Surface area", `${(6 * l * l).toFixed(2)} u²`], ["Volume", `${(l ** 3).toFixed(2)} u³`]]
      : solidId === "cuboid"
        ? [["l, b, h", `${l.toFixed(1)}, ${b.toFixed(1)}, ${h.toFixed(1)} u`], ["Surface area", `${surfaceArea.toFixed(2)} u²`], ["Volume", `${volume.toFixed(2)} u³`]]
        : solidId === "cylinder"
          ? [["r, h", `${r.toFixed(1)}, ${ch.toFixed(1)} u`], ["Surface area", `${surfaceArea.toFixed(2)} u²`], ["Volume", `${volume.toFixed(2)} u³`]]
          : [["r, slant l", `${r.toFixed(1)}, ${liveSlant.toFixed(1)} u`], ["Surface area", `${surfaceArea.toFixed(2)} u²`], ["Volume", `${volume.toFixed(2)} u³`]];

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
          <svg viewBox="0 0 640 396" role="img" aria-label={`Net of a ${solidId}, folding into the solid`}>
            {faces.map((face) => (
              <path key={face.label} d={lerpFace(face, fold)} fill={face.fill} stroke="var(--text-main)" strokeWidth={1.6} strokeLinejoin="round" />
            ))}
            <text x={14} y={22} fontSize={11} fill="var(--text-dim)">
              {fold > 0.985 ? "folded solid — every face is the same face, moved" : "flat net — drag Fold to close it"}
            </text>
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
