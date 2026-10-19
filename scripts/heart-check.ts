/**
 * Offline check of the heart model at the stage's DEFAULT camera.
 *
 * Builds the heart exactly as the shared viewer does (same target radius,
 * same camera direction and fit), rasterises it into a z-buffered ASCII grid
 * and prints where every named part lands in NDC, so the layout can be
 * compared against the reference plates.
 *
 *   bun scripts/heart-check.ts
 */
import * as THREE from "three";
import { ORGAN_MODELS } from "../src/components/lab/bio/organ-model";

const TARGET_RADIUS = 1.7;
const CAM_DIR = new THREE.Vector3(0.42, 0.3, 1).normalize();

const W = 100;
const H = 40;
/* Character cells are ~2:1, so a 100x40 grid reads like a 1.25:1 frame. */
const ASPECT = (W / H) * 0.5;

const GLYPH: Record<string, string> = {
  "right-atrium": "R",
  "right-auricle": "r",
  "left-atrium": "L",
  "left-auricle": "l",
  "left-ventricle": "V",
  "right-ventricle": "W",
  "interventricular-septum": "S",
  apex: "n",
  "tricuspid-valve": "t",
  "mitral-valve": "m",
  "pulmonary-valve": "p",
  "aortic-valve": "e",
  "papillary-muscles": "x",
  "chordae-tendineae": "y",
  "aorta-ascending": "A",
  "aorta-arch": "O",
  "aorta-descending": "D",
  "brachiocephalic-trunk": "b",
  "left-common-carotid": "c",
  "left-subclavian": "u",
  "pulmonary-trunk": "T",
  "left-pulmonary-artery": "P",
  "right-pulmonary-artery": "Q",
  "superior-vena-cava": "E",
  "inferior-vena-cava": "I",
  "pulmonary-vein-lu": "1",
  "pulmonary-vein-ll": "2",
  "pulmonary-vein-ru": "3",
  "pulmonary-vein-rl": "4",
  "right-coronary-artery": "k",
  "left-main-artery": "g",
  lad: "j",
  circumflex: "f",
};

const built = ORGAN_MODELS.heart.build();

const holder = new THREE.Group();
holder.add(built.root);
const rawBox = new THREE.Box3().setFromObject(built.root);
const sphere = rawBox.getBoundingSphere(new THREE.Sphere());
const scale = TARGET_RADIUS / Math.max(0.001, sphere.radius);
holder.scale.setScalar(scale);
holder.position.copy(sphere.center).multiplyScalar(-scale);
holder.updateMatrixWorld(true);

const camera = new THREE.PerspectiveCamera(40, ASPECT, 0.1, 120);
const fit = (TARGET_RADIUS / Math.sin((camera.fov * Math.PI) / 360)) * 1.34;
camera.position.copy(CAM_DIR).multiplyScalar(fit);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const meshRecords: { id: string; mesh: THREE.Mesh }[] = [];
for (const entry of built.parts) {
  if (entry.part.outer) continue; // translucent shell: not part of the surface read
  meshRecords.push({ id: entry.part.id, mesh: entry.mesh });
}

/* ---------------------------------------------------------- projection */

const projected = new Map<string, { minU: number; maxU: number; minV: number; maxV: number; z: number }>();
const v = new THREE.Vector3();

function project(id: string, p: THREE.Vector3, matrix: THREE.Matrix4) {
  const world = v.copy(p).applyMatrix4(matrix).clone();
  const view = world.clone().applyMatrix4(camera.matrixWorldInverse);
  const ndc = world.clone().project(camera);
  let rec = projected.get(id);
  if (!rec) {
    rec = { minU: 9, maxU: -9, minV: 9, maxV: -9, z: view.z };
    projected.set(id, rec);
  }
  const u = ndc.x;
  const w = ndc.y;
  rec.minU = Math.min(rec.minU, u);
  rec.maxU = Math.max(rec.maxU, u);
  rec.minV = Math.min(rec.minV, w);
  rec.maxV = Math.max(rec.maxV, w);
  rec.z = view.z;
}

/* ---------------------------------------------------------- raster */

const zbuf = new Float32Array(W * H).fill(Infinity);
const idbuf = new Int32Array(W * H).fill(-1);

const eye = new THREE.Vector3();
const pa = new THREE.Vector3();
const pb = new THREE.Vector3();
const pc = new THREE.Vector3();

function rasterise(id: string, geometry: THREE.BufferGeometry) {
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const matrix = new THREE.Matrix4();
  const mesh = meshRecords.find((r) => r.id === id)?.mesh;
  if (mesh) matrix.copy(mesh.matrixWorld);
  const count = index ? index.count : positions.count;
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i;
    const ib = index ? index.getX(i + 1) : i + 1;
    const ic = index ? index.getX(i + 2) : i + 2;

    pa.fromBufferAttribute(positions, ia).applyMatrix4(matrix).project(camera);
    pb.fromBufferAttribute(positions, ib).applyMatrix4(matrix).project(camera);
    pc.fromBufferAttribute(positions, ic).applyMatrix4(matrix).project(camera);

    if (pa.z < -1 || pa.z > 1 || pb.z < -1 || pb.z > 1 || pc.z < -1 || pc.z > 1) continue;

    const ax = (pa.x * 0.5 + 0.5) * W;
    const ay = (0.5 - pa.y * 0.5) * H;
    const bx = (pb.x * 0.5 + 0.5) * W;
    const by = (0.5 - pb.y * 0.5) * H;
    const cx = (pc.x * 0.5 + 0.5) * W;
    const cy = (0.5 - pc.y * 0.5) * H;

    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * pa.z + w1 * pb.z + w2 * pc.z;
        const slot = y * W + x;
        if (z < zbuf[slot]) {
          zbuf[slot] = z;
          idbuf[slot] = meshRecords.findIndex((r) => r.id === id);
        }
      }
    }
  }
}

holder.updateMatrixWorld(true);
for (const record of meshRecords) {
  record.mesh.updateMatrixWorld(true);
  const geometry = record.mesh.geometry;
  rasterise(record.id, geometry);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    for (const cx of [box.min.x, box.max.x]) {
      for (const cy of [box.min.y, box.max.y]) {
        for (const cz of [box.min.z, box.max.z]) {
          eye.set(cx, cy, cz);
          project(record.id, eye, record.mesh.matrixWorld);
        }
      }
    }
  }
}

/* ---------------------------------------------------------- output */

const rows: string[] = [];
for (let y = 0; y < H; y += 1) {
  let line = "";
  for (let x = 0; x < W; x += 1) {
    const slot = y * W + x;
    const id = idbuf[slot] >= 0 ? meshRecords[idbuf[slot]].id : "";
    line += id ? (GLYPH[id] ?? "#") : "·";
  }
  rows.push(line);
}
console.log(rows.join("\n"));

console.log("\nparts (NDC: u = -1 left .. +1 right, w = -1 bottom .. +1 top):");

console.log(
  "id".padEnd(26) + "u0     u1     w0     w1     depth",
);
for (const record of meshRecords) {
  const rec = projected.get(record.id);
  if (!rec) continue;
  console.log(
    record.id.padEnd(26) +
      rec.minU.toFixed(2).padStart(6) +
      rec.maxU.toFixed(2).padStart(7) +
      rec.minV.toFixed(2).padStart(7) +
      rec.maxV.toFixed(2).padStart(7) +
      (-rec.z).toFixed(2).padStart(7),
  );
}

const size = new THREE.Box3().setFromObject(built.root).getSize(new THREE.Vector3());
console.log(
  `\nworld size x=${size.x.toFixed(2)} y=${size.y.toFixed(2)} z=${size.z.toFixed(2)}`,
);

/* Body vs pericardium, in the model's own (untilted-holder) space. */
const bodyBox = new THREE.Box3();
const periBox = new THREE.Box3();
for (const entry of built.parts) {
  entry.mesh.updateMatrix();
  entry.mesh.geometry.computeBoundingBox();
  const bb = entry.mesh.geometry.boundingBox?.clone();
  if (!bb) continue;
  bb.applyMatrix4(entry.mesh.matrix);
  if (entry.part.outer) periBox.union(bb);
  else bodyBox.union(bb);
}
const fmt = (b: THREE.Box3) =>
  `x [${b.min.x.toFixed(2)}, ${b.max.x.toFixed(2)}]  y [${b.min.y.toFixed(2)}, ${b.max.y.toFixed(2)}]  z [${b.min.z.toFixed(2)}, ${b.max.z.toFixed(2)}]`;
console.log(`body      ${fmt(bodyBox)}`);
console.log(`pericard. ${fmt(periBox)}`);
