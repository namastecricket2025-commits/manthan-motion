import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The anatomy of the digestive plate.
 *
 * The liver, the small intestine and the large intestine are the National
 * Institutes of Health Human Reference Atlas meshes from 3d.nih.gov. They are
 * already registered into one body frame in metres — the liver's dome at
 * y ≈ 0.45, the rectum at y ≈ −0.04, patient's left at +x, anterior at +z — so
 * they can be dropped in side by side without any fudging, and every tube and
 * every position below is written in that same frame. The plate is that frame
 * scaled by S and centred on ORIGIN; nothing outside this file needs to know.
 *
 * The stomach, oesophagus, gallbladder and pancreas are built here instead of
 * downloaded: a scaled, textured stomach scan was 4 MB on its own and its
 * proportions were rounder than the organ, and the other three are smooth
 * shapes a loft gets right at a fraction of the weight. The stomach's spine
 * still ends exactly on the pylorus the HRA small intestine starts from, which
 * is what keeps the food inside a continuous lumen.
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

/** Oesophagus: from the pharynx cut down to the cardia on the lesser curve. */
const OESO: Pt3[] = [
  [0.0, 0.612, 0.036],
  [0.001, 0.596, 0.036],
  [0.003, 0.575, 0.037],
  [0.005, 0.552, 0.038],
  [0.009, 0.53, 0.04],
  [0.014, 0.512, 0.042],
  [0.02, 0.5, 0.044],
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
  [0.03, 0.505, 0.048],
  [0.048, 0.47, 0.052],
  [0.052, 0.432, 0.056],
  [0.044, 0.398, 0.056],
  [0.02, 0.376, 0.048],
  [-0.018, 0.366, 0.042],
];
const STOMACH_R = [0.006, 0.04, 0.052, 0.044, 0.026, 0.011];

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
function swirl(center: Pt3, rx: number, ry: number, turns: number, count: number, phase: number): Pt3[] {
  const out: Pt3[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const angle = phase + t * turns * Math.PI * 2;
    const radius = 1 - 0.45 * t;
    out.push([
      center[0] + Math.cos(angle) * rx * radius,
      center[1] + Math.sin(angle) * ry * radius * 0.85,
      center[2] + Math.sin(angle * 1.5 + phase) * 0.012,
    ]);
  }
  return out;
}

const SI_ROUTE: Pt3[] = [
  SI_START,
  [-0.016, 0.353, 0.049],
  [-0.001, 0.352, 0.066],
  [-0.036, 0.323, 0.022],
  [-0.009, 0.289, 0.028],
  [0.034, 0.321, 0.037],
  ...swirl([0.051, 0.279, 0.06], 0.044, 0.05, 2.2, 14, 2.4),
  ...swirl([0.012, 0.168, 0.071], 0.036, 0.04, 1.6, 10, 0.6),
  [-0.016, 0.151, 0.043],
  [-0.044, 0.17, 0.061],
];

/** Caecum → ascending → transverse → descending → sigmoid → rectum. */
const COLON: Pt3[] = [
  [-0.055, 0.147, 0.07],
  [-0.066, 0.146, 0.07],
  [-0.078, 0.263, 0.046],
  [-0.063, 0.323, 0.059],
  [0.022, 0.314, 0.069],
  [0.099, 0.372, 0.036],
  [0.098, 0.235, 0.035],
  [0.007, 0.083, 0.034],
  [0.004, 0.05, -0.01],
  [-0.002, 0.037, -0.049],
  [0.0, 0.008, -0.058],
];

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
  options: { tubular?: number; radial?: number; squash?: number; wobble?: (t: number, angle: number) => number } = {},
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
  si: [3],
  li: [4, 5],
};

const ORGAN_LOOK: Record<string, { color: string; roughness: number; clearcoat: number }> = {
  liver: { color: "#6b3a34", roughness: 0.5, clearcoat: 0.45 },
  si: { color: "#c08a6d", roughness: 0.56, clearcoat: 0.3 },
  li: { color: "#a9765b", roughness: 0.58, clearcoat: 0.3 },
};

const ORGANS = [
  { id: "liver", url: "/models/digestive-liver.glb" },
  { id: "si", url: "/models/digestive-small-intestine.glb" },
  { id: "li", url: "/models/digestive-large-intestine.glb" },
];

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

  /* Oesophagus. Two layers, as the wall really is, so the tube has a lip at
     the pharynx cut instead of ending in mid-air. */  add(
    new THREE.Mesh(
      sweep(OESO, OESO_R, { tubular: 96, radial: 28, wobble: oesoSkin }),
      organMaterial("#a97562", 0.58, 0.28),
    ),
    [1],
  );
  /* The cut at the pharynx, closed with a rounded lip. A tube that simply stops
     in mid-air is what made this read as a pipe; an atlas cuts and rims it. */
  const pharynxRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.0134, 0.0024, 10, 30),
    organMaterial("#8e5f50", 0.52, 0.35),
  );
  pharynxRim.position.set(0, 0.6125, 0.036);
  pharynxRim.rotation.x = Math.PI / 2;
  add(pharynxRim, [0, 1]);

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

  /* Pyloric ring, so the stomach does not just taper into the intestine. */
  const pylorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.013, 0.006, 10, 26),
    organMaterial("#a06b58", 0.6, 0.3),
  );
  pylorus.position.set(-0.012, 0.368, 0.04);
  pylorus.rotation.set(Math.PI / 2, 0, 0.5);
  add(pylorus, [2]);

  add(
    new THREE.Mesh(
      sweep(PANCREAS, radii(PANCREAS_R), { tubular: 54, radial: 20, squash: 0.85 }),
      organMaterial("#c9a97a", 0.62, 0.35),
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

  /* The food. */
  const food = buildFood();
  body.add(food.root);

  const anchors: Record<string, THREE.Vector3> = {
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

/** Stream the three real meshes in and fit them to the plate's palette. */
export function loadOrgans(tract: Tract, onReady?: (id: string) => void, onFail?: (id: string) => void) {
  const loader = new GLTFLoader();
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
}

/* ------------------------------------------------------------------ */
/* the route                                                           */
/* ------------------------------------------------------------------ */

const ROUTES: Pt3[][] = [
  [
    [0.0, 0.615, 0.036],
    [0.002, 0.6, 0.036],
    [0.006, 0.57, 0.036],
    [0.012, 0.53, 0.04],
    [0.02, 0.5, 0.044],
  ],
  OESO,
  STOMACH,
  SI_ROUTE,
  COLON,
  [
    [0.004, 0.05, -0.01],
    [-0.002, 0.037, -0.049],
    [0.0, 0.018, -0.055],
    [0.0, 0.004, -0.058],
  ],
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
export const STAGE_FOOD_SIZE = [1, 1, 1.15, 0.8, 0.68, 0.58];

/** Where the camera looks for each stop, and how close it gets. */
export const STAGE_CAMERA: Array<{ at: Pt3; distance: number; azimuth: number }> = [
  { at: [0.004, 0.585, 0.036], distance: 3.6, azimuth: 0.24 },
  { at: [0.008, 0.535, 0.04], distance: 3.3, azimuth: 0.24 },
  { at: [0.035, 0.44, 0.05], distance: 3.4, azimuth: 0.3 },
  { at: [0.03, 0.24, 0.04], distance: 3.6, azimuth: 0.2 },
  { at: [0.03, 0.24, 0.0], distance: 3.9, azimuth: 0.12 },
  { at: [0.008, 0.02, -0.05], distance: 3.3, azimuth: 0.1 },
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
