import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { Activity, Pause, Play, RotateCcw } from "lucide-react";
import { sfx } from "../lab-sound";
import { SPRING, clamp, useCanvasSize, useRaf } from "../use-canvas";

const PARTS: Record<string, { name: string; def: string }> = {
  ra: { name: "Right atrium", def: "Receives deoxygenated blood from the superior/inferior venae cavae. Thin-walled, low pressure." },
  rv: { name: "Right ventricle", def: "Anterior crescent — pumps deoxygenated blood into the pulmonary trunk at ~25 mmHg. Wall about half as thick as LV." },
  la: { name: "Left atrium", def: "Posterior chamber behind RA — receives oxygenated blood from 4 pulmonary veins." },
  lv: { name: "Left ventricle", def: "Thick conical muscle (up to 15 mm) forming the apex. Generates 120 mmHg to drive systemic circulation." },
  septum: { name: "Interventricular septum", def: "Muscular wall separating LV/RV — asymmetric, bulges into RV because LV pressure is 5× higher." },
  aorta: { name: "Aortic arch", def: "Largest artery. Ascending aorta → arch curving over left pulmonary artery → descending aorta. Three branches on top." },
  brachio: { name: "Brachiocephalic trunk", def: "First arch branch — splits into right common carotid + right subclavian." },
  carotid: { name: "Left common carotid", def: "Second arch branch — ascends to left head/neck." },
  subclavian: { name: "Left subclavian", def: "Third arch branch — feeds left arm." },
  pulmTrunk: { name: "Pulmonary trunk", def: "Wide vessel in front of aorta, from RV. Bifurcates at carina into left & right pulmonary arteries." },
  pulmL: { name: "Left pulmonary artery", def: "Passes under aortic arch to left lung. Carries deoxygenated blood — only artery to do so." },
  pulmR: { name: "Right pulmonary artery", def: "Passes behind ascending aorta & SVC to right lung." },
  svc: { name: "Superior vena cava", def: "Vertical blue vessel entering RA superiorly — drains head, neck, upper limbs." },
  ivc: { name: "Inferior vena cava", def: "Vertical vessel entering RA inferiorly — drains abdomen and legs. Enters from below diaphragm." },
  pulmVein: { name: "Pulmonary veins (4)", def: "Return oxygenated blood to LA — posterior. Two left, two right." },
};

const QUESTIONS: { q: string; options: string[]; ok: number; why: string }[] = [
  { q: "Which chamber pumps deoxygenated blood to the lungs?", options: ["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"], ok: 1, why: "Right ventricle → pulmonary trunk → lungs." },
  { q: "Which vessel crosses IN FRONT of the aorta?", options: ["Superior vena cava", "Pulmonary trunk", "Inferior vena cava", "Pulmonary veins"], ok: 1, why: "Pulmonary trunk is anterior to the ascending aorta — a key landmark." },
  { q: "How many branches arise from the aortic arch top?", options: ["1", "2", "3", "4"], ok: 2, why: "Brachiocephalic, left common carotid, left subclavian — three." },
  { q: "Which chamber has the thickest wall?", options: ["Right atrium", "Left atrium", "Right ventricle", "Left ventricle"], ok: 3, why: "LV is ~2× thicker than RV to generate systemic pressure." },
  { q: "Where do the venae cavae enter?", options: ["Left atrium", "Right ventricle", "Right atrium", "Left ventricle"], ok: 2, why: "SVC superiorly, IVC inferiorly — both vertically into RA." },
  { q: "Which vessels carry oxygenated blood to the left atrium?", options: ["Venae cavae", "Pulmonary artery", "Aorta", "Pulmonary veins"], ok: 3, why: "Four pulmonary veins are the only veins with oxygenated blood." },
  { q: "Where does systemic blood leave the heart?", options: ["Pulmonary trunk", "Aorta", "Vena cava", "Pulmonary vein"], ok: 1, why: "LV → aortic valve → ascending aorta → arch → body." },
  { q: "Why is the septum asymmetrical?", options: ["Random", "LV pressure is higher", "RV is larger", "Atria push it"], ok: 1, why: "LV 120 mmHg vs RV 25 mmHg — septum bows into RV." },
];

function tube(curve: THREE.Curve<THREE.Vector3>, radius: number, color: number, opacity = 1) {
  const geo = new THREE.TubeGeometry(curve, 64, radius, 16, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.08, transparent: opacity < 1, opacity });
  return new THREE.Mesh(geo, mat);
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
  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const rootGroup = useRef<THREE.Group | null>(null);
  const heartGroup = useRef<THREE.Group | null>(null);
  const orbit = useRef({ yaw: 0.55, pitch: -0.08, dist: 34, panX: 0, panY: 0 });
  const target = useRef({ yaw: 0.55, pitch: -0.08, dist: 34, panX: 0, panY: 0 });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const lastInteract = useRef(performance.now());
  const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pickables = useRef<{ mesh: THREE.Object3D; id: string }[]>([]);
  const beatTime = useRef(0);

  const cycle = 60 / bpm;
  const ps = paused ? "paused" : "running";
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
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0b1120);
    sc.fog = new THREE.Fog(0x0b1120, 45, 95);
    const cam = new THREE.PerspectiveCamera(44, 1, 1, 200);
    cam.position.set(0, 0, 34);
    const root = new THREE.Group();
    sc.add(root);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    rootGroup.current = root;
    const hg = new THREE.Group();
    root.add(hg);
    heartGroup.current = hg;

    sc.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(30, 40, 30);
    sc.add(dir);
    const rim = new THREE.DirectionalLight(0xff647c, 0.5);
    rim.position.set(-30, -20, -30);
    sc.add(rim);
    sc.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.42));
    const point = new THREE.PointLight(0xff3b5c, 1.2, 60);
    point.position.set(0, -2, 8);
    sc.add(point);

    // --- chambers: optimized low-poly but smooth
    // LV: thick conical ellipsoid, forms apex
    const lvGeo = new THREE.SphereGeometry(5.2, 28, 28);
    const lvMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0x450a0a, emissiveIntensity: 0.18, roughness: 0.55 });
    const lv = new THREE.Mesh(lvGeo, lvMat);
    lv.scale.set(1.15, 1.55, 0.95);
    lv.position.set(-1.2, -3.8, 0.4);
    lv.rotation.z = -0.18;
    lv.userData.id = "lv";
    hg.add(lv);
    // RV: crescent anterior, thinner
    const rvGeo = new THREE.SphereGeometry(4.4, 26, 26);
    const rvMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x1e293b, emissiveIntensity: 0.12, roughness: 0.5, transparent: true, opacity: 0.96 });
    const rvBlue = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, emissive: 0x0f2040, emissiveIntensity: 0.18, roughness: 0.5 });
    const rv = new THREE.Mesh(rvGeo, rvBlue);
    rv.scale.set(1.05, 1.32, 0.78);
    rv.position.set(2.2, -2.4, 2.6);
    rv.rotation.y = -0.35;
    rv.userData.id = "rv";
    hg.add(rv);
    // Add Rv thin wall highlight via inner
    const rvInner = new THREE.Mesh(new THREE.SphereGeometry(3.9, 20, 20), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, transparent: true, opacity: 0.4 }));
    rvInner.scale.set(1.02, 1.28, 0.72);
    rvInner.position.copy(rv.position);
    rvInner.position.z += 0.6;
    hg.add(rvInner);

    // LA posterior
    const la = new THREE.Mesh(new THREE.SphereGeometry(3.6, 22, 22), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.55, emissive: 0x450a0a, emissiveIntensity: 0.14 }));
    la.position.set(-2.8, 2.8, -2.2);
    la.scale.set(1.25, 0.9, 0.95);
    la.userData.id = "la";
    hg.add(la);
    // RA anterior right
    const ra = new THREE.Mesh(new THREE.SphereGeometry(3.9, 22, 22), new THREE.MeshStandardMaterial({ color: 0x1e3a5f, emissive: 0x122a4a, emissiveIntensity: 0.16, roughness: 0.5 }));
    ra.position.set(3.2, 2.4, 1.2);
    ra.scale.set(1.15, 0.95, 1.05);
    ra.userData.id = "ra";
    hg.add(ra);

    // Septum plane indicative (faint)
    const septum = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    septum.position.set(0.5, -1.2, 1.0);
    septum.rotation.y = 0.45;
    septum.rotation.z = 0.08;
    septum.userData.id = "septum";
    hg.add(septum);

    // Apex tip highlight
    const apex = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshStandardMaterial({ color: 0xbe123c, emissive: 0x7f1d1d, emissiveIntensity: 0.22 }));
    apex.position.set(-2.6, -9.2, 0.6);
    hg.add(apex);

    // --- Great vessels: accurate topology
    // Ascending aorta + arch + descending, curves OVER left PA
    const aortaPoints = [
      new THREE.Vector3(-0.6, -0.2, 1.8),  // aortic root at LV outflow
      new THREE.Vector3(-0.4, 4.2, 2.0),  // ascending
      new THREE.Vector3(0.6, 8.0, 1.6),   // pre-arch
      new THREE.Vector3(2.8, 10.2, 0.2),  // top of arch (over PA)
      new THREE.Vector3(4.8, 9.2, -1.5),  // arch descending
      new THREE.Vector3(5.4, 6.5, -2.8),
      new THREE.Vector3(5.6, -8, -3.2),
    ];
    const aortaCurve = new THREE.CatmullRomCurve3(aortaPoints, false, "catmullrom", 0.55);
    const aorta = tube(aortaCurve, 1.35, 0xff647c);
    aorta.userData.id = "aorta";
    hg.add(aorta);
    // 3 arch branches on top
    const branchMat = new THREE.MeshStandardMaterial({ color: 0xff8fa0, roughness: 0.5 });
    const mkBranch = (pts: THREE.Vector3[], r = 0.55) => {
      const c = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
      return new THREE.Mesh(new THREE.TubeGeometry(c, 20, r, 12, false), branchMat);
    };
    // brachiocephalic (rightmost first, largest, bifurcates)
    const b1 = mkBranch([new THREE.Vector3(1.2, 9.4, 0.9), new THREE.Vector3(2.2, 11.8, 0.6), new THREE.Vector3(3.0, 13.5, 0.3)], 0.62);
    b1.userData.id = "brachio";
    hg.add(b1);
    // bifurcation hint: two tiny offshoots
    const b1a = mkBranch([new THREE.Vector3(3.0, 13.5, 0.3), new THREE.Vector3(3.8, 14.6, 0.8)], 0.38);
    const b1b = mkBranch([new THREE.Vector3(3.0, 13.5, 0.3), new THREE.Vector3(3.6, 14.8, -0.4)], 0.38);
    hg.add(b1a); hg.add(b1b);
    const b2 = mkBranch([new THREE.Vector3(2.8, 10.2, 0.4), new THREE.Vector3(3.2, 12.2, 0.2), new THREE.Vector3(3.4, 14.2, 0.0)], 0.48);
    b2.userData.id = "carotid";
    hg.add(b2);
    const b3 = mkBranch([new THREE.Vector3(4.0, 10.0, -0.4), new THREE.Vector3(4.8, 12.0, -0.8), new THREE.Vector3(5.2, 13.8, -1.0)], 0.5);
    b3.userData.id = "subclavian";
    hg.add(b3);

    // Pulmonary trunk: originates from RV, ANTERIOR to aorta, bifurcates
    const pulmTrunkPts = [
      new THREE.Vector3(2.4, -0.4, 3.2), // RV outflow
      new THREE.Vector3(2.0, 2.8, 3.6), // anterior to aorta
      new THREE.Vector3(1.4, 5.8, 3.2), // trunk
      new THREE.Vector3(0.8, 7.4, 2.8), // bifurcation
    ];
    const pulmTrunkCurve = new THREE.CatmullRomCurve3(pulmTrunkPts, false, "catmullrom", 0.5);
    const pulmTrunk = tube(pulmTrunkCurve, 1.28, 0x38bdf8);
    pulmTrunk.userData.id = "pulmTrunk";
    hg.add(pulmTrunk);
    // Left PA under arch
    const lpa = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(0.8, 7.4, 2.8), new THREE.Vector3(-1.2, 7.6, 1.5), new THREE.Vector3(-3.4, 7.2, 0.2), new THREE.Vector3(-5.2, 6.4, -0.4)], false, "catmullrom", 0.5), 0.85, 0x38bdf8);
    lpa.userData.id = "pulmL";
    hg.add(lpa);
    // Right PA behind aorta/SVC
    const rpa = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(0.8, 7.4, 2.8), new THREE.Vector3(2.6, 7.2, 2.2), new THREE.Vector3(4.8, 6.8, 1.8), new THREE.Vector3(6.4, 6.2, 1.2)], false, "catmullrom", 0.5), 0.85, 0x38bdf8);
    rpa.userData.id = "pulmR";
    hg.add(rpa);

    // Superior vena cava: vertical into RA superiorly
    const svc = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(3.6, 12.5, 0.6), new THREE.Vector3(3.4, 7.5, 0.9), new THREE.Vector3(3.3, 4.0, 1.1)], false, "catmullrom", 0.4), 0.95, 0x0ea5e9);
    svc.userData.id = "svc";
    hg.add(svc);
    // Inferior vena cava: vertical into RA inferiorly
    const ivc = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(3.0, -12.5, 0.2), new THREE.Vector3(3.1, -6, 0.6), new THREE.Vector3(3.2, 0.2, 1.0)], false, "catmullrom", 0.4), 1.05, 0x0ea5e9);
    ivc.userData.id = "ivc";
    hg.add(ivc);

    // Pulmonary veins: 2 left posterior into LA
    const pvL1 = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(-5.8, 3.8, -2.8), new THREE.Vector3(-4.4, 3.2, -2.6)], false, "catmullrom", 0.3), 0.55, 0xff647c);
    const pvL2 = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(-5.6, 1.8, -2.6), new THREE.Vector3(-4.2, 1.6, -2.4)], false, "catmullrom", 0.3), 0.55, 0xff647c);
    const pvR1 = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(6.8, 3.6, -1.8), new THREE.Vector3(4.8, 3.0, -1.6)], false, "catmullrom", 0.3), 0.55, 0xff647c);
    const pvR2 = tube(new THREE.CatmullRomCurve3([new THREE.Vector3(6.6, 1.6, -1.6), new THREE.Vector3(4.6, 1.4, -1.4)], false, "catmullrom", 0.3), 0.55, 0xff647c);
    [pvL1, pvL2, pvR1, pvR2].forEach((m) => { m.userData.id = "pulmVein"; hg.add(m); });

    // build pickables
    hg.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.id) {
        pickables.current.push({ mesh: o, id: o.userData.id as string });
      }
    });

    // pulsing blood flow helpers (small spheres along vessels)
    const flowSpheres: THREE.Mesh[] = [];
    const mkFlow = (color: number) => new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshBasicMaterial({ color }));
    for (let i = 0; i < 10; i++) {
      const s = mkFlow(i % 2 === 0 ? 0xff3b5c : 0x38bdf8);
      hg.add(s);
      flowSpheres.push(s);
    }
    (hg.userData as Record<string, unknown>).flows = flowSpheres;
    (hg.userData as Record<string, unknown>).aortaCurve = aortaCurve;
    (hg.userData as Record<string, unknown>).pulmCurve = pulmTrunkCurve;

    return () => {
      sc.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => { if ("map" in mm && (mm as { map?: THREE.Texture }).map) (mm as { map?: THREE.Texture }).map!.dispose(); mm.dispose(); });
      });
      renderer.dispose();
      ren.current = null; scene.current = null; camera.current = null; rootGroup.current = null; heartGroup.current = null;
    };
  }, []);

  useRaf((dt, t) => {
    const renderer = ren.current; const sc = scene.current; const cam = camera.current; const root = rootGroup.current; const hg = heartGroup.current;
    if (!renderer || !sc || !cam || !root || !hg) return;
    const tgt = target.current; const o = orbit.current;
    const since = (performance.now() - lastInteract.current) / 1000;
    const isInteracting = dragging.current !== null || pointers.current.size > 0;
    if (!isInteracting && since > 1.2 && !picked) {
      tgt.yaw += dt * 0.12;
    }
    const lerp = 1 - Math.pow(0.001, dt);
    const yawD = tgt.yaw - o.yaw; const pitchD = tgt.pitch - o.pitch;
    vel.current.yaw = vel.current.yaw * Math.pow(0.18, dt * 60) + yawD * 7 * dt;
    vel.current.pitch = vel.current.pitch * Math.pow(0.18, dt * 60) + pitchD * 7 * dt;
    o.yaw += vel.current.yaw; o.pitch += vel.current.pitch;
    o.dist += (tgt.dist - o.dist) * clamp(lerp * 1.1, 0, 1);
    o.panX += (tgt.panX - o.panX) * clamp(lerp * 1.25, 0, 1);
    o.panY += (tgt.panY - o.panY) * clamp(lerp * 1.25, 0, 1);
    root.rotation.y = o.yaw;
    root.rotation.x = o.pitch;
    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr); const cssH = h / Math.max(1, dpr);
    if (cssW > 0 && cssH > 0) { renderer.setSize(cssW, cssH, false); cam.aspect = cssW / cssH; cam.updateProjectionMatrix(); }
    const lookAt = new THREE.Vector3(o.panX * 0.08, o.panY * 0.08, 0);
    const cp = o.pitch, cy = o.yaw;
    cam.position.set(lookAt.x + o.dist * Math.sin(cy) * Math.cos(cp), lookAt.y + o.dist * Math.sin(cp), lookAt.z + o.dist * Math.cos(cy) * Math.cos(cp));
    cam.lookAt(lookAt);

    // heartbeat scale: LV/RV contract in systole
    const phase = paused ? 0 : (t % cycle) / cycle; // 0..1
    const systole = phase < 0.32;
    const beatScale = systole ? 1 + Math.sin(phase / 0.32 * Math.PI) * 0.065 : 1;
    const lv = hg.children.find((c) => (c as THREE.Mesh).userData.id === "lv") as THREE.Mesh | undefined;
    const rv = hg.children.find((c) => (c as THREE.Mesh).userData.id === "rv") as THREE.Mesh | undefined;
    if (lv) lv.scale.set(1.15 * (systole ? 0.96 : 1), 1.55 * (systole ? 0.97 : 1), 0.95 * beatScale);
    if (rv) rv.scale.set(1.05 * (systole ? 0.97 : 1), 1.32 * (systole ? 0.97 : 1), 0.78 * beatScale);
    beatTime.current = t;

    // flow spheres along aorta + pulm
    const flows = (hg.userData as Record<string, unknown>).flows as THREE.Mesh[] | undefined;
    const ac = (hg.userData as Record<string, unknown>).aortaCurve as THREE.Curve<THREE.Vector3> | undefined;
    const pc = (hg.userData as Record<string, unknown>).pulmCurve as THREE.Curve<THREE.Vector3> | undefined;
    if (flows && ac && pc) {
      const speed = 0.22 + (bpm - 60) * 0.003;
      flows.forEach((s, i) => {
        const isAorta = i % 2 === 0;
        const curve = isAorta ? ac : pc;
        const u = ((t * speed + i * 0.18) % 1);
        const p = curve.getPointAt(u);
        s.position.copy(p);
        s.visible = true;
      });
    }

    renderer.render(sc, cam);
  });

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 18, 68); lastInteract.current = performance.now(); };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const getNDC = (x: number, y: number) => {
    const c = canvasRef.current; if (!c) return null;
    const r = c.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };

  const setHoverFromRay = (clientX: number, clientY: number) => {
    const ndc = getNDC(clientX, clientY);
    if (!ndc || !camera.current) return;
    // ensure matrixWorld up to date
    if (rootGroup.current) rootGroup.current.updateMatrixWorld(true);
    raycaster.current.setFromCamera(ndc, camera.current);
    const meshes = pickables.current.map((p) => p.mesh as THREE.Object3D);
    const hits = raycaster.current.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const hit = hits[0].object as THREE.Mesh;
      const id = (hit.userData.id as string) || "lv";
      setHover(id);
    } else setHover(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-100">Anatomy suite — human heart (accurate pipelines)</p>
            <p className="text-[11px] text-slate-500">Drag to orbit · scroll to zoom · right-drag to pan. Hover any chamber or vessel for its name.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPaused(!paused)} className="lab-btn">{paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{paused ? "Play" : "Pause"}</button>
            <button type="button" onClick={() => { target.current = { yaw: 0.55, pitch: -0.08, dist: 34, panX: 0, panY: 0 }; orbit.current = { ...target.current }; }} className="lab-btn"><RotateCcw className="h-3.5 w-3.5" /> Fit</button>
          </div>
        </div>
        <div ref={wrapRef} className="relative h-[520px] cursor-grab touch-none overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_30%,#16233b_0%,#0b1120_80%)] active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button }); dragging.current = e.button === 2 ? "pan" : "rotate"; lastInteract.current = performance.now(); }}
            onPointerMove={(e) => {
              if (!dragging.current && pointers.current.size === 0) setHoverFromRay(e.clientX, e.clientY);
              const prev = pointers.current.get(e.pointerId); if (!prev) return;
              const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
              if (dragging.current === "pan") { target.current.panX += dx * 0.45; target.current.panY -= dy * 0.45; }
              else if (dragging.current === "rotate") { target.current.yaw += dx * 0.006; target.current.pitch = clamp(target.current.pitch + dy * 0.006, -0.95, 0.95); }
            }}
            onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size === 0) dragging.current = null; (e.currentTarget as HTMLElement).style.cursor = "grab"; }}
            onPointerCancel={(e) => { pointers.current.delete(e.pointerId); dragging.current = null; }}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
            {hover ? (<motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}><p className="text-xs font-bold text-[#ff647c]">{PARTS[hover]?.name ?? hover}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{PARTS[hover]?.def ?? ""}</p></motion.div>) : (<p className="text-[11px] text-slate-500">Hover a chamber, valve, or vessel to see its anatomical name. Try the aortic arch top — 3 branches.</p>)}
          </div>
          {/* vessel legend */}
          <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
            <span className="lab-chip border-[#ff647c]/30 bg-black/50 text-[#ff8a9a]"><span className="h-2 w-2 rounded-full bg-[#ff647c]" /> Aorta &amp; oxygenated</span>
            <span className="lab-chip border-[#38bdf8]/30 bg-black/50 text-[#7dd3fc]"><span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> Pulmonary / vena cava</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[{ k: "Left ventricle", color: "#ff647c", end: String(lvPeak) }, { k: "Aorta", color: "#22d3ee", end: "120" }].map((g) => (
            <div key={g.k} className="rounded-xl border border-white/10 bg-black/20 p-3 lab-dark-surface">
              <div className="flex items-center justify-between"><p className="lab-label">{g.k} pressure</p><span className="lab-value text-xs" style={{ color: g.color }}>{g.end}/{g.k === "Left ventricle" ? "5" : "80"}</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="lab-gauge h-full rounded-full" style={{ background: `linear-gradient(90deg, ${g.color}66, ${g.color})`, boxShadow: `0 0 12px ${g.color}88`, animationDuration: `${cycle}s`, animationPlayState: ps }} /></div>
              <p className="mt-1.5 text-[9px] text-slate-500">{g.k === "Left ventricle" ? `0 → ${lvPeak} → 5 mmHg (scales with SV)` : "80 → 120 → 80 mmHg"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="lab-glass-deep h-fit space-y-4 p-4">
        <div><p className="lab-label mb-2"><Activity className="mr-1 inline h-3 w-3 text-[#ff647c]" /> Heart rate</p><div className="flex items-center justify-between text-[11px]"><span className="text-slate-400">Beats per minute</span><span className="lab-value text-slate-200">{bpm} BPM</span></div><input type="range" className="lab-range mt-1.5" min={40} max={140} step={1} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /><p className="mt-1 text-[10px] text-slate-500">cycle {cycle.toFixed(2)} s</p></div>
        <div><div className="flex items-center justify-between text-[11px]"><span className="text-slate-400">Stroke volume</span><span className="lab-value text-slate-200">{sv} mL</span></div><input type="range" className="lab-range mt-1.5" min={40} max={120} step={1} value={sv} onChange={(e) => setSv(Number(e.target.value))} /><p className="mt-1 text-[10px] text-slate-500">Cardiac output = <span className="lab-value text-slate-300">{cardiacOutput.toFixed(1)} L/min</span>{cardiacOutput > 8 && " — exercising!"}</p></div>
        <div className="lab-rule" />
        <div><p className="lab-label mb-2">Anatomical notes</p><div className="space-y-1.5 text-[11px] leading-relaxed text-slate-400"><p><b className="text-slate-200">Aortic arch</b> curves over left pulmonary artery. 3 branches on top in order: brachiocephalic (splits), left carotid, left subclavian.</p><p><b className="text-slate-200">Pulmonary trunk</b> is anterior — it crosses in front of aorta then bifurcates. Right PA goes behind aorta/SVC.</p><p><b className="text-slate-200">Venae cavae</b> enter RA vertically — SVC from above, IVC from below.</p><p><b className="text-slate-200">LV asymmetry</b> — LV is thick, conical, forms apex. RV is thin, crescentic, wrapping anteriorly. Septum bulges into RV.</p></div></div>
        <div className="lab-rule" />
        <div><p className="lab-label mb-2">Student check</p>
          {!quizDone ? (<><p className="mb-2 rounded-lg border border-white/10 bg-black/25 p-2.5 text-[12px] font-semibold text-slate-100">Q{qIdx + 1}/{QUESTIONS.length} · {QUESTIONS[qIdx].q}</p><div className="space-y-1.5">{QUESTIONS[qIdx].options.map((opt, oi) => { const show = picked !== null; const isRight = oi === QUESTIONS[qIdx].ok; const isPicked = picked === oi; return (<button key={oi} type="button" disabled={show} onClick={() => { setPicked(oi); if (oi === QUESTIONS[qIdx].ok) { setScore((s) => s + 1); sfx.snap(); } else sfx.buzz(); }} className={`w-full rounded-lg border px-3 py-2 text-left text-[11px] ${show && isRight ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : show && isPicked ? "border-red-400/60 bg-red-400/10 text-red-300" : "border-white/10 bg-black/20 text-slate-300 hover:border-[#ff3b5c]/50"}`}>{opt}</button>); })}</div>{picked !== null && (<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mt-2"><p className="text-[10px] text-slate-400">{QUESTIONS[qIdx].why}</p><button type="button" onClick={() => { if (qIdx + 1 >= QUESTIONS.length) { setQuizDone(true); sfx.pop(); } else { setQIdx((i) => i + 1); setPicked(null); } }} className="lab-btn lab-btn-neon mt-2 w-full">{qIdx + 1 >= QUESTIONS.length ? "See score" : "Next"}</button></motion.div>)}</>) : (<motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center"><p className="font-display text-2xl font-bold text-[#ff647c]">{score}/{QUESTIONS.length}</p><p className="mt-1 text-[11px] text-slate-400">{score === QUESTIONS.length ? "Perfect — you know the pipelines!" : score >= 5 ? "Solid! Review arch branches once more." : "Hover the vessels then retry."}</p><button type="button" onClick={() => { setQIdx(0); setPicked(null); setScore(0); setQuizDone(false); }} className="lab-btn mt-2 w-full">Retry</button></motion.div>)}
        </div>
      </div>
    </div>
  );
}
