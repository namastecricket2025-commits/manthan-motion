import { useEffect, useRef, useState } from "react";
import { useTelemetryPublisher } from "../PhysicsSim";
import { SPRING, clamp, syncViewport, useCanvasSize, useRaf, useViewport } from "../use-canvas";
import { animDt } from "@/lib/app-settings";
import * as THREE from "three";
import { motion } from "motion/react";
import { Activity, Info, Pause, Play, RotateCcw, PenLine } from "lucide-react";
import { sfx } from "../lab-sound";
import { CursorTip, useCursorTip } from "../CursorTip";
import { ExamSketchPanel, useExamSketch, type ExamStep } from "../ExamSketch";
import { disposeSurfaceMaps, muscleMaps, vesselMaps, tissueMaterial } from "../lab-textures";
import { LabelDrillHud, useLabelDrill } from "./LabelDrill";

const PARTS: Record<string, { name: string; def: string; accent: string }> = {
  ra: { name: "Right atrium", def: "Thin-walled chamber that collects deoxygenated blood from the superior and inferior venae cavae. It contracts weakly, topping up the right ventricle.", accent: "#38bdf8" },
  rv: { name: "Right ventricle", def: "A thin crescent that wraps around the front of the heart and pumps blood into the pulmonary trunk at only ~25 mmHg. Its wall is about a third as thick as the left ventricle's.", accent: "#38bdf8" },
  la: { name: "Left atrium", def: "Posterior chamber receiving oxygenated blood from the four pulmonary veins. It is the most posterior chamber, sitting right in front of the oesophagus.", accent: "#aab3ff" },
  lv: { name: "Left ventricle", def: "The thick, conical muscle (10–15 mm wall) whose apex forms the heart's tip. It generates ~120 mmHg to push blood around the whole systemic circuit.", accent: "#aab3ff" },
  septum: { name: "Interventricular septum", def: "Muscular wall dividing the two ventricles. It bows into the right ventricle because left-sided pressure is about five times higher.", accent: "#f87171" },
  aorta: { name: "Aortic arch", def: "The body's largest artery: it ascends, arches over the left pulmonary artery, then descends behind the heart. Three branches rise from the top of the arch to supply head and arms.", accent: "#aab3ff" },
  brachio: { name: "Brachiocephalic trunk", def: "The first and widest arch branch. It immediately splits into the right common carotid artery and the right subclavian artery.", accent: "#aab3ff" },
  carotid: { name: "Left common carotid artery", def: "Second arch branch, ascending in the neck to supply the left side of the head and brain.", accent: "#aab3ff" },
  subclavian: { name: "Left subclavian artery", def: "Third arch branch, arching under the collarbone to feed the left arm and part of the chest wall.", accent: "#aab3ff" },
  pulmTrunk: { name: "Pulmonary trunk", def: "Carries deoxygenated blood out of the right ventricle. It is anterior to the aorta — it physically crosses in FRONT of it before splitting.", accent: "#38bdf8" },
  pulmL: { name: "Left pulmonary artery", def: "Runs from the bifurcation underneath the aortic arch to the left lung. It is one of only two arteries carrying deoxygenated blood.", accent: "#38bdf8" },
  pulmR: { name: "Right pulmonary artery", def: "Passes behind the ascending aorta and the superior vena cava to reach the right lung — the classic radiological 'posterior' relationship.", accent: "#38bdf8" },
  svc: { name: "Superior vena cava", def: "Wide vertical blue vessel draining the head, neck and upper limbs. It enters the top of the right atrium straight from above.", accent: "#38bdf8" },
  ivc: { name: "Inferior vena cava", def: "The body's largest vein, draining everything below the diaphragm. It punches vertically up through the diaphragm to enter the right atrium from below.", accent: "#38bdf8" },
  pulmVein: { name: "Pulmonary veins", def: "Four veins (two left, two right) returning oxygenated blood to the left atrium. They are the only veins in the body that carry oxygen-rich blood.", accent: "#f472b6" },
  lad: { name: "Left anterior descending artery", def: "The coronary artery running down the front interventricular groove. Blocking it causes the classic anterior heart attack.", accent: "#aab3ff" },
  rca: { name: "Right coronary artery", def: "Runs in the groove between the right atrium and right ventricle and supplies the right side of the heart plus the pacemaker node.", accent: "#aab3ff" },
  circumflex: { name: "Left circumflex artery", def: "Curves around the left atrioventricular groove, feeding the left atrium and the back/side wall of the left ventricle.", accent: "#aab3ff" },
  cs: { name: "Coronary sinus", def: "The heart's own drainage vein running along the back groove. All coronary venous blood collects here and empties into the right atrium.", accent: "#38bdf8" },
  tricuspid: { name: "Tricuspid valve", def: "Three-flap valve between right atrium and right ventricle. It closes during ventricular contraction so blood cannot leak backwards.", accent: "#a78bfa" },
  mitral: { name: "Mitral valve", def: "Two-flap valve between left atrium and left ventricle. Its leaflets are anchored by chordae tendineae so they cannot blow inside-out under 120 mmHg.", accent: "#a78bfa" },
  aorticValve: { name: "Aortic valve", def: "Three-cusped valve at the exit of the left ventricle. It opens when the ventricle contracts and snaps shut to keep blood in the aorta.", accent: "#a78bfa" },
  pulmValve: { name: "Pulmonary valve", def: "Three-cusped valve guarding the exit of the right ventricle into the pulmonary trunk. It prevents backflow from the pulmonary artery.", accent: "#a78bfa" },
};

/** The structures a student is expected to label on a board diagram. */
const HEART_DRILL_PARTS = [
  "Right atrium",
  "Right ventricle",
  "Left atrium",
  "Left ventricle",
  "Interventricular septum",
  "Aortic arch",
  "Pulmonary trunk",
  "Superior vena cava",
  "Inferior vena cava",
  "Tricuspid valve",
  "Mitral valve",
];

const EXAM_STEPS: ExamStep[] = [
  { t: "Block in the ventricles", d: "Draw one large tilted oval leaning about 30° to the right — that is the ventricular mass, and the apex points down-left." },
  { t: "Add both atria", d: "Sketch two smaller rounded lobes sitting on top of the oval — right atrium on your left as you look at it, left atrium behind it." },
  { t: "Mark the interventricular groove", d: "One line down the front of the oval separates the two ventricles. The left side of that line is the thick-walled left ventricle." },
  { t: "Draw the aorta and its arch", d: "A wide tube leaves the centre and arches to the LEFT over everything else. Three short upward strokes on top of the arch are its branches." },
  { t: "Put the pulmonary trunk in front", d: "A second wide tube starts from the right ventricle and crosses IN FRONT of the aorta before splitting — shade it darker to show it is nearer." },
  { t: "Add the venae cavae", d: "Two vertical tubes enter the right atrium: the superior vena cava from above and the inferior vena cava from below." },
  { t: "Shade and label", d: "Shade the left ventricle wall thickest, then label the four valves: tricuspid, mitral, pulmonary and aortic." },
];

const QUESTIONS: { q: string; options: string[]; ok: number; why: string }[] = [
  { q: "Which chamber pumps deoxygenated blood to the lungs?", options: ["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"], ok: 1, why: "Right ventricle → pulmonary trunk → lungs." },
  { q: "Which vessel crosses IN FRONT of the aorta?", options: ["Superior vena cava", "Pulmonary trunk", "Inferior vena cava", "Pulmonary veins"], ok: 1, why: "The pulmonary trunk is anterior to the ascending aorta — a key landmark." },
  { q: "How many branches arise from the top of the aortic arch?", options: ["1", "2", "3", "4"], ok: 2, why: "Brachiocephalic, left common carotid, left subclavian — three." },
  { q: "Which chamber has the thickest wall?", options: ["Right atrium", "Left atrium", "Right ventricle", "Left ventricle"], ok: 3, why: "The LV is roughly twice as thick as the RV to generate systemic pressure." },
  { q: "Where do the venae cavae enter?", options: ["Left atrium", "Right ventricle", "Right atrium", "Left ventricle"], ok: 2, why: "SVC from above, IVC from below — both vertically into the right atrium." },
  { q: "Which vessels carry oxygenated blood to the left atrium?", options: ["Venae cavae", "Pulmonary artery", "Aorta", "Pulmonary veins"], ok: 3, why: "The four pulmonary veins are the only veins with oxygenated blood." },
  { q: "Which coronary artery runs down the front groove?", options: ["Right coronary", "Left anterior descending", "Circumflex", "Coronary sinus"], ok: 1, why: "The LAD runs in the anterior interventricular groove — its blockage is the classic anterior infarct." },
  { q: "Why is the septum asymmetrical?", options: ["Random growth", "LV pressure is much higher", "RV is larger", "Atria push it"], ok: 1, why: "LV ~120 mmHg vs RV ~25 mmHg, so the septum bows into the RV." },
];

/* ── organic geometry helpers ───────────────────────────────── */

/** Ventricle shell: spherical base tapering to a muscular apex. */
function ventricleGeometry(radius: number, taper = 0.34, seg = 48) {
  const geo = new THREE.SphereGeometry(radius, seg, seg);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = v.y / radius; // −1 apex … +1 base
    const t = (ny + 1) / 2;
    const f = taper + (1 - taper) * Math.pow(t, 0.5);
    v.x *= f;
    v.z *= f * (1 + 0.06 * (1 - t)); // slight anterior bulge at the apex
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Atrial shell: squashed, gently lobed. */
function atriumGeometry(radius: number, lobed = true) {
  const geo = new THREE.SphereGeometry(radius, 34, 34);
  if (!lobed) return geo;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lobe = 1 + 0.13 * Math.sin(Math.atan2(v.z, v.x) * 3);
    v.x *= lobe;
    v.z *= lobe;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function curveTube(
  points: [number, number, number][],
  radius: number,
  mat: THREE.Material,
  radial = 18,
) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, radius, radial, false), mat);
  return { mesh, curve };
}

export default function HeartAnatomy() {
  const [bpm, setBpm] = useState(72);
  const [sv, setSv] = useState(70);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const { tip, show: showTip, hide: hideTip } = useCursorTip();
  const [exam, setExam] = useState(false);
  const drill = useLabelDrill(HEART_DRILL_PARTS);

  useEffect(() => {
    if (!drill.drill) return;
    hideTip();
    setHover(null);
    hoverId.current = null;
  }, [drill.drill, hideTip]);

  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const vp = useViewport();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const rootGroup = useRef<THREE.Group | null>(null);
  useExamSketch(rootGroup, exam, canvasRef);
  const beatParts = useRef<{ lv: THREE.Object3D; rv: THREE.Object3D; la: THREE.Object3D; ra: THREE.Object3D; valves: THREE.Object3D[] } | null>(null);
  const orbit = useRef({ yaw: 0.5, pitch: -0.06, dist: 32, panX: 0, panY: 0 });
  const target = useRef({ yaw: 0.5, pitch: -0.06, dist: 32, panX: 0, panY: 0 });
  const lastInteract = useRef(performance.now());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const pinch = useRef<number | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pickables = useRef<{ mesh: THREE.Object3D; id: string }[]>([]);
  const hoverId = useRef<string | null>(null);
  const tipClock = useRef(0);

  const cycle = 60 / bpm;
  const cardiacOutput = (sv * bpm) / 1000;
  const lvPeak = Math.round(80 + sv * 0.5);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => sfx.thump(), 60000 / bpm);
    return () => window.clearInterval(id);
  }, [bpm, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x080d18);
    sc.fog = new THREE.Fog(0x080d18, 52, 108);
    const cam = new THREE.PerspectiveCamera(42, 1, 1, 260);
    const root = new THREE.Group();
    sc.add(root);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    rootGroup.current = root;

    sc.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.45);
    key.position.set(26, 34, 30);
    sc.add(key);
    const fill = new THREE.DirectionalLight(0xbfdbfe, 0.5);
    fill.position.set(-30, -8, 18);
    sc.add(fill);
    const rim = new THREE.DirectionalLight(0xff647c, 0.55);
    rim.position.set(-24, 16, -26);
    sc.add(rim);
    sc.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.45));

    const muscle = muscleMaps({ repeat: 2.4, seed: 9 });
    const vesselRed = vesselMaps("#b0182f", 3);
    const vesselBlue = vesselMaps("#1d5f9e", 3);
    const valveMaps = vesselMaps("#c4b5fd", 2);

    const hg = new THREE.Group();
    root.add(hg);

    const chamberMat = (tint: number, emissive: number, ei: number) =>
      tissueMaterial(muscle, { color: tint, roughness: 0.58, bumpScale: 0.045, emissive, emissiveIntensity: ei, clearcoat: 0.18 });
    const redMat = tissueMaterial(vesselRed, { color: 0xffffff, roughness: 0.44, bumpScale: 0.02, clearcoat: 0.3 });
    const blueMat = tissueMaterial(vesselBlue, { color: 0xffffff, roughness: 0.44, bumpScale: 0.02, clearcoat: 0.3 });
    const valveMat = tissueMaterial(valveMaps, { color: 0xf5f3ff, roughness: 0.35, bumpScale: 0.012, clearcoat: 0.4 });

    // ── ventricles: thick asymmetric muscle ──
    const lv = new THREE.Mesh(ventricleGeometry(4.6, 0.32, 52), chamberMat(0xd0515a, 0x4a0a12, 0.22));
    lv.scale.set(1.06, 1.5, 0.92);
    lv.position.set(-1.15, -3.5, 0.25);
    lv.rotation.z = -0.17;
    lv.rotation.y = 0.22;
    lv.userData.id = "lv";
    hg.add(lv);
    pickables.current.push({ mesh: lv, id: "lv" });

    const rv = new THREE.Mesh(ventricleGeometry(4.1, 0.4, 46), chamberMat(0xc2575f, 0x3f0a11, 0.18));
    rv.scale.set(0.95, 1.24, 0.66);
    rv.position.set(1.85, -2.5, 1.75);
    rv.rotation.z = 0.12;
    rv.rotation.y = -0.28;
    rv.userData.id = "rv";
    hg.add(rv);
    pickables.current.push({ mesh: rv, id: "rv" });

    // septum — bows into the RV
    const septum = new THREE.Mesh(new THREE.SphereGeometry(3.5, 34, 34), chamberMat(0xa8464f, 0x3a0810, 0.16));
    septum.scale.set(0.52, 1.42, 0.74);
    septum.position.set(0.35, -3.0, 0.55);
    septum.rotation.z = -0.1;
    septum.userData.id = "septum";
    hg.add(septum);
    pickables.current.push({ mesh: septum, id: "septum" });

    // ── atria (posterior, thinner wall) ──
    const la = new THREE.Mesh(atriumGeometry(2.85), chamberMat(0xbe4a57, 0x420b13, 0.16));
    la.scale.set(1.06, 0.94, 1.0);
    la.position.set(-1.35, 4.5, -1.45);
    la.userData.id = "la";
    hg.add(la);
    pickables.current.push({ mesh: la, id: "la" });

    const ra = new THREE.Mesh(atriumGeometry(2.6), chamberMat(0xb85560, 0x3c0a12, 0.14));
    ra.scale.set(1.12, 1.0, 1.0);
    ra.position.set(2.85, 4.15, -0.35);
    ra.userData.id = "ra";
    hg.add(ra);
    pickables.current.push({ mesh: ra, id: "ra" });

    // patent fossa ovalis dimple on the RA (small realism cue)
    const fossa = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshStandardMaterial({ color: 0x7f1d2e, roughness: 0.9, side: THREE.DoubleSide }));
    fossa.position.set(3.35, 4.35, 1.05);
    fossa.rotation.y = 0.35;
    hg.add(fossa);

    // ── aortic arch: ascends, arches OVER the left pulmonary artery, descends ──
    const aortaAsc = curveTube([[0.1, -0.4, -0.5], [0.05, 2.0, -0.55], [-0.1, 4.1, -0.6], [-0.4, 5.3, -0.85]], 1.34, redMat);
    const aortaArch = curveTube([[-0.4, 5.3, -0.85], [-1.5, 6.55, -1.15], [-2.7, 6.3, -1.5], [-3.35, 5.0, -1.7]], 1.2, redMat);
    const aortaDesc = curveTube([[-3.35, 5.0, -1.7], [-3.6, 2.6, -1.95], [-3.5, -1.0, -2.1], [-3.3, -5.4, -2.15]], 1.02, redMat);
    [aortaAsc, aortaArch, aortaDesc].forEach((m, i) => {
      if (i === 1) m.mesh.userData.id = "aorta";
      hg.add(m.mesh);
    });
    pickables.current.push({ mesh: aortaArch.mesh, id: "aorta" });
    pickables.current.push({ mesh: aortaAsc.mesh, id: "aorta" });
    pickables.current.push({ mesh: aortaDesc.mesh, id: "aorta" });

    // three arch branches
    const brachio = curveTube([[-1.35, 6.5, -1.0], [-0.85, 8.1, -0.75], [-0.55, 9.3, -0.6]], 0.44, redMat);
    brachio.mesh.userData.id = "brachio";
    hg.add(brachio.mesh);
    pickables.current.push({ mesh: brachio.mesh, id: "brachio" });
    const rCarotid = curveTube([[-0.6, 9.2, -0.62], [-0.35, 10.6, -0.5]], 0.3, redMat);
    const rSubclav = curveTube([[-0.7, 8.9, -0.68], [-1.55, 9.5, -0.3], [-2.2, 9.0, 0.05]], 0.3, redMat);
    hg.add(rCarotid.mesh, rSubclav.mesh);

    const lCarotid = curveTube([[-2.35, 6.5, -1.35], [-2.75, 8.4, -1.2], [-2.95, 10.3, -1.15]], 0.34, redMat);
    lCarotid.mesh.userData.id = "carotid";
    hg.add(lCarotid.mesh);
    pickables.current.push({ mesh: lCarotid.mesh, id: "carotid" });

    const lSubclav = curveTube([[-3.2, 5.3, -1.62], [-4.3, 6.0, -1.5], [-5.3, 5.5, -1.35]], 0.34, redMat);
    lSubclav.mesh.userData.id = "subclavian";
    hg.add(lSubclav.mesh);
    pickables.current.push({ mesh: lSubclav.mesh, id: "subclavian" });

    // ── pulmonary trunk: ANTERIOR to the aorta (z is positive = front) ──
    const pulmTrunk = curveTube([[1.95, -0.7, 1.35], [1.75, 1.6, 1.9], [1.5, 3.6, 2.1], [1.1, 4.8, 2.0]], 1.26, blueMat);
    pulmTrunk.mesh.userData.id = "pulmTrunk";
    hg.add(pulmTrunk.mesh);
    pickables.current.push({ mesh: pulmTrunk.mesh, id: "pulmTrunk" });

    const pulmL = curveTube([[1.1, 4.8, 2.0], [-1.0, 5.05, 2.05], [-2.9, 4.85, 1.85], [-4.4, 4.3, 1.5]], 0.62, blueMat);
    pulmL.mesh.userData.id = "pulmL";
    hg.add(pulmL.mesh);
    pickables.current.push({ mesh: pulmL.mesh, id: "pulmL" });

    const pulmR = curveTube([[1.1, 4.8, 2.0], [2.9, 4.55, 1.35], [4.2, 3.85, 0.6], [5.1, 3.0, 0.1]], 0.62, blueMat);
    pulmR.mesh.userData.id = "pulmR";
    hg.add(pulmR.mesh);
    pickables.current.push({ mesh: pulmR.mesh, id: "pulmR" });

    // ── vertical venae cavae into the RA ──
    const svc = curveTube([[3.15, 9.4, -0.3], [3.1, 7.6, -0.3], [3.05, 6.1, -0.3], [3.0, 5.3, -0.3]], 0.86, blueMat);
    svc.mesh.userData.id = "svc";
    hg.add(svc.mesh);
    pickables.current.push({ mesh: svc.mesh, id: "svc" });

    const ivc = curveTube([[3.05, -4.2, -0.9], [3.05, -1.2, -0.75], [3.0, 1.8, -0.6], [2.95, 3.2, -0.5]], 0.98, blueMat);
    ivc.mesh.userData.id = "ivc";
    hg.add(ivc.mesh);
    pickables.current.push({ mesh: ivc.mesh, id: "ivc" });

    // four pulmonary veins entering the LA posteriorly
    const pvGeo = [
      [[-5.0, 4.3, -2.4], [-3.4, 4.5, -2.3], [-2.1, 4.7, -2.0]],
      [[-4.9, 2.6, -2.6], [-3.3, 3.0, -2.5], [-2.0, 3.6, -2.2]],
      [[5.0, 4.0, -2.2], [3.4, 4.2, -2.2], [2.0, 4.6, -1.9]],
      [[4.9, 2.3, -2.4], [3.3, 2.8, -2.3], [2.0, 3.4, -2.0]],
    ] as [number, number, number][][];
    pvGeo.forEach((pts) => {
      const pv = curveTube(pts, 0.3, new THREE.MeshPhysicalMaterial({ color: 0xf9a8d4, roughness: 0.4, clearcoat: 0.3 }));
      pv.mesh.userData.id = "pulmVein";
      hg.add(pv.mesh);
      pickables.current.push({ mesh: pv.mesh, id: "pulmVein" });
    });

    // ── coronary circulation (huge realism win) ──
    const lad = curveTube([[0.1, 0.6, 1.15], [-0.2, -0.9, 1.5], [-0.6, -3.0, 1.35], [-1.0, -4.6, 0.9]], 0.17, redMat);
    lad.mesh.userData.id = "lad";
    hg.add(lad.mesh);
    pickables.current.push({ mesh: lad.mesh, id: "lad" });

    const rca = curveTube([[1.9, 2.9, 1.0], [2.7, 2.1, 1.55], [2.9, 0.4, 1.9], [2.7, -1.3, 1.5]], 0.17, redMat);
    rca.mesh.userData.id = "rca";
    hg.add(rca.mesh);
    pickables.current.push({ mesh: rca.mesh, id: "rca" });

    const circumflex = curveTube([[-0.6, 2.9, 0.6], [-1.9, 3.0, 0.2], [-2.9, 3.1, -0.7], [-3.2, 3.0, -1.6]], 0.15, redMat);
    circumflex.mesh.userData.id = "circumflex";
    hg.add(circumflex.mesh);
    pickables.current.push({ mesh: circumflex.mesh, id: "circumflex" });

    const cs = curveTube([[-1.9, 4.9, -2.05], [-0.6, 4.8, -2.3], [0.9, 4.5, -2.35], [2.4, 4.1, -1.9], [2.75, 3.7, -1.2]], 0.22, blueMat);
    cs.mesh.userData.id = "cs";
    hg.add(cs.mesh);
    pickables.current.push({ mesh: cs.mesh, id: "cs" });

    // ── valves: thin cusped rings that open and close ──
    const valves: THREE.Object3D[] = [];
    const makeValve = (id: string, r: number, pos: [number, number, number], rot: [number, number, number], tilt: number) => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 10, 30), valveMat);
      const leafletGeo = new THREE.CircleGeometry(r * 0.92, 3);
      const leafletMat = new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.3, clearcoat: 0.5, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
      const flaps: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const flap = new THREE.Mesh(leafletGeo, leafletMat);
        flap.rotation.z = i * ((Math.PI * 2) / 3);
        flap.rotation.x = tilt;
        flaps.push(flap);
        g.add(flap);
      }
      g.add(ring);
      g.position.set(...pos);
      g.rotation.set(...rot);
      ring.userData.id = id;
      g.userData.flaps = flaps;
      hg.add(g);
      valves.push(g);
      pickables.current.push({ mesh: ring, id });
      return g;
    };
    makeValve("tricuspid", 1.15, [1.9, 1.15, 0.35], [Math.PI / 2, 0, 0.1], -1.15);
    makeValve("mitral", 1.2, [-0.75, 1.35, -0.15], [Math.PI / 2, 0, -0.18], -1.15);
    makeValve("aorticValve", 0.72, [0.1, 0.05, -0.3], [Math.PI / 2, 0, 0], -1.2);
    makeValve("pulmValve", 0.7, [1.85, 0.15, 0.9], [Math.PI / 2, 0.2, 0], -1.2);

    beatParts.current = { lv, rv, la, ra, valves };

    return () => {
      disposeSurfaceMaps(sc);
      sc.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm.dispose());
      });
      renderer.dispose();
      ren.current = null;
      scene.current = null;
      camera.current = null;
      rootGroup.current = null;
      pickables.current = [];
    };
  }, [canvasRef]);

  /* ── picking ── */
  const partAt = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c || !camera.current || !rootGroup.current) return null;
    const r = c.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    rootGroup.current.updateMatrixWorld(true);
    raycaster.current.setFromCamera(ndc, camera.current);
    const hits = raycaster.current.intersectObjects(pickables.current.map((p) => p.mesh), false);
    if (hits.length === 0) return null;
    const mesh = hits[0].object as THREE.Mesh;
    const id = (mesh.userData.id as string) || "";
    const part = PARTS[id];
    return part ? { id, part } : null;
  };

  const setHoverFromRay = (clientX: number, clientY: number) => {
    /* During a drill the hover card would print the answer. */
    if (drill.drill) return;
    const hit = partAt(clientX, clientY);
    if (hit) {
      const { id, part } = hit;
      const same = id === hoverId.current;
      hoverId.current = id;
      setHover(id);
      // throttle the bubble to ~22fps so hovering never costs a full re-render per frame
      const now = performance.now();
      if (same && now - tipClock.current < 45) return;
      tipClock.current = now;
      showTip({ title: part.name, body: part.def, accent: part.accent }, clientX, clientY);
    } else if (hoverId.current) {
      hoverId.current = null;
      setHover(null);
      hideTip();
    }
  };

  /* ── render loop ── */
  useRaf((dt, t) => {
    const renderer = ren.current;
    const sc = scene.current;
    const cam = camera.current;
    const grp = rootGroup.current;
    if (!renderer || !sc || !cam || !grp) return;

    const tgt = target.current;
    const o = orbit.current;
    const since = (performance.now() - lastInteract.current) / 1000;
    const interacting = dragging.current !== null;
    // idle auto-rotate — stands still in Motionless Mode
    if (!interacting && since > 1.4) tgt.yaw += animDt(dt) * 0.1;

    const yd = tgt.yaw - o.yaw;
    const pd = tgt.pitch - o.pitch;
    // exponential chase (no velocity integrator → no overshoot/jitter)
    const follow = 1 - Math.pow(0.002, dt);
    o.yaw += yd * follow;
    o.pitch = clamp(o.pitch + pd * follow, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    const lerp = 1 - Math.pow(0.0015, dt);
    o.dist += (tgt.dist - o.dist) * lerp;
    o.panX += (tgt.panX - o.panX) * lerp;
    o.panY += (tgt.panY - o.panY) * lerp;
    grp.rotation.y = o.yaw;
    grp.rotation.x = o.pitch;

    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    // size only on a real box change, never mid-drag (canvas.width resets the buffer)
    syncViewport(vp.current, renderer, cam, cssW, cssH, dragging.current !== null);
    const look = new THREE.Vector3(o.panX * 0.07, o.panY * 0.07, 0);
    cam.position.set(
      look.x + o.dist * Math.sin(o.yaw) * Math.cos(o.pitch),
      look.y + o.dist * Math.sin(o.pitch),
      look.z + o.dist * Math.cos(o.yaw) * Math.cos(o.pitch),
    );
    cam.lookAt(look);

    // heartbeat: ventricular systole then atrial topping-up
    const beat = beatParts.current;
    if (beat) {
      const phase = paused ? 0.4 : (t % cycle) / cycle;
      const systole = Math.exp(-Math.pow((phase - 0.18) / 0.1, 2));
      const diastole = Math.exp(-Math.pow((phase - 0.72) / 0.12, 2));
      const lvScale = 1 + systole * 0.075 - diastole * 0.02;
      beat.lv.scale.set(1.06 * lvScale, 1.5 * (1 - systole * 0.05), 0.92 * lvScale);
      beat.rv.scale.set(0.95 * lvScale, 1.24 * (1 - systole * 0.05), 0.66 * lvScale);
      beat.la.scale.set(1.06 * (1 + diastole * 0.05), 0.94, 1.0);
      beat.ra.scale.set(1.12 * (1 + diastole * 0.05), 1.0, 1.0);
      beat.valves.forEach((v) => {
        const flaps = (v.userData.flaps as THREE.Mesh[]) || [];
        // AV valves shut during systole; outflow valves open instead
        const av = v.children.some((c) => {
          const id = (c as THREE.Mesh).userData?.id;
          return id === "tricuspid" || id === "mitral";
        });
        const target = av ? 1 - systole * 0.95 : 1 - (1 - systole) * 0.95;
        flaps.forEach((f) => {
          f.rotation.x = -1.15 + target * 1.0;
        });
        v.scale.setScalar(0.94 + 0.06 * (1 + systole * 0.2));
      });
    }

    renderer.render(sc, cam);
  });

  /* ── input ── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 14, 62);
      lastInteract.current = performance.now();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt.current = { x: e.clientX, y: e.clientY };
    dragging.current = e.button === 2 ? "pan" : "rotate";
    lastInteract.current = performance.now();
    if (e.pointerType === "touch") setHoverFromRay(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) setHoverFromRay(e.clientX, e.clientY);
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteract.current = performance.now();
    if (pointers.current.size >= 2) {
      const vals = [...pointers.current.values()];
      const dist = Math.hypot(vals[0].x - vals[1].x, vals[0].y - vals[1].y);
      if (pinch.current != null) target.current.dist = clamp(target.current.dist * (pinch.current / Math.max(1, dist)), 14, 62);
      pinch.current = dist;
      return;
    }
    if (dragging.current === "pan") {
      const sp = target.current.dist * 0.0022;
      const yw = target.current.yaw;
      target.current.panX += (Math.cos(yw) * dx - Math.sin(yw) * dy) * sp;
      target.current.panY += (Math.sin(yw) * dx + Math.cos(yw) * dy) * sp;
    } else {
      target.current.yaw += dx * 0.0065;
      target.current.pitch = clamp(target.current.pitch + dy * 0.0062, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const down = downAt.current;
    downAt.current = null;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) dragging.current = null;

    /* A clean tap during a drill is an answer. */
    if (
      down &&
      drill.drill &&
      Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6
    ) {
      drill.answer(partAt(e.clientX, e.clientY)?.part.name ?? "");
    }
  };

  const resetView = () => {
    target.current = { yaw: 0.5, pitch: -0.06, dist: 32, panX: 0, panY: 0 };
    orbit.current = { ...target.current };
  };
  const ps = paused ? "paused" : "running";

  // publish live cardiac telemetry
  const publish = useTelemetryPublisher();
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  useEffect(() => {
    const co = (bpm * sv) / 1000; // cardiac output L/min
    publish({
      subject: "Biology · Heart",
      rows: [
        { k: "Heart rate", v: `${bpm} bpm`, accent: "#aab3ff" },
        { k: "Stroke volume", v: `${sv} mL` },
        { k: "Cardiac output", v: `${co.toFixed(2)} L/min` },
        { k: "Systolic / diastolic", v: `${Math.round(80 + bpm * 0.55)}/${Math.round(58 + sv * 0.12)} mmHg` },
        { k: "Beat cycle", v: `${(60 / bpm).toFixed(2)} s` },
      ],
      equation: "CO = HR × SV",
      eqNote: "Cardiac output is heart rate times stroke volume — roughly 5 L/min at rest.",
      signal: clamp01(Math.sin((performance.now() / 1000) * ((bpm / 60) * Math.PI * 2)) * 0.5 + 0.5),
      accent: "#aab3ff",
    });
  }, [bpm, sv, paused, publish]);

  const hoverPart = hover ? PARTS[hover] : null;

  return (
    <div className="lab-split lab-split--wide">
      <div className="lab-stage-pane lab-glass p-2.5 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Human heart — anatomical pipelines</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Left-drag to orbit 360° · right-drag to pan · scroll/pinch to zoom · tap any vessel for its name
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => (drill.drill ? drill.stop() : drill.start())}
              className={`lab-btn !px-2.5 ${drill.drill ? "lab-btn--active" : ""}`}
              title="Find the named structure on the model"
            >
              <Info className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {drill.drill ? "Exit drill" : "Label drill"}
              </span>
            </button>
            <button type="button" onClick={() => setPaused(!paused)} className="lab-btn !px-2.5">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{paused ? "Play" : "Pause"}</span>
            </button>
            <button
              type="button"
              onClick={() => setExam((v) => !v)}
              className={`lab-btn !px-2.5 ${exam ? "lab-btn--active" : ""}`}
              title="Ghost the model and overlay ink outlines you can copy by hand"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exam Sketch</span>
            </button>
            <button type="button" onClick={resetView} className="lab-btn !px-2.5">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fit</span>
            </button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative cursor-grab touch-none overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_35%,#152036_0%,#080d18_78%)] active:cursor-grabbing"
        >
          <canvas
            ref={canvasRef}
            className="lab-stage w-full"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => {
              hideTip();
              setHover(null);
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* live readouts live on the glass, so the deck stays free for controls */}
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            <span className="lab-chip border-[#aab3ff]/30 bg-black/55 text-[10px] text-[#ff8a9a]">
              <span className="h-2 w-2 rounded-full bg-[#aab3ff]" /> oxygenated
            </span>
            <span className="lab-chip border-[#38bdf8]/30 bg-black/55 text-[10px] text-[#7dd3fc]">
              <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> deoxygenated
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex flex-wrap gap-1.5">
            <span className="lab-chip border-white/15 bg-black/55 text-[10px]">
              <Activity className="h-3 w-3 text-[#aab3ff]" /> {bpm} bpm · CO {cardiacOutput.toFixed(1)} L/min
            </span>
          </div>
          <CursorTip tip={tip} hostRef={wrapRef} width={262} />
          <LabelDrillHud
            drill={drill.drill}
            accent="#aab3ff"
            onNext={drill.next}
            onStop={drill.stop}
          />
        </div>

        {/* pressure gauges — side by side under the model, compact */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          {[
            { k: "Left ventricle", color: "#aab3ff", end: String(lvPeak), lo: "5" },
            { k: "Aortic pressure", color: "#22d3ee", end: "120", lo: "80" },
          ].map((g) => (
            <div key={g.k} className="rounded-xl border border-white/10 bg-black/20 p-2.5 lab-dark-surface">
              <div className="flex items-center justify-between">
                <p className="lab-label">{g.k}</p>
                <span className="lab-value text-xs" style={{ color: g.color }}>
                  {g.end}/{g.lo}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="lab-gauge h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${g.color}66, ${g.color})`, boxShadow: `0 0 12px ${g.color}88`, animationDuration: `${cycle}s`, animationPlayState: ps }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lab-deck-pane lab-glass-deep space-y-3.5 p-3.5">
        {hoverPart && (
          <motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="rounded-xl border p-2.5" style={{ borderColor: `${hoverPart.accent}55`, background: `${hoverPart.accent}12` }}>
            <p className="text-xs font-bold" style={{ color: hoverPart.accent }}>
              {hoverPart.name}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{hoverPart.def}</p>
          </motion.div>
        )}

        <div>
          <p className="lab-label mb-2">
            <Activity className="mr-1 inline h-3 w-3 text-[#aab3ff]" /> Haemodynamics
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Heart rate</span>
            <span className="lab-value text-slate-200">{bpm} BPM</span>
          </div>
          <input type="range" className="lab-range mt-1.5" min={40} max={140} step={1} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Stroke volume</span>
            <span className="lab-value text-slate-200">{sv} mL</span>
          </div>
          <input type="range" className="lab-range mt-1.5" min={40} max={120} step={1} value={sv} onChange={(e) => setSv(Number(e.target.value))} />
          <p className="mt-1.5 text-[10px] text-slate-500">
            cycle {cycle.toFixed(2)} s · CO = <span className="lab-value text-slate-300">{cardiacOutput.toFixed(1)} L/min</span>
            {cardiacOutput > 8 && " — exercising!"}
          </p>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">
            <Info className="mr-1 inline h-3 w-3" /> Study prompts
          </p>
          {!quizDone ? (
            <>
              <p className="mb-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[12px] font-semibold text-slate-100">
                Q{qIdx + 1}/{QUESTIONS.length} · {QUESTIONS[qIdx].q}
              </p>
              <div className="space-y-1.5">
                {QUESTIONS[qIdx].options.map((opt, oi) => {
                  const shown = picked !== null;
                  const right = oi === QUESTIONS[qIdx].ok;
                  const chosen = picked === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={shown}
                      onClick={() => {
                        setPicked(oi);
                        if (right) {
                          setScore((s) => s + 1);
                          sfx.snap();
                        } else sfx.buzz();
                      }}
                      className={`w-full rounded-lg border px-3 py-1.5 text-left text-[11px] ${
                        shown && right
                          ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                          : shown && chosen
                            ? "border-red-400/60 bg-red-400/10 text-red-300"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-[#8b93ff]/50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mt-2">
                  <p className="text-[10px] text-slate-400">{QUESTIONS[qIdx].why}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (qIdx + 1 >= QUESTIONS.length) {
                        setQuizDone(true);
                        sfx.pop();
                      } else {
                        setQIdx((i) => i + 1);
                        setPicked(null);
                      }
                    }}
                    className="lab-btn lab-btn-neon mt-2 w-full"
                  >
                    {qIdx + 1 >= QUESTIONS.length ? "See score" : "Next"}
                  </button>
                </motion.div>
              )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center">
              <p className="font-display text-2xl font-bold text-[#aab3ff]">
                {score}/{QUESTIONS.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {score === QUESTIONS.length ? "Perfect — you know the pipelines!" : score >= 5 ? "Solid. Review the arch branches once more." : "Hover the vessels, then retry."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQIdx(0);
                  setPicked(null);
                  setScore(0);
                  setQuizDone(false);
                }}
                className="lab-btn mt-2 w-full"
              >
                Retry
              </button>
            </motion.div>
          )}
        </div>
      </div>
    
      <ExamSketchPanel open={exam} title="Human heart — how to draw it" steps={EXAM_STEPS} onClose={() => setExam(false)} />
</div>
  );
}
