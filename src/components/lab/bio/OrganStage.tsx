import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { motion } from "motion/react";
import { Filter, HeartPulse, MousePointer2, RotateCcw, Waves, Wind } from "lucide-react";
import { animDt, settingsRuntime } from "@/lib/app-settings";
import { SPRING, syncViewport, useCanvasSize, useRaf, useViewport } from "../use-canvas";

/**
 * Organ Stage — the biology bench's single WebGL canvas.
 *
 * One renderer, one camera, one orbit rig: the stage mounts when any of the
 * three organ systems is active and simply swaps what sits in the scene when
 * the student moves between tabs. Switching tabs disposes the outgoing model
 * (geometries, materials and every texture on them) before the next one is
 * loaded, and leaving the systems entirely tears the renderer down, so the
 * page never accumulates contexts or GPU buffers.
 *
 *   Heart System       heart.glb  — Beat clip looped at the BPM control, plus
 *                                   red/blue particles running the circuits
 *   Respiratory System lungs.glb  — a slider that scales both lung fields
 *                                   about their own centres (deep breathing)
 *   Excretory System   kidney.glb — a Filter button that fades the outer
 *                                   shell open to reveal the nephrons
 *
 * Lighting is a four-point studio rig (key, cool fill, cyan rim, violet
 * kicker) over ambient + hemisphere, re-timed for the bench's light mode.
 * All motion honours the lab's Motionless Mode: decorative time comes from
 * `animDt`, which collapses to zero under reduced motion.
 */

export type OrganSystem = "heart" | "respiratory" | "excretory";

const MODELS: Record<OrganSystem, { file: string; url: string }> = {
  heart: { file: "heart.glb", url: "/models/heart.glb" },
  respiratory: { file: "lungs.glb", url: "/models/lungs.glb" },
  excretory: { file: "kidney.glb", url: "/models/kidney.glb" },
};

/** Every model is normalised to this bounding radius so framing, orbit
    limits and particle sizes are identical across the three tabs. */
const TARGET_RADIUS = 1.7;
/** Where the camera stands for the fit view, before controls take over. */
const CAM_DIR = new THREE.Vector3(0.42, 0.3, 1).normalize();
/** The Beat clip in heart.glb is authored at one cycle per 0.833 s. */
const BASE_BPM = 72;

/* Blood: arterial red and venous blue in the lab's palette, plus the
   amber/mint the chemistry and biology plates already use for filtrate. */
const RED: [number, number, number] = [1, 0.3, 0.36];
const RED_SOFT: [number, number, number] = [1, 0.46, 0.42];
const BLUE: [number, number, number] = [0.3, 0.62, 1];
const BLUE_SOFT: [number, number, number] = [0.4, 0.78, 1];
const AMBER: [number, number, number] = [0.984, 0.749, 0.141];
const MINT: [number, number, number] = [0.204, 0.827, 0.6];

/* ------------------------------------------------------------------ */
/* disposal                                                            */
/* ------------------------------------------------------------------ */

/** Walks a subtree and frees everything GPU-side: geometry, materials and
    any texture a material references. Safe to call twice — dispose() is
    idempotent, which the StrictMode double-mount relies on. */
function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (!material) return;
    for (const mat of Array.isArray(material) ? material : [material]) {
      const record = mat as unknown as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const value = record[key] as THREE.Texture | undefined;
        if (value && value.isTexture) value.dispose();
      }
      mat.dispose();
    }
  });
}

/* ------------------------------------------------------------------ */
/* flow paths — moving particles along tubes                           */
/* ------------------------------------------------------------------ */

/** A soft round sprite for the particles, generated once per flow and
    freed with it. */
function makeDotTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.85)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface FlowSpec {
  curves: THREE.CatmullRomCurve3[];
  /** RGB 0–1 per curve. */
  colors: [number, number, number][];
  /** Particles per curve. */
  counts: number[];
  closed: boolean;
  tubeOpacity?: number;
  particleSize?: number;
}

interface Flow {
  object: THREE.Group;
  setVisible: (visible: boolean) => void;
  /** `dt` seconds of motion time, `speedScale` multiplies the base rate. */
  update: (dt: number, speedScale: number) => void;
  dispose: () => void;
}

const FLOW_POINT = new THREE.Vector3();

/**
 * A visible path (faint tube) with particles that run along it — the red and
 * blue circulation of the heart and the filtrate crawl through the nephrons.
 */
function createFlow(spec: FlowSpec): Flow {
  const object = new THREE.Group();

  for (let i = 0; i < spec.curves.length; i += 1) {
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(spec.curves[i], spec.closed ? 160 : 120, 0.016, 6, spec.closed),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(...spec.colors[i]),
        transparent: true,
        opacity: spec.tubeOpacity ?? 0.3,
        depthWrite: false,
      }),
    );
    object.add(tube);
  }

  let total = 0;
  for (const count of spec.counts) total += count;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const start = new Float32Array(total);
  const speed = new Float32Array(total);
  const curveOf = new Uint16Array(total);

  let n = 0;
  spec.counts.forEach((count, group) => {
    for (let i = 0; i < count; i += 1, n += 1) {
      curveOf[n] = group;
      start[n] = Math.random();
      speed[n] = 0.05 + Math.random() * 0.06;
      const [r, g, b] = spec.colors[group];
      const jitter = 0.85 + Math.random() * 0.3;
      colors[n * 3] = Math.min(1, r * jitter);
      colors[n * 3 + 1] = Math.min(1, g * jitter);
      colors[n * 3 + 2] = Math.min(1, b * jitter);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: spec.particleSize ?? 0.085,
    sizeAttenuation: true,
    map: makeDotTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // positions are rewritten every frame
  object.add(points);

  let phase = 0;
  return {
    object,
    setVisible: (visible) => {
      object.visible = visible;
    },
    update: (dt, speedScale) => {
      phase += dt * speedScale;
      const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
      const array = attr.array as Float32Array;
      for (let i = 0; i < total; i += 1) {
        const u = ((start[i] + phase * speed[i]) % 1 + 1) % 1;
        spec.curves[curveOf[i]].getPointAt(u, FLOW_POINT);
        array[i * 3] = FLOW_POINT.x;
        array[i * 3 + 1] = FLOW_POINT.y;
        array[i * 3 + 2] = FLOW_POINT.z;
      }
      attr.needsUpdate = true;
    },
    dispose: () => disposeTree(object),
  };
}

/* ------------------------------------------------------------------ */
/* path geometry per system                                            */
/* ------------------------------------------------------------------ */

/** A tilted ring hugging the heart — one loop per circuit, offset front or
    back so the red paths wrap the anterior face and the blue the posterior. */
function orbitRing(half: THREE.Vector3, opts: { rx: number; ry: number; z: number; tilt: number; wob: number }) {
  const points: THREE.Vector3[] = [];
  const N = 14;
  const tiltMatrix = new THREE.Matrix4().makeRotationX(opts.tilt);
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    const p = new THREE.Vector3(
      Math.cos(a) * half.x * opts.rx,
      Math.sin(a) * half.y * opts.ry,
      opts.z * half.z + Math.sin(a * 2) * half.z * opts.wob,
    );
    p.applyMatrix4(tiltMatrix);
    points.push(p);
  }
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
}

/** Five filtrate paths shaped like the model's nephrons: a coil at the
    glomerulus, a loop dipping toward the medulla, then the collecting duct
    draining into the papilla on the medial (+x) side. */
function nephronFlowCurves(half: THREE.Vector3) {
  const curves: THREE.CatmullRomCurve3[] = [];
  const papilla = new THREE.Vector3(half.x * 0.55, 0, 0);
  const centre = new THREE.Vector3(-half.x * 0.18, 0, 0);
  for (let i = 0; i < 5; i += 1) {
    const a = -1.15 + i * 0.58;
    const glom = new THREE.Vector3(
      centre.x + half.x * 0.62 * Math.cos(a),
      half.y * 0.82 * Math.sin(a),
      half.z * 0.5 * Math.cos(i * 1.7),
    );
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 5; s += 1) {
      const ang = (s / 5) * Math.PI * 1.9 + i;
      pts.push(
        glom.clone().add(new THREE.Vector3(Math.cos(ang) * half.x * 0.1, Math.sin(ang) * half.x * 0.1, half.z * 0.05 * s)),
      );
    }
    const dir = papilla.clone().sub(glom).normalize();
    const off = (i % 2 === 0 ? 1 : -1) * half.y * (0.14 + 0.07 * (i % 3));
    pts.push(glom.clone().addScaledVector(dir, half.x * 0.3));
    pts.push(centre.clone().lerp(papilla, 0.55).add(new THREE.Vector3(0, off, half.z * 0.35)));
    pts.push(centre.clone().lerp(papilla, 0.74).add(new THREE.Vector3(0, off * 0.9, -half.z * 0.14)));
    pts.push(papilla.clone().add(new THREE.Vector3(-half.x * 0.1, off * 0.5, half.z * 0.1)));
    curves.push(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.3));
  }
  return curves;
}

/* ------------------------------------------------------------------ */
/* stage                                                               */
/* ------------------------------------------------------------------ */

interface LoadedModel {
  kind: OrganSystem;
  holder: THREE.Group;
  fx: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  beat: THREE.AnimationAction | null;
  flow: Flow | null;
  fields: THREE.Object3D[];
  outer: THREE.Mesh | null;
  interiorMats: THREE.MeshStandardMaterial[];
}

/** Frees one loaded model and everything bolted to it. Called from effect
    cleanups (never during render), and safe to run on an already-freed
    record because dispose() is idempotent. */
function teardownModel(rec: LoadedModel) {
  rec.mixer?.stopAllAction();
  if (rec.mixer) rec.mixer.uncacheRoot(rec.mixer.getRoot());
  rec.holder.parent?.remove(rec.holder);
  rec.fx.parent?.remove(rec.fx);
  disposeTree(rec.holder);
  disposeTree(rec.fx);
}

/** Eases the kidney's capsule toward `target` opacity and flips depth-write
    off once it is see-through, so the nephrons behind it stay visible. */
function fadeShell(shell: THREE.MeshStandardMaterial, target: number, dt: number) {
  shell.opacity += (target - shell.opacity) * Math.min(1, dt * 5);
  shell.depthWrite = shell.opacity > 0.97;
}

/** Eases the interior glow that marks the filtered state. */
function lerpGlow(mat: THREE.MeshStandardMaterial, target: number, dt: number) {
  mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
}

interface StageProps {
  system: OrganSystem;
  /** Tab label, e.g. "Heart System". */
  label: string;
  /** One-line blurb shown above the canvas. */
  blurb: string;
  theme: "dark" | "light";
}

export default function OrganStage({ system, label, blurb, theme }: StageProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [bpm, setBpm] = useState(72);
  const [flowOn, setFlowOn] = useState(true);
  const [volume, setVolume] = useState(35);
  const [rate, setRate] = useState(14);
  const [breathe, setBreathe] = useState(false);
  const [filter, setFilter] = useState(false);
  const [filtrate, setFiltrate] = useState(55);

  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const vp = useViewport();
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const lightsRef = useRef<Record<string, THREE.Light> | null>(null);
  const modelRef = useRef<LoadedModel | null>(null);
  const dragging = useRef(false);
  /* Zero means "nothing loaded yet"; every model load and every control
     gesture stamps it so the idle turntable knows when to wake. */
  const lastInteract = useRef(0);

  /* Controls are read from the render loop through a ref so slider drags
     never re-render React at frame rate. */
  const ctrl = useRef({ bpm: 72, flow: true, volume: 35, rate: 14, breathe: false, filter: false, filtrate: 55 });
  useEffect(() => {
    ctrl.current = { bpm, flow: flowOn, volume, rate, breathe, filter, filtrate };
  });

  /* ── engine: one renderer, one orbit camera, the studio rig ── */
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
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.copy(CAM_DIR).multiplyScalar(6.6);

    /* Studio lighting: soft ambient + hemisphere carry the shadows away,
       a white key shapes the organ, a cool fill opens the dark side, and
       the cyan rim and violet kicker are the bench's own accents so the
       model belongs to this room. */
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const hemi = new THREE.HemisphereLight(0xdbe7f5, 0x0b1020, 0.45);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4.5, 6, 5);
    const fill = new THREE.DirectionalLight(0xbfe7ff, 0.6);
    fill.position.set(-5.5, 1.2, 3.5);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.8);
    rim.position.set(-3, 4.5, -6);
    const kicker = new THREE.DirectionalLight(0xa78bfa, 0.45);
    kicker.position.set(4.5, -3, -4.5);
    scene.add(ambient, hemi, key, fill, rim, kicker);
    lightsRef.current = { ambient, hemi, key, fill, rim, kicker };

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = TARGET_RADIUS * 0.7;
    controls.maxDistance = TARGET_RADIUS * 5;
    const onControlStart = () => {
      dragging.current = true;
      lastInteract.current = performance.now();
    };
    const onControlEnd = () => {
      dragging.current = false;
      lastInteract.current = performance.now();
    };
    controls.addEventListener("start", onControlStart);
    controls.addEventListener("end", onControlEnd);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    return () => {
      controls.removeEventListener("start", onControlStart);
      controls.removeEventListener("end", onControlEnd);
      controls.dispose();
      const leftover = modelRef.current;
      if (leftover) {
        modelRef.current = null;
        teardownModel(leftover);
      }
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      lightsRef.current = null;
    };
  }, [canvasRef]);

  /* ── the bench's light/dark switch re-times the rig ── */
  useEffect(() => {
    const lights = lightsRef.current;
    const renderer = rendererRef.current;
    if (!lights || !renderer) return;
    const set = (name: string, intensity: number) => {
      (lights[name] as THREE.Light & { intensity: number }).intensity = intensity;
    };
    if (theme === "light") {
      renderer.toneMappingExposure = 1.18;
      set("ambient", 0.72);
      set("hemi", 0.7);
      set("key", 2.6);
      set("fill", 0.9);
      set("rim", 0.55);
      set("kicker", 0.3);
      (lights.hemi as THREE.HemisphereLight).color.set(0xffffff);
      (lights.hemi as THREE.HemisphereLight).groundColor.set(0xd8dde6);
    } else {
      renderer.toneMappingExposure = 1.05;
      set("ambient", 0.5);
      set("hemi", 0.45);
      set("key", 2.1);
      set("fill", 0.6);
      set("rim", 0.8);
      set("kicker", 0.45);
      (lights.hemi as THREE.HemisphereLight).color.set(0xdbe7f5);
      (lights.hemi as THREE.HemisphereLight).groundColor.set(0x0b1020);
    }
  }, [theme]);

  /* ── tab switch: dispose the outgoing GLB, load the incoming one ── */
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    const spec = MODELS[system];
    let cancelled = false;
    setStatus("loading");

    new GLTFLoader().load(
      spec.url,
      (gltf) => {
        if (cancelled) {
          // the tab moved on while the file was in flight — free it now
          disposeTree(gltf.scene);
          return;
        }

        /* The holder owns normalisation (fit scale + centring) so the Beat
           clip keeps sole ownership of the inner node's scale. */
        const holder = new THREE.Group();
        holder.add(gltf.scene);
        scene.add(holder);
        const rawBox = new THREE.Box3().setFromObject(gltf.scene);
        const centre = rawBox.getCenter(new THREE.Vector3());
        const radius = Math.max(0.001, rawBox.getBoundingSphere(new THREE.Sphere()).radius);
        const k = TARGET_RADIUS / radius;
        holder.scale.setScalar(k);
        holder.position.copy(centre).multiplyScalar(-k);
        holder.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(holder);
        const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);

        const fx = new THREE.Group();
        scene.add(fx);

        let mixer: THREE.AnimationMixer | null = null;
        let beat: THREE.AnimationAction | null = null;
        let flow: Flow | null = null;
        const fields: THREE.Object3D[] = [];
        let outer: THREE.Mesh | null = null;
        const interiorMats: THREE.MeshStandardMaterial[] = [];

        if (system === "heart") {
          const clip = gltf.animations.find((a) => a.name === "Beat") ?? gltf.animations[0];
          if (clip) {
            mixer = new THREE.AnimationMixer(gltf.scene);
            beat = mixer.clipAction(clip);
            beat.setLoop(THREE.LoopRepeat, Infinity);
            beat.play();
          }
          flow = createFlow({
            closed: true,
            curves: [
              orbitRing(half, { rx: 1.1, ry: 1.15, z: 0.42, tilt: 0.42, wob: 0.2 }),
              orbitRing(half, { rx: 0.9, ry: 1.3, z: 0.08, tilt: -0.55, wob: 0.14 }),
              orbitRing(half, { rx: 1.16, ry: 1.1, z: -0.42, tilt: -0.38, wob: 0.18 }),
              orbitRing(half, { rx: 0.95, ry: 1.24, z: -0.1, tilt: 0.58, wob: 0.12 }),
            ],
            colors: [RED, RED_SOFT, BLUE, BLUE_SOFT],
            counts: [70, 70, 70, 70],
          });
          fx.add(flow.object);
        } else if (system === "respiratory") {
          for (const name of ["LungFieldR", "LungFieldL"]) {
            const field = gltf.scene.getObjectByName(name);
            if (field) fields.push(field);
          }
        } else {
          const shell = gltf.scene.getObjectByName("KidneyOuter");
          if (shell) {
            outer = shell as THREE.Mesh;
            const shellMat = outer.material as THREE.MeshStandardMaterial;
            shellMat.transparent = true; // fades open when Filter is pressed
            shellMat.opacity = 1;
            shellMat.depthWrite = true;
          }
          const seen = new Set<THREE.MeshStandardMaterial>();
          gltf.scene.getObjectByName("KidneyInterior")?.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of mats) {
              const std = mat as THREE.MeshStandardMaterial;
              if (!std.emissive || seen.has(std)) continue;
              seen.add(std);
              std.emissive.copy(std.color);
              std.emissiveIntensity = 0; // glows once the shell opens
              interiorMats.push(std);
            }
          });
          flow = createFlow({
            closed: false,
            curves: nephronFlowCurves(half),
            colors: [AMBER, MINT, AMBER, MINT, AMBER],
            counts: [40, 40, 40, 40, 40],
            tubeOpacity: 0.22,
            particleSize: 0.07,
          });
          fx.add(flow.object);
        }

        /* Fit view: stand far enough back that the whole organ is in frame,
           remember it for the reset button, then hand the camera over. */
        const fit = (TARGET_RADIUS / Math.sin((camera.fov * Math.PI) / 360)) * 1.4;
        camera.position.copy(CAM_DIR).multiplyScalar(fit);
        controls.target.set(0, 0, 0);
        controls.minDistance = TARGET_RADIUS * 0.7;
        controls.maxDistance = TARGET_RADIUS * 5;
        controls.update();
        controls.saveState();
        lastInteract.current = performance.now();

        modelRef.current = { kind: system, holder, fx, mixer, beat, flow, fields, outer, interiorMats };
        setStatus("ready");
      },
      undefined,
      () => {
        if (!cancelled) setStatus("error");
      },
    );

    return () => {
      cancelled = true;
      const rec = modelRef.current;
      if (rec) {
        modelRef.current = null;
        teardownModel(rec);
      }
    };
  }, [system]);

  /* ── the single frame loop ── */
  useRaf((dt, t) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!renderer || !scene || !camera || !controls) return;

    // Resize only when the box really changed, and never mid-gesture.
    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    syncViewport(vp.current, renderer, camera, cssW, cssH, dragging.current);

    // Orbit damping, plus a turntable that only wakes once the student lets
    // go — parked entirely under Motionless Mode.
    controls.autoRotate =
      !settingsRuntime.reduceMotion && performance.now() - lastInteract.current > 3200;
    controls.update();

    const rec = modelRef.current;
    const c = ctrl.current;
    const mdt = animDt(dt); // decorative time: 0 under reduced motion

    if (rec) {
      if (rec.kind === "heart") {
        if (rec.beat) rec.beat.timeScale = c.bpm / BASE_BPM;
        rec.mixer?.update(mdt);
        rec.flow?.setVisible(c.flow);
        rec.flow?.update(mdt, c.bpm / BASE_BPM);
      } else if (rec.kind === "respiratory") {
        // The slider is the manual scale; the optional cycle breathes on top.
        const manual = 1 + (c.volume / 100) * 0.32;
        let breath = 1;
        if (c.breathe) {
          const period = 60 / c.rate;
          const cyc = (t % period) / period;
          // quick inhale, slower exhale, short end-expiratory rest
          const inh =
            cyc < 0.42
              ? 0.5 - 0.5 * Math.cos((cyc / 0.42) * Math.PI)
              : cyc < 0.9
                ? 0.5 + 0.5 * Math.cos(((cyc - 0.42) / 0.48) * Math.PI)
                : 0;
          breath = 1 + inh * 0.16;
        }
        const s = manual * breath;
        for (const field of rec.fields) field.scale.set(s, 1 + (s - 1) * 0.72, s);
      } else {
        const shellMat = rec.outer?.material as THREE.MeshStandardMaterial | undefined;
        if (shellMat) fadeShell(shellMat, c.filter ? 0.16 : 1, dt);
        const glow = c.filter ? 0.85 : 0;
        for (const mat of rec.interiorMats) lerpGlow(mat, glow, dt);
        rec.flow?.update(mdt, (c.filtrate / 100) * 1.4);
      }
    }

    renderer.render(scene, camera);
  });

  const spec = MODELS[system];
  const resetView = () => {
    controlsRef.current?.reset();
    lastInteract.current = performance.now();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="apple-lab-micro">{label}</p>
            <h3 className="apple-lab-title mt-1 text-lg">{blurb}</h3>
          </div>
          <button type="button" className="apple-lab-btn !px-3 !py-2" onClick={resetView}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fit view</span>
          </button>
        </div>

        <div className="apple-lab-stage mt-4">
          <canvas
            ref={canvasRef}
            className="apple-lab-stage__canvas"
            role="img"
            aria-label={`${label} — interactive 3D model, drag to orbit, scroll to zoom`}
            onContextMenu={(event) => event.preventDefault()}
          />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="apple-lab-chip">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    status === "ready"
                      ? "var(--signal)"
                      : status === "loading"
                        ? "var(--lab-amber, #fbbf24)"
                        : "#f87171",
                }}
              />
              {status === "loading"
                ? `loading ${spec.file}…`
                : status === "error"
                  ? `${spec.file} unavailable`
                  : spec.file}
            </span>
            {status === "ready" && system === "heart" && (
              <span className="apple-lab-chip">{bpm} bpm · beat looping</span>
            )}
            {status === "ready" && system === "respiratory" && (
              <span className="apple-lab-chip">{volume}% inflation</span>
            )}
            {status === "ready" && system === "excretory" && (
              <span className="apple-lab-chip">
                {filter ? "shell open — nephrons visible" : "shell sealed"}
              </span>
            )}
          </div>

          <span className="apple-lab-chip pointer-events-none absolute bottom-3 right-3 !text-[10px]">
            drag orbit · scroll zoom · right-drag pan
          </span>

          {status === "error" && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="apple-lab-chip max-w-sm text-center leading-relaxed">
                {spec.file} could not be loaded from <code>public/models/</code> — the model
                ships with the app, so a reload should bring it back.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="apple-lab-micro">Controls</p>

        <motion.div
          key={system}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="flex flex-col gap-3"
        >
          {system === "heart" && (
            <>
              <div className="apple-lab-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="apple-lab-micro flex items-center gap-2">
                    <HeartPulse className="h-3.5 w-3.5" style={{ color: "var(--signal)" }} />
                    Heart rate
                  </span>
                  <span className="apple-lab-value text-[13px]">{bpm} bpm</span>
                </div>
                <input
                  type="range"
                  className="apple-lab-range mt-2"
                  min={40}
                  max={180}
                  step={1}
                  value={bpm}
                  onChange={(event) => setBpm(Number(event.target.value))}
                  aria-label="Heart rate in beats per minute"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--lab-ink-micro)]">
                  <span>Stroke ≈ 70 mL</span>
                  <span className="text-right tabular-nums">
                    Output {(bpm * 0.07).toFixed(1)} L/min
                  </span>
                </div>
              </div>

              <div className="apple-lab-card flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="min-w-0">
                  <span className="apple-lab-micro block">Blood flow paths</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                    Red runs the oxygenated circuit out of the left ventricle; blue returns
                    deoxygenated blood to the right side. Both speed up with the rate.
                  </span>
                </span>
                <button
                  type="button"
                  className="apple-lab-btn !shrink-0 !px-3 !py-2"
                  data-active={flowOn}
                  aria-pressed={flowOn}
                  onClick={() => setFlowOn((value) => !value)}
                >
                  <Waves className="h-3.5 w-3.5" />
                  <span>{flowOn ? "On" : "Off"}</span>
                </button>
              </div>

              <div className="apple-lab-card px-3.5 py-3">
                <p className="apple-lab-micro mb-1.5">What the rate changes</p>
                <ul className="space-y-1.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  <li className="flex gap-2">
                    <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                    One loop of the Beat clip is a single cardiac cycle — systole bulges, then
                    the muscle settles back.
                  </li>
                  <li className="flex gap-2">
                    <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                    Cardiac output is rate × stroke volume: 70 mL per beat means about 5 L/min
                    at rest.
                  </li>
                </ul>
              </div>
            </>
          )}

          {system === "respiratory" && (
            <>
              <div className="apple-lab-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="apple-lab-micro flex items-center gap-2">
                    <Wind className="h-3.5 w-3.5" style={{ color: "var(--signal)" }} />
                    Lung inflation
                  </span>
                  <span className="apple-lab-value text-[13px] tabular-nums">
                    {volume}% · {(1 + (volume / 100) * 0.32).toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  className="apple-lab-range mt-2"
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  aria-label="Lung inflation — scales the lungs"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--lab-ink-micro)]">
                  <span>Tidal ≈ {volume * 5} mL</span>
                  <span className="text-right">Alveoli ≈ 480 million</span>
                </div>
              </div>

              <div className="apple-lab-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="apple-lab-micro">Breathing cycle</span>
                  <button
                    type="button"
                    className="apple-lab-btn !px-3 !py-1.5 !text-[12px]"
                    data-active={breathe}
                    aria-pressed={breathe}
                    onClick={() => setBreathe((value) => !value)}
                  >
                    <Wind className="h-3.5 w-3.5" />
                    <span>{breathe ? "Cycling" : "Manual"}</span>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--lab-ink-dim)]">
                  <span>Rate</span>
                  <span className="apple-lab-value tabular-nums">{rate} /min</span>
                </div>
                <input
                  type="range"
                  className={`apple-lab-range mt-1 ${breathe ? "" : "opacity-40"}`}
                  min={8}
                  max={30}
                  step={1}
                  value={rate}
                  disabled={!breathe}
                  onChange={(event) => setRate(Number(event.target.value))}
                  aria-label="Breaths per minute"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--lab-ink-micro)]">
                  <span>Depth = the slider</span>
                  <span className="text-right tabular-nums">
                    {breathe ? `Minute vent ${(rate * volume * 5) / 1000} L/min` : "Slider sets scale"}
                  </span>
                </div>
              </div>

              <div className="apple-lab-card px-3.5 py-3">
                <p className="apple-lab-micro mb-1.5">What the slider changes</p>
                <ul className="space-y-1.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  <li className="flex gap-2">
                    <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                    It scales both lung fields about their own centres — the airway stays put
                    while the lobes fill, like a real inhalation.
                  </li>
                  <li className="flex gap-2">
                    <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                    Turn on the cycle and the slider becomes breath depth: the rate sets how
                    often, the slider sets how deep.
                  </li>
                </ul>
              </div>
            </>
          )}

          {system === "excretory" && (
            <>
              <div className="apple-lab-card flex items-center justify-between gap-3 px-3.5 py-3">
                <span className="min-w-0">
                  <span className="apple-lab-micro block">Outer shell</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                    {filter
                      ? "Faded open — the pyramids, glomeruli and tubules show through."
                      : "Opaque, as the capsule sits in the body. Press Filter to look inside."}
                  </span>
                </span>
                <button
                  type="button"
                  className="apple-lab-btn apple-lab-btn--solid !shrink-0 !px-3.5 !py-2"
                  data-active={filter}
                  aria-pressed={filter}
                  onClick={() => setFilter((value) => !value)}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter</span>
                </button>
              </div>

              <div className="apple-lab-card px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="apple-lab-micro">Filtration rate</span>
                  <span className="apple-lab-value text-[13px] tabular-nums">
                    ≈ {((filtrate / 100) * 125).toFixed(0)} mL/min
                  </span>
                </div>
                <input
                  type="range"
                  className="apple-lab-range mt-2"
                  min={0}
                  max={100}
                  step={1}
                  value={filtrate}
                  onChange={(event) => setFiltrate(Number(event.target.value))}
                  aria-label="Filtration rate"
                />
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[var(--lab-ink-micro)]">
                  <span>100% ≈ 180 L/day</span>
                  <span className="text-right">5 nephrons drawn</span>
                </div>
              </div>

              <div className="apple-lab-card px-3.5 py-3">
                <p className="apple-lab-micro mb-1.5">Follow the filtrate</p>
                <ul className="space-y-1.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  <li className="flex gap-2">
                    <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#fbbf24]" />
                    Amber dots coil around the glomerulus, dip into the loop of Henle and drain
                    through the collecting duct toward the pelvis.
                  </li>
                  <li className="flex gap-2">
                    <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#34d399]" />
                    Mint marks the glomeruli themselves — the pressure filters blood into the
                    tubule right there.
                  </li>
                </ul>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
