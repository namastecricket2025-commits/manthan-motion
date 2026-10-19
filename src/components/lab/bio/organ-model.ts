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

/** Roles in the cardiac cycle, played by the heart beat choreographer. */
export type HeartBeatRole = "atrium" | "ventricle" | "papillary" | "chordae";

export interface BuiltPart {
  part: OrganPart;
  mesh: THREE.Mesh;
  rim?: THREE.Mesh;
  /** Lung lobes scale with the inflation control. */
  inflate?: boolean;
  /** Heart chambers pulse with the beat. */
  beat?: HeartBeatRole;
  /** AV valves open during filling; semilunar valves open during ejection. */
  valve?: "av" | "sl";
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
  /** Points are sized in local units; the stage passes the holder scale and
      the canvas pixel scale so they render at a constant on-screen size. */
  setSizing: (worldScale: number, pxScale: number) => void;
  dispose: () => void;
}

/* ------------------------------------------------------------------ */
/* parts tables                                                        */
/* ------------------------------------------------------------------ */

const HEART_PARTS: OrganPart[] = [
  /* Chambers */
  {
    id: "right-atrium",
    name: "Right atrium",
    fn: "Collects deoxygenated blood from the body and pushes it into the right ventricle.",
    color: "#3b82f6",
    group: "Chambers",
  },
  {
    id: "right-auricle",
    name: "Right auricle",
    fn: "A small ear-shaped pouch on the front of the right atrium.",
    color: "#5b9bf8",
    group: "Chambers",
  },
  {
    id: "left-atrium",
    name: "Left atrium",
    fn: "Receives oxygenated blood from the four pulmonary veins.",
    color: "#ef6a6a",
    group: "Chambers",
  },
  {
    id: "left-auricle",
    name: "Left auricle",
    fn: "A small ear-shaped pouch beside the pulmonary trunk.",
    color: "#f28a8a",
    group: "Chambers",
  },
  {
    id: "left-ventricle",
    name: "Left ventricle",
    fn: "The thickest chamber; pumps oxygenated blood through the whole body.",
    color: "#d94a55",
    group: "Chambers",
  },
  {
    id: "right-ventricle",
    name: "Right ventricle",
    fn: "A thinner crescent wrapping the front of the heart; pumps blood to the lungs.",
    color: "#3f7ef0",
    group: "Chambers",
  },
  {
    id: "interventricular-septum",
    name: "Interventricular septum",
    fn: "The thick wall that keeps the two ventricles and their blood separate.",
    color: "#a3414a",
    group: "Chambers",
  },
  {
    id: "apex",
    name: "Apex",
    fn: "The pointed lower tip of the left ventricle.",
    color: "#c9434e",
    group: "Chambers",
  },
  /* Valves */
  {
    id: "tricuspid-valve",
    name: "Tricuspid valve",
    fn: "Three leaflets between the right atrium and right ventricle.",
    color: "#ece6f4",
    group: "Valves",
  },
  {
    id: "mitral-valve",
    name: "Mitral (bicuspid) valve",
    fn: "Two leaflets between the left atrium and left ventricle.",
    color: "#ece6f4",
    group: "Valves",
  },
  {
    id: "pulmonary-valve",
    name: "Pulmonary valve",
    fn: "Three cusps that open as the right ventricle pumps blood out.",
    color: "#ece6f4",
    group: "Valves",
  },
  {
    id: "aortic-valve",
    name: "Aortic valve",
    fn: "Three cusps at the exit of the left ventricle into the aorta.",
    color: "#ece6f4",
    group: "Valves",
  },
  /* Inner structures */
  {
    id: "papillary-muscles",
    name: "Papillary muscles",
    fn: "Muscle columns in the ventricles that pull the valve leaflets tight.",
    color: "#b04a52",
    group: "Inner structures",
  },
  {
    id: "chordae-tendineae",
    name: "Chordae tendineae",
    fn: "Fine heart strings anchoring the leaflets so they cannot turn inside out.",
    color: "#f6f1ea",
    group: "Inner structures",
  },
  /* Great vessels */
  {
    id: "aorta-ascending",
    name: "Ascending aorta",
    fn: "Carries oxygenated blood up from the left ventricle.",
    color: "#ef4444",
    group: "Great vessels",
  },
  {
    id: "aorta-arch",
    name: "Aortic arch",
    fn: "The curved top of the aorta, where three arteries branch off.",
    color: "#ef4444",
    group: "Great vessels",
  },
  {
    id: "aorta-descending",
    name: "Descending aorta",
    fn: "Runs down behind the heart to supply the rest of the body.",
    color: "#e13b3b",
    group: "Great vessels",
  },
  {
    id: "brachiocephalic-trunk",
    name: "Brachiocephalic trunk",
    fn: "The arch's first branch; feeds the right arm and right side of the head.",
    color: "#f0554f",
    group: "Great vessels",
  },
  {
    id: "left-common-carotid",
    name: "Left common carotid artery",
    fn: "The arch's second branch; runs up the left side of the neck.",
    color: "#f0554f",
    group: "Great vessels",
  },
  {
    id: "left-subclavian",
    name: "Left subclavian artery",
    fn: "The arch's third branch; supplies the left arm.",
    color: "#f0554f",
    group: "Great vessels",
  },
  {
    id: "pulmonary-trunk",
    name: "Pulmonary trunk",
    fn: "Leaves the right ventricle and splits to carry blood to both lungs.",
    color: "#3b82f6",
    group: "Great vessels",
  },
  {
    id: "left-pulmonary-artery",
    name: "Left pulmonary artery",
    fn: "Takes deoxygenated blood into the left lung.",
    color: "#4b8ef5",
    group: "Great vessels",
  },
  {
    id: "right-pulmonary-artery",
    name: "Right pulmonary artery",
    fn: "Runs behind the aorta and vena cava into the right lung.",
    color: "#4b8ef5",
    group: "Great vessels",
  },
  {
    id: "superior-vena-cava",
    name: "Superior vena cava",
    fn: "Brings blood from the head, neck and arms into the right atrium.",
    color: "#2563eb",
    group: "Great vessels",
  },
  {
    id: "inferior-vena-cava",
    name: "Inferior vena cava",
    fn: "Brings blood from the lower body up into the right atrium.",
    color: "#2563eb",
    group: "Great vessels",
  },
  {
    id: "pulmonary-vein-lu",
    name: "Left superior pulmonary vein",
    fn: "Drains the top of the left lung into the left atrium.",
    color: "#f472b6",
    group: "Great vessels",
  },
  {
    id: "pulmonary-vein-ll",
    name: "Left inferior pulmonary vein",
    fn: "Drains the bottom of the left lung into the left atrium.",
    color: "#f472b6",
    group: "Great vessels",
  },
  {
    id: "pulmonary-vein-ru",
    name: "Right superior pulmonary vein",
    fn: "Drains the top of the right lung into the left atrium.",
    color: "#f472b6",
    group: "Great vessels",
  },
  {
    id: "pulmonary-vein-rl",
    name: "Right inferior pulmonary vein",
    fn: "Drains the bottom of the right lung into the left atrium.",
    color: "#f472b6",
    group: "Great vessels",
  },
  /* Coronary arteries */
  {
    id: "right-coronary-artery",
    name: "Right coronary artery",
    fn: "Runs in the groove between the right atrium and ventricle.",
    color: "#ff3b3b",
    group: "Coronary arteries",
  },
  {
    id: "left-main-artery",
    name: "Left main artery",
    fn: "A short artery that splits into the LAD and the circumflex.",
    color: "#ff3b3b",
    group: "Coronary arteries",
  },
  {
    id: "lad",
    name: "Left anterior descending artery",
    fn: "Runs down the front groove between the ventricles toward the apex.",
    color: "#ff3b3b",
    group: "Coronary arteries",
  },
  {
    id: "circumflex",
    name: "Circumflex artery",
    fn: "Curves around the left side in the atrioventricular groove.",
    color: "#ff3b3b",
    group: "Coronary arteries",
  },
  /* Outer layers */
  {
    id: "pericardium",
    name: "Pericardium",
    fn: "The protective sac around the heart; fades in X-ray so the inside shows.",
    color: "#f2a7b8",
    group: "Outer layers",
    outer: true,
    baseOpacity: 0.3,
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
  /* Cross-section tint: only the thin band of surface that actually touches
     the clipping plane is painted amber, so a hollow chamber reads as a
     sliced wall with a cavity behind it rather than a flat filled face. */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCutColor = { value: new THREE.Color(CUT_COLOR) };
    shader.uniforms.uCutStrength = { value: 0 };
    shader.uniforms.uCutZ = { value: 0 };
    shader.vertexShader = `varying float vCutWorldZ;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vCutWorldZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).z;
      #else
        vCutWorldZ = (modelMatrix * vec4(transformed, 1.0)).z;
      #endif`,
    );
    shader.fragmentShader = `uniform vec3 uCutColor;\nuniform float uCutStrength;\nuniform float uCutZ;\nvarying float vCutWorldZ;\n${shader.fragmentShader}`.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
      if (uCutStrength > 0.5 && abs(vCutWorldZ - uCutZ) < 0.02) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uCutColor, 0.92);
      }`,
    );
    material.userData.cutStrength = shader.uniforms.uCutStrength;
    material.userData.cutZ = shader.uniforms.uCutZ;
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

function cutCap(geometries: THREE.BufferGeometry[], opacity = 0.16) {
  return new THREE.Mesh(
    merge(geometries),
    new THREE.MeshBasicMaterial({
      color: CUT_COLOR,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* particle flow                                                       */
/* ------------------------------------------------------------------ */

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function smoothstep01(a: number, b: number, x: number) {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
}

function createFlow(
  curves: THREE.CatmullRomCurve3[],
  colors: string[],
  counts: number[],
  size = 0.16,
  opts: { fadeEnds?: boolean } = {},
): ParticleFlow {
  const object = new THREE.Group();
  object.name = "flow";

  let total = 0;
  for (const count of counts) total += count;
  const positions = new Float32Array(total * 3);
  const colorAttribute = new Float32Array(total * 3);
  const alphaAttribute = new Float32Array(total).fill(1);
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
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colorAttribute, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphaAttribute, 1));

  /* A small point shader: round soft dots plus a per-particle alpha, so the
     heart flow can fade out into the lungs and fade back in as it returns. */
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uWorldScale: { value: 1 },
      uPxScale: { value: 600 },
    },
    vertexShader: `
      uniform float uSize;
      uniform float uWorldScale;
      uniform float uPxScale;
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, uSize * uWorldScale * uPxScale / max(0.05, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float a = smoothstep(0.5, 0.1, d) * vAlpha;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
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
      const alpha = geometry.attributes.aAlpha as THREE.BufferAttribute;
      const alphaArray = alpha.array as Float32Array;
      for (let i = 0; i < total; i += 1) {
        const u = ((start[i] + phase * speed[i]) % 1 + 1) % 1;
        curves[curveOf[i]].getPointAt(u, point);
        array[i * 3] = point.x;
        array[i * 3 + 1] = point.y;
        array[i * 3 + 2] = point.z;
        alphaArray[i] = opts.fadeEnds
          ? smoothstep01(0, 0.07, u) * (1 - smoothstep01(0.92, 1, u))
          : 1;
      }
      attribute.needsUpdate = true;
      alpha.needsUpdate = true;
    },
    setVisible: (visible) => {
      object.visible = visible;
    },
    setSizing: (worldScale, pxScale) => {
      material.uniforms.uWorldScale.value = worldScale;
      material.uniforms.uPxScale.value = pxScale;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* heart                                                               */
/* ------------------------------------------------------------------ */

/* The heart sits tilted in the chest: base up, apex pointing down, forward
   and to the patient's left. Every part is designed in an "untilted" frame
   (+x = patient's left, +z = anterior) and then carried through one shared
   rotation, so chambers, valves and vessels stay in register. */
const HEART_TILT = new THREE.Matrix4().makeRotationFromEuler(
  new THREE.Euler(0.06, -0.1, 0.3),
);
const HEART_TILT_Q = new THREE.Quaternion().setFromRotationMatrix(HEART_TILT);

function tiltPoint(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z).applyMatrix4(HEART_TILT);
}

/** Tube in untilted space, baked through the shared tilt. */
function heartTube(points: [number, number, number][], radius: number, radial = 12) {
  const geometry = tubeGeometry(points, radius, radial);
  geometry.applyMatrix4(HEART_TILT);
  return geometry;
}

/** Unit sphere deformed into a ventricle: tapers to the apex below the
    equator, with an optional flattened septal (+x) face for the RV. */
function ventricleShape(opts: { taper: number; apexDx: number; flattenMedial?: number }) {
  const geometry = new THREE.SphereGeometry(1, 46, 34);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    if (v.y < 0) {
      const t = -v.y;
      const k = 1 - opts.taper * Math.pow(t, 1.7);
      v.x *= k;
      v.z *= k;
      v.y *= 1.24;
      v.x += opts.apexDx * Math.pow(t, 2.1);
    } else {
      v.y *= 0.95;
      const k = 1 + 0.05 * v.y;
      v.x *= k;
      v.z *= k;
    }
    if (opts.flattenMedial && v.x > 0.4) {
      v.x = 0.4 + (v.x - 0.4) * opts.flattenMedial;
    }
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function flipWinding(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex();
  if (index) {
    const array = index.array;
    for (let i = 0; i < array.length; i += 3) {
      const tmp = array[i + 1];
      array[i + 1] = array[i + 2];
      array[i + 2] = tmp;
    }
    index.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Hollow chamber: outer muscle shell + inner cavity. Wall thickness is in
    unit-sphere space, so the LV wall reads about 3× the RV wall. */
function chamberShell(opts: {
  taper: number;
  apexDx: number;
  flattenMedial?: number;
  wall: number;
}) {
  const outer = ventricleShape(opts);
  const inner = ventricleShape({ ...opts, taper: opts.taper * 0.96 });
  inner.scale(1 - opts.wall, 1 - opts.wall * 0.92, 1 - opts.wall);
  flipWinding(inner);
  return merge([outer, inner]);
}

/** Auricles are the wrinkled, ear-shaped pouches on the atria. */
function auricleGeometry(seed: number) {
  const geometry = new THREE.SphereGeometry(1, 28, 22);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const lobe =
      1 + 0.1 * Math.sin(Math.atan2(v.z, v.x) * 3 + seed) * (1 - Math.min(1, Math.abs(v.y)));
    v.x *= lobe * 1.12;
    v.z *= lobe;
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function applyAxisRotation(
  geometry: THREE.BufferGeometry,
  axis: THREE.Vector3,
  angle: number,
) {
  const matrix = new THREE.Matrix4().makeRotationAxis(axis.clone().normalize(), angle);
  geometry.applyMatrix4(matrix);
  return geometry;
}

/** A valve: torus ring in the XZ plane plus 2–3 curved leaflet flaps that
    lean toward the centre. The beat flattens them open or bulges them shut. */
function valveGeometry(ringR: number, leaflets: number, kind: "av" | "sl") {
  const pieces: THREE.BufferGeometry[] = [];
  const ring = new THREE.TorusGeometry(ringR, ringR * 0.17, 10, 26);
  ring.rotateX(Math.PI / 2);
  pieces.push(ring);

  const phiLen = (Math.PI * 2) / leaflets - 0.2;
  for (let i = 0; i < leaflets; i += 1) {
    const angle = (i / leaflets) * Math.PI * 2 + (leaflets === 2 ? Math.PI / 2 : 0);
    const sector = new THREE.SphereGeometry(
      ringR,
      18,
      10,
      Math.PI - phiLen / 2,
      phiLen,
      Math.PI * 0.26,
      Math.PI * 0.5,
    );
    sector.scale(1, 0.42, 1);
    sector.rotateY(-angle);
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(0, 1, 0).cross(radial);
    applyAxisRotation(sector, tangent, kind === "sl" ? 0.5 : -0.5);
    sector.translate(
      radial.x * -ringR * 0.45,
      kind === "sl" ? ringR * 0.1 : -ringR * 0.1,
      radial.z * -ringR * 0.45,
    );
    pieces.push(sector);
  }
  return merge(pieces);
}

/** A papillary muscle: a small cone whose tip points at its valve. */
function papillaryMuscleAt(
  base: [number, number, number],
  tip: [number, number, number],
) {
  const muscle = new THREE.ConeGeometry(0.14, 0.46, 14);
  const direction = new THREE.Vector3(
    tip[0] - base[0],
    tip[1] - base[1],
    tip[2] - base[2],
  ).normalize();
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...base).addScaledVector(direction, 0.23),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
    new THREE.Vector3(1, 1, 1),
  );
  muscle.applyMatrix4(matrix);
  return muscle;
}

function tiltCurve(points: [number, number, number][]) {
  return new THREE.CatmullRomCurve3(
    points.map((p) => tiltPoint(...p)),
    false,
    "catmullrom",
    0.32,
  );
}

/** The real circulation path, in two blue curves (venae cavae in) and two
    red curves (pulmonary veins back). Particles fade out at the lung end of
    the blue curves and fade back in on the red side. */
function createHeartFlow(): ParticleFlow {
  const blueSVC: [number, number, number][] = [
    [-1.15, 3.3, -0.3],
    [-1.18, 2.2, -0.2],
    [-1.1, 1.3, -0.1],
    [-0.85, 0.75, 0.05],
    [-0.62, 0.42, 0.16],
    [-0.58, -0.2, 0.32],
    [-0.3, 0.4, 0.5],
    [-0.08, 1.3, 0.42],
    [0.12, 2.05, 0.28],
    [0.9, 1.98, 0.0],
    [1.5, 1.92, -0.22],
  ];
  const blueIVC: [number, number, number][] = [
    [-1.05, -1.35, -0.25],
    [-1.12, -0.4, -0.18],
    [-1.0, 0.55, -0.02],
    [-0.7, 0.5, 0.14],
    [-0.62, 0.42, 0.16],
    [-0.58, -0.2, 0.32],
    [-0.3, 0.4, 0.5],
    [-0.08, 1.3, 0.42],
    [0.12, 2.05, 0.28],
    [0.9, 1.98, 0.0],
    [1.5, 1.92, -0.22],
  ];
  const redLeft: [number, number, number][] = [
    [1.7, 1.9, -0.6],
    [1.05, 1.5, -0.66],
    [0.7, 1.1, -0.5],
    [0.42, 0.6, -0.12],
    [0.5, -0.3, 0.0],
    [0.35, 0.35, 0.05],
    [0.26, 0.85, 0.02],
    [0.45, 1.5, -0.15],
    [0.6, 2.2, -0.35],
    [0.4, 2.95, -0.68],
    [-0.3, 3.1, -0.75],
    [-0.9, 2.5, -0.83],
    [-0.94, 1.5, -0.88],
  ];
  const redRight: [number, number, number][] = [
    [-0.55, 1.95, -0.85],
    [0.2, 1.3, -0.72],
    [0.45, 0.95, -0.45],
    [0.42, 0.6, -0.12],
    [0.5, -0.3, 0.0],
    [0.35, 0.35, 0.05],
    [0.26, 0.85, 0.02],
    [0.45, 1.5, -0.15],
    [0.6, 2.2, -0.35],
    [0.4, 2.95, -0.68],
    [-0.3, 3.1, -0.75],
    [-0.9, 2.5, -0.83],
    [-0.94, 1.5, -0.88],
  ];
  return createFlow(
    [tiltCurve(blueSVC), tiltCurve(blueIVC), tiltCurve(redLeft), tiltCurve(redRight)],
    ["#4d8dfb", "#5f9cff", "#ff5a66", "#ff7d80"],
    [70, 55, 70, 55],
    0.16,
    { fadeEnds: true },
  );
}

function buildHeart(): OrganBuild {
  const root = new THREE.Group();
  root.name = "Heart";
  const parts: BuiltPart[] = [];
  const byId = new Map(HEART_PARTS.map((part) => [part.id, part]));

  const part = (id: string) => {
    const found = byId.get(id);
    if (!found) throw new Error(`Unknown heart part ${id}`);
    return found;
  };

  const attach = (entry: OrganPart, mesh: THREE.Mesh) => {
    let rim: THREE.Mesh | undefined;
    if (entry.outer) {
      rim = new THREE.Mesh(mesh.geometry, rimMaterial(entry.color));
      rim.name = `${entry.id}-rim`;
      rim.renderOrder = 4;
      rim.visible = false;
      mesh.add(rim);
    }
    root.add(mesh);
    return rim;
  };

  /** Animated parts: geometry is local to the part; the mesh carries the
      shared tilt plus its own rotation, position and beat scale. */
  const addLocal = (
    id: string,
    geometry: THREE.BufferGeometry,
    pos: [number, number, number],
    opts: {
      scale?: [number, number, number];
      rotate?: [number, number, number];
      beat?: "atrium" | "ventricle" | "papillary" | "chordae";
      valve?: "av" | "sl";
    } = {},
  ) => {
    const entry = part(id);
    const mesh = new THREE.Mesh(geometry, partMaterial(entry));
    mesh.name = id;
    mesh.userData.partId = id;
    if (opts.scale) mesh.scale.set(...opts.scale);
    mesh.quaternion.copy(HEART_TILT_Q);
    if (opts.rotate) {
      mesh.quaternion.multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...opts.rotate)),
      );
    }
    mesh.position.copy(tiltPoint(...pos));
    const rim = attach(entry, mesh);
    parts.push({ part: entry, mesh, rim, beat: opts.beat, valve: opts.valve });
    return mesh;
  };

  /** Static parts: geometry is already tilted and positioned in heart space. */
  const addBaked = (
    id: string,
    geometry: THREE.BufferGeometry,
    opts: {
      beat?: "atrium" | "ventricle" | "papillary" | "chordae";
      valve?: "av" | "sl";
    } = {},
  ) => {
    const entry = part(id);
    const mesh = new THREE.Mesh(geometry, partMaterial(entry));
    mesh.name = id;
    mesh.userData.partId = id;
    const rim = attach(entry, mesh);
    parts.push({ part: entry, mesh, rim, beat: opts.beat, valve: opts.valve });
    return mesh;
  };

  /* (a) chambers and great vessels --------------------------------- */
  addLocal(
    "left-ventricle",
    chamberShell({ taper: 0.72, apexDx: 0.16, wall: 0.3 }),
    [0.42, -0.5, -0.08],
    { scale: [0.98, 1.62, 0.9], rotate: [0, 0, -0.05], beat: "ventricle" },
  );
  addLocal(
    "right-ventricle",
    chamberShell({ taper: 0.52, apexDx: 0.1, flattenMedial: 0.22, wall: 0.1 }),
    [-0.58, -0.36, 0.3],
    { scale: [1.08, 1.32, 1.0], rotate: [0, -0.18, 0.1], beat: "ventricle" },
  );
  addLocal("interventricular-septum", new THREE.SphereGeometry(1, 32, 26), [0.02, -0.5, -0.02], {
    scale: [0.2, 1.3, 0.8],
    rotate: [0, 0, 0.1],
    beat: "ventricle",
  });
  addLocal(
    "left-atrium",
    chamberShell({ taper: 0.22, apexDx: 0, wall: 0.1 }),
    [0.62, 1.12, -0.62],
    { scale: [0.8, 0.64, 0.68], rotate: [0, -0.3, 0.1], beat: "atrium" },
  );
  addLocal(
    "right-atrium",
    chamberShell({ taper: 0.22, apexDx: 0, wall: 0.1 }),
    [-1.15, 0.95, -0.1],
    { scale: [0.9, 0.86, 0.84], rotate: [0, 0.22, -0.08], beat: "atrium" },
  );
  addLocal("left-auricle", auricleGeometry(1.7), [1.02, 1.28, -0.18], {
    scale: [0.34, 0.26, 0.24],
    rotate: [0, -0.5, 0.35],
    beat: "atrium",
  });
  addLocal("right-auricle", auricleGeometry(0.4), [-0.9, 1.42, 0.3], {
    scale: [0.4, 0.3, 0.3],
    rotate: [0, 0.4, -0.5],
    beat: "atrium",
  });

  // The apex — the pointed tip the left ventricle forms.
  const apexGeometry = new THREE.SphereGeometry(1, 26, 20);
  apexGeometry.scale(0.3, 0.42, 0.3);
  apexGeometry.translate(0.58, -2.46, -0.08);
  apexGeometry.applyMatrix4(HEART_TILT);
  addBaked("apex", apexGeometry);

  addBaked(
    "aorta-ascending",
    heartTube(
      [
        [0.28, 0.78, 0.0],
        [0.45, 1.5, -0.12],
        [0.6, 2.2, -0.35],
      ],
      0.2,
      14,
    ),
  );
  addBaked(
    "aorta-arch",
    heartTube(
      [
        [0.6, 2.2, -0.35],
        [0.52, 2.85, -0.6],
        [0.05, 3.15, -0.72],
        [-0.55, 3.05, -0.78],
        [-0.85, 2.6, -0.82],
      ],
      0.19,
      14,
    ),
  );
  addBaked(
    "aorta-descending",
    heartTube(
      [
        [-0.85, 2.6, -0.82],
        [-0.95, 1.6, -0.88],
        [-0.9, 0.4, -0.9],
      ],
      0.16,
      12,
    ),
  );
  addBaked(
    "brachiocephalic-trunk",
    heartTube(
      [
        [-0.5, 3.0, -0.78],
        [-0.72, 3.6, -0.7],
        [-0.95, 4.1, -0.62],
      ],
      0.09,
      10,
    ),
  );
  addBaked(
    "left-common-carotid",
    heartTube(
      [
        [-0.05, 3.14, -0.74],
        [-0.02, 3.75, -0.7],
      ],
      0.07,
      10,
    ),
  );
  addBaked(
    "left-subclavian",
    heartTube(
      [
        [0.3, 3.0, -0.66],
        [0.5, 3.55, -0.6],
        [0.85, 3.9, -0.5],
      ],
      0.07,
      10,
    ),
  );
  addBaked(
    "pulmonary-trunk",
    heartTube(
      [
        [-0.2, 0.75, 0.42],
        [-0.08, 1.5, 0.4],
        [0.12, 2.05, 0.28],
      ],
      0.19,
      14,
    ),
  );
  addBaked(
    "left-pulmonary-artery",
    heartTube(
      [
        [0.12, 2.05, 0.28],
        [0.8, 2.0, 0.0],
        [1.45, 1.92, -0.25],
      ],
      0.12,
      12,
    ),
  );
  addBaked(
    "right-pulmonary-artery",
    heartTube(
      [
        [0.12, 2.05, 0.28],
        [-0.55, 2.2, -0.3],
        [-1.35, 2.18, -0.5],
      ],
      0.12,
      12,
    ),
  );
  addBaked(
    "superior-vena-cava",
    heartTube(
      [
        [-1.15, 3.3, -0.3],
        [-1.18, 2.4, -0.24],
        [-1.2, 1.5, -0.15],
      ],
      0.14,
      12,
    ),
  );
  addBaked(
    "inferior-vena-cava",
    heartTube(
      [
        [-1.05, -1.35, -0.25],
        [-1.12, -0.5, -0.2],
        [-1.16, 0.35, -0.16],
      ],
      0.13,
      12,
    ),
  );
  addBaked(
    "pulmonary-vein-lu",
    heartTube(
      [
        [1.7, 1.9, -0.6],
        [1.05, 1.5, -0.66],
      ],
      0.075,
      10,
    ),
  );
  addBaked(
    "pulmonary-vein-ll",
    heartTube(
      [
        [1.65, 0.95, -0.7],
        [0.95, 1.0, -0.68],
      ],
      0.07,
      10,
    ),
  );
  addBaked(
    "pulmonary-vein-ru",
    heartTube(
      [
        [-0.55, 1.95, -0.85],
        [0.2, 1.3, -0.72],
      ],
      0.075,
      10,
    ),
  );
  addBaked(
    "pulmonary-vein-rl",
    heartTube(
      [
        [-0.5, 1.05, -0.9],
        [0.25, 1.0, -0.72],
      ],
      0.07,
      10,
    ),
  );

  /* (b) valves and inner structures -------------------------------- */
  addLocal("tricuspid-valve", valveGeometry(0.32, 3, "av"), [-0.62, 0.42, 0.16], {
    rotate: [-0.24, 0, 0.1],
    valve: "av",
  });
  addLocal("mitral-valve", valveGeometry(0.3, 2, "av"), [0.42, 0.6, -0.12], {
    rotate: [-0.2, 0, -0.08],
    valve: "av",
  });
  addLocal("pulmonary-valve", valveGeometry(0.22, 3, "sl"), [-0.22, 0.95, 0.52], {
    rotate: [0.12, 0, 0],
    valve: "sl",
  });
  addLocal("aortic-valve", valveGeometry(0.22, 3, "sl"), [0.26, 0.9, 0.02], {
    rotate: [0.1, 0, 0],
    valve: "sl",
  });

  const lvTipA: [number, number, number] = [0.48, -1.22, 0.28];
  const lvTipB: [number, number, number] = [0.66, -1.28, -0.34];
  const rvTip: [number, number, number] = [-0.44, -0.86, 0.52];
  const papillary = merge([
    papillaryMuscleAt([0.45, -1.5, 0.28], lvTipA),
    papillaryMuscleAt([0.63, -1.56, -0.34], lvTipB),
    papillaryMuscleAt([-0.41, -1.08, 0.52], rvTip),
  ]);
  papillary.applyMatrix4(HEART_TILT);
  addBaked("papillary-muscles", papillary, { beat: "papillary" });

  const chordae: THREE.BufferGeometry[] = [];
  const mid = (
    a: [number, number, number],
    b: [number, number, number],
  ): [number, number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2 + 0.22,
    (a[2] + b[2]) / 2,
  ];
  const chord = (from: [number, number, number], to: [number, number, number]) =>
    chordae.push(tubeGeometry([from, mid(from, to), to], 0.014, 6).applyMatrix4(HEART_TILT));
  const mitralEdges: [number, number, number][] = [
    [0.2, 0.52, 0.06],
    [0.42, 0.46, -0.34],
    [0.62, 0.5, -0.02],
  ];
  const tricuspidEdges: [number, number, number][] = [
    [-0.86, 0.34, 0.3],
    [-0.42, 0.3, 0.34],
    [-0.6, 0.28, -0.1],
  ];
  for (const edge of mitralEdges) {
    chord(lvTipA, edge);
    chord(lvTipB, edge);
  }
  for (const edge of tricuspidEdges) {
    chord(rvTip, edge);
  }
  addBaked("chordae-tendineae", merge(chordae));

  /* (c) the beat is choreographed in the stage; (d) coronaries ------- */
  addBaked(
    "left-main-artery",
    heartTube(
      [
        [0.4, 1.05, 0.05],
        [0.36, 0.95, 0.3],
      ],
      0.05,
      8,
    ),
  );
  addBaked(
    "lad",
    heartTube(
      [
        [0.36, 0.95, 0.32],
        [0.1, 0.15, 0.7],
        [0.25, -0.75, 0.68],
        [0.55, -1.55, 0.5],
        [0.9, -2.1, 0.18],
      ],
      0.04,
      8,
    ),
  );
  addBaked(
    "circumflex",
    heartTube(
      [
        [0.36, 0.95, 0.3],
        [0.9, 0.85, 0.08],
        [1.18, 0.5, -0.3],
        [1.22, 0.1, -0.6],
      ],
      0.036,
      8,
    ),
  );
  addBaked(
    "right-coronary-artery",
    heartTube(
      [
        [-0.3, 1.0, 0.3],
        [-0.85, 0.75, 0.5],
        [-1.15, 0.25, 0.45],
        [-1.05, -0.4, 0.5],
        [-0.75, -0.95, 0.55],
      ],
      0.042,
      8,
    ),
  );

  const pericardium = new THREE.SphereGeometry(1, 48, 36);
  pericardium.scale(2.35, 3.05, 1.95);
  pericardium.translate(0, 0.25, -0.3);
  pericardium.applyMatrix4(HEART_TILT);
  addBaked("pericardium", pericardium);

  const cap = cutCap([ellipseCap([0, -0.2], 2.7, 3.3)], 0.1);
  cap.name = "heart-cut-cap";
  cap.renderOrder = 6;

  const flow = createHeartFlow();

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
    R * 0.05,
    { fadeEnds: true },
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
