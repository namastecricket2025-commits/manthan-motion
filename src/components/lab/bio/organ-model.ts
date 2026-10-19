import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------------ */
/* shared types                                                        */
/* ------------------------------------------------------------------ */

export type OrganSystem = "heart" | "respiratory" | "excretory";
export type ViewMode = "solid" | "xray" | "cross";

export interface OrganPart {
  id: string;
  name: string;
  /** One short sentence a Class 8–12 student can read at a glance. */
  fn: string;
  color: string;
  group: string;
  /** Outer shell: fades in X-ray and gets the fresnel rim. */
  outer?: boolean;
  /** Opacity in Solid view. Defaults to 0.34 for shells, 1 for tissue. */
  baseOpacity?: number;
}

export interface BuiltPart {
  part: OrganPart;
  mesh: THREE.Mesh;
  rim?: THREE.Mesh;
  /** Lung lobes scale with the inflation control. */
  inflate?: boolean;
  /** Heart chambers pulse with the beat. */
  beat?: boolean;
  /** Optional label anchor for instanced/merged interiors. */
  center?: THREE.Vector3;
}

export interface OrganBuild {
  root: THREE.Group;
  parts: BuiltPart[];
  /** Flat amber silhouette at the cross-section cut. */
  cap: THREE.Mesh;
  flow?: ParticleFlow;
}

export interface ParticleFlow {
  object: THREE.Group;
  update: (dt: number, speedScale: number) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

/* ------------------------------------------------------------------ */
/* parts tables                                                        */
/* ------------------------------------------------------------------ */

const HEART_PARTS: OrganPart[] = [
  {
    id: "pericardium",
    name: "Pericardium",
    fn: "A fluid-filled sac that protects the heart and lets it beat without friction.",
    color: "#f2a7b8",
    group: "Outer layers",
    outer: true,
    baseOpacity: 0.3,
  },
  {
    id: "left-ventricle",
    name: "Left ventricle",
    fn: "The thick-walled pump that sends oxygenated blood around the whole body.",
    color: "#e14b5a",
    group: "Chambers",
  },
  {
    id: "right-ventricle",
    name: "Right ventricle",
    fn: "Pumps deoxygenated blood to the lungs through the pulmonary artery.",
    color: "#3b82f6",
    group: "Chambers",
  },
  {
    id: "left-atrium",
    name: "Left atrium",
    fn: "Collects oxygenated blood from the lungs and pushes it into the left ventricle.",
    color: "#f07b8b",
    group: "Chambers",
  },
  {
    id: "right-atrium",
    name: "Right atrium",
    fn: "Collects deoxygenated blood from the body and pushes it into the right ventricle.",
    color: "#60a5fa",
    group: "Chambers",
  },
  {
    id: "septum",
    name: "Interventricular septum",
    fn: "The muscular wall that keeps oxygenated and deoxygenated blood apart.",
    color: "#f3b8b4",
    group: "Wall",
  },
  {
    id: "mitral-valve",
    name: "Mitral valve",
    fn: "A one-way valve between the left atrium and the left ventricle.",
    color: "#c4b5fd",
    group: "Valves",
  },
  {
    id: "tricuspid-valve",
    name: "Tricuspid valve",
    fn: "A one-way valve between the right atrium and the right ventricle.",
    color: "#c4b5fd",
    group: "Valves",
  },
  {
    id: "aortic-valve",
    name: "Aortic valve",
    fn: "Guards the exit from the left ventricle into the aorta.",
    color: "#c4b5fd",
    group: "Valves",
  },
  {
    id: "pulmonary-valve",
    name: "Pulmonary valve",
    fn: "Guards the exit from the right ventricle into the pulmonary artery.",
    color: "#c4b5fd",
    group: "Valves",
  },
  {
    id: "aorta",
    name: "Aorta",
    fn: "The body's largest artery; it carries oxygenated blood away from the heart.",
    color: "#ef4444",
    group: "Great vessels",
  },
  {
    id: "pulmonary-artery",
    name: "Pulmonary artery",
    fn: "Carries deoxygenated blood from the right ventricle to the lungs.",
    color: "#3b82f6",
    group: "Great vessels",
  },
  {
    id: "vena-cava",
    name: "Venae cavae",
    fn: "Large veins that return deoxygenated blood from the body to the right atrium.",
    color: "#2563eb",
    group: "Great vessels",
  },
  {
    id: "pulmonary-vein",
    name: "Pulmonary veins",
    fn: "Bring oxygenated blood from the lungs back to the left atrium.",
    color: "#f472b6",
    group: "Great vessels",
  },
];

const LUNG_PARTS: OrganPart[] = [
  {
    id: "pleura",
    name: "Pleura",
    fn: "A thin double membrane that cushions each lung against the chest wall.",
    color: "#a5b4fc",
    group: "Outer layers",
    outer: true,
    baseOpacity: 0.26,
  },
  {
    id: "trachea",
    name: "Trachea",
    fn: "The windpipe; it carries air from the throat toward the bronchi.",
    color: "#bae6fd",
    group: "Airway",
  },
  {
    id: "right-main-bronchus",
    name: "Right main bronchus",
    fn: "Branches from the trachea and carries air into the right lung.",
    color: "#fbbf24",
    group: "Airway",
  },
  {
    id: "left-main-bronchus",
    name: "Left main bronchus",
    fn: "Branches from the trachea and carries air into the left lung.",
    color: "#fbbf24",
    group: "Airway",
  },
  {
    id: "right-superior-lobe",
    name: "Right superior lobe",
    fn: "The upper lobe of the right lung; it fills with air during inhalation.",
    color: "#f9a8b8",
    group: "Right lung",
  },
  {
    id: "right-middle-lobe",
    name: "Right middle lobe",
    fn: "The small middle lobe found only in the right lung.",
    color: "#fda4af",
    group: "Right lung",
  },
  {
    id: "right-inferior-lobe",
    name: "Right inferior lobe",
    fn: "The lower lobe of the right lung; it rests on the diaphragm.",
    color: "#fb7185",
    group: "Right lung",
  },
  {
    id: "left-superior-lobe",
    name: "Left superior lobe",
    fn: "The upper lobe of the left lung, with a notch where the heart presses in.",
    color: "#f9a8d4",
    group: "Left lung",
  },
  {
    id: "left-inferior-lobe",
    name: "Left inferior lobe",
    fn: "The lower lobe of the left lung; it rests on the diaphragm.",
    color: "#ec4899",
    group: "Left lung",
  },
  {
    id: "alveoli",
    name: "Alveoli",
    fn: "Tiny air sacs where oxygen enters the blood and carbon dioxide leaves it.",
    color: "#fde68a",
    group: "Gas exchange",
  },
  {
    id: "diaphragm",
    name: "Diaphragm",
    fn: "The dome-shaped muscle that flattens to pull air into the lungs.",
    color: "#fca5a5",
    group: "Breathing",
  },
];

const KIDNEY_PARTS: OrganPart[] = [
  {
    id: "capsule",
    name: "Fibrous capsule",
    fn: "A tough fibrous coat that protects the kidney and keeps its shape.",
    color: "#fecaca",
    group: "Outer layers",
    outer: true,
    baseOpacity: 0.3,
  },
  {
    id: "cortex",
    name: "Renal cortex",
    fn: "The outer layer containing the glomeruli, where blood is first filtered.",
    color: "#c2705a",
    group: "Cortex & medulla",
    outer: true,
    baseOpacity: 0.94,
  },
  {
    id: "medulla",
    name: "Renal medulla",
    fn: "The inner region of pyramids that concentrates urine.",
    color: "#8b5a6b",
    group: "Cortex & medulla",
  },
  {
    id: "renal-pyramids",
    name: "Renal pyramids",
    fn: "Cone-shaped bundles of tubules that drain urine toward the pelvis.",
    color: "#f0a35e",
    group: "Cortex & medulla",
  },
  {
    id: "nephrons",
    name: "Nephrons",
    fn: "Microscopic filters and tubules that make urine from blood.",
    color: "#fbbf24",
    group: "Filtration",
  },
  {
    id: "renal-pelvis",
    name: "Renal pelvis",
    fn: "The funnel that collects urine from the pyramids.",
    color: "#fde68a",
    group: "Collecting system",
  },
  {
    id: "renal-artery",
    name: "Renal artery",
    fn: "Brings oxygenated blood to the kidney for filtration.",
    color: "#ef4444",
    group: "Vessels",
  },
  {
    id: "renal-vein",
    name: "Renal vein",
    fn: "Takes filtered blood away from the kidney.",
    color: "#3b82f6",
    group: "Vessels",
  },
  {
    id: "ureter",
    name: "Ureter",
    fn: "Carries urine from the kidney down to the bladder.",
    color: "#fbbf24",
    group: "Collecting system",
  },
];

/* ------------------------------------------------------------------ */
/* materials                                                           */
/* ------------------------------------------------------------------ */

/** Backfaces revealed by the clipping plane are painted with this. */
const CUT_COLOR = "#fbbf24";

function partMaterial(part: OrganPart) {
  const baseOpacity = part.baseOpacity ?? (part.outer ? 0.34 : 1);
  const baseColor = new THREE.Color(part.color);
  const material = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: 0.46,
    metalness: 0.02,
    clearcoat: 0.5,
    clearcoatRoughness: 0.34,
    sheen: 0.3,
    sheenColor: baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.42),
    sheenRoughness: 0.62,
    transparent: baseOpacity < 0.999,
    opacity: baseOpacity,
    depthWrite: baseOpacity > 0.8,
    side: THREE.DoubleSide,
  });

  material.userData.baseColor = baseColor;
  material.userData.baseOpacity = baseOpacity;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCutColor = { value: new THREE.Color(CUT_COLOR) };
    shader.uniforms.uCutStrength = { value: 0 };
    shader.fragmentShader = `uniform vec3 uCutColor;\nuniform float uCutStrength;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
      if (uCutStrength > 0.001 && !gl_FrontFacing) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uCutColor, 0.9);
      }`,
    );
    material.userData.cutStrength = shader.uniforms.uCutStrength;
  };
  return material;
}

function rimMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: 2.2 },
      uIntensity: { value: 1.25 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDir))), uPower);
        gl_FragColor = vec4(uColor * f * uIntensity, f * 0.92);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/* ------------------------------------------------------------------ */
/* geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function ellipsoidGeometry() {
  return new THREE.SphereGeometry(1, 44, 34);
}

function tubeGeometry(points: [number, number, number][], radius: number, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    0.35,
  );
  return new THREE.TubeGeometry(curve, 64, radius, radial, false);
}

function merge(geometries: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error("Could not merge organ geometry");
  return merged;
}

function ventricleGeometry(segments = 48) {
  const geometry = new THREE.SphereGeometry(1, segments, segments);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    if (v.y < 0) {
      const t = -v.y;
      const k = 1 - 0.55 * Math.pow(t, 1.65);
      v.x *= k;
      v.z *= k;
      v.y *= 1.22;
      v.x += 0.07 * Math.pow(t, 2.4);
    } else {
      v.y *= 0.92;
      const k = 1 + 0.05 * v.y;
      v.x *= k;
      v.z *= k;
    }
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

interface LobeSpec {
  rx: number;
  ry: number;
  rz: number;
  /** +1 flattens the +x face, -1 the -x face. */
  sign: 1 | -1;
  notch?: { center: [number, number, number]; radius: number; depth: number };
  seed: number;
}

function lobeGeometry({ rx, ry, rz, sign, notch, seed }: LobeSpec) {
  const geometry = new THREE.SphereGeometry(1, 40, 32);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const ripple =
      1 +
      0.032 * Math.sin(v.x * 7.4 + seed) * Math.cos(v.y * 6.1 - seed) +
      0.02 * Math.sin(v.z * 9.2 + seed * 1.7);
    v.multiplyScalar(ripple);
    const medial = sign * v.x;
    if (medial > 0.45) v.x = sign * (0.45 + (medial - 0.45) * 0.28);
    v.x *= rx;
    v.y *= ry;
    v.z *= rz;
    if (notch) {
      const c = new THREE.Vector3(...notch.center);
      const d = v.distanceTo(c);
      if (d < notch.radius) {
        const t = 1 - d / notch.radius;
        v.addScaledVector(v.clone().sub(c).normalize(), -notch.depth * Math.pow(t, 1.4));
      }
    }
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function kidneyGeometry(radius: number) {
  const geometry = new THREE.SphereGeometry(radius, 56, 48);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const hilum = new THREE.Vector3(radius * 0.78, radius * 0.03, 0);
  const reach = radius * 0.7;
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    v.z *= 0.62;
    v.y *= 1.2;
    const d = v.distanceTo(hilum);
    if (d < reach) {
      const t = 1 - d / reach;
      const s = t * t * (3 - 2 * t);
      v.x -= radius * 0.5 * s;
      v.z *= 1 - 0.35 * s;
    }
    const pole = Math.pow(Math.abs(v.y) / (radius * 1.2), 2.4);
    v.x += (v.x > 0 ? 0.03 : 0.01) * radius * pole;
    v.y *= 1 + 0.03 * pole;
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function ellipseCap(
  center: [number, number],
  radiusX: number,
  radiusY: number,
) {
  const shape = new THREE.Shape();
  shape.absellipse(center[0], center[1], radiusX, radiusY, 0, Math.PI * 2, false, 0);
  return new THREE.ShapeGeometry(shape, 40);
}

function cutCap(geometries: THREE.BufferGeometry[]) {
  return new THREE.Mesh(
    merge(geometries),
    new THREE.MeshBasicMaterial({
      color: CUT_COLOR,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* particle flow                                                       */
/* ------------------------------------------------------------------ */

function dotTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.42, "rgba(255,255,255,0.85)");
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

function createFlow(
  curves: THREE.CatmullRomCurve3[],
  colors: string[],
  counts: number[],
  size = 0.11,
): ParticleFlow {
  const object = new THREE.Group();
  object.name = "flow";

  let total = 0;
  for (const count of counts) total += count;
  const positions = new Float32Array(total * 3);
  const colorAttribute = new Float32Array(total * 3);
  const start = new Float32Array(total);
  const speed = new Float32Array(total);
  const curveOf = new Uint16Array(total);

  let index = 0;
  counts.forEach((count, group) => {
    const color = new THREE.Color(colors[group]);
    for (let i = 0; i < count; i += 1, index += 1) {
      curveOf[index] = group;
      start[index] = Math.random();
      speed[index] = 0.045 + Math.random() * 0.05;
      const jitter = 0.82 + Math.random() * 0.34;
      colorAttribute[index * 3] = Math.min(1, color.r * jitter);
      colorAttribute[index * 3 + 1] = Math.min(1, color.g * jitter);
      colorAttribute[index * 3 + 2] = Math.min(1, color.b * jitter);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorAttribute, 3));
  const texture = dotTexture();
  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: true,
    ...(texture ? { map: texture } : {}),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.02,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  object.add(points);

  let phase = 0;
  const point = new THREE.Vector3();
  return {
    object,
    update: (dt, speedScale) => {
      phase += dt * speedScale;
      const attribute = geometry.attributes.position as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      for (let i = 0; i < total; i += 1) {
        const u = ((start[i] + phase * speed[i]) % 1 + 1) % 1;
        curves[curveOf[i]].getPointAt(u, point);
        array[i * 3] = point.x;
        array[i * 3 + 1] = point.y;
        array[i * 3 + 2] = point.z;
      }
      attribute.needsUpdate = true;
    },
    setVisible: (visible) => {
      object.visible = visible;
    },
    dispose: () => {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* heart                                                               */
/* ------------------------------------------------------------------ */

/** A loop around the heart for the red and blue blood paths. */
function heartLoop(rx: number, ry: number, z: number, tilt: number, wobble: number) {
  const points: THREE.Vector3[] = [];
  const rotation = new THREE.Matrix4().makeRotationX(tilt);
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const p = new THREE.Vector3(
      Math.cos(angle) * rx,
      Math.sin(angle) * ry - 0.34,
      z + Math.sin(angle * 2) * wobble,
    );
    p.applyMatrix4(rotation);
    points.push(p);
  }
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
}

function buildHeart(): OrganBuild {
  const root = new THREE.Group();
  root.name = "Heart";
  const parts: BuiltPart[] = [];
  const byId = new Map(HEART_PARTS.map((part) => [part.id, part]));

  const add = (
    id: string,
    geometry: THREE.BufferGeometry,
    opts: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      beat?: boolean;
      center?: [number, number, number];
    } = {},
  ) => {
    const part = byId.get(id);
    if (!part) throw new Error(`Unknown heart part ${id}`);
    const mesh = new THREE.Mesh(geometry, partMaterial(part));
    mesh.name = id;
    mesh.userData.partId = id;
    if (opts.position) mesh.position.set(...opts.position);
    if (opts.rotation) mesh.rotation.set(...opts.rotation);
    if (opts.scale) mesh.scale.set(...opts.scale);
    let rim: THREE.Mesh | undefined;
    if (part.outer) {
      rim = new THREE.Mesh(geometry, rimMaterial(part.color));
      rim.name = `${id}-rim`;
      rim.renderOrder = 4;
      rim.visible = false;
      mesh.add(rim);
    }
    root.add(mesh);
    parts.push({
      part,
      mesh,
      rim,
      beat: opts.beat,
      center: opts.center ? new THREE.Vector3(...opts.center) : undefined,
    });
    return mesh;
  };

  add("left-ventricle", ventricleGeometry(56), {
    position: [-0.82, -0.55, 0.12],
    rotation: [0, 0, -0.16],
    scale: [1.78, 2.18, 1.62],
    beat: true,
  });
  add("right-ventricle", ventricleGeometry(56), {
    position: [0.98, -0.42, 0.02],
    rotation: [0, 0, 0.18],
    scale: [1.92, 2.0, 1.72],
    beat: true,
  });
  add("left-atrium", ellipsoidGeometry(), {
    position: [-1.78, 1.55, -0.25],
    scale: [1.18, 0.98, 1.05],
    rotation: [0, 0.2, -0.08],
    beat: true,
  });
  add("right-atrium", ellipsoidGeometry(), {
    position: [1.78, 1.42, 0.05],
    scale: [1.24, 1.02, 1.12],
    rotation: [0, -0.18, 0.08],
    beat: true,
  });
  add("septum", ellipsoidGeometry(), {
    position: [0.08, -0.62, 0.0],
    rotation: [0, 0, -0.05],
    scale: [0.28, 1.78, 1.25],
  });

  const valveGeometry = () => new THREE.TorusGeometry(0.52, 0.095, 12, 30);
  add("mitral-valve", valveGeometry(), {
    position: [-1.0, 0.72, 0.08],
    rotation: [Math.PI / 2, 0, -0.12],
  });
  add("tricuspid-valve", valveGeometry(), {
    position: [1.08, 0.66, 0.14],
    rotation: [Math.PI / 2, 0, 0.1],
  });
  add("aortic-valve", valveGeometry(), {
    position: [0.4, 0.94, -0.16],
    rotation: [Math.PI / 2, 0, 0.2],
  });
  add("pulmonary-valve", valveGeometry(), {
    position: [-0.12, 0.9, 0.56],
    rotation: [Math.PI / 2, 0, -0.16],
  });

  add(
    "aorta",
    tubeGeometry(
      [
        [0.42, 0.96, -0.3],
        [0.55, 2.35, -0.25],
        [0.86, 3.9, -0.2],
        [1.9, 4.7, -0.45],
        [3.0, 4.05, -0.7],
        [3.2, 2.7, -0.9],
      ],
      0.46,
      16,
    ),
  );
  add(
    "pulmonary-artery",
    tubeGeometry(
      [
        [0.2, 0.9, 1.05],
        [-0.05, 2.25, 0.98],
        [-0.7, 3.5, 0.65],
        [-1.8, 3.95, 0.25],
      ],
      0.42,
      16,
    ),
  );
  add(
    "vena-cava",
    merge([
      tubeGeometry(
        [
          [-1.72, 4.55, -0.1],
          [-1.76, 3.2, -0.06],
          [-1.68, 1.9, 0.02],
          [-1.6, 1.55, 0.08],
        ],
        0.36,
        14,
      ),
      tubeGeometry(
        [
          [-1.35, -3.35, -0.2],
          [-1.5, -1.55, -0.05],
          [-1.62, 0.2, 0.05],
          [-1.65, 1.1, 0.08],
        ],
        0.4,
        14,
      ),
    ]),
  );
  add(
    "pulmonary-vein",
    merge([
      tubeGeometry(
        [
          [-3.0, 2.85, -1.35],
          [-2.05, 2.5, -0.9],
          [-1.35, 2.0, -0.45],
        ],
        0.23,
        12,
      ),
      tubeGeometry(
        [
          [2.95, 2.75, -1.4],
          [2.0, 2.4, -0.95],
          [1.4, 1.95, -0.45],
        ],
        0.23,
        12,
      ),
    ]),
  );

  add("pericardium", ellipsoidGeometry(), {
    position: [0, -0.24, 0],
    scale: [2.92, 3.78, 2.62],
  });

  const cap = cutCap([ellipseCap([0, -0.35], 2.95, 3.5)]);
  cap.name = "heart-cut-cap";
  cap.renderOrder = 6;

  const flow = createFlow(
    [
      heartLoop(3.55, 3.2, 1.25, 0.32, 0.38),
      heartLoop(3.15, 3.65, 0.3, -0.48, 0.3),
      heartLoop(3.65, 3.15, -1.2, -0.3, 0.34),
      heartLoop(3.2, 3.55, -0.25, 0.46, 0.28),
    ],
    ["#ff4d5e", "#ff7d80", "#3b82f6", "#67b7ff"],
    [52, 52, 52, 52],
    0.12,
  );

  return { root, parts, cap, flow };
}

/* ------------------------------------------------------------------ */
/* lungs                                                               */
/* ------------------------------------------------------------------ */

function buildLungs(): OrganBuild {
  const root = new THREE.Group();
  root.name = "Lungs";
  const parts: BuiltPart[] = [];
  const byId = new Map(LUNG_PARTS.map((part) => [part.id, part]));

  const add = (
    id: string,
    geometry: THREE.BufferGeometry,
    opts: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      inflate?: boolean;
      center?: [number, number, number];
    } = {},
  ) => {
    const part = byId.get(id);
    if (!part) throw new Error(`Unknown lung part ${id}`);
    const mesh = new THREE.Mesh(geometry, partMaterial(part));
    mesh.name = id;
    mesh.userData.partId = id;
    if (opts.position) mesh.position.set(...opts.position);
    if (opts.rotation) mesh.rotation.set(...opts.rotation);
    if (opts.scale) mesh.scale.set(...opts.scale);
    let rim: THREE.Mesh | undefined;
    if (part.outer) {
      rim = new THREE.Mesh(geometry, rimMaterial(part.color));
      rim.name = `${id}-rim`;
      rim.renderOrder = 4;
      rim.visible = false;
      mesh.add(rim);
    }
    root.add(mesh);
    parts.push({
      part,
      mesh,
      rim,
      inflate: opts.inflate,
      center: opts.center ? new THREE.Vector3(...opts.center) : undefined,
    });
    return mesh;
  };

  /* Trachea: cylinder + cartilage rings + carina, merged into one part. */
  const airwayPieces: THREE.BufferGeometry[] = [];
  const trachea = new THREE.CylinderGeometry(0.5, 0.58, 3.5, 28);
  trachea.translate(0, 5.2, 0);
  airwayPieces.push(trachea);
  for (let i = 0; i < 8; i += 1) {
    const ring = new THREE.TorusGeometry(0.58, 0.085, 10, 28);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 3.7 + i * 0.44, 0);
    airwayPieces.push(ring);
  }
  const carina = new THREE.SphereGeometry(0.62, 24, 18);
  carina.scale(1.35, 0.72, 1.05);
  carina.translate(0, 3.5, 0);
  airwayPieces.push(carina);
  add("trachea", merge(airwayPieces));

  add(
    "right-main-bronchus",
    tubeGeometry(
      [
        [0, 3.55, 0],
        [-0.95, 3.15, -0.08],
        [-1.8, 2.6, -0.12],
        [-2.25, 1.75, -0.08],
      ],
      0.27,
      12,
    ),
  );
  add(
    "left-main-bronchus",
    tubeGeometry(
      [
        [0, 3.55, 0],
        [0.95, 3.15, -0.08],
        [1.8, 2.6, -0.12],
        [2.25, 1.75, -0.08],
      ],
      0.27,
      12,
    ),
  );

  add(
    "right-superior-lobe",
    lobeGeometry({ rx: 1.62, ry: 1.74, rz: 1.42, sign: 1, seed: 1.3 }),
    { position: [-2.45, 2.25, 0.08], inflate: true },
  );
  add(
    "right-middle-lobe",
    lobeGeometry({ rx: 1.48, ry: 1.05, rz: 1.3, sign: 1, seed: 2.1 }),
    { position: [-2.42, 0.32, 0.18], inflate: true },
  );
  add(
    "right-inferior-lobe",
    lobeGeometry({ rx: 1.72, ry: 1.78, rz: 1.48, sign: 1, seed: 2.6 }),
    { position: [-2.46, -1.65, -0.08], inflate: true },
  );
  add(
    "left-superior-lobe",
    lobeGeometry({
      rx: 1.55,
      ry: 1.8,
      rz: 1.38,
      sign: -1,
      seed: 3.9,
      notch: { center: [-0.55, -0.55, 1.2], radius: 1.15, depth: 0.78 },
    }),
    { position: [2.42, 2.08, 0.08], inflate: true },
  );
  add(
    "left-inferior-lobe",
    lobeGeometry({ rx: 1.68, ry: 1.8, rz: 1.46, sign: -1, seed: 5.2 }),
    { position: [2.46, -1.68, -0.08], inflate: true },
  );

  /* Alveoli: one instanced mesh, spread through the lower lobes. */
  const alveoliPart = byId.get("alveoli");
  if (!alveoliPart) throw new Error("Unknown lung part alveoli");
  const alveoliCount = 90;
  const alveoli = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.115, 10, 8),
    partMaterial(alveoliPart),
    alveoliCount,
  );
  alveoli.name = "alveoli";
  alveoli.userData.partId = "alveoli";
  const dummy = new THREE.Object3D();
  for (let i = 0; i < alveoliCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    dummy.position.set(
      side * (2.35 + Math.random() * 0.7),
      -2.55 + Math.random() * 3.0,
      -0.85 + Math.random() * 1.7,
    );
    const s = 0.62 + Math.random() * 0.8;
    dummy.scale.setScalar(s);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    dummy.updateMatrix();
    alveoli.setMatrixAt(i, dummy.matrix);
  }
  alveoli.instanceMatrix.needsUpdate = true;
  root.add(alveoli);
  parts.push({
    part: alveoliPart,
    mesh: alveoli,
    center: new THREE.Vector3(0, -1.05, 0.1),
  });

  /* Pleura: two thin, merged shells around the lung fields. */
  const pleuraPieces: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const shell = new THREE.SphereGeometry(1, 40, 28);
    shell.scale(1.76, 4.05, 1.58);
    shell.translate(side * 2.44, 0.05, 0);
    pleuraPieces.push(shell);
  }
  add("pleura", merge(pleuraPieces));

  const diaphragm = new THREE.SphereGeometry(4.15, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.42);
  diaphragm.scale(1.12, 0.54, 0.94);
  diaphragm.translate(0, -4.28, 0);
  add("diaphragm", diaphragm);

  const capPieces = [
    ellipseCap([-2.44, 0.0], 1.64, 3.8),
    ellipseCap([2.44, 0.0], 1.6, 3.8),
  ];
  const cap = cutCap(capPieces);
  cap.name = "lungs-cut-cap";
  cap.renderOrder = 6;

  return { root, parts, cap };
}

/* ------------------------------------------------------------------ */
/* kidney                                                              */
/* ------------------------------------------------------------------ */

interface Nephron {
  glomerulus: THREE.Vector3;
  curve: THREE.CatmullRomCurve3;
}

function nephronCurves(radius: number): Nephron[] {
  const centre = new THREE.Vector3(-radius * 0.12, 0, 0);
  const pelvis = new THREE.Vector3(radius * 0.45, 0, 0);
  const nephrons: Nephron[] = [];
  for (let i = 0; i < 5; i += 1) {
    const angle = -1.15 + i * 0.58;
    const glomerulus = new THREE.Vector3(
      centre.x + radius * 0.6 * Math.cos(angle),
      radius * 0.8 * Math.sin(angle),
      radius * 0.16 * Math.cos(i * 1.7),
    );
    const points: THREE.Vector3[] = [];
    for (let s = 0; s <= 5; s += 1) {
      const a = (s / 5) * Math.PI * 1.9 + i;
      points.push(
        glomerulus
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(a) * radius * 0.12,
              Math.sin(a) * radius * 0.12,
              radius * 0.035 * s,
            ),
          ),
      );
    }
    const dir = pelvis.clone().sub(glomerulus).normalize();
    const offset = (i % 2 === 0 ? 1 : -1) * radius * (0.14 + 0.05 * (i % 3));
    points.push(glomerulus.clone().addScaledVector(dir, radius * 0.3));
    points.push(
      centre
        .clone()
        .lerp(pelvis, 0.55)
        .add(new THREE.Vector3(0, offset, radius * 0.22)),
    );
    points.push(
      centre
        .clone()
        .lerp(pelvis, 0.76)
        .add(new THREE.Vector3(0, offset * 0.9, -radius * 0.12)),
    );
    points.push(pelvis.clone().add(new THREE.Vector3(-radius * 0.08, offset * 0.45, radius * 0.08)));
    nephrons.push({
      glomerulus,
      curve: new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.3),
    });
  }
  return nephrons;
}

function buildKidney(): OrganBuild {
  const root = new THREE.Group();
  root.name = "Kidney";
  const parts: BuiltPart[] = [];
  const byId = new Map(KIDNEY_PARTS.map((part) => [part.id, part]));

  const add = (
    id: string,
    geometry: THREE.BufferGeometry,
    opts: {
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      center?: [number, number, number];
    } = {},
  ) => {
    const part = byId.get(id);
    if (!part) throw new Error(`Unknown kidney part ${id}`);
    const mesh = new THREE.Mesh(geometry, partMaterial(part));
    mesh.name = id;
    mesh.userData.partId = id;
    if (opts.position) mesh.position.set(...opts.position);
    if (opts.rotation) mesh.rotation.set(...opts.rotation);
    if (opts.scale) mesh.scale.set(...opts.scale);
    let rim: THREE.Mesh | undefined;
    if (part.outer) {
      rim = new THREE.Mesh(geometry, rimMaterial(part.color));
      rim.name = `${id}-rim`;
      rim.renderOrder = 4;
      rim.visible = false;
      mesh.add(rim);
    }
    root.add(mesh);
    parts.push({
      part,
      mesh,
      rim,
      center: opts.center ? new THREE.Vector3(...opts.center) : undefined,
    });
    return mesh;
  };

  const R = 3.35;
  add("capsule", kidneyGeometry(R * 1.035));
  add("cortex", kidneyGeometry(R));
  add("medulla", kidneyGeometry(R * 0.73), {
    position: [-0.1, 0, 0.04],
  });

  /* Renal pyramids: cones whose bases face the cortex and papillae face the pelvis. */
  const pyramidGeometries: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const pelvisPoint = new THREE.Vector3(R * 0.44, 0, 0);
  const pyramidCentre = new THREE.Vector3(-R * 0.12, 0, 0);
  for (let i = 0; i < 6; i += 1) {
    const angle = -1.25 + i * 0.5;
    const base = new THREE.Vector3(
      pyramidCentre.x + R * 0.7 * Math.cos(angle),
      pyramidCentre.y + R * 0.92 * Math.sin(angle),
      R * 0.03 * Math.sin(i * 2.1),
    );
    const dir = pelvisPoint.clone().sub(base);
    const length = Math.min(R * 0.72, dir.length() * 0.66);
    dir.normalize();
    const cone = new THREE.ConeGeometry(R * 0.24, length, 20);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const matrix = new THREE.Matrix4().compose(
      base.clone().addScaledVector(dir, length * 0.5 + R * 0.1),
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    cone.applyMatrix4(matrix);
    pyramidGeometries.push(cone);
  }
  add("renal-pyramids", merge(pyramidGeometries), {
    center: [0, 0, 0.1],
  });

  const nephrons = nephronCurves(R);
  const nephronGeometries = nephrons.map((nephron) => {
    const geo = new THREE.TubeGeometry(nephron.curve, 72, R * 0.025, 8, false);
    return geo;
  });
  add("nephrons", merge(nephronGeometries), {
    center: [0, 0, 0.25],
  });

  const pelvis = new THREE.ConeGeometry(R * 0.34, R * 0.72, 26, 1, true);
  pelvis.rotateZ(-Math.PI / 2);
  pelvis.translate(R * 0.52, -R * 0.02, 0);
  add("renal-pelvis", pelvis);

  add(
    "ureter",
    tubeGeometry(
      [
        [R * 0.68, -R * 0.12, 0.05],
        [R * 0.98, -R * 0.4, 0.12],
        [R * 1.22, -R * 0.9, 0.18],
        [R * 1.32, -R * 1.5, 0.22],
      ],
      R * 0.085,
      10,
    ),
  );

  add(
    "renal-artery",
    tubeGeometry(
      [
        [R * 1.22, R * 0.38, 0.3],
        [R * 0.88, R * 0.28, 0.18],
        [R * 0.62, R * 0.18, 0.08],
      ],
      R * 0.075,
      10,
    ),
  );
  add(
    "renal-vein",
    tubeGeometry(
      [
        [R * 1.22, R * 0.06, -0.42],
        [R * 0.9, 0.0, -0.32],
        [R * 0.6, -R * 0.06, -0.2],
      ],
      R * 0.09,
      10,
    ),
  );

  const cap = cutCap([ellipseCap([0, 0], R * 1.02, R * 1.16)]);
  cap.name = "kidney-cut-cap";
  cap.renderOrder = 6;

  const flow = createFlow(
    nephrons.map((nephron) => nephron.curve),
    ["#fbbf24", "#34d399", "#fbbf24", "#34d399", "#fbbf24"],
    [34, 34, 34, 34, 34],
    R * 0.032,
  );

  return { root, parts, cap, flow };
}

/* ------------------------------------------------------------------ */
/* public registry                                                     */
/* ------------------------------------------------------------------ */

export const ORGAN_MODELS: Record<
  OrganSystem,
  { parts: OrganPart[]; build: () => OrganBuild }
> = {
  heart: { parts: HEART_PARTS, build: buildHeart },
  respiratory: { parts: LUNG_PARTS, build: buildLungs },
  excretory: { parts: KIDNEY_PARTS, build: buildKidney },
};

export const VIEW_COPY: Record<ViewMode, { label: string; hint: string }> = {
  solid: { label: "Solid", hint: "The organ as it sits in the body" },
  xray: { label: "X-ray", hint: "Outer membranes fade so the inside shows" },
  cross: { label: "Cross-section", hint: "A clipping plane cuts the organ open" },
};
