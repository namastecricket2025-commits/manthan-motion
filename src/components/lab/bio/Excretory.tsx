import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "motion/react";
import { Droplets, RotateCcw, Eye, EyeOff } from "lucide-react";
import { SPRING, clamp, useCanvasSize, useRaf } from "../use-canvas";

const PARTS: Record<string, { name: string; def: string }> = {
  aorta: { name: "Abdominal aorta", def: "Midline posterior — gives off renal arteries laterally near L1/L2. Left renal artery is shorter (closer to aorta)." },
  vena: { name: "Inferior vena cava", def: "Right of aorta — receives renal veins. Right renal vein is shorter, drains directly." },
  kidneyL: { name: "Left kidney (higher)", def: "Sits higher (T12–L3) — no liver above. Slightly larger in some. Hilum faces medially toward aorta." },
  kidneyR: { name: "Right kidney (lower)", def: "Sits ~1–2 cm lower than left to accommodate liver — lower pole near iliac crest. Shorter renal vein." },
  arteryL: { name: "Left renal artery", def: "Branches laterally from aorta to left hilum — passes behind left renal vein." },
  arteryR: { name: "Right renal artery", def: "Longer — passes behind IVC to reach right hilum. Supplies ~20% cardiac output per kidney." },
  veinL: { name: "Left renal vein", def: "Crosses anterior to aorta to join IVC — receives left gonadal & suprarenal veins." },
  veinR: { name: "Right renal vein", def: "Short, directly into IVC. No tributaries." },
  cortex: { name: "Renal cortex", def: "Outer ~1 cm — contains glomeruli, proximal tubules. Brownish-red, granular." },
  medulla: { name: "Renal medulla — pyramids", def: "8–12 triangular pyramids with bases at cortex, apices (papillae) at calyces. Striated via collecting ducts." },
  pyramid: { name: "Renal pyramid", def: "Medullary pyramid draining through papilla → minor calyx → major calyx → pelvis." },
  calyx: { name: "Minor / major calyx", def: "Cup around each papilla (minor), merging into 2–3 major calyces, then renal pelvis." },
  pelvis: { name: "Renal pelvis", def: "Funnel collecting from calyces → ureter. At hilum, exits with vessels." },
  ureter: { name: "Ureter", def: "Muscular tube with peristaltic waves (~3/min) pushing urine to bladder — retroperitoneal." },
  bladder: { name: "Urinary bladder", def: "Detrusor muscle sac up to ~500 mL. Trigone is fixed." },
  cross: { name: "Cross-section", def: "Sagittal cut revealing cortex → pyramids → calyces → pelvis. Toggle to study medulla." },
};

function kidneyMesh(side: "left" | "right", withNotch = true): THREE.Group {
  const g = new THREE.Group();
  // Main bean shape: scaled sphere with hilum notch via torus cut
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(2.9, 26, 26),
    new THREE.MeshStandardMaterial({ color: 0x9f1239, emissive: 0x450a0a, emissiveIntensity: 0.12, roughness: 0.55 }),
  );
  body.scale.set(0.85, 1.35, 0.72);
  body.position.set(0, 0, 0);
  body.userData.id = side === "left" ? "kidneyL" : "kidneyR";
  g.add(body);

  // Hilum notch: torus half
  if (withNotch) {
    const hilum = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.38, 12, 20, Math.PI * 1.05),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }),
    );
    hilum.position.set(side === "left" ? 0.62 : -0.62, 0.15, 0);
    hilum.rotation.y = side === "left" ? -0.25 : 0.25;
    hilum.rotation.x = Math.PI / 2 - 0.12;
    hilum.rotation.z = side === "left" ? -0.12 : 0.12;
    g.add(hilum);
  }

  // Capsule highlight
  const caps = new THREE.Mesh(new THREE.SphereGeometry(2.92, 22, 22), new THREE.MeshStandardMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
  caps.scale.copy(body.scale);
  g.add(caps);

  return g;
}

function vesselTube(pts: THREE.Vector3[], radius: number, color: number) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
  const geo = new THREE.TubeGeometry(curve, 32, radius, 12, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, curve };
}

export default function Excretory() {
  const [crossSection, setCrossSection] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const root = useRef<THREE.Group | null>(null);
  const kidneyLGroup = useRef<THREE.Group | null>(null);
  const kidneyRGroup = useRef<THREE.Group | null>(null);
  const orbit = useRef({ yaw: 0.1, pitch: 0.12, dist: 26, panX: 0, panY: 0 });
  const target = useRef({ yaw: 0.1, pitch: 0.12, dist: 26, panX: 0, panY: 0 });
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
    sc.fog = new THREE.Fog(0x0b1120, 28, 70);
    const cam = new THREE.PerspectiveCamera(44, 1, 1, 200);
    cam.position.set(0, 0, 26);
    const rootG = new THREE.Group();
    sc.add(rootG);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    root.current = rootG;

    sc.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(20, 25, 18);
    sc.add(dir);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.35);
    rim.position.set(-20, -10, -18);
    sc.add(rim);
    sc.add(new THREE.HemisphereLight(0xcbd5e1, 0x1a202e, 0.45));

    const hg = new THREE.Group();
    rootG.add(hg);

    // Aorta (midline, posterior) and IVC (right of aorta)
    const aorta = vesselTube(
      [new THREE.Vector3(0.6, 8.5, -1.8), new THREE.Vector3(0.6, 0, -1.8), new THREE.Vector3(0.6, -8.5, -1.8)],
      0.62,
      0xff647c,
    );
    aorta.mesh.userData.id = "aorta";
    hg.add(aorta.mesh);
    pickables.current.push({ mesh: aorta.mesh, id: "aorta" });

    const vena = vesselTube(
      [new THREE.Vector3(2.2, 8.5, -1.6), new THREE.Vector3(2.2, 0, -1.6), new THREE.Vector3(2.2, -8.5, -1.6)],
      0.72,
      0x38bdf8,
    );
    vena.mesh.userData.id = "vena";
    hg.add(vena.mesh);
    pickables.current.push({ mesh: vena.mesh, id: "vena" });

    // Kidneys: LEFT higher (y ~1.6), RIGHT lower (~ -0.4)
    const kL = kidneyMesh("left");
    kL.position.set(-3.2, 1.6, 0.2);
    kL.rotation.z = 0.12;
    kL.rotation.y = 0.42;
    hg.add(kL);
    kidneyLGroup.current = kL;
    pickables.current.push({ mesh: kL.children[0] as THREE.Mesh, id: "kidneyL" });

    const kR = kidneyMesh("right");
    kR.position.set(3.4, -0.35, 0.2);
    kR.rotation.z = -0.14;
    kR.rotation.y = -0.48;
    hg.add(kR);
    kidneyRGroup.current = kR;
    pickables.current.push({ mesh: kR.children[0] as THREE.Mesh, id: "kidneyR" });

    // Renal arteries branching from aorta
    const artL = vesselTube(
      [new THREE.Vector3(0.6, 1.6, -1.8), new THREE.Vector3(-0.8, 1.6, -0.9), new THREE.Vector3(-1.9, 1.6, -0.1)],
      0.34,
      0xff3b5c,
    );
    artL.mesh.userData.id = "arteryL";
    hg.add(artL.mesh);
    pickables.current.push({ mesh: artL.mesh, id: "arteryL" });

    // Right renal artery is longer, passes BEHIND IVC
    const artR = vesselTube(
      [new THREE.Vector3(0.6, -0.35, -1.8), new THREE.Vector3(1.6, -0.35, -1.85), new THREE.Vector3(2.8, -0.35, -0.6), new THREE.Vector3(3.4, -0.35, 0.0)],
      0.32,
      0xff3b5c,
    );
    artR.mesh.userData.id = "arteryR";
    hg.add(artR.mesh);
    pickables.current.push({ mesh: artR.mesh, id: "arteryR" });

    // Renal veins
    const veinL = vesselTube(
      [new THREE.Vector3(-1.9, 1.1, -0.05), new THREE.Vector3(0.1, 1.1, -0.7), new THREE.Vector3(2.2, 1.1, -1.6)],
      0.36,
      0x38bdf8,
    );
    veinL.mesh.userData.id = "veinL";
    hg.add(veinL.mesh);
    pickables.current.push({ mesh: veinL.mesh, id: "veinL" });

    const veinR = vesselTube(
      [new THREE.Vector3(3.4, 0.25, 0.0), new THREE.Vector3(2.7, 0.25, -0.9), new THREE.Vector3(2.2, 0.25, -1.6)],
      0.33,
      0x38bdf8,
    );
    veinR.mesh.userData.id = "veinR";
    hg.add(veinR.mesh);
    pickables.current.push({ mesh: veinR.mesh, id: "veinR" });

    // Build left kidney internal anatomy (cross-section group, hidden by default)
    const crossL = new THREE.Group();
    kL.add(crossL);
    // Cortex shell (outer)
    const cortex = new THREE.Mesh(
      new THREE.SphereGeometry(2.85, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5, transparent: true, opacity: 0.42 }),
    );
    cortex.scale.set(0.86, 1.36, 0.73);
    cortex.userData.id = "cortex";
    crossL.add(cortex);
    pickables.current.push({ mesh: cortex, id: "cortex" });

    // Medulla: 7 pyramids (triangular prisms approximated by cones)
    const medullaMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55, transparent: true, opacity: 0.78 });
    const pyramidPos: [number, number, number, number, number][] = [
      // x, y, z, height, radius
      [0.0, 0.95, 0.15, 1.55, 0.62],
      [0.42, 0.55, 0.42, 1.35, 0.52],
      [-0.38, 0.52, 0.38, 1.32, 0.50],
      [0.45, -0.18, 0.35, 1.28, 0.48],
      [-0.42, -0.22, 0.32, 1.25, 0.46],
      [0.18, -0.88, 0.18, 1.22, 0.48],
      [-0.22, -0.92, 0.14, 1.18, 0.44],
    ];
    pyramidPos.forEach(([x, y, z, h, r]) => {
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), medullaMat);
      pyr.position.set(x, y - h * 0.18, z);
      pyr.rotation.x = Math.PI;
      pyr.rotation.z = x * 0.22;
      pyr.userData.id = "pyramid";
      crossL.add(pyr);
      pickables.current.push({ mesh: pyr, id: "pyramid" });
      // papilla tip highlight
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfef3c7 }));
      tip.position.set(x * 0.86, y - h + 0.28, z * 0.9);
      crossL.add(tip);
      // minor calyx cup
      const calyx = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.72, r * 0.55, 0.38, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xfde68a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      calyx.position.set(x * 0.86, y - h + 0.05, z * 0.9);
      crossL.add(calyx);
      calyx.userData.id = "calyx";
      pickables.current.push({ mesh: calyx, id: "calyx" });
    });

    // Major calyces + pelvis funnel
    const pelvis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.35, 1.8, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.62, side: THREE.DoubleSide }),
    );
    pelvis.position.set(0.18, -1.55, -0.08);
    pelvis.rotation.z = -0.22;
    pelvis.userData.id = "pelvis";
    crossL.add(pelvis);
    pickables.current.push({ mesh: pelvis, id: "pelvis" });

    crossL.visible = false;
    (kL.userData as Record<string, unknown>)._cross = crossL;

    // Clone cross-section for right kidney (smaller)
    const crossR = crossL.clone(true);
    kR.add(crossR);
    (kR.userData as Record<string, unknown>)._cross = crossR;
    crossR.visible = false;

    // Ureters from pelvis downward
    const ureterL = vesselTube(
      [new THREE.Vector3(-3.02, 0.0, 0.12), new THREE.Vector3(-3.3, -1.5, 0.0), new THREE.Vector3(-3.1, -4.5, 0.2), new THREE.Vector3(-1.2, -7.2, 0.3)],
      0.24,
      0xfbbf24,
    );
    ureterL.mesh.userData.id = "ureter";
    hg.add(ureterL.mesh);
    pickables.current.push({ mesh: ureterL.mesh, id: "ureter" });

    const ureterR = vesselTube(
      [new THREE.Vector3(3.58, -1.55, 0.12), new THREE.Vector3(3.85, -3.0, 0.0), new THREE.Vector3(3.45, -5.2, 0.18), new THREE.Vector3(1.2, -7.2, 0.28)],
      0.24,
      0xfbbf24,
    );
    ureterR.mesh.userData.id = "ureter";
    hg.add(ureterR.mesh);

    // Bladder
    const bladder = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x92400e, emissiveIntensity: 0.08, roughness: 0.5, transparent: true, opacity: 0.88 }),
    );
    bladder.position.set(0, -7.6, 0.2);
    bladder.scale.set(1.35, 0.95, 0.92);
    bladder.userData.id = "bladder";
    hg.add(bladder);
    pickables.current.push({ mesh: bladder, id: "bladder" });

    // store for peristalsis
    (hg.userData as Record<string, unknown>).ureterCurves = [ureterL.curve, ureterR.curve];
    const pulses: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      hg.add(p);
      pulses.push(p);
    }
    (hg.userData as Record<string, unknown>).pulses = pulses;

    return () => {
      sc.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((mm) => { const any = mm as unknown as { map?: THREE.Texture }; if (any.map) any.map.dispose(); mm.dispose(); });
      });
      renderer.dispose();
      ren.current = null; scene.current = null; camera.current = null; root.current = null;
    };
  }, []);

  // sync cross-section visibility
  useEffect(() => {
    if (kidneyLGroup.current) {
      const g = (kidneyLGroup.current.userData as Record<string, unknown>)._cross as THREE.Group | undefined;
      if (g) g.visible = crossSection;
      // hide outer body slightly when open
      const body = kidneyLGroup.current.children[0] as THREE.Mesh;
      if (body) (body.material as THREE.MeshStandardMaterial).opacity = crossSection ? 0.28 : 1;
    }
    if (kidneyRGroup.current) {
      const g = (kidneyRGroup.current.userData as Record<string, unknown>)._cross as THREE.Group | undefined;
      if (g) g.visible = crossSection;
      const body = kidneyRGroup.current.children[0] as THREE.Mesh;
      if (body) (body.material as THREE.MeshStandardMaterial).opacity = crossSection ? 0.28 : 1;
    }
  }, [crossSection]);

  useRaf((dt, t) => {
    const renderer = ren.current; const sc = scene.current; const cam = camera.current; const grp = root.current;
    if (!renderer || !sc || !cam || !grp) return;
    const hg = grp.children[0] as THREE.Group | undefined;
    const tgt = target.current; const o = orbit.current;
    const since = (performance.now() - lastInteract.current) / 1000;
    const isInteracting = dragging.current !== null || pointers.current.size > 0;
    if (!isInteracting && since > 1.2) tgt.yaw += dt * 0.09;
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
      const curves = (hg.userData as Record<string, unknown>).ureterCurves as THREE.Curve<THREE.Vector3>[] | undefined;
      const pulses = (hg.userData as Record<string, unknown>).pulses as THREE.Mesh[] | undefined;
      if (curves && pulses) {
        pulses.forEach((p, i) => {
          const curve = curves[i % 2];
          const u = ((t * 0.18 + i * 0.26) % 1);
          p.position.copy(curve.getPointAt(u));
          p.visible = true;
        });
      }
    }
    renderer.render(sc, cam);
  });

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const fn = (e: WheelEvent) => { e.preventDefault(); target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 13, 48); lastInteract.current = performance.now(); };
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
    for (const h of hits) {
      let obj: THREE.Object3D | null = h.object;
      while (obj) {
        const found = pickables.current.find((p) => p.mesh === obj);
        if (found) { setHover(found.id); return; }
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
          <p className="text-sm font-bold text-slate-100">Excretory — asymmetric kidneys &amp; medulla</p>
          <p className="text-[11px] text-slate-500">Right kidney lower (liver). Aorta gives renal arteries near L1/L2. Toggle cross-section for pyramids → calyces → pelvis.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setCrossSection((v) => !v)} className={`lab-btn !px-3 text-xs ${crossSection ? "lab-btn--active" : ""}`}>{crossSection ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{crossSection ? "Hide interior" : "Cross-section"}</button>
          <button type="button" onClick={() => { target.current = { yaw: 0.1, pitch: 0.12, dist: 26, panX: 0, panY: 0 }; orbit.current = { ...target.current }; }} className="lab-btn !px-2"><RotateCcw className="h-3.5 w-3.5" /> Fit</button>
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
          <span className="lab-chip border-white/15 bg-black/50 text-slate-300"><Droplets className="h-3 w-3 text-[#fbbf24]" /> Asymmetric heights</span>
          {crossSection && <span className="lab-chip border-[#fbbf24]/40 bg-[#fbbf24]/15 text-[#fde68a]">Cross-section: cortex → pyramids → pelvis</span>}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur-md">
          {hover ? (<motion.div key={hover} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}><p className="text-xs font-bold text-[#fbbf24]">{PARTS[hover]?.name ?? hover}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{PARTS[hover]?.def ?? ""}</p></motion.div>) : (<p className="text-[11px] text-slate-500">Hover aorta, IVC, hilum, or any pyramid/calyx. Toggle Cross-section to see 7 pyramids draining to pelvis.</p>)}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500">Left kidney higher (no liver) · Right lower by ~1.5 cm · Renal arteries from aorta at ~L1 · Veins to IVC · 7 pyramids per kidney in this model.</p>
    </div>
  );
}
