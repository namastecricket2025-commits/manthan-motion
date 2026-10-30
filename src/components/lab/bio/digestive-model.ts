import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The anatomy of the digestive plate.
 *
 * The liver is the National Institutes of Health Human Reference Atlas mesh
 * from 3d.nih.gov, registered in a body frame in metres — the liver's dome at
 * y ≈ 0.45, patient's left at +x, anterior at +z. Every tube and every
 * position below is written in that same frame. The plate is that frame scaled
 * by S and centred on ORIGIN; nothing outside this file needs to know.
 *
 * The rest of the tract is modelled. The three downloaded gut scans were cut
 * surfaces, and no amount of registration makes two cut surfaces meet without
 * a seam; the old plate had open pipe ends at the cardia, pylorus, ileocaecal
 * valve and rectum. Here the mouth, pharynx, oesophagus, stomach and the whole
 * gut from pylorus to anus share radii and tangent-friendly junctions, and
 * every loft is capped. The food path uses the same centre-lines, so it cannot
 * leave the lumen.
 *
 * The food is four objects rather than one: a chewed bolus, a chyme cloud, a
 * nutrient stream and a formed stool. They cross-fade along the route, so the
 * change of form happens while the food is somewhere, not at a cut between
 * stops.
 */

/* ------------------------------------------------------------------ */
/* the body frame                                                      */
/* ------------------------------------------------------------------ */

export const S = 4.6;
const SPAN = new THREE.Vector3(0.005, 0.21, 0.02);
const ORIGIN = new THREE.Vector3(0, 1.18, 0);

export type Pt3 = [number, number, number];

/** HRA metres → the plate's scene units. */
export function toScene(p: Pt3) {
  return new THREE.Vector3(
    (p[0] - SPAN.x) * S + ORIGIN.x,
    (p[1] - SPAN.y) * S + ORIGIN.y,
    (p[2] - SPAN.z) * S + ORIGIN.z,
  );
}

/* ------------------------------------------------------------------ */
/* centre-lines, in metres                                             */
/* ------------------------------------------------------------------ */

/**
 * The mouth: lips, cavity, tongue, then the pharynx handing the bolus to the
 * top of the oesophagus. The route starts between the teeth; everything below
 * is the same tube the plate models, so the food never hops a gap between the
 * mouth and the oesophagus.
 */
const MOUTH_ROUTE: Pt3[] = [
  [0.0, 0.6515, 0.1],
  [0.0, 0.6505, 0.09],
  [0.0, 0.6475, 0.076],
  [0.0, 0.6425, 0.062],
  [0.0, 0.633, 0.052],
  [0.0, 0.621, 0.043],
  [0.0, 0.612, 0.036],
];

/** Oesophagus: from the pharynx cut down to the cardia on the lesser curve. */
const OESO: Pt3[] = [
  [0.0, 0.6115, 0.036],
  [0.001, 0.596, 0.036],
  [0.003, 0.575, 0.037],
  [0.005, 0.552, 0.038],
  [0.009, 0.53, 0.04],
  [0.014, 0.512, 0.042],
  [0.02, 0.5, 0.0445],
];

/**
 * Oesophageal calibre. A real oesophagus is not a pipe: it is widest just
 * under the pharynx, narrows through the thoracic stretch, and opens again at
 * the cardia. The rings are peristalsis, not decoration.
 */
const OESO_R = (t: number) => 0.0132 - 0.0034 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.0018 * t;
const oesoSkin = (t: number, angle: number) =>
  1 + 0.035 * Math.sin(t * Math.PI * 9) + 0.012 * Math.cos(angle * 3 + t * 4);

/**
 * The stomach's greater curvature, fundus → body → antrum → pylorus.
 *
 * The body sits 3 cm anterior to its strict position because the real liver
 * hangs in front of it: registered exactly, the liver hides all but a strip of
 * the stomach in an anterior view. Every atlas retracts or omits the liver for
 * this reason; the nudge does the same job without losing the liver. The
 * pylorus stays put, on the HRA small intestine's own first point.
 */
const STOMACH: Pt3[] = [
  [0.02, 0.5, 0.0445],
  [0.04, 0.483, 0.05],
  [0.05, 0.455, 0.054],
  [0.052, 0.43, 0.056],
  [0.044, 0.398, 0.056],
  [0.02, 0.376, 0.048],
  [-0.018, 0.366, 0.042],
];
const STOMACH_R = [0.0145, 0.027, 0.044, 0.052, 0.04, 0.023, 0.011];

const PANCREAS: Pt3[] = [
  [-0.028, 0.348, 0.0],
  [-0.006, 0.35, -0.004],
  [0.03, 0.356, -0.008],
  [0.062, 0.362, -0.012],
  [0.082, 0.368, -0.014],
];
const PANCREAS_R = [0.016, 0.013, 0.01, 0.007, 0.004];

/** Gallbladder: a pear hanging under the right lobe, neck up to the liver. */
const GALL: Pt3[] = [
  [-0.072, 0.318, 0.05],
  [-0.074, 0.305, 0.052],
  [-0.073, 0.29, 0.05],
  [-0.069, 0.28, 0.045],
];

/** The pylorus the small intestine's own mesh begins at. */
export const SI_START: Pt3 = [-0.018, 0.366, 0.042];

/**
 * The route through the gut is anchored to the HRA model's own named segments:
 * each centroid is the middle of that piece of tube, so the path is inside the
 * lumen by construction rather than by eye. The two coiled pieces (jejunum,
 * ileum) are the exception — a coil's centroid falls in the gap between its
 * loops — so those get a tight swirl sized to the piece's own bounding box.
 *
 * The point is not to reproduce six metres of tubing; it is that the food is
 * always in the gut the student is looking at, in a direction that reads.
 */
/**
 * Duodenum, jejunum and ileum as one readable coil. The old route jumped
 * between a few clusters, which the tube faithfully drew as kinks; these points
 * keep a continuous centre-line and finish exactly on the caecum, so the gut is
 * one lumen rather than a pipe shop.
 */
const SI_ROUTE: Pt3[] = [
  SI_START,
  [-0.029, 0.358, 0.05],
  [-0.04, 0.345, 0.055],
  [-0.043, 0.329, 0.05],
  [-0.035, 0.314, 0.043],
  [-0.018, 0.304, 0.038],
  [0.003, 0.303, 0.041],
  [0.019, 0.311, 0.05],
  [0.028, 0.327, 0.06],
  [0.05, 0.334, 0.068],
  [0.074, 0.321, 0.071],
  [0.09, 0.3, 0.061],
  [0.085, 0.278, 0.046],
  [0.063, 0.269, 0.036],
  [0.041, 0.278, 0.04],
  [0.037, 0.296, 0.054],
  [0.052, 0.307, 0.066],
  [0.075, 0.294, 0.072],
  [0.081, 0.272, 0.062],
  [0.068, 0.255, 0.052],
  [0.045, 0.248, 0.048],
  [0.022, 0.254, 0.055],
  [0.007, 0.238, 0.063],
  [0.021, 0.219, 0.072],
  [0.049, 0.214, 0.077],
  [0.073, 0.226, 0.073],
  [0.08, 0.247, 0.062],
  [0.064, 0.193, 0.06],
  [0.04, 0.179, 0.066],
  [0.013, 0.174, 0.071],
  [-0.012, 0.166, 0.07],
  [-0.034, 0.158, 0.071],
  [-0.053, 0.155, 0.07],
  [-0.067, 0.16, 0.067],
  [-0.076, 0.148, 0.064],
  [-0.0875, 0.1404, 0.0651],
];

/**
 * Caecum → ascending → hepatic flexure → transverse → splenic flexure →
 * descending → sigmoid. Every point is the centre of a cross-section of the
 * HRA colon mesh itself, found by taking the ring of vertices around a seed
 * and moving the seed to that ring's centre; the old hand-placed path cut the
 * corner of the descending colon and threw the bolus out through the wall.
 */
const COLON: Pt3[] = [
  [-0.0875, 0.1404, 0.0651],
  [-0.0667, 0.1949, 0.0554],
  [-0.0798, 0.2534, 0.0525],
  [-0.0532, 0.2993, 0.0518],
  [-0.0177, 0.3081, 0.0873],
  [0.0408, 0.3161, 0.0825],
  [0.0878, 0.3418, 0.0688],
  [0.0969, 0.3483, 0.0197],
  [0.1031, 0.2884, 0.0146],
  [0.0927, 0.2306, 0.0289],
  [0.0872, 0.1725, 0.0434],
  [0.0676, 0.1166, 0.0544],
  [0.0216, 0.0802, 0.056],
  [-0.0059, 0.081, 0.0082],
];

/** The rectum and anal canal, handed on from the sigmoid without a jump. */
const RECTUM: Pt3[] = [
  [-0.0059, 0.081, 0.0082],
  [0.0012, 0.0495, -0.0499],
  [0.0016, -0.0109, -0.0634],
];

/**
 * The gut from the pylorus to the anus. The small intestine, colon and rectum
 * are sections of one centre-line, so there is no cut face where one scan
 * ended and another began. The old plate stitched three NIH meshes together
 * and the seams were exactly what the eye found first.
 */
const GUT: Pt3[] = [...SI_ROUTE, ...COLON.slice(1), ...RECTUM.slice(1)];

const SI_SHARE = (SI_ROUTE.length - 1) / (GUT.length - 1);
const COLON_SHARE = (SI_ROUTE.length + COLON.length - 2) / (GUT.length - 1);

function smoothstep(value: number) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

/**
 * The calibre changes are the anatomy: narrow duodenum, wider ileum, a broad
 * colon, then a short taper into the anal canal. Both transitions are blended
 * over a few millimetres instead of stepping at a boundary, because a step in
 * radius is a visible ring no matter how well the centres line up.
 */
function gutRadius(t: number) {
  const small = 0.0105 + 0.0035 * Math.min(1, t / 0.035) + 0.0007 * Math.sin(t * 42);
  const colon = 0.0245 + 0.0032 * Math.sin(t * 19.5) + 0.0014 * Math.sin(t * 61);
  const intoColon = smoothstep((t - SI_SHARE + 0.012) / 0.0265);
  const intoRectum = smoothstep((t - COLON_SHARE + 0.008) / 0.018);
  const large = small * (1 - intoColon) + colon * intoColon;
  const rectum = 0.018 - (0.018 - 0.0105) * Math.min(1, Math.max(0, (t - COLON_SHARE) / (1 - COLON_SHARE)));
  return large * (1 - intoRectum) + rectum * intoRectum;
}

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

function organMaterial(color: string, roughness = 0.55, clearcoat = 0.35) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.42,
    side: THREE.DoubleSide,
  });
}

function radii(values: number[]) {
  return (t: number) => {
    const x = Math.min(0.9999, Math.max(0, t)) * (values.length - 1);
    const index = Math.floor(x);
    const f = x - index;
    const a = values[index];
    const b = values[Math.min(values.length - 1, index + 1)];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

export function curveOf(points: Pt3[], tension = 0.2) {
  return new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    tension,
  );
}

/**
 * Sweep a section along a centre-line. `radius` and `wobble` both take the
 * distance along the curve, so a stomach can swell and taper, and the rugae
 * can fade out at the two sphincters instead of ringing the pylorus.
 */
function sweep(
  points: Pt3[],
  radius: number | ((t: number) => number),
  options: {
    tubular?: number;
    radial?: number;
    squash?: number;
    wobble?: (t: number, angle: number) => number;
    /** Close the tube at each end. An open loft reads as a cut pipe. */
    caps?: boolean;
  } = {},
) {
  const curve = curveOf(points, 0.18);
  const tubular = options.tubular ?? 120;
  const radial = options.radial ?? 16;
  const at = typeof radius === "function" ? radius : () => radius;
  const frames = curve.computeFrenetFrames(tubular, false);
  const spaced = curve.getSpacedPoints(tubular);
  const positions: number[] = [];
  const indices: number[] = [];
  const squash = options.squash ?? 1;

  for (let i = 0; i <= tubular; i += 1) {
    const t = i / tubular;
    const base = at(t);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const center = spaced[i];
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const r = base * (options.wobble ? options.wobble(t, angle) : 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle) * squash;
      positions.push(
        center.x + (normal.x * cos + binormal.x * sin) * r,
        center.y + (normal.y * cos + binormal.y * sin) * r,
        center.z + (normal.z * cos + binormal.z * sin) * r,
      );
    }
  }

  for (let i = 0; i < tubular; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }

  if (options.caps !== false) {
    /* A flat fan closes the tube. It sits inside the next organ at every
       junction, so it is the back of a sleeve, not a visible lid. */
    for (const end of [0, tubular]) {
      const ring = end * radial;
      const center = spaced[end];
      const centreIndex = positions.length / 3;
      positions.push(center.x, center.y, center.z);
      for (let j = 0; j < radial; j += 1) {
        const a = ring + j;
        const b = ring + ((j + 1) % radial);
        if (end === 0) indices.push(centreIndex, a, b);
        else indices.push(centreIndex, b, a);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------------ */
/* the food                                                            */
/* ------------------------------------------------------------------ */

export type FoodForm = "bolus" | "chyme" | "nutrients" | "waste";

export type FoodRig = {
  root: THREE.Group;
  set: (weights: Record<FoodForm, number>, position: THREE.Vector3, size: number, t: number) => void;
};

function lumpy(radius: number, seed: number) {
  const geometry = new THREE.SphereGeometry(radius, 26, 20);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const n =
      1 +
      0.16 * Math.sin(v.x * 34 + seed) * Math.cos(v.y * 29 - seed) +
      0.12 * Math.sin(v.z * 41 + seed * 2.1);
    v.multiplyScalar(n);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function cloud(count: number, spread: number, radius: number, seed: number, color: string, opacity: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const geometry = new THREE.SphereGeometry(radius, 10, 8);
  for (let i = 0; i < count; i += 1) {
    const a = i * 2.399 + seed;
    const r = spread * Math.sqrt((i + 0.5) / count);
    const dot = new THREE.Mesh(geometry, material);
    const y = Math.sin(a) * r * 0.7;
    dot.position.set(Math.cos(a) * r * 0.9, y, Math.cos(a * 1.7) * r * 0.55);
    dot.userData.y = y;
    group.add(dot);
  }
  return group;
}

function buildFood(): FoodRig {
  const root = new THREE.Group();
  root.renderOrder = 3;

  const bolusMaterial = new THREE.MeshStandardMaterial({
    color: "#c49a63",
    roughness: 0.62,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  /* Sizes are lumen sizes, not marker sizes: a chewed bolus is about 17 mm
     across and the oesophagus is 23, so the food fits the tube carrying it
     instead of swallowing it. */
  const bolus = new THREE.Mesh(lumpy(0.0085, 1.7), bolusMaterial);

  const chyme = cloud(9, 0.014, 0.004, 0.4, "#a58447", 0.9);

  const nutrientMaterial = new THREE.MeshStandardMaterial({
    color: "#e8c98a",
    roughness: 0.28,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  const nutrients = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const a = i * 2.399;
    const r = 0.004 + 0.009 * Math.sqrt(i / 6);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 8, 6), nutrientMaterial);
    dot.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, Math.sin(a * 1.9) * 0.006);
    nutrients.add(dot);
  }

  const wasteMaterial = new THREE.MeshStandardMaterial({
    color: "#8f6a44",
    roughness: 0.78,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  /* Two beads, 12 mm across, 21 mm long: the anal canal is about 25 mm, and the
     old three 28 mm spheres hung outside the rectum, which is what made the
     last stop look fake. */
  const waste = new THREE.Group();
  for (let i = 0; i < 2; i += 1) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 14, 10), wasteMaterial);
    bead.scale.set(1, 0.92, 0.92);
    bead.position.y = (i - 0.5) * 0.0115;
    waste.add(bead);
  }

  const forms: Array<[FoodForm, THREE.Object3D]> = [
    ["bolus", bolus],
    ["chyme", chyme],
    ["nutrients", nutrients],
    ["waste", waste],
  ];
  for (const [, object] of forms) root.add(object);
  root.visible = false;

  const scaleOf: Record<FoodForm, number> = { bolus: 1, chyme: 1, nutrients: 1, waste: 1 };

  return {
    root,
    set(weights, position, size, t) {
      root.position.copy(position);
      root.visible = true;
      for (const [id, object] of forms) {
        const w = Math.max(0, Math.min(1, weights[id]));
        object.visible = w > 0.01;
        const target = w * size * scaleOf[id];
        object.scale.setScalar(object.scale.x + (target - object.scale.x) * 0.16);
        /* A slow tumble keeps the mass reading as a solid object rather than a
           marker, without ever showing its seam. */
        object.rotation.y = t * 0.6 + (id === "waste" ? 0.4 : 0);
        object.rotation.x = Math.sin(t * 0.8) * 0.18;
      }
      /* The chyme cloud breathes without wandering: the offset is computed
         from the rest position every frame, never accumulated. */
      chyme.children.forEach((child, i) => {
        child.position.y = (child.userData.y as number) + Math.sin(t * 2.2 + i) * 0.0012;
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

export type FadeEntry = { material: THREE.Material; stages: number[] };

export type Tract = {
  group: THREE.Group;
  body: THREE.Group;
  fading: FadeEntry[];
  food: FoodRig;
  anchors: Record<string, THREE.Vector3>;
};

const ORGAN_FADE: Record<string, number[]> = {
  liver: [2],
};

const ORGAN_LOOK: Record<string, { color: string; roughness: number; clearcoat: number }> = {
  liver: { color: "#6b3a34", roughness: 0.5, clearcoat: 0.45 },
};

/* The liver is a real HRA scan. The gut is modelled as one tube instead of
   three scans: the scans are cut surfaces, and a cut surface cannot be joined
   to another cut surface without a seam. */
const ORGANS = [{ id: "liver", url: "/models/digestive-liver.glb" }];

export function buildTract(): Tract {
  const group = new THREE.Group();
  group.scale.setScalar(S);
  group.position.set(
    ORIGIN.x - SPAN.x * S,
    ORIGIN.y - SPAN.y * S,
    ORIGIN.z - SPAN.z * S,
  );

  const body = new THREE.Group();
  group.add(body);

  const fading: FadeEntry[] = [];
  const add = (mesh: THREE.Mesh, stages: number[] = []) => {
    body.add(mesh);
    fading.push({ material: mesh.material as THREE.Material, stages });
    return mesh;
  };

  /* Oesophagus, from the pharynx down to the cardia. Its first point is where
     the mouth's pharynx ends, so the two tubes share one lumen. */
  add(
    new THREE.Mesh(
      sweep(OESO, OESO_R, { tubular: 96, radial: 28, wobble: oesoSkin }),
      organMaterial("#a97562", 0.58, 0.28),
    ),
    [1],
  );
  /* The mouth, cut open. An oval face with the cavity bored through it, teeth
     on the rim, the tongue on the floor, and a short pharynx that meets the
     oesophagus at its own first point — so the bolus starts between the teeth
     and stays inside flesh all the way down. Modelled in the plate's own
     frame rather than drawn in a corner of the screen. */
  const mouth = new THREE.Group();
  const face = new THREE.Shape();
  face.absellipse(0, 0, 0.038, 0.0265, 0, Math.PI * 2);
  const cavity = new THREE.Path();
  cavity.absellipse(0, -0.0008, 0.0275, 0.0148, 0, Math.PI * 2, true);
  face.holes.push(cavity);
  const mouthWall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(face, {
      depth: 0.042,
      bevelEnabled: true,
      bevelSize: 0.0034,
      bevelThickness: 0.0034,
      bevelSegments: 3,
      curveSegments: 22,
    }),
    organMaterial("#a97562", 0.6, 0.22),
  );
  mouthWall.position.set(0, 0.6555, 0.06);
  mouth.add(mouthWall);

  const toothMaterial = organMaterial("#e6d9c7", 0.52, 0.2);
  const toothGeometry = new THREE.SphereGeometry(1, 12, 9);
  for (const side of [1, -1]) {
    for (let i = 0; i < 8; i += 1) {
      const x = -0.021 + (i / 7) * 0.042;
      const lift = Math.sqrt(Math.max(0, 1 - (x / 0.0275) ** 2)) * 0.0125;
      const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
      tooth.scale.set(0.0041, 0.0054, 0.0033);
      tooth.position.set(x, 0.6555 + side * lift, 0.0985);
      mouth.add(tooth);
    }
  }

  /* The back of the throat. Without it the open mouth is a hole straight
     through the head; with it the cavity has a floor and the pharynx begins
     inside flesh. */
  const throatBack = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    organMaterial("#4d292b", 0.84, 0.04),
  );
  throatBack.scale.set(0.029, 0.019, 0.009);
  throatBack.position.set(0, 0.649, 0.041);
  mouth.add(throatBack);

  const gums = new THREE.Mesh(
    new THREE.TorusGeometry(0.0262, 0.0022, 8, 36),
    organMaterial("#9b5a56", 0.6, 0.18),
  );
  gums.position.set(0, 0.6555, 0.0955);
  gums.scale.set(1.2, 0.88, 1);
  mouth.add(gums);

  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), organMaterial("#b0716b", 0.5, 0.3));
  tongue.scale.set(0.019, 0.0064, 0.019);
  tongue.position.set(0, 0.6452, 0.082);
  mouth.add(tongue);

  const uvula = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 10), organMaterial("#b0716b", 0.5, 0.3));
  uvula.scale.set(0.7, 1.4, 0.7);
  uvula.position.set(0, 0.6645, 0.0635);
  mouth.add(uvula);

  const lips = new THREE.Mesh(
    new THREE.TorusGeometry(0.030, 0.0038, 10, 40),
    organMaterial("#8f5b4e", 0.5, 0.32),
  );
  lips.position.set(0, 0.6555, 0.1035);
  lips.scale.set(1.2, 0.88, 1);
  mouth.add(lips);

  body.add(mouth);

  const pharynx = new THREE.Mesh(
    sweep(
      [
        [0.0, 0.648, 0.056],
        [0.0, 0.638, 0.052],
        [0.0, 0.624, 0.044],
        [0.0, 0.6115, 0.036],
      ],
      (t) => 0.0192 - 0.005 * t,
      { tubular: 44, radial: 22 },
    ),
    organMaterial("#a97562", 0.6, 0.22),
  );
  add(pharynx, [0]);

  /* The stomach. The wobble is rugae: six soft folds that fade out at both
     sphincters, which is what keeps the fundus smooth and the pylorus tight. */
  const stomach = new THREE.Mesh(
    sweep(STOMACH, radii(STOMACH_R), {
      squash: 0.8,
      tubular: 132,
      radial: 44,
      wobble: (t, angle) => {
        const fade = Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 1.4;
        return 1 + 0.026 * Math.sin(angle * 6 + t * 2.2) * fade;
      },
    }),
    organMaterial("#b3806a", 0.56, 0.42),
  );
  add(stomach, [2]);

  /* The cardia and pylorus are the only two places where two separate tubes
     meet. A ring at each hides the join and is anatomically the sphincter that
     is actually there. */
  const orient = (object: THREE.Object3D, from: Pt3, to: Pt3) => {
    const direction = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  };

  const cardia = new THREE.Mesh(
    new THREE.TorusGeometry(0.0175, 0.0035, 10, 30),
    organMaterial("#a06b58", 0.6, 0.3),
  );
  cardia.position.set(0.02, 0.5, 0.0445);
  orient(cardia, OESO[OESO.length - 2], OESO[OESO.length - 1]);
  add(cardia, [1, 2]);

  /* One continuous gut: duodenum → jejunum → ileum → caecum → colon →
     rectum. Every section shares the same centre-line, so there is no seam for
     the food to cross and no cut pipe for the eye to find. */
  const gut = new THREE.Mesh(
    sweep(GUT, gutRadius, {
      tubular: 340,
      radial: 26,
      wobble: (t, angle) => {
        const haustra = smoothstep((t - SI_SHARE + 0.012) / 0.03);
        return 1 + 0.03 * Math.sin(angle * 9 + t * 58) * haustra;
      },
    }),
    organMaterial("#b97c63", 0.54, 0.36),
  );
  add(gut, [3, 4, 5]);

  /* Pyloric ring at the exact point where the stomach hands over to the
     duodenum, turned along the gut's own tangent. */
  const pylorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.0125, 0.005, 10, 30),
    organMaterial("#a06b58", 0.6, 0.3),
  );
  pylorus.position.set(...SI_START);
  orient(pylorus, SI_ROUTE[0], SI_ROUTE[1]);
  add(pylorus, [2]);

  add(
    new THREE.Mesh(
      sweep(PANCREAS, radii(PANCREAS_R), { tubular: 54, radial: 20, squash: 0.85 }),
      organMaterial("#c9a97a", 0.62, 0.35),
    ),
    [2],
  );
  /* The pancreatic duct is the physical reason the gland belongs to the
     duodenum; without it the tail floats near the gut like a prop. */
  add(
    new THREE.Mesh(
      sweep(
        [PANCREAS[0], [-0.03, 0.344, 0.018], [-0.036, 0.337, 0.035], [-0.04, 0.332, 0.044]],
        0.0028,
        { tubular: 46, radial: 10 },
      ),
      organMaterial("#d8c39a", 0.55, 0.2),
    ),
    [2],
  );

  add(
    new THREE.Mesh(
      sweep(
        GALL,
        radii([0.008, 0.016, 0.014, 0.006]),
        { tubular: 34, radial: 20 },
      ),
      organMaterial("#7f8a5f", 0.44, 0.5),
    ),
  );
  /* Cystic duct + common bile duct, from the gallbladder neck to the duodenum. */
  add(
    new THREE.Mesh(
      sweep(
        [
          GALL[GALL.length - 1],
          [-0.062, 0.3, 0.05],
          [-0.052, 0.32, 0.051],
          [-0.042, 0.337, 0.048],
          [-0.037, 0.344, 0.045],
        ],
        0.0024,
        { tubular: 54, radial: 10 },
      ),
      organMaterial("#818854", 0.48, 0.3),
    ),
    [2],
  );

  /* The food. */
  const food = buildFood();
  body.add(food.root);

  const anchors: Record<string, THREE.Vector3> = {
    mouth: new THREE.Vector3(0.0, 0.653, 0.086),
    oesophagus: new THREE.Vector3(0.004, 0.56, 0.038),
    stomach: new THREE.Vector3(0.052, 0.45, 0.078),
    pylorus: new THREE.Vector3(-0.014, 0.368, 0.042),
    pancreas: new THREE.Vector3(0.05, 0.362, -0.012),
    gallbladder: new THREE.Vector3(-0.073, 0.3, 0.052),
    liver: new THREE.Vector3(-0.07, 0.4, 0.09),
    small: new THREE.Vector3(0.06, 0.235, 0.1),
    large: new THREE.Vector3(0.118, 0.3, -0.005),
    rectum: new THREE.Vector3(0.001, -0.02, -0.072),
  };

  return { group, body, fading, food, anchors };
}

/** Stream the liver in and fit it to the plate's palette. */
export function loadOrgans(tract: Tract, onReady?: (id: string) => void, onFail?: (id: string) => void) {
  const loader = new GLTFLoader();
  const pending = ORGANS.length;
  for (const organ of ORGANS) {
    loader.load(
      organ.url,
      (gltf) => {
        const look = ORGAN_LOOK[organ.id];
        const material = organMaterial(look.color, look.roughness, look.clearcoat);
        /* The plate already has its tubes and its food up; the scanned organs
           ease in from nothing as they arrive, one material per organ so the
           whole organ fades at one rate. */
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          const geometry = mesh.geometry as THREE.BufferGeometry;
          if (!geometry.attributes.normal) geometry.computeVertexNormals();
          mesh.material = material;
          mesh.frustumCulled = false;
        });
        tract.body.add(gltf.scene);
        tract.fading.push({ material, stages: ORGAN_FADE[organ.id] ?? [] });
        onReady?.(organ.id);
      },
      undefined,
      () => onFail?.(organ.id),
    );
  }
  return pending;
}

/* ------------------------------------------------------------------ */
/* the route                                                           */
/* ------------------------------------------------------------------ */

const ROUTES: Pt3[][] = [
  MOUTH_ROUTE,
  OESO,
  STOMACH,
  SI_ROUTE,
  COLON,
  RECTUM,
];

export const STAGE_CURVES = ROUTES.map((points, index) =>
  index === 5
    ? curveOf(points, 0.12)
    : curveOf(points, index === 3 ? 0.12 : 0.2),
);

/**
 * Food size at each stop, relative to life size. The gut narrows as it goes, so
 * a bolus that fits the oesophagus has to shrink again for the terminal colon
 * and the anal canal — otherwise it hangs outside the organ it is inside.
 */
export const STAGE_FOOD_SIZE = [0.95, 0.85, 1.15, 0.7, 0.62, 0.52];

/** Where the camera looks for each stop, and how close it gets. */
export const STAGE_CAMERA: Array<{ at: Pt3; distance: number; azimuth: number }> = [
  { at: [0.0, 0.648, 0.07], distance: 0.85, azimuth: 0.2 },
  { at: [0.006, 0.555, 0.04], distance: 2.2, azimuth: 0.24 },
  { at: [0.035, 0.44, 0.05], distance: 3.4, azimuth: 0.3 },
  { at: [0.03, 0.24, 0.04], distance: 3.6, azimuth: 0.2 },
  { at: [0.03, 0.24, 0.0], distance: 3.9, azimuth: 0.12 },
  { at: [0.0, 0.02, -0.05], distance: 3.3, azimuth: 0.1 },
];

/**
 * How much of each form a given point in the run is. The stomach and the small
 * intestine are where the food changes, so the keys sit inside those stages.
 */
export const FORM_KEYS: Array<{ at: number; w: Partial<Record<FoodForm, number>> }> = [
  { at: 0.0, w: { bolus: 1 } },
  { at: 0.34, w: { bolus: 1 } },
  { at: 0.4, w: { bolus: 0.55, chyme: 0.45 } },
  { at: 0.47, w: { chyme: 1 } },
  { at: 0.62, w: { chyme: 1 } },
  { at: 0.7, w: { chyme: 0.35, nutrients: 0.65 } },
  { at: 0.78, w: { nutrients: 0.8, waste: 0.2 } },
  { at: 0.86, w: { waste: 1 } },
  { at: 1.0, w: { waste: 1 } },
];

export function formWeights(at: number): Record<FoodForm, number> {
  const clamped = Math.max(0, Math.min(1, at));
  let a = FORM_KEYS[0];
  let b = FORM_KEYS[FORM_KEYS.length - 1];
  for (let i = 0; i < FORM_KEYS.length - 1; i += 1) {
    if (clamped >= FORM_KEYS[i].at && clamped <= FORM_KEYS[i + 1].at) {
      a = FORM_KEYS[i];
      b = FORM_KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, b.at - a.at);
  const k = Math.max(0, Math.min(1, (clamped - a.at) / span));
  const s = k * k * (3 - 2 * k);
  const out: Record<FoodForm, number> = { bolus: 0, chyme: 0, nutrients: 0, waste: 0 };
  for (const id of Object.keys(out) as FoodForm[]) {
    out[id] = (a.w[id] ?? 0) * (1 - s) + (b.w[id] ?? 0) * s;
  }
  return out;
}
