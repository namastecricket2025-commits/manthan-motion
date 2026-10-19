import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { motion } from "motion/react";
import {
  Box,
  Droplets,
  Eye,
  HeartPulse,
  Layers,
  MousePointer2,
  RotateCcw,
  Scan,
  Tag,
  Waves,
  Wind,
} from "lucide-react";
import { animDt, settingsRuntime } from "@/lib/app-settings";
import { SPRING, syncViewport, useCanvasSize, useRaf, useViewport } from "../use-canvas";
import {
  ORGAN_MODELS,
  VIEW_COPY,
  type OrganPart,
  type OrganSystem,
  type ParticleFlow,
  type ViewMode,
} from "./organ-model";

export type { OrganSystem } from "./organ-model";

const TARGET_RADIUS = 1.7;
const CAM_DIR = new THREE.Vector3(0.42, 0.3, 1).normalize();
const CUT_COLOR = "#fbbf24";

/* ------------------------------------------------------------------ */
/* model records                                                       */
/* ------------------------------------------------------------------ */

interface PartRecord {
  part: OrganPart;
  mesh: THREE.Mesh;
  rim?: THREE.Mesh;
  inflate: boolean;
  beat: boolean;
  basePos: THREE.Vector3;
  baseScale: THREE.Vector3;
  baseCenter: THREE.Vector3;
  dir: THREE.Vector3;
}

interface LabelRecord {
  object: CSS2DObject;
  anchor: HTMLDivElement;
  card: HTMLDivElement;
  line: SVGLineElement;
  compact: boolean;
  width: number;
  height: number;
}

interface StageModel {
  system: OrganSystem;
  holder: THREE.Group;
  root: THREE.Group;
  records: PartRecord[];
  byId: Map<string, PartRecord>;
  pickMeshes: THREE.Mesh[];
  plane: THREE.Plane;
  cutMinZ: number;
  cutMaxZ: number;
  cap: THREE.Mesh;
  flow?: ParticleFlow;
  labels: Map<string, LabelRecord>;
  labelRenderer: CSS2DRenderer;
  appliedMode: ViewMode | null;
  appliedFocus: string | null | undefined;
  appliedIsolate: string | null | undefined;
  appliedExplode: number | null;
  appliedCut: number | null;
}

interface Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  lights: {
    ambient: THREE.AmbientLight;
    hemi: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
    kicker: THREE.DirectionalLight;
  };
  labelRenderer: CSS2DRenderer;
  labelLayer: HTMLDivElement;
  leaderSvg: SVGSVGElement;
  model: StageModel | null;
}

function materialOf(mesh: THREE.Mesh) {
  return mesh.material as THREE.MeshPhysicalMaterial;
}

/* ------------------------------------------------------------------ */
/* view / state sync                                                   */
/* ------------------------------------------------------------------ */

function applyMode(model: StageModel, mode: ViewMode) {
  for (const record of model.records) {
    const material = materialOf(record.mesh);
    if (record.rim) record.rim.visible = mode === "xray";
    if (record.part.outer) {
      const base = (material.userData.baseOpacity as number | undefined) ?? 0.3;
      material.opacity = mode === "xray" ? 0.13 : base;
      material.depthWrite = mode === "xray" ? false : base > 0.8;
    }
  }

  if (model.appliedMode === mode) return;
  model.appliedMode = mode;
  const clipping = mode === "cross" ? [model.plane] : [];
  for (const record of model.records) {
    const material = materialOf(record.mesh);
    material.clippingPlanes = clipping;
    material.needsUpdate = true;
  }
  model.cap.visible = mode === "cross";
}

function applyFocus(
  model: StageModel,
  focus: string | null,
  isolate: string | null,
) {
  if (model.appliedFocus === focus && model.appliedIsolate === isolate) return;
  model.appliedFocus = focus;
  model.appliedIsolate = isolate;

  for (const record of model.records) {
    recordsVisibility(record, isolate);
    const material = materialOf(record.mesh);
    const base = (material.userData.baseColor as THREE.Color | undefined) ?? new THREE.Color(record.part.color);
    material.color.copy(base);
    material.emissive.setRGB(0, 0, 0);
    material.emissiveIntensity = 0;

    if (focus) {
      if (record.part.id === focus) {
        material.emissive.copy(base);
        material.emissiveIntensity = 0.55;
      } else if (!isolate) {
        material.color.multiplyScalar(0.45);
      }
    }
  }
}

function recordsVisibility(record: PartRecord, isolate: string | null) {
  record.mesh.visible = !isolate || record.part.id === isolate;
}

function applyExplode(model: StageModel, value: number) {
  if (model.appliedExplode === value) return;
  model.appliedExplode = value;
  for (const record of model.records) {
    record.mesh.position.copy(record.basePos).addScaledVector(record.dir, value * 0.3);
  }
}

function applyCut(model: StageModel, percent: number) {
  if (model.appliedCut === percent) return;
  model.appliedCut = percent;
  const t = Math.max(0, Math.min(100, percent)) / 100;
  const localZ = model.cutMinZ + t * (model.cutMaxZ - model.cutMinZ);
  model.cap.position.z = localZ;
  model.plane.constant = localZ * model.holder.scale.z + model.holder.position.z;
}

/* ------------------------------------------------------------------ */
/* labels                                                              */
/* ------------------------------------------------------------------ */

interface LabelItem {
  record: PartRecord;
  label: LabelRecord;
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  width: number;
  height: number;
}

function updateLabels(
  model: StageModel,
  state: {
    showAll: boolean;
    hovered: string | null;
    pinned: string | null;
    isolate: string | null;
    explode: number;
  },
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
) {
  const focus = state.isolate ?? state.hovered ?? state.pinned;
  const items: LabelItem[] = [];
  const point = new THREE.Vector3();

  for (const record of model.records) {
    const label = model.labels.get(record.part.id);
    if (!label) continue;
    const available = !state.isolate || state.isolate === record.part.id;
    const show =
      available &&
      (state.showAll || record.part.id === focus || record.part.id === state.pinned);
    label.object.visible = show;
    if (!show) {
      label.line.style.display = "none";
      continue;
    }

    label.object.position
      .copy(record.baseCenter)
      .addScaledVector(record.dir, state.explode * 0.3);
    point.copy(label.object.position);
    model.holder.localToWorld(point);
    point.project(camera);

    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.z < -1 ||
      point.z > 1
    ) {
      label.object.visible = false;
      label.line.style.display = "none";
      continue;
    }

    const ax = (point.x * 0.5 + 0.5) * width;
    const ay = (-point.y * 0.5 + 0.5) * height;
    if (ax < -50 || ax > width + 50 || ay < -40 || ay > height + 40) {
      label.object.visible = false;
      label.line.style.display = "none";
      continue;
    }

    const isFocus = record.part.id === focus;
    const compact = state.showAll && !isFocus;
    if (label.compact !== compact) {
      label.compact = compact;
      label.width = 0;
      label.height = 0;
    }
    label.card.classList.toggle("is-compact", compact);
    label.card.classList.toggle("is-focus", isFocus);
    label.card.classList.toggle("is-pinned", record.part.id === state.pinned);
    if (label.width === 0) {
      label.width = label.card.offsetWidth || 172;
      label.height = label.card.offsetHeight || 34;
    }

    const side = ax < width * 0.52 ? 1 : -1;
    items.push({
      record,
      label,
      ax,
      ay,
      dx: side * (compact ? 94 : 84),
      dy: 0,
      width: label.width,
      height: label.height,
    });
  }

  /* Stack labels on each side so the "show all" view never overlaps. */
  if (state.showAll) {
    const columns = new Map<number, LabelItem[]>();
    for (const item of items) {
      const side = item.dx >= 0 ? 1 : -1;
      const column = columns.get(side) ?? [];
      column.push(item);
      columns.set(side, column);
    }
    for (const column of columns.values()) {
      column.sort((a, b) => a.ay - b.ay);
      let cursor = 14;
      let gap = 37;
      for (const item of column) {
        item.dy = Math.max(item.ay - 8, cursor) - item.ay;
        gap = Math.max(37, item.height + 8);
        cursor = Math.max(item.ay - 8, cursor) + gap;
      }
      const overflow = cursor - gap - (height - 14);
      if (overflow > 0) {
        for (const item of column) item.dy -= overflow;
      }
    }
  } else {
    for (const item of items) {
      if (item.ay < 50) item.dy = 34;
      if (item.ay > height - 50) item.dy = -34;
    }
  }

  for (const item of items) {
    const { label, ax, ay, dx, dy, width: labelWidth, record } = item;
    label.card.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const cardX = ax + dx;
    const cardY = ay + dy;
    const edgeX = cardX - Math.sign(dx) * Math.min(labelWidth / 2, 92);
    label.line.setAttribute("x1", ax.toFixed(1));
    label.line.setAttribute("y1", ay.toFixed(1));
    label.line.setAttribute("x2", edgeX.toFixed(1));
    label.line.setAttribute("y2", cardY.toFixed(1));
    label.line.setAttribute("stroke", record.part.color);
    label.line.setAttribute(
      "opacity",
      record.part.id === focus ? "0.9" : "0.45",
    );
    label.line.style.display = "";
  }
}

function makeLabelElement(part: OrganPart) {
  const anchor = document.createElement("div");
  anchor.className = "organ-anchor";
  const card = document.createElement("div");
  card.className = "organ-label";
  card.dataset.part = part.id;

  const dot = document.createElement("span");
  dot.className = "organ-label__dot";
  dot.style.background = part.color;
  dot.style.boxShadow = `0 0 8px ${part.color}`;

  const body = document.createElement("span");
  body.className = "organ-label__body";
  const name = document.createElement("span");
  name.className = "organ-label__name";
  name.textContent = part.name;
  const fn = document.createElement("span");
  fn.className = "organ-label__fn";
  fn.textContent = part.fn;
  body.append(name, fn);
  card.append(dot, body);
  anchor.appendChild(card);
  return { anchor, card };
}

/* ------------------------------------------------------------------ */
/* disposal                                                            */
/* ------------------------------------------------------------------ */

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (!material) return;
    for (const entry of Array.isArray(material) ? material : [material]) {
      const record = entry as unknown as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const value = record[key] as THREE.Texture | undefined;
        if (value && value.isTexture) value.dispose();
      }
      entry.dispose();
    }
  });
}

/* ------------------------------------------------------------------ */
/* engine component                                                    */
/* ------------------------------------------------------------------ */

interface StageProps {
  system: OrganSystem;
  label: string;
  blurb: string;
  theme: "dark" | "light";
}

export default function OrganStage({ system, label, blurb, theme }: StageProps) {
  const definition = ORGAN_MODELS[system];

  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewMode>("solid");
  const [cut, setCut] = useState(55);
  const [explode, setExplode] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [isolate, setIsolate] = useState<string | null>(null);

  const [bpm, setBpm] = useState(72);
  const [flowOn, setFlowOn] = useState(true);
  const [volume, setVolume] = useState(35);
  const [rate, setRate] = useState(14);
  const [breathe, setBreathe] = useState(false);
  const [filtrate, setFiltrate] = useState(55);

  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const vp = useViewport();
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
  const leaderRef = useRef<SVGSVGElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const modelRef = useRef<StageModel | null>(null);
  const hoverRef = useRef<string | null>(null);
  const lastInteract = useRef(0);

  const stateRef = useRef({
    view,
    cut,
    explode,
    showAll,
    hovered,
    pinned,
    isolate,
    bpm,
    flowOn,
    volume,
    rate,
    breathe,
    filtrate,
  });
  useEffect(() => {
    stateRef.current = {
      view,
      cut,
      explode,
      showAll,
      hovered,
      pinned,
      isolate,
      bpm,
      flowOn,
      volume,
      rate,
      breathe,
      filtrate,
    };
  });

  const hoverPart = (id: string | null) => {
    hoverRef.current = id;
    setHovered(id);
  };

  const pinPart = (id: string | null) => {
    setPinned((previous) => (previous === id ? null : id));
    setIsolate((previous) => (previous && id ? id : previous));
  };

  const clearSelection = () => {
    setPinned(null);
    setIsolate(null);
    hoverRef.current = null;
    setHovered(null);
  };

  const selectedPart = useMemo(
    () => definition.parts.find((part) => part.id === (pinned ?? isolate)) ?? null,
    [definition.parts, pinned, isolate],
  );

  const groups = useMemo(() => {
    const map = new Map<string, OrganPart[]>();
    for (const part of definition.parts) {
      const list = map.get(part.group) ?? [];
      list.push(part);
      map.set(part.group, list);
    }
    return [...map.entries()];
  }, [definition.parts]);

  /* ── one renderer, one scene, one organ built in code ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelLayerRef.current;
    const leaderSvg = leaderRef.current;
    if (!canvas || !labelLayer || !leaderSvg) return;

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
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);

    const ambient = new THREE.AmbientLight(0xffffff, 0.52);
    const hemi = new THREE.HemisphereLight(0xdfeaff, 0x131a25, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(4.5, 6, 5);
    const fill = new THREE.DirectionalLight(0xbfe7ff, 0.62);
    fill.position.set(-5.5, 1.2, 3.5);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.7);
    rim.position.set(-3, 4.5, -6);
    const kicker = new THREE.DirectionalLight(0xa78bfa, 0.38);
    kicker.position.set(4.5, -3, -4.5);
    scene.add(ambient, hemi, key, fill, rim, kicker);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 0.45;
    controls.minDistance = TARGET_RADIUS * 0.7;
    controls.maxDistance = TARGET_RADIUS * 5;
    controls.screenSpacePanning = true;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "organ-css2d";
    labelLayer.appendChild(labelRenderer.domElement);

    let dragging = false;
    const onControlStart = () => {
      dragging = true;
      lastInteract.current = performance.now();
    };
    const onControlEnd = () => {
      dragging = false;
      lastInteract.current = performance.now();
    };
    controls.addEventListener("start", onControlStart);
    controls.addEventListener("end", onControlEnd);

    /* Build the model before it is ever shown, so switching tabs cannot
       leave the previous organ in the frame. */
    const built = definition.build();
    const holder = new THREE.Group();
    holder.name = `${system}-holder`;
    holder.add(built.root);

    const rawBox = new THREE.Box3().setFromObject(built.root);
    const sphere = rawBox.getBoundingSphere(new THREE.Sphere());
    const scale = TARGET_RADIUS / Math.max(0.001, sphere.radius);
    holder.scale.setScalar(scale);
    holder.position.copy(sphere.center).multiplyScalar(-scale);
    holder.updateMatrixWorld(true);

    built.root.add(built.cap);
    built.cap.visible = false;
    if (built.flow) built.root.add(built.flow.object);
    scene.add(holder);

    const cutMinZ = rawBox.min.z;
    const cutMaxZ = rawBox.max.z;
    const records: PartRecord[] = built.parts.map((entry) => {
      entry.mesh.updateMatrix();
      const center = entry.center
        ? entry.center.clone()
        : (() => {
            entry.mesh.geometry.computeBoundingBox();
            const c = entry.mesh.geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
            return c.applyMatrix4(entry.mesh.matrix);
          })();
      const dir = center.clone();
      if (dir.lengthSq() < 0.0001) dir.set(0, 0.8, 0.35);
      dir.normalize();
      return {
        part: entry.part,
        mesh: entry.mesh,
        rim: entry.rim,
        inflate: Boolean(entry.inflate),
        beat: Boolean(entry.beat),
        basePos: entry.mesh.position.clone(),
        baseScale: entry.mesh.scale.clone(),
        baseCenter: center,
        dir,
      };
    });

    const labels = new Map<string, LabelRecord>();
    for (const record of records) {
      const { anchor, card } = makeLabelElement(record.part);
      const object = new CSS2DObject(anchor);
      object.position.copy(record.baseCenter);
      object.visible = false;
      holder.add(object);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "organ-leader");
      line.style.display = "none";
      leaderSvg.appendChild(line);
      labels.set(record.part.id, {
        object,
        anchor,
        card,
        line,
        compact: false,
        width: 0,
        height: 0,
      });
    }

    const model: StageModel = {
      system,
      holder,
      root: built.root,
      records,
      byId: new Map(records.map((record) => [record.part.id, record])),
      pickMeshes: records.map((record) => record.mesh),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
      cutMinZ,
      cutMaxZ,
      cap: built.cap,
      flow: built.flow,
      labels,
      labelRenderer,
      appliedMode: null,
      appliedFocus: undefined,
      appliedIsolate: undefined,
      appliedExplode: null,
      appliedCut: null,
    };
    modelRef.current = model;

    const engine: Engine = {
      renderer,
      scene,
      camera,
      controls,
      lights: { ambient, hemi, key, fill, rim, kicker },
      labelRenderer,
      labelLayer,
      leaderSvg,
      model,
    };
    engineRef.current = engine;

    const fitView = () => {
      const fit = (TARGET_RADIUS / Math.sin((camera.fov * Math.PI) / 360)) * 1.34;
      camera.position.copy(CAM_DIR).multiplyScalar(fit);
      controls.target.set(0, 0, 0);
      controls.update();
      controls.saveState();
      lastInteract.current = performance.now();
    };
    fitView();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const down = { x: 0, y: 0, time: 0, id: -1, button: 0 };
    let moved = false;

    const setPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
      );
    };

    const pickAt = (event: PointerEvent) => {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(model.pickMeshes, false);
      const state = stateRef.current;
      const hit = hits.find((entry) => {
        if (state.view !== "cross") return true;
        return model.plane.distanceToPoint(entry.point) >= 0;
      });
      return (hit?.object.userData.partId as string | undefined) ?? null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragging) return;
      const id = pickAt(event);
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        setHovered(id);
      }
      canvas.style.cursor = id ? "pointer" : "";
    };

    const onPointerDown = (event: PointerEvent) => {
      down.x = event.clientX;
      down.y = event.clientY;
      down.time = performance.now();
      down.id = event.pointerId;
      down.button = event.button;
      moved = false;
      lastInteract.current = performance.now();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== down.id || down.button !== 0) return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) moved = true;
      if (moved || performance.now() - down.time > 650) return;
      /* Re-pick at the release point: touch has no hover frame before a tap. */
      const id = pickAt(event);
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        setHovered(id);
      }
      setPinned((previous) => (previous === id ? null : id));
      setIsolate((previous) => (previous && id ? id : previous));
    };

    const onPointerLeave = () => {
      if (hoverRef.current !== null) {
        hoverRef.current = null;
        setHovered(null);
      }
      canvas.style.cursor = "";
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    setReady(true);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      controls.removeEventListener("start", onControlStart);
      controls.removeEventListener("end", onControlEnd);
      controls.dispose();
      for (const label of labels.values()) {
        label.line.remove();
      }
      labelRenderer.domElement.remove();
      built.flow?.dispose();
      disposeTree(holder);
      scene.clear();
      renderer.dispose();
      modelRef.current = null;
      engineRef.current = null;
      setReady(false);
    };
    // The organ is rebuilt when the tab changes; the renderer itself is
    // intentionally created fresh so the previous organ cannot linger.
  }, [canvasRef, definition, system]);

  /* Light/dark retiming. */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const { renderer, lights } = engine;
    if (theme === "light") {
      renderer.toneMappingExposure = 1.18;
      lights.ambient.intensity = 0.72;
      lights.hemi.intensity = 0.72;
      lights.hemi.color.set(0xffffff);
      lights.hemi.groundColor.set(0xd8dde6);
      lights.key.intensity = 2.35;
      lights.fill.intensity = 0.9;
      lights.rim.intensity = 0.45;
      lights.kicker.intensity = 0.22;
    } else {
      renderer.toneMappingExposure = 1.05;
      lights.ambient.intensity = 0.52;
      lights.hemi.intensity = 0.55;
      lights.hemi.color.set(0xdfeaff);
      lights.hemi.groundColor.set(0x131a25);
      lights.key.intensity = 1.9;
      lights.fill.intensity = 0.62;
      lights.rim.intensity = 0.7;
      lights.kicker.intensity = 0.38;
    }
  }, [theme, system]);

  /* ── single frame loop ── */
  useRaf((dt, t) => {
    const engine = engineRef.current;
    const model = modelRef.current;
    if (!engine) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const { renderer, scene, camera, controls, labelRenderer } = engine;
    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    if (cssW <= 0 || cssH <= 0) return;

    syncViewport(vp.current, renderer, camera, cssW, cssH, false);
    if (
      labelRenderer.domElement.style.width !== `${cssW}px` ||
      labelRenderer.domElement.style.height !== `${cssH}px`
    ) {
      labelRenderer.setSize(cssW, cssH);
    }

    const state = stateRef.current;
    controls.autoRotate =
      !settingsRuntime.reduceMotion &&
      !state.hovered &&
      !state.pinned &&
      !state.isolate &&
      performance.now() - lastInteract.current > 4800;
    controls.update();
    const motion = animDt(dt);

    if (model) {
      for (const record of model.records) {
        if (!record.inflate && !record.beat) continue;
        if (record.inflate) {
          const manual = 1 + (state.volume / 100) * 0.32;
          let breath = 1;
          if (state.breathe) {
            const period = 60 / state.rate;
            const cycle = (t % period) / period;
            const inhale =
              cycle < 0.42
                ? 0.5 - 0.5 * Math.cos((cycle / 0.42) * Math.PI)
                : cycle < 0.9
                  ? 0.5 + 0.5 * Math.cos(((cycle - 0.42) / 0.48) * Math.PI)
                  : 0;
            breath = 1 + inhale * 0.16;
          }
          const s = manual * breath;
          record.mesh.scale.set(
            record.baseScale.x * s,
            record.baseScale.y * (1 + (s - 1) * 0.72),
            record.baseScale.z * s,
          );
        }
        if (record.beat) {
          const phase = ((t * state.bpm) / 60) % 1;
          const systole = Math.exp(-Math.pow((phase - 0.12) / 0.075, 2));
          const diastole = Math.exp(-Math.pow((phase - 0.44) / 0.085, 2));
          const pulse = systole * 0.055 + diastole * 0.035;
          record.mesh.scale.set(
            record.baseScale.x * (1 + pulse * 0.8),
            record.baseScale.y * (1 - pulse),
            record.baseScale.z * (1 + pulse * 0.8),
          );
        }
      }

      applyMode(model, state.view);
      applyExplode(model, state.explode);
      applyCut(model, state.cut);
      const focus = state.isolate ?? state.hovered ?? state.pinned;
      applyFocus(model, focus, state.isolate);

      /* Keep the cut-face uniform alive even if the material compiled
         after the first mode switch. */
      for (const record of model.records) {
        const uniform = materialOf(record.mesh).userData.cutStrength as
          | { value: number }
          | undefined;
        if (uniform) uniform.value = state.view === "cross" ? 1 : 0;
      }

      const flowVisible =
        Boolean(model.flow) &&
        (!state.isolate || state.isolate === "nephrons") &&
        (system !== "heart" || state.flowOn);
      model.flow?.setVisible(flowVisible);
      if (flowVisible && model.flow) {
        model.flow.update(motion, system === "heart" ? state.bpm / 72 : 0.35 + (state.filtrate / 100) * 1.5);
      }
    }

    renderer.render(scene, camera);

    if (model) {
      updateLabels(model, state, camera, cssW, cssH);
      labelRenderer.render(scene, camera);
    }
  });

  const resetView = () => {
    engineRef.current?.controls.reset();
    lastInteract.current = performance.now();
  };

  const visibleLabelCount = isolate
    ? 1
    : showAll
      ? definition.parts.length
      : new Set([hovered, pinned].filter(Boolean)).size;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* ── viewer ── */}
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

        <div className="organ-viewbar mt-4">
          <div className="organ-seg" role="group" aria-label="3D view mode">
            {(["solid", "xray", "cross"] as ViewMode[]).map((mode) => {
              const Icon = mode === "solid" ? Box : mode === "xray" ? Eye : Layers;
              return (
                <button
                  key={mode}
                  type="button"
                  data-active={view === mode}
                  onClick={() => setView(mode)}
                  aria-pressed={view === mode}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{VIEW_COPY[mode].label}</span>
                </button>
              );
            })}
          </div>
          <span className="organ-viewhint">{VIEW_COPY[view].hint}</span>
        </div>

        <div className="apple-lab-stage mt-3">
          <canvas
            ref={canvasRef}
            className="apple-lab-stage__canvas"
            role="img"
            aria-label={`${label} — interactive 3D model. Drag to orbit, scroll to zoom, click a part to pin its description.`}
            onContextMenu={(event) => event.preventDefault()}
          />

          <div ref={labelLayerRef} className="organ-label-layer" />
          <svg ref={leaderRef} className="organ-leaders" aria-hidden="true" />

          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="apple-lab-chip">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: ready ? "var(--signal)" : "var(--lab-amber, #fbbf24)" }}
              />
              {ready ? `${definition.parts.length} structures` : "building model…"}
            </span>
            {ready && (
              <span className="apple-lab-chip">
                {VIEW_COPY[view].label}
                {view === "cross" ? ` · ${cut}%` : ""}
              </span>
            )}
            {ready && visibleLabelCount > 1 && (
              <span className="apple-lab-chip">{visibleLabelCount} labels</span>
            )}
          </div>

          <span className="apple-lab-chip pointer-events-none absolute bottom-3 right-3 !text-[10px]">
            drag orbit · scroll zoom · right-drag pan · click to pin
          </span>
        </div>

        {view === "cross" && (
          <div className="apple-lab-card mt-3 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="apple-lab-micro flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" style={{ color: CUT_COLOR }} />
                Cut plane
              </span>
              <span className="apple-lab-value text-[13px] tabular-nums">{cut}%</span>
            </div>
            <input
              type="range"
              className="apple-lab-range mt-2"
              min={0}
              max={100}
              step={1}
              value={cut}
              onChange={(event) => setCut(Number(event.target.value))}
              aria-label="Cross-section cut depth"
            />
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--lab-ink-micro)]">
              Slide through the organ. The exposed cut face is tinted amber so the
              interior surfaces stay readable.
            </p>
          </div>
        )}

        <div className="apple-lab-card mt-3 px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
              data-active={Boolean(isolate)}
              disabled={!isolate && !selectedPart && !hovered}
              onClick={() => {
                if (isolate) {
                  setIsolate(null);
                  return;
                }
                const target = selectedPart?.id ?? hovered;
                if (target) setIsolate(target);
              }}
            >
              <Scan className="h-3.5 w-3.5" />
              <span>{isolate ? "Show all" : "Isolate"}</span>
            </button>
            <button
              type="button"
              className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
              data-active={showAll}
              aria-pressed={showAll}
              onClick={() => {
                const next = !showAll;
                setShowAll(next);
                if (next && isolate) setIsolate(null);
              }}
            >
              <Tag className="h-3.5 w-3.5" />
              <span>{showAll ? "Hide labels" : "Show all labels"}</span>
            </button>
            <span className="ml-auto text-[10px] text-[var(--lab-ink-micro)]">
              {isolate ? "Only the chosen part is drawn" : "Hover a part to preview it"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="apple-lab-micro">Explode</span>
            <span className="apple-lab-value text-[12px] tabular-nums">{explode}%</span>
          </div>
          <input
            type="range"
            className="apple-lab-range mt-1.5"
            min={0}
            max={100}
            step={1}
            value={explode}
            onChange={(event) => setExplode(Number(event.target.value))}
            aria-label="Explode view — separates the parts"
          />
        </div>
      </div>

      {/* ── structures + controls ── */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Structures</p>
            <span className="apple-lab-note text-[10px]">click to pin · hover to find</span>
          </div>

          {selectedPart ? (
            <motion.div
              key={selectedPart.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              className="apple-lab-card mt-3 px-3.5 py-3"
              style={{ borderColor: `color-mix(in srgb, ${selectedPart.color} 46%, transparent)` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="apple-lab-micro" style={{ color: selectedPart.color }}>
                    {selectedPart.group}
                  </p>
                  <p className="apple-lab-value mt-1 text-[14px] font-semibold leading-tight">
                    {selectedPart.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="apple-lab-btn !px-2.5 !py-1 !text-[10px]"
                  onClick={clearSelection}
                >
                  Clear
                </button>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
                {selectedPart.fn}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="apple-lab-btn !px-2.5 !py-1 !text-[10px]"
                  data-active={isolate === selectedPart.id}
                  onClick={() =>
                    setIsolate((previous) =>
                      previous === selectedPart.id ? null : selectedPart.id,
                    )
                  }
                >
                  <Scan className="h-3 w-3" />
                  <span>{isolate === selectedPart.id ? "Show all" : "Isolate part"}</span>
                </button>
                <span className="text-[10px] text-[var(--lab-ink-micro)]">
                  {pinned ? "Pinned in the model" : "Isolated in the model"}
                </span>
              </div>
            </motion.div>
          ) : (
            <p className="apple-lab-note mt-2">
              Hover any structure to light it up in 3D. Click the model or a row to
              pin its description here.
            </p>
          )}

          <div className="organ-scroll mt-2 max-h-[360px] overflow-y-auto pr-1">
            {groups.map(([group, parts]) => (
              <div key={group}>
                <p className="apple-lab-micro mt-3">{group}</p>
                <div className="mt-1.5 flex flex-col gap-1">
                  {parts.map((part) => {
                    const active = part.id === pinned || part.id === isolate;
                    const hot = part.id === hovered;
                    return (
                      <button
                        key={part.id}
                        type="button"
                        className="organ-row"
                        data-active={active || hot}
                        onMouseEnter={() => hoverPart(part.id)}
                        onMouseLeave={() => {
                          if (hoverRef.current === part.id) hoverPart(null);
                        }}
                        onFocus={() => hoverPart(part.id)}
                        onBlur={() => {
                          if (hoverRef.current === part.id) hoverPart(null);
                        }}
                        onClick={() => pinPart(part.id)}
                        aria-pressed={active}
                      >
                        <span
                          className="organ-row__dot"
                          style={{ background: part.color, boxShadow: `0 0 10px ${part.color}55` }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[12px] font-semibold leading-tight">
                            {part.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] leading-tight text-[var(--lab-ink-micro)]">
                            {part.fn}
                          </span>
                        </span>
                        {active && (
                          <span className="organ-row__pin" aria-hidden="true">
                            ●
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Controls</p>

          <motion.div
            key={system}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="mt-3 flex flex-col gap-3"
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
                      Red carries oxygenated blood out of the left ventricle; blue
                      returns deoxygenated blood to the right side.
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
                      The chambers bulge and relax once per beat — systole then
                      diastole — so the model speeds up with the slider.
                    </li>
                    <li className="flex gap-2">
                      <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                      Cardiac output is rate × stroke volume: 70 mL per beat is about
                      5 L/min at rest.
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
                    aria-label="Lung inflation — scales the lung lobes"
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
                      {breathe ? `Minute vent ${((rate * volume * 5) / 1000).toFixed(1)} L/min` : "Slider sets scale"}
                    </span>
                  </div>
                </div>

                <div className="apple-lab-card px-3.5 py-3">
                  <p className="apple-lab-micro mb-1.5">What the slider changes</p>
                  <ul className="space-y-1.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                    <li className="flex gap-2">
                      <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                      It scales each lobe about its own centre, so the lungs fill like
                      balloons while the airway stays put.
                    </li>
                    <li className="flex gap-2">
                      <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--signal)]" />
                      Turn on the cycle and the slider becomes breath depth: the rate
                      sets how often, the slider sets how deep.
                    </li>
                  </ul>
                </div>
              </>
            )}

            {system === "excretory" && (
              <>
                <div className="apple-lab-card px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="apple-lab-micro flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5" style={{ color: "var(--signal)" }} />
                      Filtration rate
                    </span>
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
                    <span className="text-right">5 nephrons traced</span>
                  </div>
                </div>

                <div className="apple-lab-card px-3.5 py-3">
                  <p className="apple-lab-micro mb-1.5">Follow the filtrate</p>
                  <ul className="space-y-1.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                    <li className="flex gap-2">
                      <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#fbbf24]" />
                      Amber dots coil through the nephron, dip into the loop of Henle
                      and drain toward the renal pelvis.
                    </li>
                    <li className="flex gap-2">
                      <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#34d399]" />
                      Mint marks the glomeruli, where pressure filters blood into the
                      tubule. Use X-ray to see them through the cortex.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
