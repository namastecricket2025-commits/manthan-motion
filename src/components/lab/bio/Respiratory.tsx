import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { Wind, RotateCcw, Play, Pause } from "lucide-react";
import { SPRING, clamp, useCanvasSize, useRaf } from "../use-canvas";

const PARTS: Record<string, { name: string; def: string }> = {
  trachea: { name: "Trachea — C-shaped cartilage", def: "Anterior C-rings (hyaline cartilage, ~16) keep it patent. Posterior trachealis muscle gap faces esophagus. Rigid yet flexible." },
  carina: { name: "Carina", def: "Keel-shaped spur at T4/T5 where trachea bifurcates. Highly sensitive — cough reflex trigger." },
  bronchusR: { name: "Right main bronchus", def: "Shorter, wider, more vertical (25°) — aspiration favors right lung. Leads to 3 lobar bronchi." },
  bronchusL: { name: "Left main bronchus", def: "Longer, narrower, more horizontal (45°) — passes under aortic arch. Leads to 2 lobar bronchi." },
  lobeRsup: { name: "Right superior lobe", def: "Upper right lobe — separated by horizontal fissure above. Apical, posterior, anterior segments." },
  lobeRmid: { name: "Right middle lobe", def: "Wedge between horizontal & oblique fissures — lateral and medial segments. Unique to right lung." },
  lobeRinf: { name: "Right inferior lobe", def: "Largest, diaphragmatic. 5 segments — superior, basal groups." },
  lobeLsup: { name: "Left superior lobe (with lingula)", def: "Upper left lobe — includes lingula (tongue) homologous to middle lobe. Borders cardiac notch." },
  lobeLinf: { name: "Left inferior lobe", def: "Lower left lobe — larger, similar to right inferior but with cardiac notch neighbor." },
  notch: { name: "Cardiac notch", def: "Concave shelter on anteromedial left lung (superior lobe) cradling the heart — why left lung has 2 lobes, not 3." },
  fissureH: { name: "Horizontal fissure", def: "Separates right superior & middle lobes — only on right." },
  fissureO: { name: "Oblique fissure", def: "Major fissure separating upper/middle from lower lobes bilaterally." },
  alveoli: { name: "Alveolar sacs (→300M)", def: "Respiratory bronchioles → alveolar ducts → alveoli — 70 m² diffusion surface." },
  diaphragm: { name: "Diaphragm", def: "Domed musculotendinous sheet — contracts flattens → inspiration. Central tendon." },
  pleura: { name: "Pleura", def: "Visceral + parietal layers with pleural fluid. Negative pressure couples lung to chest wall." },
};

function cRingMesh(y: number): THREE.Group {
  const g = new THREE.Group();
  // C-shaped cartilage: torus arc ~290°, gap posterior (facing -Z)
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.22, 12, 24, Math.PI * 1.62),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xb45309, emissiveIntensity: 0.08, roughness: 0.45 }),
  );
  torus.rotation.x = Math.PI / 2;
  torus.rotation.z = Math.PI * 0.19; // gap posterior
  torus.position.set(0, y, 0);
  g.add(torus);
  // trachealis membrane (posterior gap fill — smooth muscle)
  const membr = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 0.6 }),
  );
  membr.position.set(0, y, -1.22);
  membr.rotation.y = Math.PI;
  g.add(membr);
  return g;
}

export default function Respiratory() {
  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const root = useRef<THREE.Group | null>(null);
  const [breathing, setBreathing] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const orbit = useRef({ yaw: -0.18, pitch: 0.08, dist: 28, panX: 0, panY: 0 });
  const target = useRef({ yaw: -0.18, pitch: 0.08, dist: 28, panX: 0, panY: 0 });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const lastInteract = useRef(performance.now());
  const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pickables = useRef<{ mesh: THREE.Object3D; id: string }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0b1120);
    sc.fog = new THREE.Fog(0x0b1120, 28, 72);
    const cam = new THREE.PerspectiveCamera(44, 1, 1, 200);
    cam.position.set(0, 0, 28);
    const rootG = new THREE.Group();
    sc.add(rootG);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    root.current = rootG;

    sc.add(new THREE.AmbientLight(0xffffff, 0.92));
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(20, 30, 20);
    sc.add(dir);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.45);
    rim.position.set(-25, -15, -20);
    sc.add(rim);
    sc.add(new THREE.HemisphereLight(0xcbd5e1, 0x0f172a, 0.45));

    const hg = new THREE.Group();
    rootG.add(hg);

    // --- trachea: 14 C-rings from y=9 to y=1.2 (spacing ~0.58)
    const tracheaG = new THREE.Group();
    hg.add(tracheaG);
    const ringYs: number[] = [];
    for (let i = 0; i < 14; i++) {
      const y = 9.2 - i * 0.58;
      ringYs.push(y);
      const ring = cRingMesh(y);
      ring.userData.id = "trachea";
      tracheaG.add(ring);
      pickables.current.push({ mesh: ring.children[0] as THREE.Mesh, id: "trachea" });
    }
    // carina spur at bottom
    const carina = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.0, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x92400e, emissiveIntensity: 0.15 }),
    );
    carina.position.set(0, 0.45, 0.12);
    carina.rotation.x = Math.PI;
    carina.userData.id = "carina";
    hg.add(carina);
    pickables.current.push({ mesh: carina, id: "carina" });

    // helper to make tube with shared mat
    const tube = (pts: THREE.Vector3[], radius: number, color: number) => {
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.45);
      const geo = new THREE.TubeGeometry(curve, 28, radius, 14, false);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.04 });
      return { mesh: new THREE.Mesh(geo, mat), curve };
    };

    // primary bronchi
    const bronchusR = tube(
      [new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(1.2, -0.4, 0.4), new THREE.Vector3(2.6, -1.2, 0.9)],
      0.62,
      0xfde68a,
    );
    bronchusR.mesh.userData.id = "bronchusR";
    hg.add(bronchusR.mesh);
    pickables.current.push({ mesh: bronchusR.mesh, id: "bronchusR" });

    const bronchusL = tube(
      [new THREE.Vector3(0, 0.7, 0), new THREE.Vector3(-1.1, -0.35, 0.2), new THREE.Vector3(-2.4, -0.9, 0.6)],
      0.58,
      0xfde68a,
    );
    bronchusL.mesh.userData.id = "bronchusL";
    hg.add(bronchusL.mesh);
    pickables.current.push({ mesh: bronchusL.mesh, id: "bronchusL" });

    // secondary bronchi hints (thin)
    const secR = tube(
      [new THREE.Vector3(2.6, -1.2, 0.9), new THREE.Vector3(3.4, -2.0, 1.6), new THREE.Vector3(3.8, -3.2, 2.0)],
      0.26,
      0xfbbf24,
    );
    hg.add(secR.mesh);
    const secL = tube(
      [new THREE.Vector3(-2.4, -0.9, 0.6), new THREE.Vector3(-3.2, -1.8, 1.2), new THREE.Vector3(-3.6, -3.0, 1.7)],
      0.24,
      0xfbbf24,
    );
    hg.add(secL.mesh);

    // --- lungs: right 3 lobes, left 2 lobes with cardiac notch
    // Use shared lung material variants (pinkish)
    const lobeMat = (color: number, opacity = 0.92) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, transparent: opacity < 1, opacity, side: THREE.DoubleSide });

    // Right lung group
    const rightLung = new THREE.Group();
    rightLung.position.set(4.8, -2.2, 0.8);
    hg.add(rightLung);
    // Superior lobe
    const rSup = new THREE.Mesh(new THREE.SphereGeometry(2.4, 22, 22), lobeMat(0xfda4af));
    rSup.scale.set(1.0, 0.95, 0.85);
    rSup.position.set(0.2, 2.6, 0.3);
    rSup.userData.id = "lobeRsup";
    rightLung.add(rSup);
    pickables.current.push({ mesh: rSup, id: "lobeRsup" });
    // Middle lobe (wedge)
    const rMid = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 20), lobeMat(0xfb7185));
    rMid.scale.set(1.25, 0.62, 0.92);
    rMid.position.set(0.45, 0.55, 0.55);
    rMid.rotation.z = -0.12;
    rMid.userData.id = "lobeRmid";
    rightLung.add(rMid);
    pickables.current.push({ mesh: rMid, id: "lobeRmid" });
    // Inferior lobe
    const rInf = new THREE.Mesh(new THREE.SphereGeometry(2.85, 22, 22), lobeMat(0xe11d48, 0.88));
    rInf.scale.set(1.08, 1.25, 0.95);
    rInf.position.set(0.0, -2.15, 0.2);
    rInf.userData.id = "lobeRinf";
    rightLung.add(rInf);
    pickables.current.push({ mesh: rInf, id: "lobeRinf" });

    // fissures on right: horizontal (between sup/mid) and oblique (between mid+sup vs inf)
    const fissH = new THREE.Mesh(new THREE.CircleGeometry(1.9, 22), new THREE.MeshBasicMaterial({ color: 0x881337, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    fissH.position.set(0.45, 1.45, 1.35);
    fissH.rotation.x = Math.PI / 2 - 0.18;
    fissH.rotation.y = -0.15;
    fissH.userData.id = "fissureH";
    rightLung.add(fissH);
    pickables.current.push({ mesh: fissH, id: "fissureH" });

    const fissO_R = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshBasicMaterial({ color: 0x881337, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
    fissO_R.position.set(0.35, -0.75, 1.35);
    fissO_R.rotation.x = 0.55;
    fissO_R.rotation.y = -0.2;
    fissO_R.userData.id = "fissureO";
    rightLung.add(fissO_R);

    // Left lung group
    const leftLung = new THREE.Group();
    leftLung.position.set(-4.6, -2.0, 0.6);
    hg.add(leftLung);
    const lSup = new THREE.Mesh(new THREE.SphereGeometry(2.65, 22, 22), lobeMat(0xf9a8d4));
    lSup.scale.set(1.05, 1.08, 0.88);
    lSup.position.set(-0.15, 2.25, 0.25);
    lSup.userData.id = "lobeLsup";
    leftLung.add(lSup);
    pickables.current.push({ mesh: lSup, id: "lobeLsup" });

    const lInf = new THREE.Mesh(new THREE.SphereGeometry(2.95, 22, 22), lobeMat(0xbe185d, 0.88));
    lInf.scale.set(1.1, 1.28, 0.95);
    lInf.position.set(-0.05, -2.05, 0.18);
    lInf.userData.id = "lobeLinf";
    leftLung.add(lInf);
    pickables.current.push({ mesh: lInf, id: "lobeLinf" });

    // oblique fissure left
    const fissO_L = fissO_R.clone();
    fissO_L.position.set(-0.05, -0.55, 1.32);
    fissO_L.rotation.y = 0.12;
    fissO_L.userData.id = "fissureO";
    leftLung.add(fissO_L);

    // Cardiac notch: indentation on anteromedial left superior lobe — visualize as dark carved sphere intersecting lobe edge
    const notchCarve = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, transparent: true, opacity: 0.96 }),
    );
    notchCarve.position.set(1.05, 0.85, 0.95); // medial border
    notchCarve.scale.set(1.0, 1.15, 0.75);
    notchCarve.userData.id = "notch";
    leftLung.add(notchCarve);
    pickables.current.push({ mesh: notchCarve, id: "notch" });
    // notch rim highlight
    const notchRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.07, 10, 18, Math.PI * 1.2),
      new THREE.MeshBasicMaterial({ color: 0x881337, transparent: true, opacity: 0.5 }),
    );
    notchRim.position.copy(notchCarve.position);
    notchRim.rotation.y = 0.35;
    notchRim.rotation.x = 0.25;
    leftLung.add(notchRim);

    // alveoli clusters (small bubbly instanced spheres near inferior lobes)
    const alveoGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const alveoMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0x7f1d1d, emissiveIntensity: 0.12, transparent: true, opacity: 0.7 });
    const alveoCount = 90;
    const alveoMesh = new THREE.InstancedMesh(alveoGeo, alveoMat, alveoCount);
    alveoMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < alveoCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const base = side === 1 ? new THREE.Vector3(4.8, -4.8, 0.8) : new THREE.Vector3(-4.6, -4.7, 0.6);
      const off = new THREE.Vector3((Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.6);
      dummy.position.copy(base).add(off);
      dummy.scale.setScalar(0.85 + Math.random() * 0.55);
      dummy.updateMatrix();
      alveoMesh.setMatrixAt(i, dummy.matrix);
    }
    alveoMesh.userData.id = "alveoli";
    hg.add(alveoMesh);
    pickables.current.push({ mesh: alveoMesh, id: "alveoli" });

    // diaphragm dome
    const diaphragm = new THREE.Mesh(
      new THREE.SphereGeometry(7.2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.38),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55, transparent: true, opacity: 0.52, side: THREE.DoubleSide }),
    );
    diaphragm.position.set(0, -7.6, 0);
    diaphragm.rotation.x = Math.PI;
    diaphragm.scale.set(1.15, 0.65, 0.9);
    diaphragm.userData.id = "diaphragm";
    hg.add(diaphragm);
    pickables.current.push({ mesh: diaphragm, id: "diaphragm" });

    // pleura outline faint
    const pleuraMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.08, side: THREE.DoubleSide, wireframe: false });
    const pleuraR = new THREE.Mesh(new THREE.SphereGeometry(4.1, 18, 18), pleuraMat);
    pleuraR.scale.set(1.05, 1.35, 0.92);
    pleuraR.position.copy(rightLung.position);
    hg.add(pleuraR);
    const pleuraL = pleuraR.clone();
    pleuraL.position.copy(leftLung.position);
    pleuraL.scale.set(1.08, 1.38, 0.95);
    hg.add(pleuraL);

    // store lung groups for breathing
    (hg.userData as Record<string, unknown>).rightLung = rightLung;
    (hg.userData as Record<string, unknown>).leftLung = leftLung;
    (hg.userData as Record<string, unknown>).diaphragm = diaphragm;

    // gas flow spheres
    const flows: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff647c : 0x38bdf8 }));
      hg.add(s);
      flows.push(s);
    }
    (hg.userData as Record<string, unknown>).flows = flows;
    (hg.userData as Record<string, unknown>).brR = bronchusR.curve;
    (hg.userData as Record<string, unknown>).brL = bronchusL.curve;

    return () => {
      sc.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => { const any = mm as unknown as { map?: THREE.Texture }; if (any.map) any.map.dispose(); mm.dispose(); });
        if ((obj as THREE.InstancedMesh).isInstancedMesh) {
          // disposed above
        }
      });
      renderer.dispose();
      ren.current = null; scene.current = null; camera.current = null; root.current = null;
    };
  }, []);

  useRaf((dt, t) => {
    const renderer = ren.current; const sc = scene.current; const cam = camera.current; const grp = root.current;
    if (!renderer || !sc || !cam || !grp) return;
    const hg = grp.children[0] as THREE.Group | undefined;
    const tgt = target.current; const o = orbit.current;
    const since = (performance.now() - lastInteract.current) / 1000;
    const isInteracting = dragging.current !== null || pointers.current.size > 0;
    if (!isInteracting && since > 1.1) tgt.yaw += dt * 0.08;
    const lerp = 1 - Math.pow(0.001, dt);
    const yd = tgt.yaw - o.yaw, pd = tgt.pitch - o.pitch;
    vel.current.yaw = vel.current.yaw * Math.pow(0.16, dt * 60) + yd * 7 * dt;
    vel.current.pitch = vel.current.pitch * Math.pow(0.16, dt * 60) + pd * 7 * dt;
    o.yaw += vel.current.yaw; o.pitch += vel.current.pitch;
    o.dist += (tgt.dist - o.dist) * clamp(lerp * 1.1, 0, 1);
    o.panX += (tgt.panX - o.panX) * clamp(lerp * 1.25, 0, 1);
    o.panY += (tgt.panY - o.panY) * clamp(lerp * 1.25, 0, 1);
    grp.rotation.y = o.yaw; grp.rotation.x = o.pitch;
    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr); const cssH = h / Math.max(1, dpr);
    if (cssW > 0 && cssH > 0) { renderer.setSize(cssW, cssH, false); cam.aspect = cssW / cssH; cam.updateProjectionMatrix(); }
    const lookAt = new THREE.Vector3(o.panX * 0.08, o.panY * 0.08, 0);
    cam.position.set(lookAt.x + o.dist * Math.sin(o.yaw) * Math.cos(o.pitch), lookAt.y + o.dist * Math.sin(o.pitch), lookAt.z + o.dist * Math.cos(o.yaw) * Math.cos(o.pitch));
    cam.lookAt(lookAt);

    if (hg) {
      const br = breathing ? 1 + Math.sin(t * 0.9) * 0.025 : 1;
      const rl = (hg.userData as Record<string, unknown>).rightLung as THREE.Group | undefined;
      const ll = (hg.userData as Record<string, unknown>).leftLung as THREE.Group | undefined;
      const di = (hg.userData as Record<string, unknown>).diaphragm as THREE.Mesh | undefined;
      if (rl) rl.scale.setScalar(br);
      if (ll) ll.scale.setScalar(br);
      if (di) di.position.y = -7.6 + (breathing ? Math.sin(t * 0.9) * 0.22 : 0);

      const flows = (hg.userData as Record<string, unknown>).flows as THREE.Mesh[] | undefined;
      const brR = (hg.userData as Record<string, unknown>).brR as THREE.Curve<THREE.Vector3> | undefined;
      const brL = (hg.userData as Record<string, unknown>).brL as THREE.Curve<THREE.Vector3> | undefined;
      if (flows && brR && brL) {
        flows.forEach((s, i) => {
          const curve = i % 2 === 0 ? brR : brL;
          const u = (t * 0.14 + i * 0.17) % 1;
          s.position.copy(curve.getPointAt(u));
          s.visible = true;
        });
      }
    }
    renderer.render(sc, cam);
  });

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 14, 52); lastInteract.current = performance.now(); };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const getNDC = (x: number, y: number) => {
    const c = canvasRef.current; if (!c) return null;
    const r = c.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };

  const setHoverFromRay = (cx: number, cy: number) => {
    const ndc = getNDC(cx, cy);
    if (!ndc || !camera.current) return;
    if (root.current) root.current.updateMatrixWorld(true);
    raycaster.current.setFromCamera(ndc, camera.current);
    const meshes = pickables.current.map((p) => p.mesh);
    const hits = raycaster.current.intersectObjects(meshes as THREE.Object3D[], true);
    // find closest pickable via traversing parents
    for (const h of hits) {
      let obj: THREE.Object3D | null = h.object;
      while (obj) {
        const found = pickables.current.find((p) => p.mesh === obj);
        if (found) { setHover(found.id); return; }
        // also check userData.id propagation
        if ((obj as THREE.Mesh).userData?.id) { setHover((obj as THREE.Mesh).userData.id as string); return; }
        obj = obj.parent;
      }
    }
    setHover(null);
  };

  return (
    <div className="lab-glass p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-100">Respiratory — trachea, bronchi &amp; 3/2 lobes</p>
          <p className="text-[11px] text-slate-500">C-rings with posterior gap · carina at T4/T5 · right 3 lobes vs left 2 + cardiac notch. Drag to orbit, scroll to zoom.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setBreathing((v) => !v)} className={`lab-btn !px-2 text-xs ${breathing ? "lab-btn--active" : ""}`}>{breathing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{breathing ? "Breathing" : "Paused"}</button>
          <button type="button" onClick={() => { target.current = { yaw: -0.18, pitch: 0.08, dist: 28, panX: 0, panY: 0 }; orbit.current = { ...target.current }; }} className="lab-btn !px-2"><RotateCcw className="h-3.5 w-3.5" /> Fit</button>
        </div>
      </div>
      <div ref={wrapRef} className="relative h-[540px] cursor-grab touch-none overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_30%,#16233b_0%,#0b1120_80%)] active:cursor-grabbing">
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
        <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
          <span className="lab-chip border-white/15 bg-black/50 text-slate-300"><Wind className="h-3 w-3 text-[#fbbf24]" /> C-rings · carina</span>
          <span className="hidden lab-chip bg-black/40 text-slate-400 sm:inline-flex">R: 3 lobes · L: 2 + notch</span>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
          {hover ? (<motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}><p className="text-xs font-bold text-[#fbbf24]">{PARTS[hover]?.name ?? hover}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{PARTS[hover]?.def ?? ""}</p></motion.div>) : (<p className="text-[11px] text-slate-500">Hover a ring, lobe, or fissure for its anatomical name. Scroll to get close — see the posterior trachealis gap.</p>)}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500">Anatomy: right lung horizontal + oblique fissures = 3 lobes; left lung oblique fissure only = 2 lobes + cardiac notch for heart.</p>
    </div>
  );
}
