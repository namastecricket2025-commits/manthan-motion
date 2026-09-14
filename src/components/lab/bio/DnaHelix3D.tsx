import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clamp, syncViewport, useCanvasSize, useRaf, useViewport } from "../use-canvas";
import { useTelemetryPublisher } from "../PhysicsSim";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
import { CursorTip } from "../CursorTip";
import { sfx } from "../lab-sound";
import { SPRING } from "../use-canvas";
import { AnimatePresence, motion } from "motion/react";

const BP = 22;
const RISE = 1.35;
const RADIUS = 5.2;
const TWIST = (Math.PI * 2) / 10; // 36° per bp, right-handed
const TOTAL_H = BP * RISE;

type Base = "A" | "T" | "G" | "C";
const COLORS: Record<Base, number> = { A: 0xff6b6b, T: 0x60a5fa, G: 0x4ade80, C: 0xfbbf24 };
const PAIR: Record<Base, Base> = { A: "T", T: "A", G: "C", C: "G" };
const SEQ: Base[] = Array.from({ length: BP }, (_, i) => (["A", "T", "G", "C"] as Base[])[i % 4]);
const BASES: Base[] = ["A", "T", "G", "C"];
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

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
  const vp = useViewport();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const group = useRef<THREE.Group | null>(null);
  const helixGroup = useRef<THREE.Group | null>(null);

  const mode = useRef<"explore" | "transcribe" | "build">("explore");
  const [modeState, setModeState] = useState<"explore" | "transcribe" | "build">("explore");
  const [autoRotate, setAutoRotate] = useState(true);
  const [polProgress, setPolProgress] = useState(0.22);
  // ── build-the-helix micro-game
  const [gameIdx, setGameIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wrongPick, setWrongPick] = useState<Base | null>(null);
  const gameIdxRef = useRef(0);
  const buildAnim = useRef(new Map<number, number>());
  const popAt = useRef(new Map<number, number>());
  gameIdxRef.current = gameIdx;
  const [playing, setPlaying] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ label: string; x: number; y: number } | null>(null);

  const orbit = useRef({ yaw: 0.45, pitch: 0.18, dist: 42, panX: 0, panY: 0, panZ: 0 });
  const target = useRef({ yaw: 0.45, pitch: 0.18, dist: 42, panX: 0, panY: 0, panZ: 0 });
  const lastInteract = useRef(performance.now());

  // publish live helix telemetry
  const publish = useTelemetryPublisher();
  useEffect(() => {
    const BP_PER_TURN = 10.5;
    publish({
      subject: "Biology · DNA",
      rows: [
        { k: "Mode", v: modeState },
        { k: "Twist", v: `${BP_PER_TURN} bp/turn` },
        { k: "Rise", v: `0.34 nm/bp` },
        { k: "Grooves", v: "major + minor" },
        { k: "mRNA progress", v: modeState === "transcribe" ? `${Math.round(polProgress * 100)}%` : "—" },
      ],
      equation: "A=T · G≡C",
      eqNote: "B-DNA: a right-handed helix, ~10.5 base pairs per turn, 2 nm wide — bases pair A–T (2 H-bonds) and G–C (3).",
      signal: clamp01(modeState === "transcribe" ? polProgress : 0.5 + 0.5 * Math.sin(performance.now() / 2100)),
      accent: "#34d399",
    });
  }, [modeState, polProgress, publish]);
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
      rung.userData = { kind: "base", index: i, base: SEQ[i], pair: PAIR[SEQ[i]], y, centerX: rung.position.x, centerZ: rung.position.z };
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

    // damped lerp — exponential chase on rotation (no velocity integrator,
    // so dragging can never overshoot and vibrate)
    const lerp = 1 - Math.pow(0.001, dt);
    const yawDiff = tgt.yaw - o.yaw;
    const pitchDiff = tgt.pitch - o.pitch;
    const follow = 1 - Math.pow(0.002, dt);
    o.yaw += yawDiff * follow;
    o.pitch += pitchDiff * follow;
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
    // size only on a real box change, never mid-drag (canvas.width resets the buffer)
    syncViewport(vp.current, renderer, cam, cssW, cssH, dragging.current !== null);
    const lookAt = new THREE.Vector3(o.panX * 0.3, o.panY * 0.3, 0);
    const cosP = Math.cos(o.pitch);
    const sinP = Math.sin(o.pitch);
    const cosY = Math.cos(o.yaw);
    const sinY = Math.sin(o.yaw);
    cam.position.set(lookAt.x + o.dist * sinY * cosP, lookAt.y + o.dist * sinP, lookAt.z + o.dist * cosY * cosP);
    cam.lookAt(lookAt);

    // update backbone splay for transcribe bubble
    const bubbleY =
      mode.current === "transcribe"
        ? (polProgress - 0.5) * TOTAL_H * 0.85
        : mode.current === "build"
          ? (gameIdxRef.current / BP - 0.5) * TOTAL_H * 0.94
          : null;
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
    // base pairs: splay around the fork (absolute, never accumulated) and, in
    // build mode, zip the strand together one pair at a time as the player answers
    const building = mode.current === "build";
    baseMeshes.current.forEach((m, i) => {
      const cx = (m.userData.centerX as number) ?? m.position.x;
      const cz = (m.userData.centerZ as number) ?? m.position.z;
      let splay = 0;
      if (bubbleY !== null) {
        const d = Math.abs((i - BP / 2) * RISE - bubbleY);
        if (d < bubbleHalf) splay = 1 - d / bubbleHalf;
      }
      m.position.x = cx * (1 + splay * 0.16);
      m.position.z = cz * (1 + splay * 0.16);

      if (building) {
        const answered = i < gameIdxRef.current;
        const prev = buildAnim.current.get(i) ?? (answered ? 1 : 0);
        const val = prev + ((answered ? 1 : 0) - prev) * Math.min(1, dt * 9);
        buildAnim.current.set(i, val);
        const pop = popAt.current.get(i);
        const since = pop ? (performance.now() - pop) / 1000 : 9;
        const popScale = since < 0.5 ? 1 + Math.sin((since / 0.5) * Math.PI) * 0.65 : 1;
        m.scale.setScalar(Math.max(0.0001, val) * popScale);
        m.visible = val > 0.02;
      } else if (m.scale.x !== 1) {
        m.scale.setScalar(1);
        m.visible = true;
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

  const answerBase = (b: Base) => {
    if (modeState !== "build" || gameIdx >= BP) return;
    if (PAIR[SEQ[gameIdx]] === b) {
      popAt.current.set(gameIdx, performance.now());
      sfx.snap();
      setWrongPick(null);
      setStreak((s) => s + 1);
      setGameIdx((i) => i + 1);
    } else {
      sfx.buzz();
      setWrongPick(b);
      setStreak(0);
      window.setTimeout(() => setWrongPick(null), 360);
    }
  };

  const resetBuild = () => {
    popAt.current.clear();
    buildAnim.current.clear();
    setGameIdx(0);
    setStreak(0);
    setWrongPick(null);
  };

  const getNDC = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };

  /** Raycast probe shared by mouse hover and mobile tap. */
  const probe = (clientX: number, clientY: number) => {
    const ndc = getNDC(clientX, clientY);
    if (!ndc || !camera.current) return;
    raycaster.current.setFromCamera(ndc, camera.current);
    const hits = raycaster.current.intersectObjects(baseMeshes.current, false);
    if (hits.length > 0) {
      const h = hits[0].object as THREE.Mesh;
      const base = h.userData.base as string;
      const pair = h.userData.pair as string;
      const bp = Math.round(((h.userData.y as number) + TOTAL_H / 2) / RISE);
      setHoverInfo({
        label: `${base} — ${pair} · ${base === "G" || base === "C" ? "3" : "2"} H-bonds · bp ${bp}`,
        x: clientX,
        y: clientY,
      });
      baseMeshes.current.forEach((m) => {
        (m.material as THREE.MeshStandardMaterial).emissiveIntensity = m === h ? 0.6 : 0.12;
      });
      if (canvasRef.current) canvasRef.current.style.cursor = "help";
      return;
    }
    if (grooveMarks.current) {
      raycaster.current.setFromCamera(ndc, camera.current);
      const gHits = raycaster.current.intersectObjects(grooveMarks.current.children, false);
      if (gHits.length > 0) {
        const g = gHits[0].object as THREE.Mesh;
        setHoverInfo({ label: g.userData.label as string, x: clientX, y: clientY });
        if (canvasRef.current) canvasRef.current.style.cursor = "help";
        return;
      }
    }
    setHoverInfo(null);
    baseMeshes.current.forEach((m) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
    });
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
            <button type="button" onClick={() => { setModeState("build"); setPlaying(false); }} className={`lab-tab !px-3 !py-1 text-xs ${modeState === "build" ? "lab-tab--on" : ""}`}>Build pairs</button>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="lab-stage w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
          if (e.button === 2) dragging.current = "pan";
          else dragging.current = "rotate";
          lastInteract.current = performance.now();
        }}
        onPointerMove={(e) => {
          if (!dragging.current) probe(e.clientX, e.clientY);
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
          if (e.pointerType === "touch") probe(e.clientX, e.clientY);
          pointers.current.delete(e.pointerId);
          if (pointers.current.size === 0) dragging.current = null;
          (e.currentTarget as HTMLElement).style.cursor = "grab";
        }}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); dragging.current = null; }}
        onPointerLeave={() => setHoverInfo(null)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* build-the-helix micro-game: floating tiles snap a base pair into the split strand */}
      <AnimatePresence>
        {modeState === "build" && (
          <motion.div
            key="build-hud"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={SPRING}
            className="absolute inset-x-3 bottom-14 z-20 lg:inset-x-auto lg:right-3 lg:w-[302px]"
          >
            <div className="lab-screen lab-dark-surface rounded-2xl p-3">
              {gameIdx < BP ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="lab-label">Pair the strand</p>
                    <span className="lab-chip text-[10px]">streak {streak}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    Template base{" "}
                    <b style={{ color: hex(COLORS[SEQ[gameIdx]]) }}>{SEQ[gameIdx]}</b> — tap the base that pairs with it to snap it in.
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {BASES.map((b) => (
                      <motion.button
                        key={b}
                        type="button"
                        whileTap={{ scale: 0.93 }}
                        animate={wrongPick === b ? { x: [0, -6, 6, -3, 0] } : { x: 0 }}
                        transition={wrongPick === b ? { duration: 0.34 } : SPRING}
                        onClick={() => answerBase(b)}
                        className="rounded-xl border py-2.5 text-sm font-bold"
                        style={{ borderColor: `${hex(COLORS[b])}66`, background: `${hex(COLORS[b])}1f`, color: hex(COLORS[b]) }}
                      >
                        {b}
                      </motion.button>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#ff3b5c]" style={{ width: `${(gameIdx / BP) * 100}%`, transition: "width .3s ease" }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    {gameIdx}/{BP} base pairs zipped · A pairs with T, G pairs with C
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-[#67e8f9]">Helix complete</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    All {BP} base pairs snapped in — one full turn every 10 pairs, right-handed. Final streak {streak}.
                  </p>
                  <button type="button" onClick={resetBuild} className="lab-btn lab-btn-neon mt-2 w-full">
                    Rebuild the helix
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CursorTip
        tip={hoverInfo ? { title: hoverInfo.label, accent: "#fbbf24", x: hoverInfo.x, y: hoverInfo.y } : null}
        hostRef={wrapRef}
        width={252}
      />

      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {modeState === "explore" ? (
            <>
              <button type="button" onClick={() => setAutoRotate((v) => !v)} className={`lab-btn !px-3 !py-1 text-xs ${autoRotate ? "lab-btn--active" : ""}`}>{autoRotate ? "Auto 360° on" : "Auto off"}</button>
              <button type="button" onClick={() => { target.current.dist = 42; target.current.panX = 0; target.current.panY = 0; }} className="lab-btn !px-2 !py-1 text-xs">Reset view</button>
            </>
          ) : modeState === "transcribe" ? (
            <>
              <button type="button" onClick={() => setPlaying((p) => !p)} className="lab-btn lab-btn-neon !px-3 !py-1 text-xs">{playing ? "Pause polymerase" : "Play polymerase 5′→3′"}</button>
              <input type="range" min={0.06} max={0.92} step={0.01} value={polProgress} onChange={(e) => setPolProgress(Number(e.target.value))} className="lab-range w-28" />
              <span className="lab-chip text-xs">{Math.round(polProgress * 100)}%</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="lab-stage-hint pointer-events-none absolute right-3 top-[52px] hidden max-w-[240px] rounded-xl border border-white/10 bg-black/50 p-2.5 text-[11px] leading-relaxed text-slate-300 backdrop-blur-md lg:block">
        <p className="font-semibold text-slate-100">How to explore</p>
        <p className="mt-1 text-slate-400">
          <b className="text-slate-200">Drag</b> to orbit · <b className="text-slate-200">Scroll / pinch</b> to zoom (to 18 units) · <b className="text-slate-200">Right-drag</b> to pan · Hover a base for its pair &amp; H-bonds. In <b className="text-[#ff8a9a]">Transcribe</b>, RNA Polymerase (red) splits the duplex and extrudes pink mRNA 5′→3′.
        </p>
      </div>
    </div>
  );
}
