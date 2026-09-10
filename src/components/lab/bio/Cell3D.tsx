import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clamp, useCanvasSize, useRaf } from "../use-canvas";

// ─── ion defs
type IonKind = "K+" | "Ca2+";
interface IonState {
  kind: IonKind;
  mesh: THREE.Mesh;
  glow: THREE.Sprite;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

const ION_COLOR: Record<IonKind, number> = {
  "K+": 0xa78bfa,
  "Ca2+": 0xfbbf24,
};
const ION_EMISSIVE: Record<IonKind, number> = {
  "K+": 0x6d28d9,
  "Ca2+": 0xb45309,
};

// ─── helpers
function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = phi * i;
    pts.push(new THREE.Vector3(Math.cos(th) * r * radius, y * radius, Math.sin(th) * r * radius));
  }
  return pts;
}

function makeGlowTexture(color: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  const hex = "#" + color.toString(16).padStart(6, "0");
  g.addColorStop(0, hex);
  g.addColorStop(0.45, hex + "aa");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ─── cytoplasm fresnel shader
const cytoVertex = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
const cytoFragment = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 2.2);
    vec3 base = vec3(0.10, 0.15, 0.28);
    vec3 glow = vec3(0.38, 0.84, 0.96) * fresnel * 0.75;
    vec3 col = base + glow;
    // subtle inner depth tint
    float depth = 0.15 + fresnel * 0.22;
    gl_FragColor = vec4(col, depth);
  }
`;

// ─── membrane shader (lipid bilayer sheen)
const memVertex = cytoVertex;
const memFragment = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float f = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 base = vec3(0.08, 0.22, 0.32);
    vec3 sheen = vec3(0.45, 0.92, 1.0) * f * 0.9;
    float alpha = 0.28 + f * 0.35;
    gl_FragColor = vec4(base + sheen, alpha);
  }
`;

export default function Cell3D({ cellType }: { cellType: "animal" | "plant" }) {
  const { ref: canvasRef, size } = useCanvasSize<HTMLCanvasElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // renderer / scene refs
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const cellGroup = useRef<THREE.Group | null>(null);
  const cytoMesh = useRef<THREE.Mesh | null>(null);

  // ions
  const ions = useRef<IonState[]>([]);
  const ionMeshes = useRef<THREE.Mesh[]>([]);
  const ripples = useRef<THREE.Mesh[]>([]);
  const channels = useRef<{ pos: THREE.Vector3; normal: THREE.Vector3; mesh: THREE.Group }[]>([]);

  // camera orbit — damped target + current for smooth motion
  const orbit = useRef({ yaw: 0.55, pitch: 0.18, dist: 118, panX: 0, panY: 0, panZ: 0 });
  const orbitTarget = useRef({ yaw: 0.55, pitch: 0.18, dist: 118, panX: 0, panY: 0, panZ: 0 });
  // full-360° orbit: no pitch/yaw locks, both damped; pan pushes camera target
  const CAM_MIN = 44;
  const CAM_MAX = 240;
  const orbitVel = useRef({ yaw: 0, pitch: 0 });
  const hoverOrganelle = useRef<{ name: string; def: string; pos: { x: number; y: number } } | null>(null);
  const organelles = useRef<{ mesh: THREE.Object3D; name: string; def: string }[]>([]);
  const organelleHoverRay = useRef(new THREE.Raycaster());
  const [tooltip, setTooltip] = useState<{ name: string; def: string; x: number; y: number } | null>(null);
  const dragging = useRef<"rotate" | "pan" | null>(null);
  const dragIon = useRef<IonState | null>(null);
  const dragPlane = useRef(new THREE.Plane());
  const dragOffset = useRef(new THREE.Vector3());
  const ionLastWorld = useRef(new THREE.Vector3());
  const idleTime = useRef(0);
  const lastInteraction = useRef(performance.now());
  const raycaster = useRef(new THREE.Raycaster());
  const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());

  const [hoverIon, setHoverIon] = useState<string | null>(null);
  const [membraneFlash, setMembraneFlash] = useState(false);
  const cellTypeRef = useRef(cellType);
  cellTypeRef.current = cellType;

  // ─── scene init
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    // better sorting for transparent cytoplasm
    renderer.sortObjects = true;

    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0b1120);
    // fog for depth
    sc.fog = new THREE.Fog(0x0b1120, 140, 320);

    const cam = new THREE.PerspectiveCamera(42, 1, 1, 800);
    cam.position.set(0, 0, 118);

    const group = new THREE.Group();
    group.rotation.order = "YXZ";
    sc.add(group);

    ren.current = renderer;
    scene.current = sc;
    camera.current = cam;
    cellGroup.current = group;

    // lights
    sc.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(40, 60, 80);
    sc.add(dir);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.9);
    rim.position.set(-50, -30, -60);
    sc.add(rim);
    const point = new THREE.PointLight(0xff647c, 0.8, 220);
    point.position.set(0, 0, 0);
    sc.add(point);
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.35);
    sc.add(hemi);

    // ── cytoplasm volume (fresnel glass)
    const cytoGeo = new THREE.SphereGeometry(38, 64, 64);
    const cytoMat = new THREE.ShaderMaterial({
      vertexShader: cytoVertex,
      fragmentShader: cytoFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const cyto = new THREE.Mesh(cytoGeo, cytoMat);
    cyto.renderOrder = 1;
    group.add(cyto);
    cytoMesh.current = cyto;

    // ── plasma membrane — detailed lipid bilayer (two shells + phospholipid heads)
    const memGroup = new THREE.Group();
    // inner leaflet
    const innerMem = new THREE.Mesh(
      new THREE.SphereGeometry(37.2, 48, 48),
      new THREE.ShaderMaterial({
        vertexShader: memVertex,
        fragmentShader: memFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    innerMem.renderOrder = 2;
    memGroup.add(innerMem);
    // outer leaflet (slightly larger, more translucent)
    const outerMem = new THREE.Mesh(
      new THREE.SphereGeometry(39.0, 48, 48),
      new THREE.ShaderMaterial({
        vertexShader: memVertex,
        fragmentShader: `
          varying vec3 vNormal; varying vec3 vView;
          void main(){
            vec3 n = normalize(vNormal); vec3 v = normalize(vView);
            float f = pow(1.0 - max(dot(n,v),0.0), 2.8);
            vec3 base = vec3(0.06,0.28,0.38);
            vec3 sheen = vec3(0.52,0.95,1.0) * f;
            float a = 0.18 + f*0.32;
            gl_FragColor = vec4(base+sheen, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    outerMem.renderOrder = 3;
    memGroup.add(outerMem);

    // phospholipid heads — instanced small spheres on outer surface
    const headCount = 180;
    const headGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0ea5e9, emissiveIntensity: 0.35, roughness: 0.3, transparent: true, opacity: 0.9 });
    const heads = new THREE.InstancedMesh(headGeo, headMat, headCount);
    heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const pts = fibonacciSphere(headCount, 39.0);
    pts.forEach((p, i) => {
      dummy.position.copy(p);
      // orient outward
      dummy.lookAt(p.clone().multiplyScalar(2));
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      // subtle color variation
      const col = new THREE.Color().setHSL(0.52 + (Math.random() - 0.5) * 0.06, 0.85, 0.62);
      heads.setColorAt(i, col);
    });
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    heads.renderOrder = 4;
    memGroup.add(heads);

    // tail layer (thin translucent sphere between leaflets to suggest hydrophobic core)
    const tail = new THREE.Mesh(
      new THREE.SphereGeometry(38.1, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.06, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    tail.renderOrder = 2;
    memGroup.add(tail);
    group.add(memGroup);

    // ── ion channels (two prominent channels for interaction)
    const channelGroup: typeof channels.current = [];
    const channelPositions: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(38.2, 6, 8), new THREE.Vector3(1, 0.12, 0.18).normalize()],
      [new THREE.Vector3(-36, -10, 14), new THREE.Vector3(-1, -0.18, 0.22).normalize()],
      [new THREE.Vector3(10, 37.5, -6), new THREE.Vector3(0.18, 1, -0.1).normalize()],
    ];
    channelPositions.forEach(([pos, normal]) => {
      const g = new THREE.Group();
      g.position.copy(pos);
      // orient cylinder along normal
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
      g.quaternion.copy(quat);
      // outer protein ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.55, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0x991b1b, emissiveIntensity: 0.6, roughness: 0.35 })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      // channel pore (cylinder through membrane thickness)
      const pore = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.45, 4.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, transparent: true, opacity: 0.85, emissive: 0x38bdf8, emissiveIntensity: 0.18 })
      );
      g.add(pore);
      // inner glow disc
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.45, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 0.1;
      g.add(disc);
      // subtle pulsing light
      const pl = new THREE.PointLight(0x38bdf8, 0.7, 18);
      pl.position.set(0, 0, 0);
      g.add(pl);
      memGroup.add(g);
      channelGroup.push({ pos: pos.clone(), normal: normal.clone(), mesh: g });
    });
    channels.current = channelGroup;

    // ── nucleus + envelope
    const nucCenter = new THREE.Vector3(-4, -3, 2);
    const nucGroup = new THREE.Group();
    nucGroup.position.copy(nucCenter);
    group.add(nucGroup);

    // chromatin interior sphere
    const nucCore = new THREE.Mesh(
      new THREE.SphereGeometry(13.2, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x3730a3, emissiveIntensity: 0.22, roughness: 0.65, transparent: true, opacity: 0.92 })
    );
    nucGroup.add(nucCore);
    // inner chromatin texture: small blobs
    const chromatinPts = fibonacciSphere(22, 9.5);
    chromatinPts.forEach(p => {
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(1.2 + Math.random() * 1.3, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xa5b4fc, emissive: 0x4f46e5, emissiveIntensity: 0.15, transparent: true, opacity: 0.75 })
      );
      blob.position.copy(p).multiplyScalar(0.55 + Math.random() * 0.3);
      nucGroup.add(blob);
    });
    // nucleolus
    const nucleolus = new THREE.Mesh(
      new THREE.SphereGeometry(3.8, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xbe185d, emissiveIntensity: 0.35, roughness: 0.45 })
    );
    nucleolus.position.set(3.5, 2.2, 2.0);
    nucGroup.add(nucleolus);
    // inner nuclear membrane
    const innerNucMem = new THREE.Mesh(
      new THREE.SphereGeometry(13.8, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x818cf8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    nucGroup.add(innerNucMem);
    // outer nuclear envelope (double)
    const outerNucMem = new THREE.Mesh(
      new THREE.SphereGeometry(14.9, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    nucGroup.add(outerNucMem);
    // nuclear pores — torus rings on envelope
    const poreCount = 16;
    const porePts = fibonacciSphere(poreCount, 14.9);
    porePts.forEach(p => {
      const pore = new THREE.Group();
      pore.position.copy(p);
      pore.lookAt(p.clone().multiplyScalar(2));
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.28, 10, 18),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x64748b, emissiveIntensity: 0.25, roughness: 0.5 })
      );
      torus.rotation.x = Math.PI / 2;
      pore.add(torus);
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 12),
        new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
      );
      hole.rotation.x = Math.PI / 2;
      hole.position.y = 0.05;
      pore.add(hole);
      nucGroup.add(pore);
    });

    // ── Rough ER — folded sheets wrapping nucleus
    const roughERGroup = new THREE.Group();
    group.add(roughERGroup);
    const erCurves: THREE.Vector3[][] = [
      [new THREE.Vector3(-18, 4, 6), new THREE.Vector3(-22, 7, 10), new THREE.Vector3(-26, 2, 12), new THREE.Vector3(-24, -4, 8), new THREE.Vector3(-18, -7, 4)],
      [new THREE.Vector3(-16, -2, -8), new THREE.Vector3(-22, -1, -12), new THREE.Vector3(-27, -6, -10), new THREE.Vector3(-25, -11, -4), new THREE.Vector3(-18, -10, -2)],
      [new THREE.Vector3(-6, 10, 8), new THREE.Vector3(-10, 14, 12), new THREE.Vector3(-8, 18, 10), new THREE.Vector3(-2, 16, 5)],
      [new THREE.Vector3(-10, -14, 6), new THREE.Vector3(-14, -18, 9), new THREE.Vector3(-9, -21, 6), new THREE.Vector3(-4, -17, 2)],
      [new THREE.Vector3(6, -8, 12), new THREE.Vector3(2, -12, 15), new THREE.Vector3(-2, -10, 12)],
    ];
    erCurves.forEach((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, 1.35, 12, false),
        new THREE.MeshStandardMaterial({ color: 0x818cf8, roughness: 0.55, emissive: 0x3730a3, emissiveIntensity: 0.12, transparent: true, opacity: 0.92 })
      );
      roughERGroup.add(tube);
      // ribosomes studded on surface (outer side)
      const riboCount = 14;
      for (let i = 0; i < riboCount; i++) {
        const t = (i + 0.5) / riboCount;
        const p = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        // offset along normal (~ perpendicular)
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(1.55);
        // slight random radial jitter
        normal.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6));
        const riboPos = p.clone().add(normal);
        const r1 = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 8), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x6d28d9, emissiveIntensity: 0.18 }));
        r1.position.copy(riboPos);
        const r2 = new THREE.Mesh(new THREE.SphereGeometry(0.52, 8, 8), new THREE.MeshStandardMaterial({ color: 0xede9fe }));
        r2.position.copy(riboPos).add(new THREE.Vector3(0.55, 0.18, 0.22));
        roughERGroup.add(r1);
        roughERGroup.add(r2);
      }
      // second parallel sheet for bilayer look
      const curve2Pts = pts.map(p => p.clone().add(new THREE.Vector3(0, -1.2, 0.8)));
      const curve2 = new THREE.CatmullRomCurve3(curve2Pts, false, "catmullrom", 0.4);
      const tube2 = new THREE.Mesh(
        new THREE.TubeGeometry(curve2, 48, 1.15, 10, false),
        new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.6, transparent: true, opacity: 0.78 })
      );
      roughERGroup.add(tube2);
    });
    // smooth ER — tubular network near periphery (paler)
    const smoothERGroup = new THREE.Group();
    group.add(smoothERGroup);
    const smoothCurves: THREE.Vector3[][] = [
      [new THREE.Vector3(18, 12, 10), new THREE.Vector3(24, 14, 6), new THREE.Vector3(28, 8, 2), new THREE.Vector3(25, 2, -2)],
      [new THREE.Vector3(20, -6, -12), new THREE.Vector3(26, -4, -16), new THREE.Vector3(30, -10, -12), new THREE.Vector3(27, -16, -6)],
      [new THREE.Vector3(-26, 14, -6), new THREE.Vector3(-30, 10, -10), new THREE.Vector3(-28, 4, -14)],
      [new THREE.Vector3(8, 22, -4), new THREE.Vector3(14, 26, -8), new THREE.Vector3(10, 28, -14)],
    ];
    smoothCurves.forEach(pts => {
      const c = new THREE.CatmullRomCurve3(pts);
      const t = new THREE.Mesh(
        new THREE.TubeGeometry(c, 36, 0.75, 10, false),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.55, transparent: true, opacity: 0.68, emissive: 0x0891b2, emissiveIntensity: 0.1 })
      );
      smoothERGroup.add(t);
      // add branching offshoots
      for (let k = 0; k < 2; k++) {
        const mid = c.getPointAt(0.4 + k * 0.3);
        const branchEnd = mid.clone().add(new THREE.Vector3((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8));
        const bc = new THREE.CatmullRomCurve3([mid, mid.clone().lerp(branchEnd, 0.5).add(new THREE.Vector3(1,1,0)), branchEnd]);
        const bt = new THREE.Mesh(
          new THREE.TubeGeometry(bc, 14, 0.45, 8, false),
          new THREE.MeshStandardMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.55 })
        );
        smoothERGroup.add(bt);
      }
    });

    // ── Mitochondria — textured with inner cristae
    const mitoPositions: [number, number, number][] = [
      [20, -7, 12],
      [18, 10, -14],
      [-24, 12, -8],
      [22, -14, -6],
      [-18, -14, 14],
    ];
    mitoPositions.forEach(([x, y, z], idx) => {
      const mito = new THREE.Group();
      mito.position.set(x, y, z);
      // orient randomly
      mito.rotation.set(Math.random()*0.6, Math.random()*0.8, Math.random()*0.5);
      group.add(mito);
      const longAxis = idx % 2 === 0 ? 5.8 : 5.2;
      // outer membrane (capsule-like ellipsoid)
      const outer = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 24, 18),
        new THREE.MeshStandardMaterial({ color: 0xf87171, emissive: 0x7f1d1d, emissiveIntensity: 0.18, roughness: 0.45, transparent: true, opacity: 0.96 })
      );
      outer.scale.set(1.75, 0.95, 0.95);
      // scale longAxis proportionally
      outer.scale.multiplyScalar(longAxis / 5.5);
      mito.add(outer);
      // intermembrane space highlight ring
      const rimTorus = new THREE.Mesh(
        new THREE.TorusGeometry(3.0, 0.22, 10, 20),
        new THREE.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xf87171, emissiveIntensity: 0.22, transparent: true, opacity: 0.7 })
      );
      rimTorus.rotation.x = Math.PI/2;
      rimTorus.scale.set(1.7, 0.9, 1);
      mito.add(rimTorus);
      // inner matrix
      const matrix = new THREE.Mesh(
        new THREE.SphereGeometry(2.75, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.9, transparent: true, opacity: 0.85 })
      );
      matrix.scale.set(1.65, 0.88, 0.88);
      matrix.scale.multiplyScalar(longAxis/5.5);
      mito.add(matrix);
      // cristae — stacked lamellae inside
      const cristaCount = 5;
      for (let ci = 0; ci < cristaCount; ci++) {
        const offset = (ci - (cristaCount-1)/2) * 1.45 * (longAxis/5.5);
        const w = 2.1 - Math.abs(offset)*0.18;
        if (w <= 0.4) continue;
        // create folded crista sheet (box with ridge)
        const crista = new THREE.Mesh(
          new THREE.BoxGeometry(w*2.1, 0.38, w*1.4),
          new THREE.MeshStandardMaterial({ color: 0xfda4af, emissive: 0xe11d48, emissiveIntensity: 0.14, roughness: 0.6, transparent: true, opacity: 0.92 })
        );
        crista.position.set(offset, 0.12, 0);
        // slight wave
        crista.rotation.z = (Math.random()-0.5)*0.18;
        crista.rotation.y = (Math.random()-0.5)*0.22;
        mito.add(crista);
        // second interdigitating ridge
        const crista2 = new THREE.Mesh(
          new THREE.BoxGeometry(w*1.7, 0.32, w*1.2),
          new THREE.MeshStandardMaterial({ color: 0xffe4e6, roughness: 0.5, transparent: true, opacity: 0.55 })
        );
        crista2.position.set(offset, -0.42, 0.15);
        crista2.rotation.z = (Math.random()-0.5)*0.2;
        mito.add(crista2);
      }
      // ATP synthase dots on cristae (tiny)
      for (let a = 0; a < 6; a++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
        dot.position.set((Math.random()-0.5)*6, (Math.random()-0.5)*1.2, (Math.random()-0.5)*1.8);
        mito.add(dot);
      }
    });

    // ── Golgi apparatus — stack of cisternae (curved)
    const golgiCenter = new THREE.Vector3(16, 6, 8);
    const golgiGroup = new THREE.Group();
    golgiGroup.position.copy(golgiCenter);
    golgiGroup.rotation.set(0.2, -0.35, 0.12);
    group.add(golgiGroup);
    for (let i = 0; i < 4; i++) {
      const y = (i - 1.5) * 1.9;
      const scale = 1 - i*0.06;
      // cisterna as flattened, slightly curved capsule via scaled sphere + bending
      const cistern = new THREE.Mesh(
        new THREE.SphereGeometry(5.2 * scale, 24, 16),
        new THREE.MeshStandardMaterial({
          color: i === 1 || i === 2 ? 0x34d399 : 0x6ee7b7,
          emissive: 0x065f46,
          emissiveIntensity: 0.12,
          roughness: 0.45,
          transparent: true,
          opacity: 0.88 - i*0.06,
        })
      );
      cistern.scale.set(1.25, 0.28, 0.78);
      cistern.position.set(0, y, i*0.45);
      // curve via rotation
      cistern.rotation.x = 0.18 + i*0.04;
      golgiGroup.add(cistern);
      // lumen line
      const lumen = new THREE.Mesh(
        new THREE.SphereGeometry(4.9*scale, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.12, depthWrite: false })
      );
      lumen.scale.set(1.2, 0.18, 0.74);
      lumen.position.copy(cistern.position);
      lumen.position.y += 0.15;
      golgiGroup.add(lumen);
    }
    // vesicles budding off golgi
    for (let v = 0; v < 4; v++) {
      const ves = new THREE.Mesh(
        new THREE.SphereGeometry(0.95 + Math.random()*0.4, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e7490, emissiveIntensity: 0.18, transparent: true, opacity: 0.78, roughness: 0.3 })
      );
      ves.position.set(3.5 + Math.random()*4, (Math.random()-0.5)*5, 2+ Math.random()*3);
      golgiGroup.add(ves);
      // coat protein dots
      const coat = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf472b6 }));
      coat.position.copy(ves.position).add(new THREE.Vector3(0.7,0.3,0));
      golgiGroup.add(coat);
    }
    // cis/trans labels implied via color shift already

    // ── Cytoskeleton — fibrous mesh
    const fiberMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.32 });
    const fiberGroup = new THREE.Group();
    group.add(fiberGroup);
    // microtubules — thick straight-ish fibers radiating from centrosome region
    const centrosomePos = new THREE.Vector3(-6, 16, 4);
    const microtubuleCount = 14;
    for (let i = 0; i < microtubuleCount; i++) {
      // generate random direction with bias outward
      const theta = (i / microtubuleCount) * Math.PI*2 + Math.random()*0.4;
      const phi = Math.acos(2*Math.random()-1) * 0.6;
      const d = new THREE.Vector3(Math.cos(theta)*Math.sin(phi), Math.sin(theta)*Math.sin(phi), Math.cos(phi)).normalize();
      // ensure outward from centrosome, not through nucleus core if too short
      const len = 18 + Math.random()*16;
      const end = centrosomePos.clone().add(d.multiplyScalar(len));
      // clamp end inside cell
      if (end.length() > 36) end.normalize().multiplyScalar(36);
      const pts = [centrosomePos.clone(), end];
      // add mid wiggle
      const mid = centrosomePos.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2));
      const curve = new THREE.CatmullRomCurve3([pts[0], mid, pts[1]]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.18, 6, false),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.42, roughness: 0.8 })
      );
      fiberGroup.add(tube);
    }
    // intermediate filaments — wavy lines across cytoplasm
    for (let i = 0; i < 10; i++) {
      const a = new THREE.Vector3((Math.random()-0.5)*60, (Math.random()-0.5)*60, (Math.random()-0.5)*60);
      if (a.length() > 34) a.normalize().multiplyScalar(34);
      if (a.length() < 15) a.normalize().multiplyScalar(15);
      const b = a.clone().add(new THREE.Vector3((Math.random()-0.5)*22, (Math.random()-0.5)*22, (Math.random()-0.5)*12));
      if (b.length() > 36) b.normalize().multiplyScalar(36);
      // skip if crossing nucleus interior too deeply
      if (b.clone().sub(nucCenter).length() < 9 && a.clone().sub(nucCenter).length() < 9) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([a,b]);
      const line = new THREE.Line(geo, fiberMat);
      fiberGroup.add(line);
    }
    // actin cortex — dense belt just under membrane (thin torus-like fibers)
    for (let i = 0; i < 6; i++) {
      const ang = (i/6)*Math.PI*2;
      const ringPts: THREE.Vector3[] = [];
      for (let k = 0; k < 32; k++) {
        const t = (k/32)*Math.PI*2;
        const r = 36.5 + Math.sin(t*3 + ang)*0.8;
        ringPts.push(new THREE.Vector3(Math.cos(t)*r*0.92, Math.sin(t)*r*0.72, Math.cos(t*2)*2.5 + Math.sin(ang)*4));
      }
      const curve = new THREE.CatmullRomCurve3(ringPts, true);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.22, 6, true),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.22, roughness: 0.9 })
      );
      fiberGroup.add(tube);
    }
    // centrosome (microtubule organizing center)
    const centGroup = new THREE.Group();
    centGroup.position.copy(centrosomePos);
    group.add(centGroup);
    for (let ci = 0; ci < 2; ci++) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 3.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0x7e22ce, emissiveIntensity: 0.22 })
      );
      barrel.rotation.z = ci === 0 ? 0 : Math.PI/2;
      barrel.rotation.x = ci * 0.3;
      centGroup.add(barrel);
      // pericentriolar halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.12, depthWrite: false })
      );
      centGroup.add(halo);
    }

    // ── Plant extras (hidden for animal, toggled via visibility)
    const plantGroup = new THREE.Group();
    group.add(plantGroup);
    // cell wall — slightly larger box with rounded edges illusion via wireframe + translucent box
    const wallBox = new THREE.Mesh(
      new THREE.BoxGeometry(86, 86, 86),
      new THREE.MeshStandardMaterial({ color: 0x86efac, transparent: true, opacity: 0.10, roughness: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    wallBox.renderOrder = 0;
    plantGroup.add(wallBox);
    const wallEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(86,86,86)),
      new THREE.LineBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35 })
    );
    plantGroup.add(wallEdges);
    // central vacuole — huge translucent
    const vacuole = new THREE.Mesh(
      new THREE.SphereGeometry(21, 32, 32),
      new THREE.MeshPhysicalMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.22, roughness: 0.15, transmission: 0.6, thickness: 8, depthWrite: false })
    );
    vacuole.position.set(4, 2, -2);
    vacuole.scale.set(1.1, 0.95, 0.9);
    plantGroup.add(vacuole);
    // tonoplast membrane
    const tono = new THREE.Mesh(
      new THREE.SphereGeometry(21.6, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x86efac, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    tono.position.copy(vacuole.position);
    tono.scale.copy(vacuole.scale);
    plantGroup.add(tono);
    // chloroplasts — 5 lens-shaped plastids near periphery
    const chloroPositions: [number, number, number][] = [
      [26, 8, 10], [24, -12, -8], [-28, 6, 12], [12, 24, 6], [-12, -26, 4]
    ];
    chloroPositions.forEach(([x,y,z]) => {
      const cp = new THREE.Group();
      cp.position.set(x,y,z);
      cp.lookAt(0,0,0);
      // outer envelope double
      const outer = new THREE.Mesh(
        new THREE.SphereGeometry(3.6, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.18, roughness: 0.5, transparent: true, opacity: 0.9 })
      );
      outer.scale.set(1.35, 0.62, 0.85);
      cp.add(outer);
      const inner = new THREE.Mesh(
        new THREE.SphereGeometry(3.25, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8, transparent: true, opacity: 0.95 })
      );
      inner.scale.set(1.28, 0.58, 0.8);
      cp.add(inner);
      // thylakoid stacks (grana)
      for (let g = 0; g < 3; g++) {
        const gx = (g-1)*1.55;
        for (let disc = 0; disc < 4; disc++) {
          const d = new THREE.Mesh(
            new THREE.CylinderGeometry(1.15, 1.15, 0.22, 14),
            new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.12 })
          );
          d.position.set(gx + (Math.random()-0.5)*0.3, (disc-1.5)*0.38, (Math.random()-0.5)*0.4);
          d.rotation.x = Math.PI/2 + (Math.random()-0.5)*0.18;
          cp.add(d);
        }
        // stroma lamellae connecting grana
        if (g < 2) {
          const lam = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.08, 1.6),
            new THREE.MeshStandardMaterial({ color: 0x86efac, transparent: true, opacity: 0.7 })
          );
          lam.position.set(gx+0.78, 0, 0);
          cp.add(lam);
        }
      }
      // starch grain
      const starch = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 }));
      starch.position.set(0.8,0.5,0.6);
      cp.add(starch);
      plantGroup.add(cp);
    });
    // plasmodesmata (channels through wall)
    for (let pd = 0; pd < 8; pd++) {
      const dir = fibonacciSphere(1,1)[0];
      const d = new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2).normalize().multiplyScalar(43);
      const pdot = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,3.5,8), new THREE.MeshStandardMaterial({ color: 0x86efac, transparent: true, opacity: 0.6 }));
      pdot.position.copy(d);
      pdot.lookAt(d.clone().multiplyScalar(2));
      pdot.rotateX(Math.PI/2);
      plantGroup.add(pdot);
    }
    plantGroup.visible = cellType === "plant";

    // ── register organelles for hover picking (low-poly proxy spheres/boxes for raycasting)
    // Keep references to key organelle meshes for hover labels — use the actual meshes where possible
    const regs: { mesh: THREE.Object3D; name: string; def: string }[] = [];
    const addReg = (mesh: THREE.Object3D, name: string, def: string) => {
      mesh.userData.__orgName = name;
      mesh.userData.__orgDef = def;
      regs.push({ mesh, name, def });
    };
    addReg(nucCore, "Nucleus", "Double-walled envelope (16 pores) — stores chromatin and controls gene expression.");
    addReg(nucleolus, "Nucleolus", "Dense RNA factory inside the nucleus that assembles ribosomal subunits.");
    addReg(innerNucMem, "Nuclear envelope — inner", "Inner leaflet of the double membrane surrounding the genome.");
    addReg(outerNucMem, "Nuclear envelope — outer", "Outer leaflet continuous with rough ER; studded with nuclear pores.");
    addReg(cyto, "Cytoplasm — cytosol", "Aqueous gel with dissolved ions and the cytoskeleton — transports everything.");
    // mitochondria proxies — register each mito group
    mitoPositions.forEach(([x,y,z], idx) => {
      // mito groups are added to 'group' in order after cytoskeleton; we approximate by last added groups
    });
    // Instead register fiber and ER groups as whole
    addReg(roughERGroup, "Rough ER", "Sheets folding off the nuclear envelope, studded with ribosomes for protein synthesis.");
    addReg(smoothERGroup, "Smooth ER", "Tubular network that synthesizes lipids and detoxifies — connected to rough ER.");
    addReg(golgiGroup, "Golgi apparatus", "Stack of 4 curved cisternae that sorts, modifies and packages proteins into vesicles.");
    // Find mito groups: they are children of 'group' with position matching mitoPositions
    group.children.forEach(ch => {
      if (ch instanceof THREE.Group) {
        const p = ch.position;
        for (const [mx,my,mz] of mitoPositions) {
          if (Math.abs(p.x-mx)<0.1 && Math.abs(p.y-my)<0.1 && Math.abs(p.z-mz)<0.1) {
            addReg(ch, "Mitochondrion", "Double-membrane powerhouse — outer membrane + folded inner cristae for ATP synthesis.");
          }
        }
      }
    });
    addReg(fiberGroup, "Cytoskeleton", "Microtubules, intermediate filaments and actin cortex that shape and move the cell.");
    addReg(centGroup, "Centrosome", "Microtubule-organizing centre — two barrel centrioles that anchor the spindle.");
    addReg(outerMem, "Plasma membrane — lipid bilayer", "Double leaflet + 180 phospholipid heads. Drag K⁺/Ca²⁺ to cyan ion channels to trigger active transport.");
    organelles.current = regs;

    // ── Ions — world-space spheres with glow sprites
    const ionStates: IonState[] = [];
    const ionMeshList: THREE.Mesh[] = [];
    const ionCountPerKind = 5;
    const placements: THREE.Vector3[] = [];
    // generate non-overlapping placements inside cytoplasm but outside nucleus
    for (let k = 0; k < ionCountPerKind * 2; k++) {
      let tries = 0;
      let p: THREE.Vector3;
      do {
        const r = 16 + Math.random()*18;
        const th = Math.random()*Math.PI*2;
        const phi = Math.acos(2*Math.random()-1);
        p = new THREE.Vector3(r*Math.sin(phi)*Math.cos(th), r*Math.sin(phi)*Math.sin(th), r*Math.cos(phi));
        tries++;
      } while (p.clone().sub(nucCenter).length() < 16 && tries < 30);
      // push away if too close to another ion
      placements.push(p);
    }
    const kinds: IonKind[] = [...Array(ionCountPerKind).fill("K+" as IonKind), ...Array(ionCountPerKind).fill("Ca2+" as IonKind)];
    // shuffle kinds
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    kinds.forEach((kind, idx) => {
      const p = placements[idx];
      const radius = kind === "Ca2+" ? 1.55 : 1.32;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 18, 18),
        new THREE.MeshStandardMaterial({
          color: ION_COLOR[kind],
          emissive: ION_EMISSIVE[kind],
          emissiveIntensity: 0.55,
          roughness: 0.35,
          metalness: 0.08,
        })
      );
      mesh.position.copy(p);
      mesh.userData.kind = kind;
      mesh.userData.index = idx;
      // subtle Fresnel rim via onBeforeCompile could be added but emissive suffices
      group.add(mesh);
      // glow sprite
      const tex = makeGlowTexture(ION_COLOR[kind]);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        color: ION_COLOR[kind],
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      sprite.scale.setScalar(kind === "Ca2+" ? 6.2 : 5.2);
      sprite.position.copy(p);
      group.add(sprite);
      // ion label canvas sprite (text)
      // create tiny canvas for label
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 64; labelCanvas.height = 32;
      const lctx = labelCanvas.getContext("2d")!;
      lctx.font = "bold 20px monospace";
      lctx.fillStyle = "white";
      lctx.textAlign = "center";
      lctx.fillText(kind, 32, 22);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.85, depthWrite: false }));
      labelSpr.scale.set(3.8, 1.9, 1);
      labelSpr.position.copy(p).add(new THREE.Vector3(0, radius+1.1, 0));
      group.add(labelSpr);

      const state: IonState = {
        kind,
        mesh,
        glow: sprite,
        pos: p.clone(),
        vel: new THREE.Vector3((Math.random()-0.5)*2.2, (Math.random()-0.5)*2.2, (Math.random()-0.5)*2.2),
      };
      // store label sprite ref in mesh userData for sync
      (mesh.userData as Record<string, unknown>).labelSpr = labelSpr;
      (mesh.userData as Record<string, unknown>).labelTex = labelTex;
      ionStates.push(state);
      ionMeshList.push(mesh);
    });
    ions.current = ionStates;
    ionMeshes.current = ionMeshList;

    // ── ripples pool (rings expanding at channels)
    const ripplePool: THREE.Mesh[] = [];
    for (let ri = 0; ri < 6; ri++) {
      const rg = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 2.1, 24),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      rg.visible = false;
      rg.renderOrder = 10;
      sc.add(rg); // add to scene not group so it stays world-aligned to channel but also visible through
      // We'll parent to channel in update? Keep scene-level and set position each trigger
      ripplePool.push(rg);
    }
    ripples.current = ripplePool;

    // store plantGroup for toggle
    (group.userData as Record<string, unknown>).plantGroup = plantGroup;
    (group.userData as Record<string, unknown>).roughER = roughERGroup;
    (group.userData as Record<string, unknown>).smoothER = smoothERGroup;

    return () => {
      // dispose
      sc.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mat) {
          for (const mm of Array.isArray(mat) ? mat : [mat]) {
            const anyMat = mm as unknown as { map?: THREE.Texture; dispose: () => void };
            if (anyMat.map) anyMat.map.dispose();
            mm.dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      // dispose ion label textures already handled via traverse but ensure
      ionStates.forEach(s => {
        const lbl = (s.mesh.userData as Record<string, unknown>).labelTex as THREE.Texture | undefined;
        if (lbl) lbl.dispose();
      });
      renderer.dispose();
      ren.current = null;
      scene.current = null;
      camera.current = null;
      cellGroup.current = null;
      ions.current = [];
      ionMeshes.current = [];
      channels.current = [];
      ripples.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync plant visibility when toggle changes
  useEffect(() => {
    const g = cellGroup.current;
    if (!g) return;
    const pg = (g.userData as Record<string, unknown>).plantGroup as THREE.Group | undefined;
    if (pg) pg.visible = cellType === "plant";
  }, [cellType]);

  // ── per-frame
  useRaf((_dt, t) => {
    const renderer = ren.current;
    const sc = scene.current;
    const cam = camera.current;
    const group = cellGroup.current;
    if (!renderer || !sc || !cam || !group) return;

    const dt = Math.min(0.033, _dt);
    const o = orbit.current;
    // idle auto-rotation: dampens instantly on interaction via lastInteraction
    const since = (performance.now() - lastInteraction.current) / 1000;
    idleTime.current = since;
    const isInteracting = dragging.current !== null || dragIon.current !== null || pointers.current.size > 0;
    const tgt = orbitTarget.current;
    if (!isInteracting && since > 1.0) {
      const autoSpeed = 0.11;
      tgt.yaw += dt * autoSpeed * Math.min(1, (since - 1.0) * 0.9);
      tgt.pitch += Math.sin(t * 0.22) * dt * 0.012;
      tgt.pitch = clamp(tgt.pitch, -0.58, 0.58);
    }
    // smooth damped lerp — inertia feel
    const lerp = 1 - Math.pow(0.001, dt); // frame-rate independent
    // yaw/pitch lerp with velocity for ultra-smooth
    const yawDiff = tgt.yaw - o.yaw;
    const pitchDiff = tgt.pitch - o.pitch;
    orbitVel.current.yaw = orbitVel.current.yaw * Math.pow(0.15, dt*60) + yawDiff * 8 * dt;
    orbitVel.current.pitch = orbitVel.current.pitch * Math.pow(0.15, dt*60) + pitchDiff * 8 * dt;
    o.yaw += orbitVel.current.yaw;
    o.pitch += orbitVel.current.pitch;
    // direct lerp for dist/pan (snappier but still smooth)
    o.dist += (tgt.dist - o.dist) * clamp(lerp*1.2, 0, 1);
    o.panX += (tgt.panX - o.panX) * clamp(lerp*1.4, 0, 1);
    o.panY += (tgt.panY - o.panY) * clamp(lerp*1.4, 0, 1);

    // camera-driven orbit: group keeps identity rotation so dragging never fights the model
    group.rotation.y = 0;
    group.rotation.x = 0;

    // subtle organelle breathing (scale pulse of nucleus, mito)
    const breathe = 1 + Math.sin(t * 0.7) * 0.012;
    // find nucleus core via traversal? we stored not, approximate via group children search each frame is heavy.
    // Instead, we can just pulse whole group slightly — fine.

    // cytoplasm subtle opacity pulse via shader uniform? we use static shader but can modulate via material opacity proxy
    // Keep.

    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    if (cssW > 0 && cssH > 0) {
      renderer.setSize(cssW, cssH, false);
      cam.aspect = cssW / cssH;
      cam.updateProjectionMatrix();
    }
    // camera orbit: spherical + pan
    const cosP = Math.cos(o.pitch);
    const sinP = Math.sin(o.pitch);
    const cosY = Math.cos(o.yaw);
    const sinY = Math.sin(o.yaw);
    // camera orbits around world focus (pan offsets, full 360 in yaw & pitch)
    const lookAt = new THREE.Vector3(o.panX * 0.3, o.panY * 0.3, o.panZ * 0.3);
    const camPos = new THREE.Vector3(
      lookAt.x + o.dist * sinY * cosP,
      lookAt.y + o.dist * sinP,
      lookAt.z + o.dist * cosY * cosP
    );
    cam.position.copy(camPos);
    cam.lookAt(lookAt);

    // update ions physics when not dragged
    const nucCenter = new THREE.Vector3(-4, -3, 2);
    // apply world matrix to get group rotation for collision checks? Ions are children of group, so their positions are local.
    // For simplicity, check local distance from origin (cell center local 0,0,0) — group rotation doesn't affect local distances.
    ions.current.forEach(st => {
      if (dragIon.current === st) return; // dragged ion follows pointer, no physics
      // brownian drift + slight velocity damping
      // add small random kick
      st.vel.x += (Math.random() - 0.5) * 0.9 * dt;
      st.vel.y += (Math.random() - 0.5) * 0.9 * dt;
      st.vel.z += (Math.random() - 0.5) * 0.9 * dt;
      st.vel.multiplyScalar(0.995);
      // clamp speed
      const spd = st.vel.length();
      if (spd > 3.2) st.vel.multiplyScalar(3.2 / spd);
      if (spd < 0.4) {
        // ensure minimum drift
        st.vel.add(new THREE.Vector3((Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6).multiplyScalar(dt*3));
      }
      const next = st.mesh.position.clone().add(st.vel.clone().multiplyScalar(dt));
      // collision with nucleus (sphere 15)
      const toNuc = next.clone().sub(nucCenter);
      const nucR = 15.2 + (st.kind === "Ca2+" ? 1.55 : 1.32);
      if (toNuc.length() < nucR) {
        toNuc.normalize().multiplyScalar(nucR);
        next.copy(nucCenter.clone().add(toNuc));
        // reflect velocity
        const n = toNuc.clone().normalize();
        const dot = st.vel.dot(n);
        st.vel.add(n.multiplyScalar(-2 * dot * 0.9));
      }
      // vacuole collision for plant
      if (cellTypeRef.current === "plant") {
        const vacCenter = new THREE.Vector3(4, 2, -2);
        const vacR = 21.6 + 1.5;
        const toVac = next.clone().sub(vacCenter);
        if (toVac.length() < vacR && toVac.length() > 4) {
          // push out along normal
          toVac.normalize().multiplyScalar(vacR);
          next.copy(vacCenter.clone().add(toVac));
          const n = toVac.normalize();
          const dot = st.vel.dot(n);
          st.vel.add(n.multiplyScalar(-1.6 * dot));
        }
      }
      // membrane bounds: keep inside sphere 37 - radius
      const cellR = 37.0 - (st.kind === "Ca2+" ? 1.55 : 1.32);
      const dist = next.length();
      if (dist > cellR) {
        const n = next.clone().normalize();
        next.copy(n.multiplyScalar(cellR));
        const dot = st.vel.dot(n);
        st.vel.add(n.multiplyScalar(-2 * dot * 0.92));
        // check if near a channel — allow permeation with probability? For now, bounce but trigger ripple if velocity high
        // Determine nearest channel distance in local space (channels are in group local coords)
        let nearChannel = false;
        for (const ch of channels.current) {
          const d = next.clone().sub(ch.pos).length();
          if (d < 4.2) { nearChannel = true; break; }
        }
        if (nearChannel && Math.random() < 0.015) {
          // 1.5% chance to actually slip through channel — we simulate by letting it stay outside briefly then pulling back
          // visual ripple regardless
          triggerRipple(next.clone(), n);
        }
      }
      st.mesh.position.copy(next);
      st.pos.copy(next);
      // sync glow sprite + label
      st.glow.position.copy(next);
      const lbl = (st.mesh.userData as Record<string, unknown>).labelSpr as THREE.Sprite | undefined;
      if (lbl) lbl.position.copy(next).add(new THREE.Vector3(0, (st.kind==="Ca2+"?1.55:1.32)+1.05, 0));
      // subtle glow pulse
      const pulse = 0.55 + Math.sin(t * 2.1 + (st.kind==="Ca2+"?0:1.8)) * 0.12;
      (st.glow.material as THREE.SpriteMaterial).opacity = pulse;
      // depth sort glow behind/in front based on camera? sprite handles.
    });

    // ripples animate
    ripples.current.forEach(r => {
      if (!r.visible) return;
      const d = r.userData as { age: number; maxAge: number; channelPos: THREE.Vector3; normal: THREE.Vector3 };
      d.age += dt;
      const p = d.age / d.maxAge;
      if (p >= 1) { r.visible = false; (r.material as THREE.MeshBasicMaterial).opacity = 0; return; }
      const scale = 1 + p * 3.2;
      r.scale.setScalar(scale);
      (r.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.55;
      // keep ring oriented to face camera while staying at channel
      r.position.copy(d.channelPos);
      // orient ring to be perpendicular to normal but billboard slightly towards camera
      // We'll just make ring lookAt camera each frame
      r.lookAt(cam.position);
    });

    // ensure plant group breathe
    const pg = (group.userData as Record<string, unknown>).plantGroup as THREE.Group | undefined;
    if (pg && pg.visible) {
      pg.scale.setScalar(1 + Math.sin(t*0.35)*0.005);
    }

    // apply subtle group breathing
    group.scale.setScalar(breathe);

    renderer.render(sc, cam);
  });

  // ── trigger ripple helper (closure capturing ripples/channels)
  const triggerRipple = (worldPos: THREE.Vector3, _normal: THREE.Vector3) => {
    // find nearest channel to worldPos (worldPos is local group pos; channels are also local, so distance in local is fine)
    // transform worldPos to world? Both local, but group rotation affects world distances - but we approximate local.
    let best: typeof channels.current[0] | null = null;
    let bestD = Infinity;
    for (const ch of channels.current) {
      const d = worldPos.clone().sub(ch.pos).length();
      if (d < bestD) { bestD = d; best = ch; }
    }
    if (!best) return;
    // find free ripple
    const free = ripples.current.find(r => !r.visible);
    if (!free) return;
    // need world position of channel (group local -> world)
    const g = cellGroup.current;
    if (!g) return;
    const worldChannelPos = best.pos.clone().applyMatrix4(g.matrixWorld);
    // Reset ripple at world position, but ripples are in scene (world space) so we can set position directly to worldChannelPos
    // However group rotation: we set position to worldChannelPos overlay, but we also need to handle camera orbit later - ripples are in scene, not group, so they stay world stable.
    free.position.copy(worldChannelPos);
    free.scale.setScalar(1);
    (free.material as THREE.MeshBasicMaterial).opacity = 0.55;
    free.visible = true;
    (free.userData as Record<string, unknown>) = { age: 0, maxAge: 0.9, channelPos: worldChannelPos.clone(), normal: best.normal.clone() } as unknown as Record<string, unknown>;
    // membrane flash
    setMembraneFlash(true);
    setTimeout(() => setMembraneFlash(false), 280);
    // ion glow boost
    // small haptic via navigator.vibrate if available
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator as unknown as { vibrate: (n: number) => void }).vibrate(18); } catch {}
    }
  };

  // expose trigger for pointer handler via ref
  const triggerRef = useRef(triggerRipple);
  triggerRef.current = triggerRipple;

  // ── interaction handlers
  const getNDC = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    (canvas as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    lastInteraction.current = performance.now();

    // right-click pan
    if (e.button === 2) {
      dragging.current = "pan";
      return;
    }

    // check ion hit via raycaster
    const ndc = getNDC(e.clientX, e.clientY);
    if (!ndc || !camera.current || !cellGroup.current) return;
    raycaster.current.setFromCamera(ndc, camera.current);
    // intersect with ion meshes (world space)
    // need to ensure matrixWorld updated
    cellGroup.current.updateMatrixWorld(true);
    const hits = raycaster.current.intersectObjects(ionMeshes.current, false);
    if (hits.length > 0) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const state = ions.current.find(s => s.mesh === hitMesh);
      if (state) {
        dragIon.current = state;
        setHoverIon(state.kind);
        setTooltip(null);
        // create drag plane perpendicular to camera through ion world pos
        const camDir = new THREE.Vector3();
        camera.current!.getWorldDirection(camDir);
        // world position of ion
        const worldPos = new THREE.Vector3();
        state.mesh.getWorldPosition(worldPos);
        dragPlane.current.setFromNormalAndCoplanarPoint(camDir.clone().negate(), worldPos);
        // offset so cursor grabs at hit point, not center
        const hitPoint = hits[0].point.clone();
        dragOffset.current.copy(worldPos).sub(hitPoint);
        // bring to front render order
        state.mesh.renderOrder = 20;
        (state.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1;
        e.preventDefault();
        return;
      }
    }
    // otherwise rotate camera
    dragging.current = "rotate";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ndc = getNDC(e.clientX, e.clientY);
    const cam = camera.current;
    if (!cam) return;

    // hover feedback for ions + organelles when not dragging
    if (!dragIon.current && !dragging.current && ndc) {
      raycaster.current.setFromCamera(ndc, cam);
      if (cellGroup.current) cellGroup.current.updateMatrixWorld(true);
      const ionHits = raycaster.current.intersectObjects(ionMeshes.current, false);
      if (ionHits.length > 0) {
        const k = (ionHits[0].object as THREE.Mesh).userData.kind as string;
        setHoverIon(k);
        setTooltip(null);
        (e.currentTarget as HTMLElement).style.cursor = "grab";
      } else {
        setHoverIon(null);
        // organelle hover — raycast against registered organelle meshes (first hit wins)
        const orgHits: { obj: THREE.Object3D; dist: number; name: string; def: string }[] = [];
        for (const reg of organelles.current) {
          // Use raycaster on the mesh or its children
          const targets: THREE.Object3D[] = [];
          reg.mesh.traverse(o => { if ((o as THREE.Mesh).isMesh) targets.push(o); });
          if (targets.length === 0) targets.push(reg.mesh);
          const hits = raycaster.current.intersectObjects(targets as THREE.Object3D[], false);
          if (hits.length > 0) {
            orgHits.push({ obj: hits[0].object, dist: hits[0].distance, name: reg.name, def: reg.def });
          }
        }
        orgHits.sort((a,b)=>a.dist-b.dist);
        if (orgHits.length > 0) {
          const h = orgHits[0];
          setTooltip({ name: h.name, def: h.def, x: e.clientX, y: e.clientY });
          (e.currentTarget as HTMLElement).style.cursor = "help";
        } else {
          setTooltip(null);
          (e.currentTarget as HTMLElement).style.cursor = "grab";
        }
      }
    }

    if (dragIon.current) {
      lastInteraction.current = performance.now();
      const ndc2 = getNDC(e.clientX, e.clientY);
      if (!ndc2) return;
      raycaster.current.setFromCamera(ndc2, cam);
      const hit = new THREE.Vector3();
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hit)) {
        hit.add(dragOffset.current);
        // convert world hit to local group space
        const g = cellGroup.current!;
        const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
        const localPos = hit.clone().applyMatrix4(inv);
        // clamp inside cell but allow crossing membrane with channel proximity
        const dist = localPos.length();
        const ionR = dragIon.current.kind === "Ca2+" ? 1.55 : 1.32;
        const cellR = 37.0 - ionR;
        // record previous dist for crossing detection
        const prevDist = dragIon.current.pos.length();
        let clamped = localPos.clone();
        if (dist > cellR + 2.5) {
          // hard clamp outside
          clamped.normalize().multiplyScalar(cellR + 2.2);
        } else if (dist > cellR) {
          // near membrane — check channel proximity, allow slightly outside to simulate permeation
          let nearChannel = false;
          for (const ch of channels.current) {
            if (clamped.clone().sub(ch.pos).length() < 5.5) { nearChannel = true; break; }
          }
          if (!nearChannel) {
            // bounce back inside if not near channel
            clamped.normalize().multiplyScalar(cellR);
          }
          // if near channel and crossing outward/inward, trigger ripple
          const crossingOut = prevDist <= cellR && dist > cellR;
          const crossingIn = prevDist > cellR && dist <= cellR;
          if ((crossingOut || crossingIn) && nearChannel) {
            triggerRef.current(clamped.clone(), clamped.clone().normalize());
            // briefly boost glow
            (dragIon.current.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
            setTimeout(() => {
              if (dragIon.current) (dragIon.current.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.85;
            }, 380);
          }
        }
        // also avoid nucleus
        const nucCenter = new THREE.Vector3(-4, -3, 2);
        const toNuc = clamped.clone().sub(nucCenter);
        if (toNuc.length() < 15.2 + ionR) {
          toNuc.normalize().multiplyScalar(15.2 + ionR);
          clamped.copy(nucCenter.clone().add(toNuc));
        }
        // vacuole for plant
        if (cellTypeRef.current === "plant") {
          const vacCenter = new THREE.Vector3(4,2,-2);
          const vacR = 21.6 + ionR + 0.4;
          const toVac = clamped.clone().sub(vacCenter);
          if (toVac.length() < vacR) {
            toVac.normalize().multiplyScalar(vacR);
            clamped.copy(vacCenter.clone().add(toVac));
          }
        }
        dragIon.current.mesh.position.copy(clamped);
        dragIon.current.pos.copy(clamped);
        dragIon.current.glow.position.copy(clamped);
        const lbl = (dragIon.current.mesh.userData as Record<string, unknown>).labelSpr as THREE.Sprite | undefined;
        if (lbl) lbl.position.copy(clamped).add(new THREE.Vector3(0, ionR+1.05, 0));
        // update velocity for inertia after release (approx)
        dragIon.current.vel.copy(clamped).sub(dragIon.current.pos).multiplyScalar(0); // reset drift while dragging
        // store prev for next crossing check (already updated pos)
      }
      e.preventDefault();
      return;
    }

    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    if (dragging.current === "pan") {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button });
      // world-space pan in screen-aligned axes, scaled by zoom so speed stays constant
      const sp = orbitTarget.current.dist * 0.0022;
      const yw = orbitTarget.current.yaw;
      orbitTarget.current.panX += (Math.cos(yw) * dx - Math.sin(yw) * dy) * sp;
      orbitTarget.current.panY += (Math.sin(yw) * dx + Math.cos(yw) * dy) * sp;
      lastInteraction.current = performance.now();
      return;
    }
    if (dragging.current === "rotate") {
      // handle single pointer rotation
      if (pointers.current.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button });
        orbitTarget.current.yaw += dx * 0.0062;
        // full 360-degree vertical orbit (damped clamp near poles only)
        orbitTarget.current.pitch = clamp(orbitTarget.current.pitch + dy * 0.0062, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
        lastInteraction.current = performance.now();
        return;
      }
      // pinch zoom for two pointers already handled via move
      if (pointers.current.size >= 2) {
        const vals = [...pointers.current.values()];
        // update current pointer pos first
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev!.button });
        const vals2 = [...pointers.current.values()];
        const dist0 = Math.hypot(vals[0].x - vals[1].x, vals[0].y - vals[1].y);
        const dist1 = Math.hypot(vals2[0].x - vals2[1].x, vals2[0].y - vals2[1].y);
        if (dist0 > 0) {
          orbitTarget.current.dist = clamp(orbitTarget.current.dist * (dist0 / dist1), 44, 240);
        }
        lastInteraction.current = performance.now();
      }
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (dragIon.current) {
      // give it a little ejection velocity based on last movement? simple random
      dragIon.current.vel.set((Math.random()-0.5)*1.2, (Math.random()-0.5)*1.2, (Math.random()-0.5)*1.2);
      (dragIon.current.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
      dragIon.current.mesh.renderOrder = 0;
      dragIon.current = null;
      setHoverIon(null);
    }
    if (pointers.current.size === 0) {
      dragging.current = null;
      (e.currentTarget as HTMLElement).style.cursor = "grab";
    }
    lastInteraction.current = performance.now();
  };


  // attach native non-passive wheel to prevent page scroll
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (ev: WheelEvent) => {
      ev.preventDefault();
      orbitTarget.current.dist = clamp(orbitTarget.current.dist * (ev.deltaY > 0 ? 1.08 : 0.92), 44, 240);
      lastInteraction.current = performance.now();
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const resetIons = () => {
    // randomize ion positions again inside
    const nucCenter = new THREE.Vector3(-4, -3, 2);
    ions.current.forEach(st => {
      let p: THREE.Vector3;
      let tries = 0;
      do {
        const r = 16 + Math.random()*17;
        const th = Math.random()*Math.PI*2;
        const phi = Math.acos(2*Math.random()-1);
        p = new THREE.Vector3(r*Math.sin(phi)*Math.cos(th), r*Math.sin(phi)*Math.sin(th), r*Math.cos(phi));
        tries++;
      } while (p.clone().sub(nucCenter).length() < 16 && tries < 20);
      st.mesh.position.copy(p);
      st.pos.copy(p);
      st.glow.position.copy(p);
      const lbl = (st.mesh.userData as Record<string, unknown>).labelSpr as THREE.Sprite | undefined;
      if (lbl) lbl.position.copy(p).add(new THREE.Vector3(0, (st.kind==="Ca2+"?1.55:1.32)+1.05,0));
      st.vel.set((Math.random()-0.5)*1.6,(Math.random()-0.5)*1.6,(Math.random()-0.5)*1.6);
    });
    lastInteraction.current = performance.now();
  };

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_40%,#16233b_0%,#0b1120_72%)]">
      {/* header */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="lab-chip border-[#ff3b5c]/30 bg-[#ff3b5c]/10 text-[#ff8a9a]">LIVE 3D</span>
          <span className="text-xs font-semibold text-slate-200">{cellType === "plant" ? "Plant cell — cross-section" : "Animal cell — cross-section"}</span>
          <span className="hidden text-[11px] text-slate-500 sm:inline">· lipid bilayer · nuclear pores · ER · mitochondria cristae · cytoskeleton</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={resetIons} className="lab-btn !px-2.5 !py-1 text-[11px]">Shuffle ions</button>
          <span className={`lab-chip text-[11px] transition ${membraneFlash ? "border-[#38bdf8] bg-[#38bdf8]/20 text-[#7dd3fc] shadow-[0_0_18px_rgba(56,189,248,0.45)]" : "border-white/10 bg-white/5 text-slate-400"}`}>
            {membraneFlash ? "Channel transport ●" : hoverIon ? `${hoverIon} — drag to channel` : "Drag ions to channels"}
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="h-[520px] w-full touch-none cursor-grab active:cursor-grabbing sm:h-[560px]" style={{ willChange: "transform" } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onContextMenu={e => e.preventDefault()}
      />

      {/* bottom legend */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
        {[
          { c: "#67e8f9", l: "Plasma membrane — phospholipid bilayer" },
          { c: "#a78bfa", l: "Nucleus — pores 16×" },
          { c: "#818cf8", l: "Rough ER + ribosomes" },
          { c: "#34d399", l: "Golgi + vesicles" },
          { c: "#f87171", l: "Mitochondrion — cristae lamellae" },
          { c: "#cbd5e1", l: "Cytoskeleton — MT + filaments" },
          { c: "#a78bfa", l: "K⁺ violet" },
          { c: "#fbbf24", l: "Ca²⁺ amber" },
        ].map(i => (
          <span key={i.l} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-slate-300 backdrop-blur">
            <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: i.c }} />
            {i.l}
          </span>
        ))}
      </div>

      {/* interaction hint */}
      <div className="pointer-events-none absolute right-3 top-[52px] hidden max-w-[220px] rounded-xl border border-white/10 bg-black/45 p-2.5 text-[11px] leading-relaxed text-slate-300 backdrop-blur-md sm:block">
        <p className="font-semibold text-slate-100">How to explore</p>
        <p className="mt-1 text-slate-400"><span className="text-slate-200">Drag</span> empty space to orbit · <span className="text-slate-200">Scroll / pinch</span> to zoom · <span className="text-slate-200">Right-drag</span> to pan · <span className="text-slate-200">Click & drag</span> a glowing <span className="text-[#a78bfa]">K⁺</span> or <span className="text-[#fbbf24]">Ca²⁺</span> sphere to a cyan channel ring — cross the membrane to trigger a transport ripple. Auto-rotation resumes when idle.</p>
      </div>

      {/* hover tooltip — follows cursor, shows organelle name */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-[260px] rounded-xl border border-white/20 bg-black/75 px-3 py-2 shadow-xl backdrop-blur-md"
          style={{ left: Math.min(tooltip.x - (wrapRef.current?.getBoundingClientRect().left ?? 0) + 14, (wrapRef.current?.clientWidth ?? 400) - 274), top: Math.max(tooltip.y - (wrapRef.current?.getBoundingClientRect().top ?? 0) - 10, 10) }}
        >
          <p className="text-xs font-bold text-[#67e8f9]">{tooltip.name}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-200">{tooltip.def}</p>
        </div>
      )}

      {/* subtle vignette */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]" />
    </div>
  );
}
