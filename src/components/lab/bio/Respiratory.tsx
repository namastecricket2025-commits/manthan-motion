import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { Eye, EyeOff, RotateCcw, Wind, PenLine } from "lucide-react";
import { SPRING, clamp, syncViewport, useCanvasSize, useRaf, useViewport } from "../use-canvas";
import { animDt } from "@/lib/app-settings";
import { CursorTip, useCursorTip } from "../CursorTip";
import { ExamSketchPanel, useExamSketch, type ExamStep } from "../ExamSketch";
import { cartilageMaps, disposeSurfaceMaps, lungMaps, tissueMaterial, vesselMaps } from "../lab-textures";
import { useTelemetryPublisher } from "../PhysicsSim";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const PARTS: Record<string, { name: string; def: string; accent: string }> = {
  trachea: { name: "Trachea (windpipe)", def: "A rigid tube held open by 16–20 C-shaped rings of hyaline cartilage. The rings are incomplete at the back so a swallowed bolus can bulge into the oesophagus.", accent: "#67e8f9" },
  mucosa: { name: "Tracheal mucosa", def: "Ciliated, mucus-secreting lining inside the rings. The cilia sweep trapped dust upward toward the throat in the 'mucociliary escalator'.", accent: "#f9a8d4" },
  trachealis: { name: "Trachealis muscle", def: "Smooth muscle bridging the open back of each cartilage ring. It narrows the airway slightly during coughing to increase air speed.", accent: "#fca5a5" },
  carina: { name: "Carina", def: "The keel-shaped ridge where the trachea splits into the two main bronchi. It is highly sensitive — touching it triggers a cough reflex.", accent: "#fbbf24" },
  bronchusR: { name: "Right primary bronchus", def: "Wider, shorter and steeper (~25° from vertical) than the left. Because it is so steep, inhaled objects usually lodge in the right lung.", accent: "#fbbf24" },
  bronchusL: { name: "Left primary bronchus", def: "Narrower and more horizontal (~45°) because it must clear the aortic arch and the heart as it enters the left hilum.", accent: "#fbbf24" },
  rSup: { name: "Right superior lobe", def: "The upper lobe of the right lung — the only lobe that extends above the first rib into the neck. Split from the middle lobe by the horizontal fissure.", accent: "#fda4af" },
  rMid: { name: "Right middle lobe", def: "A small wedge-shaped lobe on the front of the right lung, unique to the right side. It is separated by the horizontal fissure above and the oblique fissure behind.", accent: "#fb7185" },
  rInf: { name: "Right inferior lobe", def: "The largest lobe, sitting behind and below the oblique fissure and resting on the diaphragm. Its base is the lowest point of the lung.", accent: "#f43f5e" },
  lSup: { name: "Left superior lobe", def: "Upper-left lobe plus the lingula — a tongue-like projection that is the left equivalent of the right middle lobe.", accent: "#f9a8d4" },
  lInf: { name: "Left inferior lobe", def: "Lower-left lobe below the oblique fissure, resting on the left dome of the diaphragm.", accent: "#db2777" },
  notch: { name: "Cardiac notch", def: "A deep concave cut-out on the front edge of the left lung where the heart presses in. The lingula below it wraps partly around the heart.", accent: "#a78bfa" },
  pleura: { name: "Visceral pleura", def: "A glistening serous membrane glued to the lung surface. It slides on the parietal pleura with a film of fluid so the lungs move without friction.", accent: "#a5b4fc" },
  diaphragm: { name: "Diaphragm", def: "The dome-shaped muscle that does most of the work of breathing. When it contracts the dome flattens and air is drawn in.", accent: "#22d3ee" },
  fissure: { name: "Oblique & horizontal fissures", def: "Deep grooves on the lung surface that divide it into lobes, letting each lobe slide independently during breathing. The right lung has both; the left only an oblique fissure.", accent: "#94a3b8" },
};

const EXAM_STEPS: ExamStep[] = [
  { t: "Draw the trachea", d: "A straight vertical tube. Mark 5–6 short horizontal double lines across it — those are the C-shaped cartilage rings." },
  { t: "Split at the carina", d: "At the bottom the tube divides into two bronchi: the right one steeper (~25° from vertical), the left one flatter (~45°)." },
  { t: "Right lung outline", d: "A tall curve bulging to the right, cut flat on the medial side against the trachea." },
  { t: "Divide the right lung", d: "Two lines — a horizontal fissure and an oblique fissure — give you three lobes: superior, middle and inferior." },
  { t: "Left lung outline", d: "Mirror the shape but make it slightly narrower and add a concave bite out of the front edge: the cardiac notch." },
  { t: "One fissure on the left", d: "A single oblique fissure leaves two lobes, with the small lingula below the notch." },
  { t: "Finish with the diaphragm", d: "Draw a dome under both lungs and label the pleura as the thin double line hugging each lung." },
];

interface LobeSpec {
  radius: number;
  sy: number;
  sx?: number;
  sz?: number;
  flatten?: number;
  sign: 1 | -1;
  notch?: { center: [number, number, number]; radius: number; depth: number };
  bands?: { y: number; band: number; strength: number }[];
  seed: number;
}

/**
 * Organic lung lobe: stretched ellipsoid with a flattened mediastinal face,
 * optional cardiac-notch carve, lobular surface ripple and dark fissure
 * bands baked into vertex colours.
 */
function lobeGeometry(spec: LobeSpec) {
  const { radius, sy, sx = 1, sz = 1, flatten = 0.55, sign, notch, bands = [], seed } = spec;
  const geo = new THREE.SphereGeometry(radius, 40, 40);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();
    const ripple = 1 + 0.05 * Math.sin(n.x * 8.5 + seed) * Math.cos(n.y * 7.4 - seed) + 0.028 * Math.sin(n.z * 10.3 + seed * 1.7);
    v.set(v.x * sx * ripple, v.y * sy * ripple, v.z * sz * ripple);

    // flatten the mediastinal face so the two lungs face each other cleanly
    const mv = sign * v.x;
    const lim = radius * sx * flatten;
    if (mv > lim) v.x = sign * (lim + (mv - lim) * 0.22);

    // cardiac notch / mediastinal carve
    if (notch) {
      const c = new THREE.Vector3(...notch.center);
      const d = v.distanceTo(c);
      if (d < notch.radius) {
        const t = 1 - d / notch.radius;
        const dir = v.clone().sub(c).normalize();
        v.addScaledVector(dir, -notch.depth * Math.pow(t, 1.5));
      }
    }
    pos.setXYZ(i, v.x, v.y, v.z);

    // fissure shadow bands (fissures look like dark grooves)
    let shade = 1;
    for (const b of bands) {
      shade -= b.strength * Math.exp(-Math.pow((v.y - b.y) / b.band, 2));
    }
    shade = clamp(shade, 0.45, 1);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.97;
    colors[i * 3 + 2] = shade * 0.96;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export default function Respiratory() {
  const [breathing, setBreathing] = useState(true);
  const [rate, setRate] = useState(14);
  const [view, setView] = useState<"both" | "right" | "left">("both");
  const [hover, setHover] = useState<string | null>(null);
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
  const lungGroup = useRef<THREE.Group | null>(null);
  const rightGroup = useRef<THREE.Group | null>(null);
  const leftGroup = useRef<THREE.Group | null>(null);
  const diaphragm = useRef<THREE.Mesh | null>(null);
  const orbit = useRef({ yaw: -0.2, pitch: 0.06, dist: 28, panX: 0, panY: 0 });
  const target = useRef({ yaw: -0.2, pitch: 0.06, dist: 28, panX: 0, panY: 0 });
  const t0 = useRef(performance.now() / 1000);
  const lastInteract = useRef(performance.now());
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const pinch = useRef<number | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pickables = useRef<{ mesh: THREE.Object3D; id: string }[]>([]);
  const hoverId = useRef<string | null>(null);
  const tipClock = useRef(0);
  // volumetric breathing registry: each lobe expands outward along its own
  // radial direction instead of one flat group scale (balloon look)
  const breathers = useRef<{ mesh: THREE.Mesh; base: THREE.Vector3; dir: THREE.Vector3 }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x080d18);
    sc.fog = new THREE.Fog(0x080d18, 46, 104);
    const cam = new THREE.PerspectiveCamera(42, 1, 1, 240);
    const rootG = new THREE.Group();
    sc.add(rootG);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    root.current = rootG;

    sc.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(22, 30, 26);
    sc.add(key);
    const fill = new THREE.DirectionalLight(0xbae6fd, 0.45);
    fill.position.set(-26, -6, 18);
    sc.add(fill);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.5);
    rim.position.set(-18, 18, -24);
    sc.add(rim);
    sc.add(new THREE.HemisphereLight(0xcbd5e1, 0x111827, 0.4));

    const cartilage = cartilageMaps(1.4);
    const lung = lungMaps(1.6);
    const mucosa = vesselMaps("#e8a0ad", 2);
    const cut = vesselMaps("#f6c6cc", 2);

    const hg = new THREE.Group();
    rootG.add(hg);

    const ringMat = tissueMaterial(cartilage, { color: 0xe8eef6, roughness: 0.55, bumpScale: 0.05, clearcoat: 0.25 });
    const mucosaMat = tissueMaterial(mucosa, { color: 0xf3b8c2, roughness: 0.35, bumpScale: 0.02, emissive: 0x2a0d14, emissiveIntensity: 0.15 });
    const lungMat = tissueMaterial(lung, { color: 0xffffff, roughness: 0.66, bumpScale: 0.05, clearcoat: 0.12 });
    lungMat.vertexColors = true; // fissure grooves are baked into vertex colours
    const bronchusMat = tissueMaterial(cut, { color: 0xf1c9b5, roughness: 0.5, bumpScale: 0.03 });

    /* ── trachea: 15 C-shaped hyaline rings + posterior trachealis gap ── */
    const tracheaG = new THREE.Group();
    const TOP = 8.6;
    const RINGS = 15;
    const membMat = new THREE.MeshPhysicalMaterial({ color: 0xf5b8c4, roughness: 0.45, transparent: true, opacity: 0.75, side: THREE.DoubleSide, clearcoat: 0.3 });
    for (let i = 0; i < RINGS; i++) {
      const y = TOP - i * 0.62;
      // a carrier group rotates the ring into the horizontal plane, then the
      // torus spins inside it so the C-gap always faces posterior (−z)
      const ringGroup = new THREE.Group();
      ringGroup.position.y = y;
      ringGroup.rotation.x = Math.PI / 2;
      // chunkier, higher-res C: solid hyaline cartilage with a bevelled lip
      const torus = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.27, 20, 56, Math.PI * 1.62), ringMat);
      torus.scale.set(1, 1, 1.18); // slightly proud front face, like real rings
      torus.rotation.z = -Math.PI * 0.31; // centres the ~58° gap at the back
      ringGroup.add(torus);
      if (i === 6) {
        torus.userData.id = "trachea";
        pickables.current.push({ mesh: torus, id: "trachea" });
      }
      // trachealis membrane spanning the open back of the C
      const memb = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.52), membMat);
      memb.rotation.x = -Math.PI / 2;
      memb.position.set(0, -1.06, 0);
      if (i === 7) {
        memb.userData.id = "trachealis";
        pickables.current.push({ mesh: memb, id: "trachealis" });
      }
      ringGroup.add(memb);
      tracheaG.add(ringGroup);
    }
    // inner mucosa tube (ciliated lining)
    const muc = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, TOP - 0.2, 26, 1, true), mucosaMat);
    muc.position.y = (TOP + 0.4) / 2;
    muc.userData.id = "mucosa";
    tracheaG.add(muc);
    pickables.current.push({ mesh: muc, id: "mucosa" });
    hg.add(tracheaG);

    /* ── carina + primary bronchi ── */
    const carinaOuter = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 22), ringMat);
    carinaOuter.position.set(0, 0.35, 0);
    carinaOuter.scale.set(1.5, 0.9, 1.2);
    carinaOuter.userData.id = "carina";
    hg.add(carinaOuter);
    pickables.current.push({ mesh: carinaOuter, id: "carina" });

    const bronchiTube = (pts: [number, number, number][], r: number, id: string) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, r, 16, false), bronchusMat);
      mesh.userData.id = id;
      hg.add(mesh);
      pickables.current.push({ mesh, id });
      return mesh;
    };
    bronchiTube([[0.15, 0.5, 0], [1.3, -0.3, 0.35], [2.5, -0.85, 0.6], [3.3, -1.1, 0.5]], 0.5, "bronchusR");
    bronchiTube([[-0.15, 0.5, 0], [-1.35, -0.45, 0.2], [-2.6, -1.0, 0.35], [-3.3, -1.15, 0.25]], 0.5, "bronchusL");

    /* ── lungs ── */
    const lungs = new THREE.Group();
    lungs.position.set(0, -1.2, 0);
    hg.add(lungs);
    lungGroup.current = lungs;

    // right: 3 lobes separated by the horizontal and oblique fissures
    const right = new THREE.Group();
    right.position.set(2.05, 0, 0.5);
    lungs.add(right);
    rightGroup.current = right;

    const rSup = new THREE.Mesh(
      lobeGeometry({ radius: 2.5, sy: 1.15, sx: 1.0, sz: 0.92, flatten: 0.5, sign: -1, seed: 3, bands: [{ y: -1.95, band: 0.9, strength: 0.3 }] }),
      lungMat,
    );
    rSup.position.set(0.15, 3.1, -0.2);
    rSup.userData.id = "rSup";
    right.add(rSup);
    pickables.current.push({ mesh: rSup, id: "rSup" });

    const rMid = new THREE.Mesh(
      lobeGeometry({ radius: 1.75, sy: 0.95, sx: 0.92, sz: 0.86, flatten: 0.52, sign: -1, seed: 7, bands: [{ y: 1.2, band: 0.7, strength: 0.34 }, { y: -1.15, band: 0.7, strength: 0.34 }] }),
      lungMat,
    );
    rMid.position.set(0.3, 1.15, 1.15);
    rMid.userData.id = "rMid";
    right.add(rMid);
    pickables.current.push({ mesh: rMid, id: "rMid" });

    const rInf = new THREE.Mesh(
      lobeGeometry({ radius: 2.85, sy: 1.2, sx: 1.0, sz: 0.95, flatten: 0.52, sign: -1, seed: 11, bands: [{ y: 2.1, band: 1.1, strength: 0.32 }] }),
      lungMat,
    );
    rInf.position.set(0.15, -1.9, -0.35);
    rInf.userData.id = "rInf";
    right.add(rInf);
    pickables.current.push({ mesh: rInf, id: "rInf" });

    // left: 2 lobes + the cardiac notch carved out of the superior lobe
    const left = new THREE.Group();
    left.position.set(-2.05, 0, 0.5);
    lungs.add(left);
    leftGroup.current = left;

    const lSup = new THREE.Mesh(
      lobeGeometry({
        radius: 2.65,
        sy: 1.18,
        sx: 1.0,
        sz: 0.92,
        flatten: 0.5,
        sign: 1,
        seed: 17,
        notch: { center: [0.35, -1.5, 2.0], radius: 2.15, depth: 1.15 },
        bands: [{ y: -2.4, band: 0.95, strength: 0.34 }],
      }),
      lungMat,
    );
    lSup.position.set(-0.3, 2.9, -0.1);
    lSup.userData.id = "lSup";
    left.add(lSup);
    pickables.current.push({ mesh: lSup, id: "lSup" });

    const lInf = new THREE.Mesh(
      lobeGeometry({ radius: 2.9, sy: 1.18, sx: 1.0, sz: 0.95, flatten: 0.52, sign: 1, seed: 23, bands: [{ y: 2.4, band: 1.05, strength: 0.32 }] }),
      lungMat,
    );
    lInf.position.set(-0.3, -2.1, -0.3);
    lInf.userData.id = "lInf";
    left.add(lInf);
    pickables.current.push({ mesh: lInf, id: "lInf" });

    // register every lobe for outward volumetric expansion (fix #4 breathing)
    breathers.current = [
      [rSup, 3.1],
      [rMid, 1.15],
      [rInf, -1.9],
      [lSup, 2.9],
      [lInf, -2.1],
    ].map(([mesh, y]) => ({
      mesh: mesh as THREE.Mesh,
      base: (mesh as THREE.Mesh).position.clone(),
      dir: new THREE.Vector3(
        (mesh as THREE.Mesh).position.x * 0.55,
        (y as number) * 0.32,
        (mesh as THREE.Mesh).position.z * 0.55,
      ).normalize(),
    }));

    // cardiac notch marker (pickable ring on the left lung's front edge)
    const notchMark = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.09, 8, 34, Math.PI * 1.35),
      new THREE.MeshPhysicalMaterial({ color: 0xc4b5fd, emissive: 0x4c1d95, emissiveIntensity: 0.5, roughness: 0.35, transparent: true, opacity: 0.9, clearcoat: 0.4 }),
    );
    notchMark.position.set(-0.4, 0.9, 2.55);
    notchMark.rotation.set(0.35, 0.5, 0.4);
    notchMark.userData.id = "notch";
    left.add(notchMark);
    pickables.current.push({ mesh: notchMark, id: "notch" });

    // visceral pleura sheen over both lungs
    const pleuraMat = new THREE.MeshPhysicalMaterial({
      color: 0xc7d2fe,
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      depthWrite: false,
    });
    [rSup, rMid, rInf, lSup, lInf].forEach((lobe) => {
      const shell = new THREE.Mesh(lobe.geometry.clone(), pleuraMat);
      // parent to the lobe itself so the sheen inherits every breathing
      // move/scale — as a sibling it would lag behind the expanding lobe
      shell.scale.setScalar(1.018);
      shell.userData.id = "pleura";
      shell.raycast = () => undefined; // never steal the lobe's hover
      lobe.add(shell);
    });

    // fissure groove markers
    const fissureMat = new THREE.MeshStandardMaterial({ color: 0x7c2d3a, roughness: 0.85, transparent: true, opacity: 0.75 });
    const fissGeo = new THREE.TorusGeometry(2.6, 0.05, 6, 40, Math.PI * 0.95);
    const fissR = new THREE.Mesh(fissGeo, fissureMat);
    fissR.position.set(2.2, 0.35, 0.4);
    fissR.rotation.set(1.25, 0.2, -0.35);
    fissR.userData.id = "fissure";
    hg.add(fissR);
    pickables.current.push({ mesh: fissR, id: "fissure" });

    const fissL = new THREE.Mesh(fissGeo, fissureMat);
    fissL.position.set(-2.25, 0.25, 0.4);
    fissL.rotation.set(1.2, -0.2, 0.35);
    fissL.userData.id = "fissure";
    hg.add(fissL);
    pickables.current.push({ mesh: fissL, id: "fissure" });

    // diaphragm dome
    const dia = new THREE.Mesh(
      new THREE.SphereGeometry(6.2, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshPhysicalMaterial({ color: 0xb45309, roughness: 0.6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, clearcoat: 0.2 }),
    );
    dia.position.set(0, -6.1, 0);
    dia.rotation.x = Math.PI;
    dia.userData.id = "diaphragm";
    hg.add(dia);
    pickables.current.push({ mesh: dia, id: "diaphragm" });
    diaphragm.current = dia;

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
      breathers.current = [];
    };
  }, [canvasRef]);

  /* side isolation */
  useEffect(() => {
    if (rightGroup.current) rightGroup.current.visible = view !== "left";
    if (leftGroup.current) leftGroup.current.visible = view !== "right";
  }, [view]);

  const setHoverFromRay = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c || !camera.current || !root.current) return;
    const r = c.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    root.current.updateMatrixWorld(true);
    raycaster.current.setFromCamera(ndc, camera.current);
    const hits = raycaster.current.intersectObjects(pickables.current.map((p) => p.mesh), false);
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
    // idle auto-rotate — stands still in Motionless Mode
    if (dragging.current === null && since > 1.4) tgt.yaw += animDt(dt) * 0.1;
    // Exponential chase instead of a velocity integrator: the orbit state
    // simply closes a frame-rate-independent fraction of the remaining error
    // every frame, so pointer motion can never recurse through state and
    // overshoot — rotation is perfectly fluid with zero spring-back jitter.
    const follow = 1 - Math.pow(0.002, dt); // ≈11% of remaining error per 60fps frame
    o.yaw += (tgt.yaw - o.yaw) * follow;
    o.pitch = clamp(o.pitch + (tgt.pitch - o.pitch) * follow, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
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

    // Natural breathing — NOT a linear balloon scale:
    //  · asymmetric cycle (quick inhale, slower exhale, brief end-expiratory rest)
    //  · each lobe expands volumetrically along its own outward vector
    //  · rib flare (±z rotation), whole-chest lift, diaphragm descends & flattens
    const period = 60 / rate;
    const cyc = breathing ? (t % period) / period : 1;
    const inhale = breathing
      ? cyc < 0.42
        ? 0.5 - 0.5 * Math.cos((cyc / 0.42) * Math.PI)
        : cyc < 0.9
          ? 0.5 + 0.5 * Math.cos(((cyc - 0.42) / 0.48) * Math.PI)
          : 0
      : 0.5; // held breath sits mid-tidal
    const lg = lungGroup.current;
    if (lg) lg.scale.set(1 + inhale * 0.025, 1 + inhale * 0.012, 1 + inhale * 0.025);
    for (const b of breathers.current) {
      b.mesh.position.copy(b.base).addScaledVector(b.dir, inhale * 0.17);
      b.mesh.scale.setScalar(1 + inhale * 0.05);
    }
    if (rightGroup.current) rightGroup.current.rotation.z = -inhale * 0.022;
    if (leftGroup.current) leftGroup.current.rotation.z = inhale * 0.022;
    if (root.current) root.current.position.y = inhale * 0.1; // chest lift
    if (diaphragm.current) {
      // contracting diaphragm flattens AND descends — that drop is what
      // creates the negative pressure the lungs expand into
      diaphragm.current.position.y = -6.1 - inhale * 0.4;
      diaphragm.current.scale.set(1 + inhale * 0.05, 1 - inhale * 0.11, 1 + inhale * 0.05);
    }

    renderer.render(sc, cam);
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 12, 56);
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
      if (pinch.current != null) target.current.dist = clamp(target.current.dist * (pinch.current / Math.max(1, d)), 12, 56);
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

  // publish live respiratory telemetry
  const publish = useTelemetryPublisher();
  useEffect(() => {
    const tidal = 500; // mL tidal volume
    const minute = rate * (tidal / 1000); // minute ventilation L/min
    publish({
      subject: "Biology · Respiratory",
      rows: [
        { k: "Breath rate", v: `${rate} /min` },
        { k: "Minute ventilation", v: `${minute.toFixed(1)} L/min` },
        { k: "Tidal volume", v: `≈ ${tidal} mL` },
        { k: "Alveolar O₂", v: breathing ? "exchanging" : "held", accent: breathing ? "#34d399" : "#fbbf24" },
      ],
      equation: "V̇ = f × V_T",
      eqNote: "Minute ventilation is breaths per minute times tidal volume — about 6 L/min at rest.",
      signal: clamp01(0.5 - 0.5 * Math.cos((t0.current / (60 / rate)) * Math.PI * 2)),
      accent: "#67e8f9",
    });
  }, [rate, breathing, publish]);

  return (
    <div className="lab-split">
      <div className="lab-stage-pane lab-glass p-2.5 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Respiratory system — lobes &amp; cartilaginous airway</p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Tap any lobe, ring or vessel for a 2-sentence explanation · drag to orbit · pinch or scroll to zoom
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
            <button type="button" onClick={() => setBreathing((v) => !v)} className={`lab-btn !px-2.5 ${breathing ? "lab-btn--active" : ""}`}>
              <Wind className="h-3.5 w-3.5" />
              {breathing ? "Breathing" : "Held"}
            </button>
            <button
              type="button"
              onClick={() => {
                target.current = { yaw: -0.2, pitch: 0.06, dist: 28, panX: 0, panY: 0 };
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
            {view === "both" && (
              <span className="lab-chip border-white/15 bg-black/55 text-[10px]">
                Right 3 lobes · left 2 lobes + cardiac notch
              </span>
            )}
            {view === "right" && <span className="lab-chip border-[#ff647c]/30 bg-black/55 text-[10px] text-[#ff8a9a]">Right lung — 3 lobes</span>}
            {view === "left" && <span className="lab-chip border-[#a78bfa]/30 bg-black/55 text-[10px] text-[#c4b5fd]">Left lung — 2 lobes + notch</span>}
          </div>
          <CursorTip tip={tip} hostRef={wrapRef} width={268} />
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
            <Eye className="mr-1 inline h-3 w-3" /> Isolation view
          </p>
          <div className="lab-tabs">
            {(
              [
                { key: "both", label: "Both" },
                { key: "right", label: "Right" },
                { key: "left", label: "Left" },
              ] as const
            ).map((v) => (
              <button key={v.key} type="button" onClick={() => setView(v.key)} className={`lab-tab text-xs ${view === v.key ? "lab-tab--on" : ""}`}>
                {v.key !== "both" && (view === v.key ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />)}
                {v.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            {view === "both" && "The right lung carries three lobes (superior, middle, inferior); the left has only two because the heart takes the space."}
            {view === "right" && "Horizontal fissure separates superior from middle; the oblique fissure separates middle from inferior."}
            {view === "left" && "The cardiac notch is cut into the superior lobe's front edge — feel the concave dip with the lingula below it."}
          </p>
        </div>

        <div className="lab-rule" />

        <div>
          <p className="lab-label mb-2">
            <Wind className="mr-1 inline h-3 w-3 text-[#22d3ee]" /> Breathing
          </p>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Rate</span>
            <span className="lab-value text-slate-200">{rate} /min</span>
          </div>
          <input type="range" className="lab-range mt-1.5" min={8} max={30} step={1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
            <span>Tidal volume ≈ 500 mL</span>
            <span>Rings in model: 15 C-shaped</span>
            <span>Bronchus angle R 25° / L 45°</span>
            <span>Alveoli ≈ 480 million</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <p className="lab-label mb-1.5">Exam hooks</p>
          <ul className="space-y-1 text-[11px] leading-relaxed text-slate-400">
            <li>• Right main bronchus is wider and more vertical — aspirated objects land here.</li>
            <li>• The carina is the last cartilage: it splits the airway at the level of T4/T5.</li>
            <li>• Only the left lung has a cardiac notch and lingula.</li>
          </ul>
        </div>
      </div>
    
      <ExamSketchPanel open={exam} title="Lungs & airway — how to draw them" steps={EXAM_STEPS} onClose={() => setExam(false)} />
</div>
  );
}
