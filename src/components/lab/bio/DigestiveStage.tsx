import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { useStillMotion } from "@/lib/motion";

/**
 * The digestive plate.
 *
 * This one is a journey rather than a structure: food is followed from the
 * mouth to the rectum, and every stop changes what the food *is* — bolus,
 * chyme, absorbed nutrients, waste. The tract is built in code (tubes swept
 * along anatomical centre-lines, a liver blob, a gallbladder, a pancreas), so
 * there is no model to stream and the food can follow the exact same curve the
 * organ was built around. That is why the bolus never drifts out of the tube it
 * is supposed to be inside.
 *
 * The organ holding the food fades to a third of its opacity while the rest
 * stay solid, so the bolus is visible without making the whole model ghostly.
 * Everything is one WebGL stage with orbit, zoom and pan, and the journey is
 * driven by one clock: six stages, six real durations, one compressed run.
 *
 * The panel is deliberately not a second copy of the rail. The rail says where
 * the food is; the panel says what is happening there, what it is called now,
 * how long it really takes, and the two questions that stop makes a student
 * ask. Same type, same hairlines, same cards as the other biology plates.
 */

type Stage = {
  id: string;
  name: string;
  short: string;
  /** Real time spent at this stop. The animation is not this. */
  duration: string;
  /** What the food is called here. */
  form: string;
  absorbs: string;
  what: string;
  qa: Array<{ q: string; a: string }>;
  /** Seconds of animation for this stage. */
  seconds: number;
};

const STAGES: Stage[] = [
  {
    id: "mouth",
    name: "Mouth",
    short: "Mouth",
    duration: "≈ 30 s",
    form: "Bolus",
    absorbs: "Nothing — digestion starts",
    what: "Teeth cut and grind while saliva wets the food and its amylase begins breaking starch into sugars. The tongue shapes the mass into a bolus and pushes it to the back of the mouth.",
    qa: [
      {
        q: "Why doesn't food go down the windpipe?",
        a: "The epiglottis folds over the larynx during the swallow, and the bolus is steered into the oesophagus behind it. Talking while swallowing is what defeats that flap.",
      },
      {
        q: "Why does saliva matter?",
        a: "It lubricates the bolus and starts starch digestion. Without it, dry food is genuinely hard to swallow — which is why you produce about a litre a day.",
      },
    ],
    seconds: 2.6,
  },
  {
    id: "oesophagus",
    name: "Oesophagus",
    short: "Oesophagus",
    duration: "≈ 8 s",
    form: "Bolus",
    absorbs: "Nothing — transport",
    what: "Not a slide. A ring of circular muscle behind the bolus squeezes while the longitudinal layer ahead shortens, so a wave — peristalsis — carries it down. Gravity helps, but you can swallow lying down, or upside down.",
    qa: [
      {
        q: "How does it move without gravity?",
        a: "Peristalsis. The tube's muscle layers make a travelling contraction; the bolus is pushed, not dropped.",
      },
      {
        q: "Why doesn't it come back up?",
        a: "The lower oesophageal sphincter stays closed except during a swallow. Reflux is that valve opening when it should not.",
      },
    ],
    seconds: 1.7,
  },
  {
    id: "stomach",
    name: "Stomach",
    short: "Stomach",
    duration: "2–4 h",
    form: "Chyme",
    absorbs: "Water, alcohol, some drugs",
    what: "Acid at pH 1.5–3.5 unfolds proteins and pepsin starts cutting them. Three muscle layers churn the bolus into chyme, and the pylorus lets it out a spoonful at a time.",
    qa: [
      {
        q: "Why doesn't acid digest the stomach?",
        a: "The lining secretes a bicarbonate-rich mucus and replaces its cells every few days. The acid is dangerous to that lining — an ulcer is what happens when the protection fails.",
      },
      {
        q: "Why does food stay so long?",
        a: "The pylorus meters chyme out by particle size. Fat slows emptying, which is why a rich meal keeps you full for hours.",
      },
    ],
    seconds: 3.2,
  },
  {
    id: "small",
    name: "Small intestine",
    short: "Small intestine",
    duration: "4–6 h",
    form: "Chyme → nutrients",
    absorbs: "≈ 90% of nutrients and most water",
    what: "The duodenum neutralises acid with bicarbonate and receives bile and pancreatic enzymes. Villi and microvilli give about 250 m² of absorbing surface; amino acids, sugars and fats cross into blood and lymph here.",
    qa: [
      {
        q: "Why is it so long?",
        a: "Area and time. Six to seven metres folded into the abdomen, with villi on top, is what it takes to absorb a day's food.",
      },
      {
        q: "Where does bile come from?",
        a: "The liver makes it, the gallbladder stores it, and the duodenum receives it to emulsify fat into droplets the enzymes can attack.",
      },
    ],
    seconds: 3.4,
  },
  {
    id: "large",
    name: "Large intestine",
    short: "Large intestine",
    duration: "12–48 h",
    form: "Waste",
    absorbs: "Water and electrolytes",
    what: "What is left is mostly fibre, bacteria and water. The colon reclaims the water and salts, its haustral pouches knead the residue, and gut bacteria ferment fibre and make vitamin K and some B vitamins.",
    qa: [
      {
        q: "Why does it take so long?",
        a: "Water recovery is slow. The longer the transit, the drier the stool — which is why the colon is where constipation happens.",
      },
      {
        q: "Why is it segmented?",
        a: "The haustra are pouches between the taeniae coli. They knead and hold the contents instead of pushing them steadily along.",
      },
    ],
    seconds: 3.0,
  },
  {
    id: "rectum",
    name: "Rectum",
    short: "Rectum",
    duration: "Minutes to hours",
    form: "Faeces",
    absorbs: "Water, before storage",
    what: "The rectum stores the waste until stretch receptors signal fullness. The internal sphincter is involuntary; the external one is skeletal muscle you control, which is what buys the time to find a bathroom.",
    qa: [
      {
        q: "Why can it wait?",
        a: "Two sphincters: one smooth muscle that opens reflexively, one you control. The cortex can hold the second shut for a while.",
      },
      {
        q: "What happens if you hold it too long?",
        a: "The colon keeps reclaiming water, so the stool hardens. The signal also fades, which is how people lose the urge.",
      },
    ],
    seconds: 1.7,
  },
];

const ACCESSORY = [
  {
    name: "Liver",
    color: "#7a4137",
    note: "makes bile and processes everything the gut absorbs.",
  },
  {
    name: "Gallbladder",
    color: "#87916a",
    note: "stores bile and squeezes it into the duodenum when fat arrives.",
  },
  {
    name: "Pancreas",
    color: "#c4a06a",
    note: "sends bicarbonate and enzymes for fat, protein and starch.",
  },
];

/* ------------------------------------------------------------------ */
/* the anatomy, as centre-lines                                        */
/* ------------------------------------------------------------------ */

type Pt3 = [number, number, number];

const MOUTH_PATH: Pt3[] = [
  [0, 2.6, 0.62],
  [0, 2.6, 0.44],
  [0, 2.6, 0.24],
  [0, 2.56, 0.06],
  [0, 2.5, -0.04],
  [0, 2.44, 0],
];
const PHARYNX_PATH: Pt3[] = [
  [0, 2.52, -0.08],
  [0, 2.47, -0.02],
  [0, 2.43, 0],
];
const OESO_PATH: Pt3[] = [
  [0, 2.44, 0],
  [0.01, 2.3, 0],
  [0.02, 2.12, 0.01],
  [0.035, 1.94, 0.02],
  [0.05, 1.8, 0.03],
];
const STOMACH_PATH: Pt3[] = [
  [0.05, 1.8, 0.03],
  [-0.04, 1.86, 0.04],
  [-0.21, 1.74, 0.03],
  [-0.27, 1.52, 0.01],
  [-0.2, 1.32, 0],
  [-0.03, 1.18, 0],
  [0.17, 1.16, 0],
];
const STOMACH_RADII = [0.075, 0.16, 0.25, 0.27, 0.23, 0.15, 0.07];
const DUODENUM_PATH: Pt3[] = [
  [0.17, 1.16, 0],
  [0.33, 1.12, -0.02],
  [0.45, 1.02, -0.03],
  [0.47, 0.9, -0.02],
  [0.4, 0.81, 0.02],
  [0.28, 0.76, 0.08],
];

/**
 * The small intestine as a packed serpentine. Each row runs across the
 * abdomen and turns into the next; the rows alternate depth so the coil reads
 * as a volume rather than as a flat zigzag. The path is also the food's path.
 */
function coilPath(): Pt3[] {
  const points: Pt3[] = [[0.28, 0.76, 0.08]];
  const rows = 6;
  for (let row = 0; row < rows; row += 1) {
    const y = 0.74 - row * 0.085;
    const z = row % 2 === 0 ? 0.12 : -0.08;
    const startX = row === 0 ? 0.24 : row % 2 === 0 ? 0.5 : -0.5;
    const endX = startX > 0 ? -0.5 : 0.5;
    if (row === 0) points.push([startX, y, z]);
    points.push(
      [(startX + endX) / 2, y + 0.015, z + 0.01],
      [endX, y, z],
    );
    if (row < rows - 1) {
      const turn = endX > 0 ? 0.575 : -0.575;
      const nextZ = row % 2 === 0 ? -0.08 : 0.12;
      points.push(
        [turn, y - 0.03, z],
        [turn, y - 0.055, (z + nextZ) / 2],
        [endX, y - 0.08, nextZ],
      );
    }
  }
  points.push([0.58, 0.27, 0.02]);
  return points;
}

const SI_PATH = coilPath();

const COLON_PATH: Pt3[] = [
  [0.63, 0.27, 0.02],
  [0.72, 0.38, 0.04],
  [0.79, 0.54, 0.05],
  [0.81, 0.7, 0.06],
  [0.8, 0.83, 0.07],
  [0.75, 0.91, 0.08],
  [0.6, 0.94, 0.09],
  [0.36, 0.95, 0.1],
  [0.1, 0.95, 0.1],
  [-0.16, 0.94, 0.1],
  [-0.4, 0.93, 0.09],
  [-0.62, 0.91, 0.08],
  [-0.76, 0.83, 0.07],
  [-0.81, 0.69, 0.05],
  [-0.8, 0.52, 0.03],
  [-0.76, 0.36, 0.01],
  [-0.67, 0.23, 0],
  [-0.53, 0.1, 0],
  [-0.35, 0, 0.01],
  [-0.16, -0.07, 0.01],
  [0, -0.13, 0.02],
];
const RECTUM_PATH: Pt3[] = [
  [0, -0.13, 0.02],
  [0, -0.28, 0.01],
  [0, -0.44, 0],
  [0, -0.54, 0],
];
const PANCREAS_PATH: Pt3[] = [
  [0.12, 1.06, -0.16],
  [0.3, 1.04, -0.18],
  [0.5, 1.02, -0.16],
  [0.68, 0.97, -0.1],
];
const GALL_PATH: Pt3[] = [
  [-0.21, 1.55, 0.19],
  [-0.225, 1.47, 0.2],
  [-0.24, 1.4, 0.18],
  [-0.25, 1.35, 0.15],
];

const JOURNEY_PATHS = [
  MOUTH_PATH,
  OESO_PATH,
  STOMACH_PATH,
  [...DUODENUM_PATH, ...SI_PATH],
  COLON_PATH,
  RECTUM_PATH,
];

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

function organMaterial(color: string, roughness = 0.58, clearcoat = 0.3) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.45,
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

function curveOf(points: Pt3[], tension = 0.22) {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    "catmullrom",
    tension,
  );
}

/**
 * Sweep a circular section along a centre-line. TubeGeometry has one radius;
 * a stomach, a tapering duodenum and a pancreas all need a radius that changes
 * with distance, so this rebuilds the ring by hand. DoubleSide on the material
 * makes the result independent of the frame's winding.
 */
function sweep(
  points: Pt3[],
  radius: number | ((t: number) => number),
  options: { tubular?: number; radial?: number; squash?: number } = {},
) {
  const curve = curveOf(points, 0.18);
  const tubular = options.tubular ?? 120;
  const radial = options.radial ?? 14;
  const at = typeof radius === "function" ? radius : () => radius;
  const frames = curve.computeFrenetFrames(tubular, false);
  const spaced = curve.getSpacedPoints(tubular);
  const positions: number[] = [];
  const indices: number[] = [];
  const squash = options.squash ?? 1;

  for (let i = 0; i <= tubular; i += 1) {
    const t = i / tubular;
    const r = at(t);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const center = spaced[i];
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
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

/** An organic lobe: a sphere with a soft ripple, then scaled to the organ. */
function blob(rx: number, ry: number, rz: number, seed: number) {
  const geometry = new THREE.SphereGeometry(1, 36, 26);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const ripple =
      1 +
      0.05 * Math.sin(v.x * 5.2 + seed) * Math.cos(v.y * 4.1 - seed) +
      0.025 * Math.sin(v.z * 7.3 + seed * 1.6);
    v.multiplyScalar(ripple);
    position.setXYZ(i, v.x * rx, v.y * ry, v.z * rz);
  }
  geometry.computeVertexNormals();
  return geometry;
}

type FadeEntry = { mesh: THREE.Mesh; stages: number[] };

function buildTract() {
  const group = new THREE.Group();
  const fading: FadeEntry[] = [];

  const add = (mesh: THREE.Mesh, stages: number[] = []) => {
    group.add(mesh);
    fading.push({ mesh, stages });
    return mesh;
  };

  /* Mouth: lips, dental arches, tongue and the dark cavity behind them. */
  const lips = new THREE.Mesh(
    new THREE.TorusGeometry(0.285, 0.055, 14, 44),
    organMaterial("#b0716a", 0.5, 0.5),
  );
  lips.position.set(0, 2.6, 0.16);
  lips.scale.set(1, 0.74, 1);
  group.add(lips);

  const cavity = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    organMaterial("#4a2523", 0.9, 0.05),
  );
  cavity.scale.set(0.255, 0.185, 0.17);
  cavity.position.set(0, 2.6, -0.06);
  group.add(cavity);

  const tooth = organMaterial("#e6dfd0", 0.35, 0.6);
  const upper = new THREE.Mesh(
    new THREE.TorusGeometry(0.232, 0.022, 8, 30, Math.PI),
    tooth,
  );
  upper.position.set(0, 2.6, 0.1);
  upper.scale.set(1, 0.72, 1);
  group.add(upper);
  const lower = new THREE.Mesh(
    new THREE.TorusGeometry(0.232, 0.022, 8, 30, Math.PI),
    tooth,
  );
  lower.position.set(0, 2.6, 0.1);
  lower.rotation.z = Math.PI;
  lower.scale.set(1, 0.72, 1);
  group.add(lower);

  const tongue = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.072, 0.16, 6, 14),
    organMaterial("#a35d55", 0.7, 0.2),
  );
  tongue.rotation.x = Math.PI / 2;
  tongue.position.set(0, 2.532, 0.03);
  tongue.scale.set(1, 1, 0.72);
  group.add(tongue);

  add(
    new THREE.Mesh(sweep(PHARYNX_PATH, 0.08, { tubular: 26 }), organMaterial("#a9605a", 0.7, 0.2)),
    [1],
  );

  /* The tract proper. */
  add(new THREE.Mesh(sweep(OESO_PATH, 0.074, { tubular: 48 }), organMaterial("#ad7a64")), [1]);
  add(
    new THREE.Mesh(
      sweep(STOMACH_PATH, radii(STOMACH_RADII), { squash: 0.84, tubular: 110 }),
      organMaterial("#b4735f", 0.62, 0.4),
    ),
    [2],
  );
  add(
    new THREE.Mesh(sweep(DUODENUM_PATH, 0.068, { tubular: 70 }), organMaterial("#b17e68")),
    [3],
  );
  add(
    new THREE.Mesh(
      sweep(SI_PATH, 0.054, { tubular: 340, radial: 10, squash: 0.92 }),
      organMaterial("#b8846d"),
    ),
    [3],
  );
  add(
    new THREE.Mesh(
      sweep(COLON_PATH, (t) => 0.104 + 0.012 * Math.sin(t * Math.PI * 24), {
        tubular: 260,
        radial: 14,
      }),
      organMaterial("#a5795f"),
    ),
    [4],
  );

  const caecum = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 18), organMaterial("#a5795f"));
  caecum.position.set(0.63, 0.27, 0.02);
  caecum.scale.set(1, 0.9, 0.9);
  add(caecum, [4]);

  add(
    new THREE.Mesh(
      sweep(
        [
          [0.7, 0.17, 0],
          [0.74, 0.08, -0.02],
          [0.72, 0, -0.04],
        ],
        0.028,
        { tubular: 24, radial: 8 },
      ),
      organMaterial("#a5795f"),
    ),
    [4],
  );

  add(
    new THREE.Mesh(sweep(RECTUM_PATH, 0.072, { tubular: 42 }), organMaterial("#b17e68")),
    [5],
  );
  const sphincter = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.02, 8, 24),
    organMaterial("#a5795f", 0.6, 0.2),
  );
  sphincter.rotation.x = Math.PI / 2;
  sphincter.position.set(0, -0.5, 0);
  add(sphincter, [5]);

  /* Accessory organs. The liver fades with the stomach because it is the thing
     standing between the camera and the food at that stop. */
  const liverMaterial = organMaterial("#6f3b34", 0.52, 0.45);
  const liverRight = new THREE.Mesh(blob(0.45, 0.22, 0.3, 2.1), liverMaterial);
  liverRight.position.set(-0.55, 1.66, 0.02);
  liverRight.rotation.z = -0.12;
  add(liverRight, [2]);
  const liverLeft = new THREE.Mesh(blob(0.2, 0.16, 0.23, 4.3), liverMaterial);
  liverLeft.position.set(-0.09, 1.61, -0.02);
  add(liverLeft, [2]);

  add(
    new THREE.Mesh(
      sweep(GALL_PATH, radii([0.055, 0.063, 0.046, 0.02]), { tubular: 30 }),
      organMaterial("#87916a", 0.5, 0.4),
    ),
  );
  add(
    new THREE.Mesh(
      sweep(PANCREAS_PATH, radii([0.085, 0.078, 0.055, 0.032]), {
        squash: 0.8,
        tubular: 50,
      }),
      organMaterial("#c4a06a", 0.62, 0.3),
    ),
  );

  const food = new THREE.Mesh(
    new THREE.SphereGeometry(0.066, 28, 20),
    new THREE.MeshStandardMaterial({
      color: "#e8a84f",
      emissive: "#5c350d",
      emissiveIntensity: 0.35,
      roughness: 0.42,
      metalness: 0,
    }),
  );
  food.visible = false;
  food.renderOrder = 2;
  group.add(food);

  return { group, fading, food };
}

/* ------------------------------------------------------------------ */
/* the plate                                                           */
/* ------------------------------------------------------------------ */

export default function DigestiveStage({ label, blurb }: { label: string; blurb: string }) {
  const still = useStillMotion();
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<{ fit: () => void } | null>(null);
  const ctl = useRef({
    stage: 0,
    progress: 0,
    running: false,
    revealed: false,
    arrived: false,
  });

  const entry = STAGES[stage];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
    const home = new THREE.Vector3(1.15, 1.45, 6.2);
    const target = new THREE.Vector3(0, 1.1, 0);
    camera.position.copy(home);

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 2.4;
    controls.maxDistance = 13;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x131a25, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.75);
    key.position.set(3.5, 5.5, 4.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe7ff, 0.55);
    fill.position.set(-4.5, 1.5, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-3, 4, -5);
    scene.add(rim);

    const { group, fading, food } = buildTract();
    scene.add(group);

    const curves = JOURNEY_PATHS.map((points) => curveOf(points, 0.18));

    const fit = () => {
      camera.position.copy(home);
      controls.target.copy(target);
      controls.update();
    };
    engineRef.current = { fit };

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let raf = 0;
    let last = performance.now();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const state = ctl.current;
      if (state.running) {
        state.progress += dt / STAGES[state.stage].seconds;
        if (state.progress >= 1) {
          if (state.stage < STAGES.length - 1) {
            state.stage += 1;
            state.progress = 0;
            setStage(state.stage);
          } else {
            state.progress = 1;
            state.running = false;
            state.arrived = true;
            setRunning(false);
            setArrived(true);
          }
        }
      }

      food.visible = state.revealed;
      if (state.revealed) {
        const point = curves[state.stage].getPointAt(
          Math.min(1, Math.max(0, state.progress)),
        );
        food.position.copy(point);
        /* The bolus is broken down as it travels: biggest in the mouth, small
           enough to sit inside the ileum by the time it gets there. */
        const size = [1.15, 1.1, 1, 0.8, 0.88, 0.82][state.stage];
        const s = food.scale.x + (size - food.scale.x) * 0.1;
        food.scale.setScalar(s);
      }

      for (const item of fading) {
        const material = item.mesh.material as THREE.MeshPhysicalMaterial;
        const goal = item.stages.includes(state.stage) ? 0.36 : 1;
        let next = material.opacity + (goal - material.opacity) * 0.12;
        if (Math.abs(next - goal) < 0.004) next = goal;
        material.opacity = next;
        const transparent = next < 0.995;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.depthWrite = !transparent;
          material.needsUpdate = true;
        }
      }

      if (barRef.current) {
        const overall = (state.stage + state.progress) / STAGES.length;
        barRef.current.style.transform = `scaleX(${overall.toFixed(4)})`;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      engineRef.current = null;
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      scene.clear();
      renderer.dispose();
    };
  }, []);

  const goTo = (index: number) => {
    ctl.current.stage = index;
    ctl.current.progress = 0.18;
    ctl.current.running = false;
    ctl.current.revealed = true;
    ctl.current.arrived = false;
    setStage(index);
    setRevealed(true);
    setArrived(false);
    setRunning(false);
  };

  const toggle = () => {
    if (running) {
      ctl.current.running = false;
      setRunning(false);
      return;
    }
    if (still) {
      ctl.current.stage = STAGES.length - 1;
      ctl.current.progress = 1;
      ctl.current.revealed = true;
      ctl.current.arrived = true;
      ctl.current.running = false;
      setStage(STAGES.length - 1);
      setRevealed(true);
      setArrived(true);
      setRunning(false);
      return;
    }
    if (ctl.current.arrived) {
      ctl.current.stage = 0;
      ctl.current.progress = 0;
      setStage(0);
      setArrived(false);
    }
    ctl.current.revealed = true;
    ctl.current.running = true;
    setRevealed(true);
    setArrived(false);
    setRunning(true);
  };

  const reset = () => {
    ctl.current = {
      stage: 0,
      progress: 0,
      running: false,
      revealed: false,
      arrived: false,
    };
    setStage(0);
    setRevealed(false);
    setArrived(false);
    setRunning(false);
  };

  const status = running ? "Travelling" : arrived ? "Delivered" : revealed ? "Paused" : "Idle";

  return (
    <div className="flex flex-col gap-3">
      <div className="apple-lab-card p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Digestive journey">
            {STAGES.map((stop, index) => (
              <button
                key={stop.id}
                type="button"
                role="tab"
                aria-selected={stage === index}
                data-active={stage === index}
                onClick={() => goTo(index)}
                className="apple-lab-btn !gap-1.5 !px-2.5 !py-1.5 !text-[11px]"
              >
                <span className="text-[9px] tabular-nums opacity-55">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {stop.short}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="apple-lab-btn apple-lab-btn--solid !px-3 !py-1.5 !text-[11.5px]"
              onClick={toggle}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pause" : arrived ? "Run again" : "Run"}
            </button>
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1.5"
              onClick={reset}
              aria-label="Reset the journey"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1.5"
              onClick={() => engineRef.current?.fit()}
              aria-label="Fit the tract in view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[var(--lab-line-soft)]">
          <div
            ref={barRef}
            className="h-full w-full origin-left rounded-full bg-[var(--lab-ink-dim)]"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="apple-lab-card relative overflow-hidden p-2.5 sm:p-3">
          <div className="mb-2 flex items-start justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="apple-lab-title truncate text-[13px]">{label}</p>
              <p className="truncate text-[11px] text-[var(--lab-ink-dim)]">{blurb}</p>
            </div>
            <span className="apple-lab-chip shrink-0">{status}</span>
          </div>

          <div className="apple-lab-stage relative">
            <canvas
              ref={canvasRef}
              className="apple-lab-stage__canvas"
              style={{ aspectRatio: "1.22" }}
              role="img"
              aria-label="Interactive 3D digestive tract. Drag to orbit, scroll to zoom, right-drag to pan."
              onContextMenu={(event) => event.preventDefault()}
            />

            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
              <span className="apple-lab-chip">
                {String(stage + 1).padStart(2, "0")} · {entry.name}
              </span>
              <span className="apple-lab-chip">{entry.form}</span>
            </div>

            <span className="apple-lab-chip pointer-events-none absolute bottom-3 right-3 !text-[10px] max-sm:hidden">
              drag orbit · scroll zoom · right-drag pan
            </span>
          </div>

          <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-[var(--lab-ink-micro)]">
            The organ holding the food goes translucent so you can follow it; the
            rest stay solid. Times on the plate are the body's, not the animation's
            — this run compresses one to three days into about fifteen seconds.
          </p>
        </div>

        <aside className="flex flex-col gap-3">
          <section className="apple-lab-card p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="apple-lab-micro">Journey</p>
              <span className="text-[10.5px] text-[var(--lab-ink-micro)]">
                {stage + 1} / {STAGES.length}
              </span>
            </div>

            <h3 className="apple-lab-title mt-1.5 text-[17px]">{entry.name}</h3>

            <div className="mt-2 flex flex-col">
              <Reading label="Duration" value={entry.duration} />
              <Reading label="Food form" value={entry.form} />
              <Reading label="Absorbed" value={entry.absorbs} />
            </div>

            <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              {entry.what}
            </p>

            <div className="mt-3 border-t border-[var(--lab-line-soft)] pt-2.5">
              <p className="apple-lab-micro">Questions here</p>
              <div className="mt-1.5 flex flex-col gap-2">
                {entry.qa.map((item) => (
                  <div key={item.q}>
                    <p className="text-[11.5px] font-semibold text-[var(--lab-ink)]">
                      {item.q}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="apple-lab-card p-3.5">
            <p className="apple-lab-micro">Also on the plate</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {ACCESSORY.map((organ) => (
                <p key={organ.name} className="flex gap-2 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  <i
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: organ.color }}
                  />
                  <span>
                    <b className="font-semibold text-[var(--lab-ink)]">{organ.name}</b> —{" "}
                    {organ.note}
                  </span>
                </p>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--lab-line-soft)] pt-2.5 text-center">
              <Stat label="Length" value="8–9 m" />
              <Stat label="Transit" value="1–3 days" />
              <Stat label="Surface" value="≈ 250 m²" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--lab-line-soft)] py-1.5 text-[11.5px] last:border-0">
      <span className="shrink-0 text-[var(--lab-ink-dim)]">{label}</span>
      <span className="apple-lab-value text-right font-semibold">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="apple-lab-micro">{label}</p>
      <p className="apple-lab-value mt-1 text-[12px] font-semibold">{value}</p>
    </div>
  );
}
