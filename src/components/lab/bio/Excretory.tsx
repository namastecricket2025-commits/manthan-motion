import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { Droplets, Eye, EyeOff, Gauge, RotateCcw, PenLine } from "lucide-react";
import { SPRING, clamp, syncViewport, useCanvasSize, useRaf, useViewport } from "../use-canvas";
import { CursorTip, useCursorTip } from "../CursorTip";
import { ExamSketchPanel, useExamSketch, type ExamStep } from "../ExamSketch";
import { disposeSurfaceMaps, kidneyCortexMaps, medullaMaps, tissueMaterial, vesselMaps } from "../lab-textures";

const PARTS: Record<string, { name: string; def: string; accent: string }> = {
  aorta: { name: "Abdominal aorta", def: "The midline artery behind the kidneys. It gives off a renal artery to each kidney near the L1–L2 vertebrae.", accent: "#ff647c" },
  vena: { name: "Inferior vena cava", def: "Lies to the right of the aorta and takes the renal veins away. The right renal vein is short because the kidney is already close to it.", accent: "#38bdf8" },
  kidneyL: { name: "Left kidney", def: "Sits higher (about T12–L3) because there is no liver above it on the left side. Its hilum faces medially toward the aorta.", accent: "#fbbf24" },
  kidneyR: { name: "Right kidney", def: "Roughly 1–2 cm lower than the left, pushed down by the bulk of the liver. It is usually marginally smaller than the left kidney.", accent: "#fbbf24" },
  capsule: { name: "Fibrous capsule", def: "A tough collagen coat that keeps the kidney's shape and protects the delicate cortex underneath. It peels off easily in a fresh specimen.", accent: "#fca5a5" },
  cortex: { name: "Renal cortex", def: "The pale outer layer, about 1 cm deep, where the glomeruli filter blood. Around a million nephrons start here in each kidney.", accent: "#f6c9a8" },
  pyramid: { name: "Renal pyramid", def: "A cone of medulla with its base at the cortex and its point (papilla) aimed at a calyx. Collecting ducts give it its striped appearance.", accent: "#fb923c" },
  calyx: { name: "Minor & major calyces", def: "Cup-shaped funnels that catch urine from each papilla. Minor calyces merge into 2–3 major calyces.", accent: "#fde68a" },
  pelvis: { name: "Renal pelvis", def: "The wide funnel inside the hilum where all the calyces converge. It narrows into the ureter and acts as the kidney's collecting tank.", accent: "#fde68a" },
  hilum: { name: "Renal hilum", def: "The concave notch on the medial border where the renal artery, renal vein and ureter enter and leave. The vein is in front of the artery.", accent: "#a78bfa" },
  arteryL: { name: "Left renal artery", def: "A short direct branch of the aorta. Because the aorta is slightly left of midline, the left artery is shorter than the right one.", accent: "#ff647c" },
  arteryR: { name: "Right renal artery", def: "Longer than the left and passes behind the inferior vena cava on its way to the right hilum — a classic exam detail.", accent: "#ff647c" },
  veinL: { name: "Left renal vein", def: "Much longer, and crosses in front of the aorta to reach the IVC. It also receives the left gonadal and suprarenal veins.", accent: "#38bdf8" },
  veinR: { name: "Right renal vein", def: "Short and direct — it drains straight into the adjacent inferior vena cava without crossing anything.", accent: "#38bdf8" },
  ureter: { name: "Ureter", def: "A muscular tube that carries urine from the pelvis to the bladder. Peristaltic waves push it along about three times a minute.", accent: "#facc15" },
  bladder: { name: "Urinary bladder", def: "A detrusor-muscle sac that stores urine until micturition. It normally holds about 400–500 mL.", accent: "#facc15" },
};

const EXAM_STEPS: ExamStep[] = [
  { t: "Two vertical vessels first", d: "Draw the abdominal aorta in the midline and the inferior vena cava just to its right — everything else hangs off these." },
  { t: "Place the kidneys", d: "One bean each side at roughly L1–L2, and draw the RIGHT kidney noticeably LOWER to make room for the liver." },
  { t: "Shape the beans", d: "Each kidney is a bean with a concave notch on its medial border — the hilum, where vessels enter." },
  { t: "Attach the vessels", d: "A renal artery leaves the aorta and a renal vein joins the IVC. Make the right artery pass BEHIND the IVC; the left vein crosses IN FRONT of the aorta." },
  { t: "Open the cross-section", d: "Draw a wedge cut: pale outer cortex, then 6–8 triangles with their points facing inwards — the pyramids." },
  { t: "Funnel it out", d: "Cup each papilla with a minor calyx, merge them into the pelvis, then run the ureter down to the bladder." },
  { t: "Label the asymmetry", d: "Write 'right lower (liver)' next to the right kidney — examiners look for exactly that fact." },
];

const CHECKS: { q: string; options: string[]; ok: number; why: string }[] = [
  { q: "Which kidney sits lower and why?", options: ["Left — spleen", "Right — liver", "Equal height", "Right — stomach"], ok: 1, why: "The liver occupies the right upper abdomen and physically displaces the right kidney downward." },
  { q: "Which renal artery passes behind the IVC?", options: ["Left", "Right", "Both", "Neither"], ok: 1, why: "The right renal artery is longer and travels posterior to the inferior vena cava." },
  { q: "What drains a renal papilla directly?", options: ["Major calyx", "Renal pelvis", "Minor calyx", "Ureter"], ok: 2, why: "Each papilla is cupped by one minor calyx; those merge into major calyces, then the pelvis." },
  { q: "Where are the glomeruli found?", options: ["Medulla", "Renal pelvis", "Cortex", "Capsule"], ok: 2, why: "Glomeruli sit in the cortex — the outer ~1 cm layer — which is why it looks granular." },
];

/** Reniform (bean) kidney: a sphere with a concave medial hilum and bulging poles. */
function kidneyGeometry(seed: number) {
  const geo = new THREE.SphereGeometry(1, 48, 48);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // medial side is +x; scoop it in at mid-height to form the hilum
    const medial = Math.max(0, v.x);
    const dip = Math.exp(-Math.pow(v.y / 0.4, 2));
    v.x -= medial * 0.8 * dip;
    // poles bulge slightly outward like a real bean
    const pole = Math.pow(Math.abs(v.y), 2.2);
    v.x += (v.x > 0 ? 0.06 : 0.02) * pole;
    v.y *= 1 + 0.04 * pole;
    v.z *= 0.72;
    const rough = 1 + 0.014 * Math.sin(v.x * 9 + seed) * Math.cos(v.y * 7.5 - seed) + 0.01 * Math.sin(v.z * 12 + seed);
    v.multiplyScalar(rough);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export default function Excretory() {
  const [crossSection, setCrossSection] = useState(false);
  const [flow, setFlow] = useState(1);
  const [hover, setHover] = useState<string | null>(null);
  const [cIdx, setCIdx] = useState(0);
  const [cPicked, setCPicked] = useState<number | null>(null);
  const [cScore, setCScore] = useState(0);
  const [cDone, setCDone] = useState(false);
  const { tip, show: showTip, hide: hideTip } = useCursorTip();
  const [exam, setExam] = useState(false);

  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const vp = useViewport();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const root = useRef<THREE.Group | null>(null);
  useExamSketch(root, exam, canvasRef);
  const kidneyL = useRef<THREE.Group | null>(null);
  const kidneyR = useRef<THREE.Group | null>(null);
  const flareMats = useRef<THREE.Material[]>([]);
  const planes = useRef<[THREE.Plane, THREE.Plane]>([new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)]);
  const flowCurves = useRef<THREE.Curve<THREE.Vector3>[]>([]);
  const pulses = useRef<THREE.Mesh[]>([]);
  const orbit = useRef({ yaw: 0.08, pitch: 0.1, dist: 26, panX: 0, panY: 0 });
  const target = useRef({ yaw: 0.08, pitch: 0.1, dist: 26, panX: 0, panY: 0 });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const lastInteract = useRef(performance.now());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const pinch = useRef<number | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pickables = useRef<{ mesh: THREE.Object3D; id: string }[]>([]);
  const hoverId = useRef<string | null>(null);
  const tipClock = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;

    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x080d18);
    sc.fog = new THREE.Fog(0x080d18, 42, 96);
    const cam = new THREE.PerspectiveCamera(42, 1, 1, 240);
    const rootG = new THREE.Group();
    sc.add(rootG);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    root.current = rootG;

    sc.add(new THREE.AmbientLight(0xffffff, 0.58));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(20, 26, 22);
    sc.add(key);
    const fill = new THREE.DirectionalLight(0xfecaca, 0.4);
    fill.position.set(-22, -6, 16);
    sc.add(fill);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.45);
    rim.position.set(-16, 14, -22);
    sc.add(rim);
    sc.add(new THREE.HemisphereLight(0xe2e8f0, 0x111827, 0.42));

    const cortexMap = kidneyCortexMaps(2);
    const medullaMap = medullaMaps(1);
    const arteryMap = vesselMaps("#b0182f", 3);
    const veinMap = vesselMaps("#1d5f9e", 3);
    const collectMap = vesselMaps("#f5d97a", 2);

    const hg = new THREE.Group();
    rootG.add(hg);

    /* ── great vessels ── */
    const arteryMat = tissueMaterial(arteryMap, { color: 0xffffff, roughness: 0.44, bumpScale: 0.02, clearcoat: 0.3 });
    const veinMat = tissueMaterial(veinMap, { color: 0xffffff, roughness: 0.44, bumpScale: 0.02, clearcoat: 0.3 });
    const collectMat = tissueMaterial(collectMap, { color: 0xffffff, roughness: 0.5, bumpScale: 0.02 });

    const vessel = (pts: [number, number, number][], r: number, mat: THREE.Material, id: string) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 16, false), mat);
      mesh.userData.id = id;
      hg.add(mesh);
      pickables.current.push({ mesh, id });
      return { mesh, curve };
    };

    vessel([[0.55, 9.2, -2.0], [0.55, 2.0, -2.0], [0.5, -2.6, -1.9], [0.45, -8.6, -1.8]], 0.6, arteryMat, "aorta");
    vessel([[2.25, 9.2, -1.8], [2.25, 2.0, -1.8], [2.2, -2.6, -1.7], [2.15, -8.6, -1.6]], 0.7, veinMat, "vena");

    /* ── kidneys: reniform, right one lower ── */
    const build = (side: "left" | "right") => {
      const g = new THREE.Group();
      hg.add(g);

      const bodyGeo = kidneyGeometry(side === "left" ? 2 : 5);
      const bodyMat = tissueMaterial(cortexMap, {
        color: 0xffffff,
        roughness: 0.62,
        bumpScale: 0.05,
        side: THREE.DoubleSide,
        clearcoat: 0.15,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.scale.set(2.55, 3.3, 2.15);
      body.userData.id = side === "left" ? "kidneyL" : "kidneyR";
      g.add(body);
      pickables.current.push({ mesh: body, id: side === "left" ? "kidneyL" : "kidneyR" });

      // fibrous capsule sheen
      const capsMat = new THREE.MeshPhysicalMaterial({ color: 0xf7b8b8, roughness: 0.3, transparent: true, opacity: 0.14, side: THREE.DoubleSide, clearcoat: 0.8, depthWrite: false });
      const caps = new THREE.Mesh(bodyGeo.clone(), capsMat);
      caps.scale.set(2.6, 3.36, 2.2);
      caps.raycast = () => undefined;
      g.add(caps);

      /* interior: cortex, 7 pyramids, calyces, pelvis */
      const cortexMat = tissueMaterial(cortexMap, { color: 0xffe0c4, roughness: 0.5, opacity: 0.62, side: THREE.DoubleSide, bumpScale: 0.03 });
      const cortex = new THREE.Mesh(bodyGeo.clone(), cortexMat);
      cortex.scale.set(2.18, 2.9, 1.85);
      cortex.userData.id = "cortex";
      g.add(cortex);
      pickables.current.push({ mesh: cortex, id: "cortex" });

      const pyrMat = tissueMaterial(medullaMap, { color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide, bumpScale: 0.04 });
      const calyxMat = new THREE.MeshPhysicalMaterial({ color: 0xfde68a, roughness: 0.35, transparent: true, opacity: 0.5, side: THREE.DoubleSide, clearcoat: 0.4 });
      const N = 7;
      for (let i = 0; i < N; i++) {
        // the medullary pyramids ring the renal pelvis in the frontal plane,
        // every papilla aimed inwards at its own minor calyx
        const ang = (i / N) * Math.PI * 2;
        const bx = -0.62 + 0.22 * Math.cos(ang);
        const by = Math.sin(ang) * 1.95;
        const bz = Math.cos(ang) * 1.02;
        const base = new THREE.Vector3(bx, by, bz);
        const apex = new THREE.Vector3(0.7, by * 0.32, bz * 0.34);
        const dir = apex.clone().sub(base);
        const len = dir.length();
        const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.62, len, 20, 1), pyrMat);
        pyr.position.copy(base.clone().add(apex).multiplyScalar(0.5));
        pyr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        pyr.userData.id = "pyramid";
        g.add(pyr);
        pickables.current.push({ mesh: pyr, id: "pyramid" });

        // minor calyx cup around the papilla
        const cal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.34, 14, 1, true), calyxMat);
        cal.position.copy(apex);
        quatToward(cal, apex, new THREE.Vector3(0.95, 0, 0));
        cal.userData.id = "calyx";
        g.add(cal);
        pickables.current.push({ mesh: cal, id: "calyx" });
      }

      // renal pelvis funnel + hilum marker
      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.05, 1.7, 18, 1, true), collectMat);
      pelvis.position.set(0.75, -0.5, 0);
      pelvis.rotation.z = -0.42;
      pelvis.userData.id = "pelvis";
      g.add(pelvis);
      pickables.current.push({ mesh: pelvis, id: "pelvis" });

      const hilum = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.13, 10, 26, Math.PI * 1.3),
        new THREE.MeshPhysicalMaterial({ color: 0xc4b5fd, emissive: 0x4c1d95, emissiveIntensity: 0.4, roughness: 0.4, clearcoat: 0.4 }),
      );
      hilum.position.set(0.68, 0.25, 0);
      hilum.rotation.set(0, Math.PI / 2, 0.4);
      hilum.userData.id = "hilum";
      g.add(hilum);
      pickables.current.push({ mesh: hilum, id: "hilum" });

      flareMats.current.push(bodyMat, cortexMat);
      return g;
    };

    const quatToward = (obj: THREE.Object3D, from: THREE.Vector3, towards: THREE.Vector3) => {
      const dir = towards.clone().sub(from);
      if (dir.lengthSq() < 1e-6) return;
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    };

    const kL = build("left");
    kL.position.set(-3.55, 1.9, 0.25);
    kL.rotation.set(0.06, -0.4, 0.1);
    kidneyL.current = kL;

    const kR = build("right");
    kR.position.set(3.55, -0.25, 0.25); // right kidney sits ~2 cm lower
    kR.rotation.set(0.06, Math.PI + 0.42, -0.09); // hilum still faces the midline
    kidneyR.current = kR;

    /* ── renal vessels off the great vessels ── */
    vessel([[0.55, 1.9, -1.95], [-0.9, 1.9, -1.2], [-2.4, 1.9, -0.35], [-2.8, 1.9, -0.05]], 0.28, arteryMat, "arteryL");
    vessel([[0.55, -0.25, -1.95], [1.5, -0.25, -2.0], [2.7, -0.25, -1.0], [3.4, -0.25, -0.2]], 0.27, arteryMat, "arteryR"); // passes behind the IVC
    vessel([[-2.8, 1.75, 0.15], [-0.4, 1.45, -0.6], [2.25, 1.45, -1.7]], 0.3, veinMat, "veinL");
    vessel([[3.4, 0.15, 0.1], [2.8, 0.15, -1.0], [2.25, 0.15, -1.7]], 0.28, veinMat, "veinR");

    /* ── ureters + bladder with peristaltic pulses ── */
    const uL = vessel([[-2.85, 0.7, 0.4], [-3.5, -1.6, 0.25], [-3.15, -4.6, 0.35], [-1.35, -7.7, 0.45]], 0.22, collectMat, "ureter");
    const uR = vessel([[2.85, -0.85, 0.4], [3.7, -3.0, 0.25], [3.35, -5.6, 0.35], [1.35, -7.8, 0.45]], 0.22, collectMat, "ureter");
    flowCurves.current = [uL.curve, uR.curve];

    const bladder = new THREE.Mesh(
      new THREE.SphereGeometry(1.85, 28, 28),
      new THREE.MeshPhysicalMaterial({ color: 0xf2cf6e, roughness: 0.42, transparent: true, opacity: 0.9, clearcoat: 0.4 }),
    );
    bladder.position.set(0, -8.2, 0.35);
    bladder.scale.set(1.35, 0.95, 0.95);
    bladder.userData.id = "bladder";
    hg.add(bladder);
    pickables.current.push({ mesh: bladder, id: "bladder" });

    const pulseMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
      hg.add(p);
      pulseMeshes.push(p);
    }
    pulses.current = pulseMeshes;

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
      root.current = null;
      pickables.current = [];
      flowCurves.current = [];
      pulses.current = [];
      flareMats.current = [];
    };
  }, [canvasRef]);

  /* cross-section toggle drives the real clipping planes */
  useEffect(() => {
    const list = crossSection ? planes.current : [];
    flareMats.current.forEach((m) => {
      const mm = m as THREE.Material & { clippingPlanes: THREE.Plane[] | null };
      mm.clippingPlanes = crossSection ? list : [];
      mm.needsUpdate = true;
    });
  }, [crossSection]);

  const setHoverFromRay = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c || !camera.current || !root.current) return;
    const r = c.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    root.current.updateMatrixWorld(true);
    raycaster.current.setFromCamera(ndc, camera.current);
    // skip hidden internals so they cannot be picked while the body is opaque
    const meshes = pickables.current
      .filter((p) => crossSection || !["cortex", "pyramid", "calyx", "pelvis"].includes(p.id))
      .map((p) => p.mesh);
    const hits = raycaster.current.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const id = ((hits[0].object as THREE.Mesh).userData.id as string) || "";
      const part = PARTS[id];
      if (!part) return;
      const same = id === hoverId.current;
      hoverId.current = id;
      setHover(id);
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

  useRaf((dt, t) => {
    const renderer = ren.current;
    const sc = scene.current;
    const cam = camera.current;
    const grp = root.current;
    if (!renderer || !sc || !cam || !grp) return;

    const tgt = target.current;
    const o = orbit.current;
    const since = (performance.now() - lastInteract.current) / 1000;
    if (dragging.current === null && since > 1.4) tgt.yaw += dt * 0.1;
    const yd = tgt.yaw - o.yaw;
    const pd = tgt.pitch - o.pitch;
    vel.current.yaw = vel.current.yaw * Math.pow(0.05, dt) + yd * 8 * dt;
    vel.current.pitch = vel.current.pitch * Math.pow(0.05, dt) + pd * 8 * dt;
    o.yaw += vel.current.yaw;
    o.pitch = clamp(o.pitch + vel.current.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
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

    // keep the cut planes aligned with the rotating bench
    if (crossSection) {
      const q = new THREE.Quaternion();
      grp.getWorldQuaternion(q);
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      [kidneyL.current, kidneyR.current].forEach((kg, i) => {
        if (!kg) return;
        const wp = new THREE.Vector3();
        kg.getWorldPosition(wp);
        planes.current[i].setFromNormalAndCoplanarPoint(n, wp);
      });
    }

    // peristalsis: urine boluses marching down the ureters
    const curves = flowCurves.current;
    pulses.current.forEach((p, i) => {
      if (curves.length < 2) return;
      const curve = curves[i % 2];
      const speed = 0.08 * flow;
      const u = (t * speed + i * 0.17) % 1;
      p.position.copy(curve.getPointAt(u));
      const s = 0.8 + 0.4 * Math.sin(t * 3 + i);
      p.scale.setScalar(s * (0.7 + flow * 0.4));
    });

    renderer.render(sc, cam);
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 12, 52);
      lastInteract.current = performance.now();
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
      const d = Math.hypot(vals[0].x - vals[1].x, vals[0].y - vals[1].y);
      if (pinch.current != null) target.current.dist = clamp(target.current.dist * (pinch.current / Math.max(1, d)), 12, 52);
      pinch.current = d;
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
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) dragging.current = null;
  };

  const hoverPart = hover ? PARTS[hover] : null;

  return (
    <div className="lab-split">
      <div className="lab-stage-pane lab-glass p-2.5 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Excretory system — reniform kidneys</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Right kidney sits lower (liver) · tap any pyramid, calyx or vessel for its role
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExam((v) => !v)}
              className={`lab-btn !px-2.5 ${exam ? "lab-btn--active" : ""}`}
              title="Ghost the model and overlay ink outlines you can copy by hand"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exam Sketch</span>
            </button>
            <button type="button" onClick={() => setCrossSection((v) => !v)} className={`lab-btn !px-2.5 ${crossSection ? "lab-btn--active" : ""}`}>
              {crossSection ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {crossSection ? "Close cut" : "Cross-section"}
            </button>
            <button
              type="button"
              onClick={() => {
                target.current = { yaw: 0.08, pitch: 0.1, dist: 26, panX: 0, panY: 0 };
                orbit.current = { ...target.current };
              }}
              className="lab-btn !px-2.5"
            >
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
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            <span className="lab-chip border-white/15 bg-black/55 text-[10px]">Left ↑ · Right ↓ (liver)</span>
            {crossSection && <span className="lab-chip border-[#fbbf24]/40 bg-black/55 text-[10px] text-[#fde68a]">Cortex → 7 pyramids → calyces → pelvis</span>}
          </div>
          <CursorTip tip={tip} hostRef={wrapRef} width={266} />
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
            <Gauge className="mr-1 inline h-3 w-3 text-[#fbbf24]" /> Renal flow
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Urine production</span>
            <span className="lab-value text-slate-200">{flow.toFixed(2)}×</span>
          </div>
          <input type="range" className="lab-range mt-1.5" min={0.2} max={2} step={0.05} value={flow} onChange={(e) => setFlow(Number(e.target.value))} />
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-slate-500">
            <span>GFR ≈ 125 mL/min</span>
            <span>Renal plasma flow ≈ 625 mL/min</span>
            <span>≈ 20–25% of cardiac output</span>
            <span>≈ 180 L filtered per day</span>
          </div>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">
            <Droplets className="mr-1 inline h-3 w-3 text-[#38bdf8]" /> Rapid check
          </p>
          {!cDone ? (
            <>
              <p className="mb-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[12px] font-semibold text-slate-100">
                Q{cIdx + 1}/{CHECKS.length} · {CHECKS[cIdx].q}
              </p>
              <div className="space-y-1.5">
                {CHECKS[cIdx].options.map((opt, oi) => {
                  const shown = cPicked !== null;
                  const right = oi === CHECKS[cIdx].ok;
                  const chosen = cPicked === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={shown}
                      onClick={() => {
                        setCPicked(oi);
                        if (right) setCScore((s) => s + 1);
                      }}
                      className={`w-full rounded-lg border px-3 py-1.5 text-left text-[11px] ${
                        shown && right
                          ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                          : shown && chosen
                            ? "border-red-400/60 bg-red-400/10 text-red-300"
                            : "border-white/10 bg-black/20 text-slate-300 hover:border-[#fbbf24]/50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {cPicked !== null && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mt-2">
                  <p className="text-[10px] text-slate-400">{CHECKS[cIdx].why}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (cIdx + 1 >= CHECKS.length) setCDone(true);
                      else {
                        setCIdx((i) => i + 1);
                        setCPicked(null);
                      }
                    }}
                    className="lab-btn lab-btn-neon mt-2 w-full"
                  >
                    {cIdx + 1 >= CHECKS.length ? "See score" : "Next"}
                  </button>
                </motion.div>
              )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center">
              <p className="font-display text-2xl font-bold text-[#fbbf24]">
                {cScore}/{CHECKS.length}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCIdx(0);
                  setCPicked(null);
                  setCScore(0);
                  setCDone(false);
                }}
                className="lab-btn mt-2 w-full"
              >
                Retry
              </button>
            </motion.div>
          )}
        </div>
      </div>
    
      <ExamSketchPanel open={exam} title="Kidneys — how to draw them" steps={EXAM_STEPS} onClose={() => setExam(false)} />
</div>
  );
}
