/**
 * Builds the three organ models the Biology bench loads at runtime:
 *
 *   public/models/heart.glb   ventricles + atria + great vessels, plus a
 *                             looping "Beat" animation clip (72 bpm authored;
 *                             the stage rescales time to the BPM control)
 *   public/models/lungs.glb   trachea, bronchi and four lobes grouped into
 *                             two inflate-able "LungField*" pivots
 *   public/models/kidney.glb  an opaque "KidneyOuter" shell around a
 *                             "KidneyInterior" of pyramids, nephrons,
 *                             glomeruli, pelvis and vessels
 *
 * Run with:  bun scripts/gen-organ-models.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

/* Bun ships Blob but not FileReader, which GLTFExporter's binary path uses to
   flatten its chunk list into an ArrayBuffer. A promise-based stand-in is
   enough: the exporter always assigns `onloadend` after calling `readAs*`, and
   Blob.arrayBuffer() resolves on a later tick. */
class BunFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader ??= BunFileReader;

const OUT_DIR = join(dirname(new URL(import.meta.url).pathname), "..", "public", "models");

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function exportGLB(root: THREE.Object3D, animations: THREE.AnimationClip[], file: string) {
  return new Promise<void>((resolve, reject) => {
    // No material in these models carries a texture, so every UV set is dead
    // weight in the file — drop it before the exporter packs the buffers.
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.deleteAttribute("uv");
      mesh.geometry.deleteAttribute("uv1");
    });
    new GLTFExporter().parse(
      root,
      (result) => {
        const buf = Buffer.from(result as ArrayBuffer);
        mkdirSync(dirname(join(OUT_DIR, file)), { recursive: true });
        writeFileSync(join(OUT_DIR, file), buf);
        resolve();
      },
      (err) => reject(err),
      { binary: true, animations, trs: true, onlyVisible: false },
    );
  });
}

/** Tube along a polyline — used for the great vessels and the ureter. */
function vessel(points: [number, number, number][], r: number, color: number, name: string) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    "catmullrom",
    0.35,
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 56, r, 16, false),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.02 }),
  );
  mesh.name = name;
  return mesh;
}

function stdMat(color: number, roughness: number) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

/* ------------------------------------------------------------------ */
/* heart                                                               */
/* ------------------------------------------------------------------ */

function heartGeometry() {
  const R = 3.3;
  const geo = new THREE.SphereGeometry(R, 72, 72);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = v.y / R;
    if (ny < 0) {
      // taper toward the apex
      const k = 1 - 0.58 * Math.pow(-ny, 1.8);
      v.x *= k;
      v.z *= k;
      const t = Math.pow(-ny, 2.2);
      v.y *= 1.2;
      v.x += 1.1 * t; // apex swings to the anatomical left
      v.z -= 0.2 * t;
    } else {
      // broad, slightly flattened base where the vessels leave
      v.y *= 0.84;
      const k = 1 + 0.09 * ny;
      v.x *= k;
      v.z *= k;
    }
    // anterior interventricular groove
    if (v.z > 0) {
      const g = Math.exp(-Math.pow((v.x + 0.35) / 0.95, 2));
      v.z *= 1 - 0.15 * g * (1 - Math.min(1, Math.max(0, ny)));
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildHeart() {
  const asset = new THREE.Group();
  asset.name = "HeartAsset";
  const heart = new THREE.Group();
  heart.name = "Heart";
  asset.add(heart);

  const myo = stdMat(0xa3273a, 0.5);
  const atriaMat = stdMat(0x8d1f30, 0.55);

  const ventricles = new THREE.Mesh(heartGeometry(), myo);
  ventricles.name = "Ventricles";
  heart.add(ventricles);

  const addAtrium = (name: string, p: [number, number, number], r: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 40), atriaMat);
    m.scale.set(1.12, 0.94, 1.0);
    m.position.set(...p);
    m.name = name;
    heart.add(m);
  };
  addAtrium("AtriumRight", [-1.5, 2.1, 0.15], 1.35);
  addAtrium("AtriumLeft", [0.9, 2.25, -0.75], 1.25);

  // great vessels — red carries oxygenated blood, blue deoxygenated
  heart.add(vessel([[0.3, 1.2, -0.3], [0.5, 3.2, -0.2], [0.8, 4.8, -0.1], [1.9, 5.5, -0.4], [3.0, 4.7, -0.7], [3.3, 3.4, -0.9]], 0.5, 0xc23a4a, "Aorta"));
  heart.add(vessel([[0.4, 1.3, 1.1], [0.1, 2.8, 1.0], [-0.6, 4.0, 0.6], [-1.7, 4.4, 0.1]], 0.46, 0x3f6fd0, "PulmonaryTrunk"));
  heart.add(vessel([[-1.7, 4.6, -0.1], [-1.65, 3.3, -0.05], [-1.5, 2.3, 0.1]], 0.4, 0x3f6fd0, "VenaCavaSuperior"));
  heart.add(vessel([[-1.3, -2.8, -0.3], [-1.45, -1.0, -0.1], [-1.5, 0.9, 0.05]], 0.42, 0x3f6fd0, "VenaCavaInferior"));
  heart.add(vessel([[-2.9, 3.1, -1.5], [-1.6, 2.7, -1.2], [-0.6, 2.5, -1.0]], 0.26, 0xc23a4a, "PulmonaryVeinLeft"));
  heart.add(vessel([[2.6, 2.9, -1.6], [1.7, 2.6, -1.3], [1.0, 2.4, -1.1]], 0.26, 0xc23a4a, "PulmonaryVeinRight"));

  /* One cardiac cycle, authored at 72 bpm (0.833 s): the quick "lub" bulge,
     a settle, the softer "dub", then the quiet filling phase. The scale is
     non-uniform — the heart widens as it shortens, which is how a ventricle
     actually squeezes. */
  const DUR = 60 / 72;
  const times = [0, 0.1, 0.24, 0.4, 0.55, DUR];
  const values = [
    1, 1, 1,
    1.075, 0.955, 1.075, // lub
    1.012, 0.995, 1.012,
    1.05, 0.978, 1.05, // dub
    0.998, 1.002, 0.998,
    1, 1, 1,
  ];
  const clip = new THREE.AnimationClip("Beat", DUR, [
    new THREE.NumberKeyframeTrack("Heart.scale", times, values),
  ]);

  return { asset, clip };
}

/* ------------------------------------------------------------------ */
/* lungs                                                               */
/* ------------------------------------------------------------------ */

interface LobeSpec {
  rx: number;
  ry: number;
  rz: number;
  /** +1 flattens the +x face (right lung), −1 the −x face (left lung). */
  sign: 1 | -1;
  notch?: { center: [number, number, number]; radius: number; depth: number };
  seed: number;
}

/** Unit sphere → one lung lobe: lobular ripple, flattened mediastinal face,
    optional cardiac-notch carve, then scaled to its final radii. */
function lobeGeometry(spec: LobeSpec) {
  const { rx, ry, rz, sign, notch, seed } = spec;
  const geo = new THREE.SphereGeometry(1, 48, 48);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ripple =
      1 +
      0.03 * Math.sin(v.x * 7.4 + seed) * Math.cos(v.y * 6.1 - seed) +
      0.018 * Math.sin(v.z * 9.2 + seed * 1.7);
    v.multiplyScalar(ripple);

    // mediastinal face is flat where the two lungs face each other
    const mv = sign * v.x;
    if (mv > 0.45) v.x = sign * (0.45 + (mv - 0.45) * 0.3);

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
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildLungs() {
  const asset = new THREE.Group();
  asset.name = "LungsAsset";
  const lungMat = stdMat(0xf0a3ae, 0.6);
  const airwayMat = stdMat(0xe9d8cf, 0.5);
  const ringMat = stdMat(0xd6e2ec, 0.42);

  /* trachea with C-shaped cartilage rings + carina */
  const airway = new THREE.Group();
  airway.name = "Airway";
  asset.add(airway);

  const trachea = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 3.8, 26), airwayMat);
  trachea.position.y = 5.5;
  trachea.name = "Trachea";
  airway.add(trachea);
  for (let i = 0; i < 8; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 10, 30, Math.PI * 1.62), ringMat);
    ring.position.y = 3.95 + i * 0.46;
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = -Math.PI * 0.31; // gap faces posterior
    airway.add(ring);
  }
  const carina = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), airwayMat);
  carina.position.y = 3.55;
  carina.scale.set(1.4, 0.8, 1.1);
  carina.name = "Carina";
  airway.add(carina);

  airway.add(vessel([[0, 3.6, 0], [-1.1, 3.1, 0], [-2.1, 2.5, -0.15]], 0.34, 0xe9d8cf, "BronchusRight"));
  airway.add(vessel([[0, 3.6, 0], [1.1, 3.1, 0], [2.05, 2.45, -0.15]], 0.34, 0xe9d8cf, "BronchusLeft"));
  airway.add(vessel([[-2.1, 2.5, -0.15], [-2.45, 1.7, -0.1]], 0.2, 0xe9d8cf, "BronchioleRight"));
  airway.add(vessel([[2.05, 2.45, -0.15], [2.4, 1.6, -0.1]], 0.2, 0xe9d8cf, "BronchioleLeft"));

  /* two lung fields — each a pivot the stage scales in place, so inflation
     expands the lobes about their own centre instead of flinging them apart */
  const fieldR = new THREE.Group();
  fieldR.name = "LungFieldR";
  fieldR.position.set(-2.45, -0.1, -0.1);
  asset.add(fieldR);
  const rightSuperior = new THREE.Mesh(
    lobeGeometry({ rx: 1.95, ry: 2.0, rz: 1.6, sign: 1, seed: 1.3 }),
    lungMat,
  );
  rightSuperior.name = "LobeRSuperior";
  rightSuperior.position.set(0, 2.1, 0.1);
  fieldR.add(rightSuperior);
  const rightInferior = new THREE.Mesh(
    lobeGeometry({ rx: 2.0, ry: 2.2, rz: 1.78, sign: 1, seed: 2.6 }),
    lungMat,
  );
  rightInferior.name = "LobeRInferior";
  rightInferior.position.set(0.05, -1.7, -0.2);
  fieldR.add(rightInferior);

  const fieldL = new THREE.Group();
  fieldL.name = "LungFieldL";
  fieldL.position.set(2.4, -0.1, -0.1);
  asset.add(fieldL);
  const leftSuperior = new THREE.Mesh(
    lobeGeometry({
      rx: 1.8,
      ry: 2.0,
      rz: 1.55,
      sign: -1,
      seed: 3.9,
      // cardiac notch — the bite the heart presses into the left lung
      notch: { center: [-0.5, -0.7, 1.35], radius: 1.25, depth: 0.85 },
    }),
    lungMat,
  );
  leftSuperior.name = "LobeLSuperior";
  leftSuperior.position.set(0, 2.0, 0.1);
  fieldL.add(leftSuperior);
  const leftInferior = new THREE.Mesh(
    lobeGeometry({ rx: 1.85, ry: 2.2, rz: 1.72, sign: -1, seed: 5.2 }),
    lungMat,
  );
  leftInferior.name = "LobeLInferior";
  leftInferior.position.set(0.03, -1.7, -0.2);
  fieldL.add(leftInferior);

  return asset;
}

/* ------------------------------------------------------------------ */
/* kidney                                                              */
/* ------------------------------------------------------------------ */

function buildKidney() {
  const asset = new THREE.Group();
  asset.name = "KidneyAsset";

  /* opaque shell: bean with the hilum notched into the medial (+x) border */
  const shellGeo = new THREE.SphereGeometry(3.4, 72, 72);
  {
    const pos = shellGeo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const H = new THREE.Vector3(2.7, 0.1, 0);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.z *= 0.6; // kidneys are flattened front-to-back
      v.y *= 1.2;
      const d = v.distanceTo(H);
      if (d < 2.4) {
        const t = 1 - d / 2.4;
        const s = t * t * (3 - 2 * t);
        v.x -= 1.7 * s; // concave medial border
        v.z *= 1 - 0.35 * s;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    shellGeo.computeVertexNormals();
  }
  const shell = new THREE.Mesh(shellGeo, stdMat(0x9d3f47, 0.52));
  shell.name = "KidneyOuter";
  asset.add(shell);

  const interior = new THREE.Group();
  interior.name = "KidneyInterior";
  asset.add(interior);

  const P = new THREE.Vector3(1.5, 0, 0); // pelvis / papilla convergence point
  const C = new THREE.Vector3(-0.4, 0, 0);

  /* renal pyramids (medulla): bases face the cortex, papillae aim at the pelvis */
  const pyramidMat = stdMat(0xcf8f52, 0.55);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 6; i++) {
    const a = -1.25 + i * 0.5;
    const Q = new THREE.Vector3(C.x + 2.35 * Math.cos(a), C.y + 3.1 * Math.sin(a), 0.1 * Math.sin(i * 2.1));
    const dir = P.clone().sub(Q);
    const len = dir.length();
    dir.normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, Math.min(2.4, len * 0.62), 22), pyramidMat);
    cone.quaternion.setFromUnitVectors(up, dir);
    cone.position.copy(Q).addScaledVector(dir, Math.min(2.4, len * 0.62) / 2 + 0.35);
    cone.name = `RenalPyramid_${i + 1}`;
    interior.add(cone);
  }

  /* nephrons: glomerulus in the cortex, convoluted tubule, loop of Henle
     dipping into a pyramid, collecting duct draining into the papilla */
  const glomMat = stdMat(0x34d399, 0.4);
  const tubuleMat = stdMat(0xfbbf24, 0.45);
  for (let i = 0; i < 5; i++) {
    const a = -1.15 + i * 0.58;
    const G = new THREE.Vector3(C.x + 2.05 * Math.cos(a), C.y + 2.75 * Math.sin(a), 0.45 * Math.cos(i * 1.7));
    const glom = new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 22), glomMat);
    glom.position.copy(G);
    glom.name = `Glomerulus_${i + 1}`;
    interior.add(glom);

    const dir = P.clone().sub(G).normalize();
    const off = (i % 2 === 0 ? 1 : -1) * (0.5 + 0.25 * (i % 3));
    const pts: THREE.Vector3[] = [];
    // proximal convoluted tubule: a tight coil around the glomerulus
    for (let s = 0; s <= 5; s++) {
      const ang = (s / 5) * Math.PI * 1.9 + i;
      pts.push(G.clone().add(new THREE.Vector3(Math.cos(ang) * 0.42, Math.sin(ang) * 0.42, 0.18 * s * 0.1)));
    }
    // loop of Henle — out into the pyramid, hairpin, then back up
    pts.push(G.clone().addScaledVector(dir, 1.15));
    pts.push(C.clone().lerp(P, 0.55).add(new THREE.Vector3(0, off, 0.85)));
    pts.push(C.clone().lerp(P, 0.72).add(new THREE.Vector3(0, off * 0.9, -0.35)));
    // collecting duct into the papilla
    pts.push(P.clone().add(new THREE.Vector3(-0.3, off * 0.5, 0.25)));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.3);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.085, 8, false), tubuleMat);
    tube.name = `Nephron_${i + 1}`;
    interior.add(tube);
  }

  /* renal pelvis + ureter leaving through the hilum */
  const pelvis = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.9, 24, 1, true), stdMat(0xe6d4b8, 0.55));
  pelvis.name = "RenalPelvis";
  pelvis.quaternion.setFromUnitVectors(up, new THREE.Vector3(1, -0.15, 0).normalize());
  pelvis.position.set(1.7, -0.1, 0);
  interior.add(pelvis);
  const ureter = vessel([[2.3, -0.45, 0], [3.4, -1.1, 0.1], [4.2, -2.2, 0.15]], 0.3, 0xe6d4b8, "Ureter");
  interior.add(ureter);

  /* renal artery + vein entering at the hilum */
  interior.add(vessel([[4.1, 1.0, 0.3], [3.0, 0.75, 0.2], [2.1, 0.5, 0.1]], 0.24, 0xb83a3a, "RenalArtery"));
  interior.add(vessel([[4.1, 0.2, -0.45], [3.0, 0.0, -0.35], [2.0, -0.1, -0.25]], 0.28, 0x3f6fd0, "RenalVein"));

  return asset;
}

/* ------------------------------------------------------------------ */
/* export + structural self-check                                      */
/* ------------------------------------------------------------------ */

function readGlbJson(path: string) {
  const buf = Buffer.from(require("node:fs").readFileSync(path));
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8")) as {
    nodes?: { name?: string }[];
    meshes?: unknown[];
    animations?: { name: string; channels: { target: { node: number; path: string } }[] }[];
    accessors: { min?: number[]; max?: number[]; count: number }[];
  };
}

const checks: string[] = [];

function check(file: string, fn: (json: ReturnType<typeof readGlbJson>) => void) {
  const json = readGlbJson(join(OUT_DIR, file));
  fn(json);
  checks.push(`${file}: ${json.nodes?.length ?? 0} nodes, ${json.meshes?.length ?? 0} meshes, anim [${(json.animations ?? []).map((a) => a.name).join(", ")}] — ok`);
}

const heart = buildHeart();
await exportGLB(heart.asset, [heart.clip], "heart.glb");
await exportGLB(buildLungs(), [], "lungs.glb");
await exportGLB(buildKidney(), [], "kidney.glb");

check("heart.glb", (json) => {
  const names = (json.nodes ?? []).map((n) => n.name);
  if (!names.includes("Heart")) throw new Error("heart.glb: missing Heart node");
  const beat = json.animations?.find((a) => a.name === "Beat");
  if (!beat) throw new Error("heart.glb: missing Beat animation");
  const target = json.nodes![beat.channels[0].target.node];
  if (target?.name !== "Heart" || beat.channels[0].target.path !== "scale")
    throw new Error("heart.glb: Beat does not target Heart.scale");
});

check("lungs.glb", (json) => {
  const names = (json.nodes ?? []).map((n) => n.name);
  for (const required of ["LungFieldR", "LungFieldL", "Trachea", "LobeRSuperior", "LobeLInferior"]) {
    if (!names.includes(required)) throw new Error(`lungs.glb: missing ${required}`);
  }
});

check("kidney.glb", (json) => {
  const names = (json.nodes ?? []).map((n) => n.name);
  if (!names.includes("KidneyOuter")) throw new Error("kidney.glb: missing KidneyOuter");
  if (!names.includes("KidneyInterior")) throw new Error("kidney.glb: missing KidneyInterior");
  const nephrons = names.filter((n) => n?.startsWith("Nephron_")).length;
  if (nephrons !== 5) throw new Error(`kidney.glb: expected 5 nephrons, got ${nephrons}`);
  // every POSITION accessor must carry min/max per the glTF spec
  for (const acc of json.accessors) {
    if (!acc.min || !acc.max) throw new Error("kidney.glb: accessor missing min/max");
  }
});

for (const f of ["heart.glb", "lungs.glb", "kidney.glb"]) {
  const size = require("node:fs").statSync(join(OUT_DIR, f)).size;
  checks.push(`${f}: ${(size / 1024).toFixed(1)} KB`);
}
console.log(checks.join("\n"));
