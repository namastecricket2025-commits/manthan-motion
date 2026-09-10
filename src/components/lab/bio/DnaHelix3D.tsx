import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clamp, useCanvasSize, useRaf } from "../use-canvas";

const BP = 22;
const RISE = 1.35;
const RADIUS = 5.2;
const TWIST = (Math.PI * 2) / 10; // 36° per bp, right-handed
const TOTAL_H = BP * RISE;

type Base = "A" | "T" | "G" | "C";
const COLORS: Record<Base, number> = { A: 0xff6b6b, T: 0x60a5fa, G: 0x4ade80, C: 0xfbbf24 };
const PAIR: Record<Base, Base> = { A: "T", T: "A", G: "C", C: "G" };
const SEQ: Base[] = Array.from({ length: BP }, (_, i) => (["A", "T", "G", "C"] as Base[])[i % 4]);

function makeBackbonePoints(
  offsetAngle: number,
  yOff: number,
  bubbleY: number | null,
  bubbleHalf: number,
  splay: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < BP; i++) {
    const y = (i - BP / 2) * RISE + yOff;
    const ang = i * TWIST + offsetAngle;
    let r = RADIUS;
    let a = ang;
    if (bubbleY !== null) {
      const d = Math.abs(y - bubbleY);
      if (d < bubbleHalf) {
        const t = 1 - d / bubbleHalf; // 1 at center
        // splay outward perpendicular to base pair direction
        const dir = offsetAngle === 0 ? 1 : -1;
        r += t * splay * 1.6;
        a += dir * t * 0.32;
      }
    }
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  // extend a bit beyond ends for smooth caps
  return pts;
}

export default function DnaHelix3D() {
  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const group = useRef<THREE.Group | null>(null);
  const helixGroup = useRef<THREE.Group | null>(null);

  const mode = useRef<"explore" | "transcribe">("explore");
  const [modeState, setModeState] = useState<"explore" | "transcribe">("explore");
  const [autoRotate, setAutoRotate] = useState(true);
  const [polProgress, setPolProgress] = useState(0.22);
  const [playing, setPlaying] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ label: string; x: number; y: number } | null>(null);

  const orbit = useRef({ yaw: 0.45, pitch: 0.18, dist: 42, panX: 0, panY: 0, panZ: 0 });
  const target = useRef({ yaw: 0.45, pitch: 0.18, dist: 42, panX: 0, panY: 0, panZ: 0 });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const lastInteract = useRef(performance.now());
  const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const baseMeshes = useRef<THREE.Mesh[]>([]);
  const backboneA = useRef<THREE.Mesh | null>(null);
  const backboneB = useRef<THREE.Mesh | null>(null);
  const grooveMarks = useRef<THREE.Group | null>(null);
  const polymerase = useRef<THREE.Group | null>(null);
  const mrnaTube = useRef<THREE.Mesh | null>(null);

  mode.current = modeState;

  // scene init
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0b1120);
    sc.fog = new THREE.Fog(0x0b1120, 55, 120);
    const cam = new THREE.PerspectiveCamera(42, 1, 1, 400);
    cam.position.set(0, 8, 42);
    const g = new THREE.Group();
    g.rotation.order = "YXZ";
    sc.add(g);

    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    group.current = g;

    const hg = new THREE.Group();
    g.add(hg);
    helixGroup.current = hg;

    sc.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(30, 40, 30);
    sc.add(dir);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.7);
    rim.position.set(-30, -20, -30);
    sc.add(rim);
    const fill = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.4);
    sc.add(fill);

    // backbone tubes (initial)
    const curveA = new THREE.CatmullRomCurve3(makeBackbonePoints(0, 0, null, 0, 0));
    const curveB = new THREE.CatmullRomCurve3(makeBackbonePoints(Math.PI, 0, null, 0, 0));
    const matA = new THREE.MeshStandardMaterial({ color: 0x8fa3bd, roughness: 0.28, metalness: 0.32, emissive: 0x334155, emissiveIntensity: 0.25 });
    const matB = new THREE.MeshStandardMaterial({ color: 0xd7e0ec, roughness: 0.28, metalness: 0.32, emissive: 0x475569, emissiveIntensity: 0.25 });
    const tubeA = new THREE.Mesh(new THREE.TubeGeometry(curveA, 120, 0.44, 16, false), matA);
    const tubeB = new THREE.Mesh(new THREE.TubeGeometry(curveB, 120, 0.44, 16, false), matB);
    hg.add(tubeA);
    hg.add(tubeB);
    backboneA.current = tubeA;
    backboneB.current = tubeB;

    // central axis helper (faint)
    const axis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, TOTAL_H + 6, 12),
      new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35 }),
    );
    hg.add(axis);

    // base pairs + phosphate/sugar beads
    const bases: THREE.Mesh[] = [];
    for (let i = 0; i < BP; i++) {
      const y = (i - BP / 2) * RISE;
      const ang = i * TWIST;
      const pA = new THREE.Vector3(Math.cos(ang) * RADIUS, y, Math.sin(ang) * RADIUS);
      const pB = new THREE.Vector3(Math.cos(ang + Math.PI) * RADIUS, y, Math.sin(ang + Math.PI) * RADIUS);
      // offset base pair center to create major/minor groove asymmetry: shift rung slightly toward major groove side (~0.9 units)
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const dir = pB.clone().sub(pA).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular in horizontal plane
      const grooveShift = 0.95; // displacement of pair center
      const center = mid.clone().add(perp.multiplyScalar(grooveShift));
      const start = center.clone().add(dir.clone().multiplyScalar(-RADIUS * 0.92));
      const end = center.clone().add(dir.clone().multiplyScalar(RADIUS * 0.92));
      // rung as box (base pair)
      const len = start.distanceTo(end);
      const rung = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.42, 0.42),
        new THREE.MeshStandardMaterial({ color: COLORS[SEQ[i]], emissive: COLORS[SEQ[i]], emissiveIntensity: 0.12 }),
      );
      rung.position.copy(center);
      // orient along dir
      const axisDir = dir.clone();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), axisDir);
      rung.quaternion.copy(quat);
      rung.userData = { kind: "base", index: i, base: SEQ[i], pair: PAIR[SEQ[i]], y };
      hg.add(rung);
      bases.push(rung);

      // sugar-phosphate beads on backbones
      const sugarA = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x64748b, emissiveIntensity: 0.12 }));
      sugarA.position.copy(pA);
      const phosA = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x9a3412, emissiveIntensity: 0.18 }));
      phosA.position.copy(pA).add(new THREE.Vector3(0, 0.55, 0));
      hg.add(sugarA);
      hg.add(phosA);
      const sugarB = sugarA.clone();
      sugarB.position.copy(pB);
      const phosB = phosA.clone();
      phosB.position.copy(pB).add(new THREE.Vector3(0, 0.55, 0));
      hg.add(sugarB);
      hg.add(phosB);

      // hydrogen bonds (2 or 3 small cylinders between bases)
      const hb = SEQ[i] === "G" || SEQ[i] === "C" ? 3 : 2;
      for (let h = 0; h < hb; h++) {
        const off = (h - (hb - 1) / 2) * 0.55;
        const c = center.clone().add(new THREE.Vector3(0, off, 0));
        const bond = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, len * 0.42, 8),
          new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.72 }),
        );
        bond.position.copy(c);
        bond.quaternion.copy(quat);
        bond.rotation.z += Math.PI / 2;
        hg.add(bond);
      }
    }
    baseMeshes.current = bases;

    // groove marks / labels
    const grooveG = new THREE.Group();
    hg.add(grooveG);
    grooveMarks.current = grooveG;
    for (let i = 0; i < BP - 1; i++) {
      const y = ((i + 0.5 - BP / 2) * RISE);
      const isMajor = i % 2 === 0; // strictly alternating
      const txt = isMajor ? "Major groove" : "Minor groove";
      // Use small plane with canvas texture for label? Simpler: add colored ring segment
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(RADIUS + 1.2, 0.06, 8, 32, Math.PI * (isMajor ? 1.35 : 0.85)),
        new THREE.MeshBasicMaterial({ color: isMajor ? 0xfbbf24 : 0x67e8f9, transparent: true, opacity: 0.55 }),
      );
      ring.position.set(0, y, 0);
      ring.rotation.y = i * TWIST + (isMajor ? 0.2 : Math.PI * 0.6);
      ring.rotation.x = Math.PI / 2;
      ring.userData = { kind: "groove", label: txt };
      grooveG.add(ring);
    }

    // polymerase + mRNA
    const polG = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.9, 18, 18), new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0x991b1b, emissiveIntensity: 0.45 }));
    polG.add(core);
    const clampL = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.2, 8, 16), new THREE.MeshStandardMaterial({ color: 0xfda4af, emissive: 0xe11d48, emissiveIntensity: 0.22 }));
    clampL.position.set(-1.1, 0.2, 0.6);
    clampL.rotation.z = 0.35;
    polG.add(clampL);
    const clampR = clampL.clone();
    clampR.position.set(1.1, 0.2, -0.6);
    clampR.rotation.z = -0.35;
    polG.add(clampR);
    const cleft = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.6), new THREE.MeshBasicMaterial({ color: 0x0b1120, transparent: true, opacity: 0.9 }));
    polG.add(cleft);
    polG.visible = false;
    hg.add(polG);
    polymerase.current = polG;

    const mrnaMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xbe185d, emissiveIntensity: 0.2, roughness: 0.4 });
    const mrna = new THREE.Mesh(new THREE.BufferGeometry(), mrnaMat);
    mrna.visible = false;
    hg.add(mrna);
    mrnaTube.current = mrna;

    return () => {
      sc.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mat) {
          for (const mm of Array.isArray(mat) ? mat : [mat]) {
            if ("map" in mm && (mm as { map?: THREE.Texture }).map) (mm as { map?: THREE.Texture }).map!.dispose();
            mm.dispose();
          }
        }
      });
      renderer.dispose();
      ren.current = null;
      scene.current = null;
      camera.current = null;
      group.current = null;
      helixGroup.current = null;
    };
  }, []);

  // per-frame
  useRaf((dt) => {
    const renderer = ren.current;
    const sc = scene.current;
    const cam = camera.current;
    const g = group.current;
    const hg = helixGroup.current;
    if (!renderer || !sc || !cam || !g || !hg) return;

    const tgt = target.current;
    const o = orbit.current;
    const since = (performance.now() - lastInteract.current) / 1000;
    const isInteracting = dragging.current !== null || pointers.current.size > 0;
    // explore auto-rotate
    if (mode.current === "explore" && autoRotate && !isInteracting && since > 0.9) {
      tgt.yaw += dt * 0.28;
    }
    // transcribe progress autoplay
    if (mode.current === "transcribe" && playing) {
      const next = polProgress + dt * 0.09;
      if (next >= 0.92) {
        setPlaying(false);
        setPolProgress(0.92);
      } else {
        setPolProgress(next);
      }
    }

    // damped lerp
    const lerp = 1 - Math.pow(0.001, dt);
    const yawDiff = tgt.yaw - o.yaw;
    const pitchDiff = tgt.pitch - o.pitch;
    vel.current.yaw = vel.current.yaw * Math.pow(0.14, dt * 60) + yawDiff * 7 * dt;
    vel.current.pitch = vel.current.pitch * Math.pow(0.14, dt * 60) + pitchDiff * 7 * dt;
    o.yaw += vel.current.yaw;
    o.pitch += vel.current.pitch;
    o.dist += (tgt.dist - o.dist) * clamp(lerp * 1.15, 0, 1);
    o.panX += (tgt.panX - o.panX) * clamp(lerp * 1.3, 0, 1);
    o.panY += (tgt.panY - o.panY) * clamp(lerp * 1.3, 0, 1);

    // group rotation vs camera orbit: we orbit camera, keep helix upright
    g.rotation.y = 0;
    hg.rotation.y = o.yaw;
    hg.rotation.x = o.pitch;

    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    if (cssW > 0 && cssH > 0) {
      renderer.setSize(cssW, cssH, false);
      cam.aspect = cssW / cssH;
      cam.updateProjectionMatrix();
    }
    const lookAt = new THREE.Vector3(o.panX * 0.3, o.panY * 0.3, 0);
    const cosP = Math.cos(o.pitch);
    const sinP = Math.sin(o.pitch);
    const cosY = Math.cos(o.yaw);
    const sinY = Math.sin(o.yaw);
    cam.position.set(lookAt.x + o.dist * sinY * cosP, lookAt.y + o.dist * sinP, lookAt.z + o.dist * cosY * cosP);
    cam.lookAt(lookAt);

    // update backbone splay for transcribe bubble
    const bubbleY = mode.current === "transcribe" ? (polProgress - 0.5) * TOTAL_H * 0.85 : null;
    const bubbleHalf = 3.8;
    if (backboneA.current && backboneB.current) {
      const ptsA = makeBackbonePoints(0, 0, bubbleY, bubbleHalf, 3.2);
      const ptsB = makeBackbonePoints(Math.PI, 0, bubbleY, bubbleHalf, 3.2);
      const curveA = new THREE.CatmullRomCurve3(ptsA);
      const curveB = new THREE.CatmullRomCurve3(ptsB);
      // dispose old geometry and assign new (cheap, ~200 vertices)
      backboneA.current.geometry.dispose();
      backboneB.current.geometry.dispose();
      backboneA.current.geometry = new THREE.TubeGeometry(curveA, 96, 0.38, 12, false);
      backboneB.current.geometry = new THREE.TubeGeometry(curveB, 96, 0.38, 12, false);
    }
    // nudge base pairs inside bubble to splay as well
    baseMeshes.current.forEach((m, i) => {
      const y = (i - BP / 2) * RISE;
      if (bubbleY !== null) {
        const d = Math.abs(y - bubbleY);
        if (d < bubbleHalf) {
          const t = 1 - d / bubbleHalf;
          m.position.x *= 1 + t * 0.18;
          m.position.z *= 1 + t * 0.18;
          (m.material as THREE.MeshStandardMaterial).opacity = 1 - t * 0.22;
        } else {
          m.position.x = m.userData.centerX ?? m.position.x;
          (m.material as THREE.MeshStandardMaterial).opacity = 1;
        }
      }
    });

    // polymerase + mRNA positions
    if (polymerase.current) {
      const pol = polymerase.current;
      if (mode.current === "transcribe" && bubbleY !== null) {
        pol.visible = true;
        pol.position.set(0, bubbleY, 0);
        // face along helix tangent (approx twist)
        const idx = Math.round((bubbleY / RISE) + BP / 2);
        const ang = clamp(idx, 0, BP - 1) * TWIST;
        pol.rotation.y = -ang;
        pol.rotation.x = 0.12;
        // mRNA ribbon
        if (mrnaTube.current) {
          mrnaTube.current.visible = true;
          // mRNA 5'→3' grows behind polymerase (more negative y as polymerase advances)
          const startY = bubbleY + 0.8;
          const len = (polProgress * TOTAL_H * 0.92);
          const pts: THREE.Vector3[] = [];
          const segs = Math.max(8, Math.floor(len / 1.1));
          for (let s = 0; s <= segs; s++) {
            const t = s / segs;
            const y = startY - t * len * 0.65;
            // ribbon exits sideways then runs parallel to axis
            const exit = t < 0.12 ? t / 0.12 : 1;
            const x = 7.5 * exit + Math.sin(t * 8) * 0.45;
            const z = -2.5 * exit + Math.cos(t * 6) * 0.32;
            pts.push(new THREE.Vector3(x, y, z));
          }
          const curve = new THREE.CatmullRomCurve3(pts);
          mrnaTube.current.geometry.dispose();
          mrnaTube.current.geometry = new THREE.TubeGeometry(curve, Math.max(24, segs * 2), 0.22, 10, false);
        }
      } else {
        pol.visible = false;
        if (mrnaTube.current) mrnaTube.current.visible = false;
      }
    }

    renderer.render(sc, cam);
  });

  // wheel
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      target.current.dist = clamp(target.current.dist * (e.deltaY > 0 ? 1.08 : 0.92), 12, 90);
      lastInteract.current = performance.now();
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const getNDC = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_30%,#16233b_0%,#0b1120_78%)]">
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="lab-chip border-[#ff3b5c]/30 bg-[#ff3b5c]/10 text-[#ff8a9a]">DNA · B-form · right-handed</span>
          <span className="hidden text-xs font-semibold text-slate-200 sm:inline">10 bp / turn · 3.4 Å rise · Major ↔ Minor alternating</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="lab-tabs !p-1">
            <button type="button" onClick={() => setModeState("explore")} className={`lab-tab !px-3 !py-1 text-xs ${modeState === "explore" ? "lab-tab--on" : ""}`}>Explore Helix 360°</button>
            <button type="button" onClick={() => { setModeState("transcribe"); setPlaying(false); }} className={`lab-tab !px-3 !py-1 text-xs ${modeState === "transcribe" ? "lab-tab--on" : ""}`}>Transcribe</button>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="h-[520px] w-full touch-none cursor-grab active:cursor-grabbing sm:h-[560px]"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
          if (e.button === 2) dragging.current = "pan";
          else dragging.current = "rotate";
          lastInteract.current = performance.now();
        }}
        onPointerMove={(e) => {
          const ndc = getNDC(e.clientX, e.clientY);
          if (!dragging.current) {
            if (ndc && camera.current) {
              raycaster.current.setFromCamera(ndc, camera.current);
              const hits = raycaster.current.intersectObjects(baseMeshes.current, false);
              if (hits.length > 0) {
                const h = hits[0].object as THREE.Mesh;
                const base = h.userData.base as string;
                const pair = h.userData.pair as string;
                setHoverInfo({ label: `${base} — ${pair} · ${base === "G" || base === "C" ? "3" : "2"} H-bonds · bp ${Math.round(((h.userData.y as number) + TOTAL_H / 2) / RISE)}`, x: e.clientX, y: e.clientY });
                // hover glow
                baseMeshes.current.forEach((m) => {
                  const mat = m.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = m === h ? 0.6 : 0.12;
                });
                (e.currentTarget as HTMLElement).style.cursor = "help";
              } else {
                // groove hover
                if (grooveMarks.current && camera.current) {
                  raycaster.current.setFromCamera(ndc!, camera.current);
                  const gHits = raycaster.current.intersectObjects(grooveMarks.current.children, false);
                  if (gHits.length > 0) {
                    const g = gHits[0].object as THREE.Mesh;
                    setHoverInfo({ label: g.userData.label as string, x: e.clientX, y: e.clientY });
                    (e.currentTarget as HTMLElement).style.cursor = "help";
                  } else { setHoverInfo(null); baseMeshes.current.forEach((m) => { (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12; }); }
                }
              }
            }
          }
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
          if (dragging.current === "pan") {
            const sp = target.current.dist * 0.0022;
            const yw = target.current.yaw;
            target.current.panX += (Math.cos(yw) * dx - Math.sin(yw) * dy) * sp;
            target.current.panY += (Math.sin(yw) * dx + Math.cos(yw) * dy) * sp;
          } else if (dragging.current === "rotate") {
            target.current.yaw += dx * 0.006;
            target.current.pitch = clamp(target.current.pitch + dy * 0.0062, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size === 0) dragging.current = null;
          (e.currentTarget as HTMLElement).style.cursor = "grab";
        }}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); dragging.current = null; }}
        onPointerLeave={() => setHoverInfo(null)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {hoverInfo && (
        <div className="pointer-events-none absolute z-20 rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-xs font-medium text-slate-100 shadow-xl backdrop-blur-md" style={{ left: Math.min(hoverInfo.x - (wrapRef.current?.getBoundingClientRect().left ?? 0) + 12, (wrapRef.current?.clientWidth ?? 500) - 220), top: Math.max(hoverInfo.y - (wrapRef.current?.getBoundingClientRect().top ?? 0) - 34, 8) }}>
          {hoverInfo.label}
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
          <span className="h-2 w-2 rounded-full" style={{ background: "#fbbf24" }} /> Major groove
          <span className="mx-1 h-3 w-px bg-white/15" />
          <span className="h-2 w-2 rounded-full" style={{ background: "#67e8f9" }} /> Minor groove — alternating every base pair
        </div>
        <div className="flex items-center gap-1.5">
          {modeState === "explore" ? (
            <>
              <button type="button" onClick={() => setAutoRotate((v) => !v)} className={`lab-btn !px-3 !py-1 text-xs ${autoRotate ? "lab-btn--active" : ""}`}>{autoRotate ? "Auto 360° on" : "Auto off"}</button>
              <button type="button" onClick={() => { target.current.dist = 42; target.current.panX = 0; target.current.panY = 0; }} className="lab-btn !px-2 !py-1 text-xs">Reset view</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setPlaying((p) => !p)} className="lab-btn lab-btn-neon !px-3 !py-1 text-xs">{playing ? "Pause polymerase" : "Play polymerase 5′→3′"}</button>
              <input type="range" min={0.06} max={0.92} step={0.01} value={polProgress} onChange={(e) => setPolProgress(Number(e.target.value))} className="lab-range w-28" />
              <span className="lab-chip text-xs">{Math.round(polProgress * 100)}%</span>
            </>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-[52px] hidden max-w-[240px] rounded-xl border border-white/10 bg-black/50 p-2.5 text-[11px] leading-relaxed text-slate-300 backdrop-blur-md sm:block">
        <p className="font-semibold text-slate-100">How to explore</p>
        <p className="mt-1 text-slate-400">
          <b className="text-slate-200">Drag</b> to orbit · <b className="text-slate-200">Scroll / pinch</b> to zoom (to 18 units) · <b className="text-slate-200">Right-drag</b> to pan · Hover a base for its pair &amp; H-bonds. In <b className="text-[#ff8a9a]">Transcribe</b>, RNA Polymerase (red) splits the duplex and extrudes pink mRNA 5′→3′.
        </p>
      </div>
    </div>
  );
}
