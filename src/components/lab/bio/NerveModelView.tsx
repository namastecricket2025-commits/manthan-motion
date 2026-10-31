import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Maximize2 } from "lucide-react";

/**
 * The nervous system in three dimensions.
 *
 * The plate beside this is a figure — hairline ink, every structure named, the
 * right thing for a class 8 to 10 student to revise from. This view is the
 * other half of the same lesson: a cell you can turn over, and a reflex loop
 * that runs in the round, so "the cord answers before the brain" is a thing you
 * can watch rather than a sentence you have to believe.
 *
 * The neuron is modelled here: a soma with its nucleus and Nissl bodies, a
 * tapering dendritic arbor, six myelin internodes with their Schwann cells, the
 * nodes between them, and a terminal arbor of boutons facing a postsynaptic
 * membrane. The reflex loop uses a real NIH Human Reference Atlas spinal-cord
 * segment (public/models/spinal-cord.glb) with the grey-matter butterfly inside
 * it and modelled roots, ganglion, skin and muscle.
 *
 * Time and the impulse live in the plate's state, not here: `progress` is the
 * same 0…1 the plate's dot travels, already stepped between nodes when myelin
 * is on, so both views show the same instant of the same event.
 */

type Props = {
  mode: "neuron" | "reflex";
  myelin: boolean;
  phase: number;
  fired: boolean;
};

const SIGNAL = "#ffb347";

/** Where the modelled axon begins and ends along the pulse path. */
const AXON_FROM = 0.27;
const AXON_TO = 0.9;

/** Dwell at a node, cross to the next: the sheath only lets current leak at
 *  the gaps, so the impulse seems to jump rather than glide. */
function stepped(t: number, segments: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const x = clamped * segments;
  const i = Math.min(segments - 1, Math.floor(x));
  const f = x - i;
  const eased = f < 0.24 ? 0 : f > 0.76 ? 1 : (f - 0.24) / 0.52;
  return (i + Math.min(1, Math.max(0, eased))) / segments;
}

function membrane(color: string, opts: { opacity?: number; roughness?: number } = {}) {
  const opacity = opts.opacity ?? 1;
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.62,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
  });
}

/** A swept tube along a polyline, with a radius that may taper. */
function tube(points: THREE.Vector3[], radius: number | ((t: number) => number), radial = 10, tubular = 56) {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
  const at = typeof radius === "function" ? radius : () => radius;
  const frames = curve.computeFrenetFrames(tubular, false);
  const spaced = curve.getSpacedPoints(tubular);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= tubular; i += 1) {
    const t = i / tubular;
    const r = at(t);
    const p = spaced[i];
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(
        p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * r,
        p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * r,
        p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * r,
      );
    }
  }
  for (let i = 0; i < tubular; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A lumpy sphere; `squash` flattens it toward the given axes. */
function blob(r: number, seed: number, squash: [number, number, number] = [1, 1, 1], detail = 20) {
  const geometry = new THREE.SphereGeometry(r, detail, Math.round(detail * 0.75));
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const n = 1 + 0.06 * Math.sin(v.x * 9 + seed) * Math.cos(v.y * 7 - seed) + 0.04 * Math.sin(v.z * 11 + seed * 1.7);
    position.setXYZ(i, v.x * n * squash[0], v.y * n * squash[1], v.z * n * squash[2]);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Built = {
  path: THREE.CatmullRomCurve3;
  targets: THREE.Object3D[];
  muscle?: THREE.Group;
  ends?: THREE.Object3D[];
};

/* ------------------------------------------------------------------ */
/* the neuron                                                          */
/* ------------------------------------------------------------------ */

const AXON_START = 0.62;
const AXON_END = 7.55;
const INTERNODES = 6;

function buildNeuron(root: THREE.Group): Built {
  const somaMaterial = membrane("#c9a494", { roughness: 0.55 });
  const deepMaterial = membrane("#8d6470", { roughness: 0.6 });
  const axonMaterial = membrane("#b08272", { roughness: 0.58 });
  /* Opaque myelin reads as a sheath, not a string of bubbles. The pulse is
     drawn over it (depth test off), so it stays visible without transparency
     sorting artefacts. */
  const myelinMaterial = membrane("#efe4d6", { roughness: 0.42 });
  const boutonMaterial = membrane("#d8bd93", { roughness: 0.5 });
  const myelin: THREE.Object3D[] = [];
  const ends: THREE.Object3D[] = [];

  /* Dendrites: a seeded arbor, tapering at every fork. Eight trunks is enough
     for a cell you can read; a real one has thousands of synapses. */
  let seed = 0x2f6b;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, length: number, radius: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, length);
    const mid = from.clone().lerp(to, 0.5).add(V((rnd() - 0.5) * 0.22, (rnd() - 0.5) * 0.22, (rnd() - 0.5) * 0.22));
    root.add(new THREE.Mesh(tube([from, mid, to], (t) => radius * (1 - 0.45 * t), 6, 12), somaMaterial));
    if (depth === 0) return;
    const children = depth === 3 ? 3 : 2;
    for (let i = 0; i < children; i += 1) {
      const turn = dir.clone().add(V((rnd() - 0.5) * 1.1, (rnd() - 0.5) * 1.1, (rnd() - 0.5) * 1.1)).normalize();
      grow(to, turn, length * (0.62 + rnd() * 0.12), radius * 0.58, depth - 1);
    }
  };
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const tilt = -0.35 + rnd() * 0.9;
    const dir = V(-1, Math.sin(angle) * 0.85, Math.cos(angle) * 0.85).normalize();
    dir.y += tilt * 0.24;
    grow(V(-0.3, Math.sin(angle) * 0.22, Math.cos(angle) * 0.22), dir.normalize(), 1.15, 0.1, 3);
  }
  /* A couple of trunks pointing back and up, so the arbor is not a flat fan. */
  grow(V(-0.18, 0.32, 0.1), V(-0.5, 0.9, -0.4).normalize(), 1.0, 0.085, 2);
  grow(V(-0.1, -0.3, -0.12), V(-0.55, -0.85, 0.35).normalize(), 0.95, 0.08, 2);

  /* Soma, nucleus, nucleolus, Nissl bodies. */
  const soma = new THREE.Mesh(blob(0.52, 3.1, [1.08, 1, 0.98], 34), membrane("#c9a494", { roughness: 0.5, opacity: 0.94 }));
  root.add(soma);
  root.add(new THREE.Mesh(blob(0.27, 1.4, [1.05, 1, 1], 24), deepMaterial));
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), membrane("#5f3d48", { roughness: 0.4 })));
  const nissl = membrane("#7d5460", { roughness: 0.6 });
  for (let i = 0; i < 9; i += 1) {
    const a = rnd() * Math.PI * 2;
    const b = rnd() * Math.PI - Math.PI / 2;
    const p = V(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)).multiplyScalar(0.4);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.035 + rnd() * 0.025, 8, 6), nissl);
    body.position.copy(p);
    body.scale.set(1.5, 1, 1);
    root.add(body);
  }

  /* Axon hillock, then the fibre itself. */
  const hillock = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.5, 20, 1, true),
    membrane("#b08272", { roughness: 0.6 }),
  );
  hillock.position.set(0.55, 0, 0);
  hillock.rotation.z = -Math.PI / 2;
  root.add(hillock);

  root.add(
    new THREE.Mesh(
      tube([V(AXON_START, 0, 0), V(3.8, 0.03, 0), V(AXON_END, 0, 0)], (t) => 0.085 - 0.02 * t, 14, 90),
      axonMaterial,
    ),
  );

  /* Six internodes. Each is a long, thin capsule with its own Schwann cell and
     a narrow node at each end; the old fat capsules read as beads on a string. */
  const span = (AXON_END - AXON_START) / INTERNODES;
  for (let i = 0; i < INTERNODES; i += 1) {
    const x = AXON_START + span * (i + 0.5);
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.145, span - 0.34, 10, 18),
      myelinMaterial,
    );
    capsule.rotation.z = Math.PI / 2;
    capsule.position.set(x, 0, 0);
    root.add(capsule);
    myelin.push(capsule);

    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), deepMaterial);
    nucleus.position.set(x + 0.1, 0.2, 0.05);
    nucleus.scale.set(1.5, 1, 1);
    root.add(nucleus);
    myelin.push(nucleus);
  }

  /* Terminal arbor: one axon, seven contacts, each a bouton on the membrane of
     the next cell. */
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const end = V(AXON_END + 0.95, Math.sin(angle) * 0.62, Math.cos(angle) * 0.62);
    const mid = V(AXON_END + 0.4, Math.sin(angle) * 0.28, Math.cos(angle) * 0.28);
    root.add(new THREE.Mesh(tube([V(AXON_END, 0, 0), mid, end], 0.035, 6, 14), axonMaterial));
    const bouton = new THREE.Mesh(blob(0.14, i, [1.25, 1, 1], 14), boutonMaterial);
    bouton.position.copy(end);
    root.add(bouton);
    ends.push(bouton);
  }

  /* The postsynaptic membrane, across the cleft. A solid curved surface with
     receptor knobs reads as the next cell; a translucent grey panel read as a
     floating rectangle. */
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 1.02, 1.5, 30, 1, true, -1.1, 2.2),
    membrane("#b78d86", { roughness: 0.7 }),
  );
  post.position.set(AXON_END + 1.12, 0, 0);
  root.add(post);
  const receptorMat = membrane("#8fb8ad", { roughness: 0.45 });
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const receptor = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), receptorMat);
    receptor.position.set(AXON_END + 1.0, Math.sin(angle) * 0.74, Math.cos(angle) * 0.74);
    root.add(receptor);
  }

  const path = new THREE.CatmullRomCurve3(
    [V(-2.4, 1.05, 0.5), V(-1.3, 0.6, 0.3), V(-0.5, 0.1, 0), V(0.4, 0, 0), V(3.8, 0, 0), V(AXON_END, 0, 0), V(AXON_END + 1.0, 0.35, 0.1)],
    false,
    "catmullrom",
    0.35,
  );
  return { path, targets: myelin, ends };
}

/* ------------------------------------------------------------------ */
/* the reflex loop                                                     */
/* ------------------------------------------------------------------ */

const CORD_URL = "/models/spinal-cord.glb";

function buildReflex(root: THREE.Group, onCord?: (mesh: THREE.Mesh) => void): Built {
  const nerveMaterial = membrane("#b08272", { roughness: 0.55 });
  const myelinMaterial = membrane("#efe4d6", { roughness: 0.42 });
  const cordMaterial = membrane("#b79080", { roughness: 0.62, opacity: 0.6 });
  const greyMaterial = membrane("#8b6370", { roughness: 0.66, opacity: 0.85 });
  const muscleMaterial = membrane("#b06f66", { roughness: 0.6 });
  const myelin: THREE.Object3D[] = [];

  /* Skin, in section: a compact three-layer pad, cut open so the ending inside
     is visible. It used to be three translucent slabs nearly 3 units tall and
     2 deep, which read as a pile of glass boxes rather than tissue and made
     the whole diagram look like a mistake. */
  const skin = new THREE.Group();
  skin.position.set(-5.18, 0, 0);
  const layers: Array<[number, string, number]> = [
    [0.1, "#cdab97", 0.55],
    [0.3, "#bb8b7c", 0.72],
    [0.24, "#a97a70", 0.82],
  ];
  let x = -0.32;
  for (const [width, colour, opacity] of layers) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1.62, 0.92),
      membrane(colour, { roughness: 0.78, opacity }),
    );
    slab.position.set(x + width / 2, 0, 0);
    skin.add(slab);
    x += width;
  }
  root.add(skin);

  /* One branched free ending, inside the dermis. */
  const receptorBase = V(-4.85, 0.35, 0);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const tip = V(receptorBase.x - 0.28 - (i % 2) * 0.12, 0.35 + Math.sin(angle) * 0.55, Math.cos(angle) * 0.5);
    root.add(new THREE.Mesh(tube([receptorBase, receptorBase.clone().lerp(tip, 0.55), tip], 0.018, 5, 10), nerveMaterial));
  }

  /* Sensory fibre, with a myelin sheath and the dorsal root ganglion. */
  const sensory = [receptorBase, V(-3.9, 0.36, 0), V(-2.4, 0.42, 0), V(-1.2, 0.5, 0), V(-0.55, 0.55, 0)];
  root.add(new THREE.Mesh(tube(sensory, 0.07, 10, 70), nerveMaterial));

  const ganglion = new THREE.Mesh(blob(0.34, 5.2, [1.55, 0.9, 0.9], 22), membrane("#c9a494", { roughness: 0.52 }));
  ganglion.position.set(-2.05, 0.44, 0);
  root.add(ganglion);
  root.add(
    (() => {
      const cell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), membrane("#7d5460", { roughness: 0.45 }));
      cell.position.set(-2.02, 0.56, 0.06);
      return cell;
    })(),
  );

  for (const [centre, length] of [
    [-3.5, 0.85],
    [-2.85, 0.55],
    [-1.45, 0.8],
  ] as Array<[number, number]>) {
    /* A sheath only slightly wider than the fibre: the old 0.16-radius
       capsules were twice the axon's diameter and read as beads on a string. */
    const sheath = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, length, 8, 16), myelinMaterial);
    sheath.rotation.z = Math.PI / 2;
    sheath.position.set(centre, 0.38 + (centre + 3.5) * 0.045, 0);
    root.add(sheath);
    myelin.push(sheath);
  }

  /* The cord. A real HRA segment stands in for the whole; the grey-matter
     butterfly is modelled inside it, because a surface scan cannot show it.
     It is a compact segment, not a trunk: the old 0.92 × 2.9 cylinder was
     wider than every other structure in the loop and swallowed the fibres. */
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 2.3, 32, 1, false),
    cordMaterial,
  );
  root.add(cord);
  /* Grey matter: one butterfly in the cord's cross-section, the shape every
     textbook draws, held upright inside the translucent segment. */
  const half: Array<[number, number]> = [
    [0, 0.52], [0.1, 0.5], [0.2, 0.46], [0.3, 0.42], [0.38, 0.34], [0.42, 0.24],
    [0.4, 0.15], [0.32, 0.1], [0.2, 0.08], [0.12, 0.06],
    [0.18, -0.02], [0.26, -0.16], [0.34, -0.3], [0.38, -0.42], [0.34, -0.52],
    [0.24, -0.56], [0.12, -0.54], [0.04, -0.48], [0, -0.46],
  ];
  const outline: Array<[number, number]> = [
    ...half,
    ...half.slice(1, -1).reverse().map(([hx, hy]) => [-hx, hy] as [number, number]),
  ];
  const greyShape = new THREE.Shape();
  greyShape.moveTo(outline[0][0], outline[0][1]);
  for (const [hx, hy] of outline.slice(1)) greyShape.lineTo(hx, hy);
  greyShape.closePath();
  const canalHole = new THREE.Path();
  canalHole.absarc(0, -0.02, 0.035, 0, Math.PI * 2, true);
  greyShape.holes.push(canalHole);
  const grey = new THREE.Mesh(
    new THREE.ExtrudeGeometry(greyShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      bevelSegments: 2,
      curveSegments: 6,
    }),
    greyMaterial,
  );
  grey.rotation.x = -Math.PI / 2;
  grey.position.set(0, 0.02, 0);
  root.add(grey);

  /* Roots: three rootlets each way, as a real segment has. */
  for (let i = 0; i < 3; i += 1) {
    const y = 0.12 + i * 0.16;
    root.add(
      new THREE.Mesh(
        tube([V(0.05, y, 0.22 - i * 0.12), V(-0.4, y + 0.06, 0.16 - i * 0.08), V(-0.62, y + 0.1, 0)], 0.035, 6, 16),
        nerveMaterial,
      ),
    );
    root.add(
      new THREE.Mesh(
        tube([V(0.05, -y - 0.28, 0.2 - i * 0.12), V(0.4, -y - 0.22, 0.14 - i * 0.08), V(0.66, -y - 0.18, 0)], 0.035, 6, 16),
        nerveMaterial,
      ),
    );
  }

  /* The interneuron that closes the loop inside the grey matter. */
  root.add(
    new THREE.Mesh(
      tube([V(-0.5, 0.4, 0), V(-0.1, 0.05, 0.02), V(0.24, -0.36, 0), V(0.5, -0.5, 0)], 0.03, 6, 26),
      membrane("#d3a07c", { roughness: 0.5, opacity: 0.9 }),
    ),
  );

  /* Motor fibre out through the ventral root, to a muscle spindle. */
  const motor = [V(0.66, -0.72, 0), V(1.6, -0.66, 0), V(2.9, -0.58, 0), V(4.15, -0.52, 0)];
  root.add(new THREE.Mesh(tube(motor, 0.07, 10, 60), nerveMaterial));
  for (const [centre, length] of [
    [1.55, 0.9],
    [3.3, 0.85],
  ] as Array<[number, number]>) {
    const sheath = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, length, 8, 16), myelinMaterial);
    sheath.rotation.z = Math.PI / 2;
    sheath.position.set(centre, -0.68 + (centre - 1.55) * 0.06, 0);
    root.add(sheath);
    myelin.push(sheath);
  }

  const muscle = new THREE.Group();
  muscle.position.set(4.75, -0.5, 0);
  const belly = new THREE.Mesh(blob(0.62, 2.6, [1.55, 0.6, 0.6], 26), muscleMaterial);
  muscle.add(belly);
  for (let i = 0; i < 3; i += 1) {
    const fibre = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 1.45, 6, 10),
      membrane("#c98f80", { roughness: 0.6 }),
    );
    fibre.rotation.z = Math.PI / 2;
    fibre.position.set(0, -0.16 + i * 0.16, 0.05 - i * 0.04);
    muscle.add(fibre);
  }
  for (const sx of [-1, 1]) {
    const tendon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.13, 0.5, 12),
      membrane("#d9cbb4", { roughness: 0.7 }),
    );
    tendon.rotation.z = Math.PI / 2;
    tendon.position.set(sx * 1.08, 0, 0);
    muscle.add(tendon);
  }
  root.add(muscle);

  const path = new THREE.CatmullRomCurve3(
    [
      V(-5.0, 0.3, 0),
      V(-4.2, 0.36, 0),
      V(-3.2, 0.4, 0),
      V(-2.05, 0.44, 0),
      V(-1.0, 0.52, 0),
      V(-0.35, 0.25, 0),
      V(-0.05, -0.05, 0.05),
      V(0.35, -0.45, 0),
      V(1.2, -0.62, 0),
      V(3.0, -0.56, 0),
      V(4.3, -0.5, 0),
      V(4.55, -0.5, 0),
    ],
    false,
    "catmullrom",
    0.3,
  );

  /* The real segment replaces the stand-in cylinder when it arrives. */
  try {
  new GLTFLoader().load(
    CORD_URL,
    (gltf) => {
      let picked: THREE.Mesh | null = null;
      gltf.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!picked && /thoracic|segment/i.test(mesh.name)) picked = mesh;
      });
      const source = picked ?? (gltf.scene.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined);
      if (!source) return;
    const geometry = source.geometry.clone();
    source.updateWorldMatrix(true, false);
    geometry.applyMatrix4(source.matrixWorld);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const height = box.max.y - box.min.y;
      const k = 2.9 / Math.max(height, 0.0001);
      const centreX = (box.min.x + box.max.x) / 2;
      const centreZ = (box.min.z + box.max.z) / 2;
      const centreY = (box.min.y + box.max.y) / 2;
      geometry.translate(-centreX, -centreY, -centreZ);
      const real = new THREE.Mesh(geometry, cordMaterial);
      real.scale.setScalar(k);
      real.position.y = -0.02;
      root.add(real);
      cord.visible = false;
      onCord?.(real);
    },
    undefined,
    () => undefined,
  );
  } catch {
    /* No loader available: the modelled segment stands in. */
  }

  return { path, targets: myelin, muscle };
}

/* ------------------------------------------------------------------ */
/* the view                                                            */
/* ------------------------------------------------------------------ */

export default function NerveModelView({ mode, myelin, phase, fired }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const ctl = useRef({ phase: 0, fired: false, myelin: true });

  useEffect(() => {
    ctl.current.phase = phase;
  }, [phase]);
  useEffect(() => {
    ctl.current.fired = fired;
  }, [fired]);
  useEffect(() => {
    ctl.current.myelin = myelin;
  }, [myelin]);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    setReady(false);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.4;
    controls.maxDistance = 40;

    scene.add(new THREE.HemisphereLight(0xfff4ea, 0x241a1c, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(5, 7, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd9c0, 0.5);
    fill.position.set(-6, 1, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xcfe4ff, 0.6);
    rim.position.set(-2, 4, -7);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);
    const built: Built = mode === "neuron" ? buildNeuron(root) : buildReflex(root);
    root.updateMatrixWorld(true);

    /* Numbered pins on the reflex loop. The structures panel beside the model
       is already numbered 1–6; without pins those numbers pointed at nothing.
       Each pin is a plain span moved in the render loop, so the labels cost no
       React renders. */
    const pins: Array<{ node: HTMLSpanElement; at: THREE.Vector3 }> = [];
    if (mode === "reflex") {
      const anchors: Array<[string, [number, number, number]]> = [
        ["1", [-4.92, 0.34, 0.1]],
        ["2", [-2.05, 0.46, 0.3]],
        ["3", [-3.18, 0.4, 0.06]],
        ["4", [0, 0.14, 0.68]],
        ["5", [2.35, -0.58, 0.08]],
        ["6", [4.75, -0.5, 0]],
      ];
      for (const [label, at] of anchors) {
        const node = document.createElement("span");
        node.className = "nerve-pin";
        node.textContent = label;
        node.setAttribute("aria-hidden", "true");
        el.appendChild(node);
        pins.push({ node, at: new THREE.Vector3(...at) });
      }
    }

    const pulse = new THREE.Group();
    pulse.renderOrder = 10;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 12),
      new THREE.MeshBasicMaterial({ color: SIGNAL, depthTest: false, depthWrite: false }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      new THREE.MeshBasicMaterial({
        color: SIGNAL,
        transparent: true,
        opacity: 0.22,
        depthTest: false,
        depthWrite: false,
      }),
    );
    pulse.add(core, halo);
    scene.add(pulse);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    /* Frame the whole figure, whatever axis it grew along: pull the camera
       back along a three-quarter direction until every corner of the bounding
       box projects inside the frame. A fixed distance would crop the axon. */
    const box = new THREE.Box3().setFromObject(root);
    const centre = box.getCenter(new THREE.Vector3());
    const corners = [
      [box.min.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.min.z],
      [box.min.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.min.z],
      [box.min.x, box.min.y, box.max.z], [box.max.x, box.min.y, box.max.z],
      [box.min.x, box.max.y, box.max.z], [box.max.x, box.max.y, box.max.z],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const direction = new THREE.Vector3(0.34, 0.26, 1).normalize();
    const fit = () => {
      let distance = Math.max(3, box.getSize(new THREE.Vector3()).length());
      controls.target.copy(centre);
      for (let attempt = 0; attempt < 44; attempt += 1) {
        camera.position.copy(centre).addScaledVector(direction, distance);
        camera.lookAt(centre);
        camera.updateMatrixWorld(true);
        const fits = corners.every((corner) => {
          const projected = corner.clone().project(camera);
          return Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92 && projected.z < 1;
        });
        if (fits) break;
        distance *= 1.06;
      }
      controls.update();
    };
    fitRef.current = fit;
    fit();

    const applyMyelin = () => {
      for (const object of built.targets) object.visible = ctl.current.myelin;
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const clock = Math.max(0, Math.min(1, ctl.current.phase));
      let p = clock;
      if (mode === "neuron" && ctl.current.myelin) {
        if (clock > AXON_FROM && clock < AXON_TO) {
          p = AXON_FROM + (AXON_TO - AXON_FROM) * stepped((clock - AXON_FROM) / (AXON_TO - AXON_FROM), INTERNODES);
        }
      }
      const at = built.path.getPointAt(p);
      pulse.position.copy(at);
      /* The throb belongs to a travelling impulse. Once it has arrived, the
         pulse holds still: a marker that keeps pulsing forever is the flicker
         this view is meant to avoid. */
      const travelling = ctl.current.phase > 0.0005 && ctl.current.phase < 0.9995;
      const beat = travelling ? 1 + 0.12 * Math.sin(performance.now() / 150) : 1;
      core.scale.setScalar(beat);
      halo.scale.setScalar(beat * 1.1);
      pulse.visible = ctl.current.phase > 0.0005;

      if (built.muscle) {
        const goal = ctl.current.fired ? 0.86 : 1;
        const s = built.muscle.scale.x + (goal - built.muscle.scale.x) * 0.12;
        built.muscle.scale.set(s, s, s);
        built.muscle.rotation.z = (1 - s) * 0.3;
      }
      applyMyelin();

      if (built.ends) for (const end of built.ends) end.scale.setScalar(1);

      controls.update();
      renderer.render(scene, camera);

      if (pins.length) {
        const rect = renderer.domElement.getBoundingClientRect();
        for (const pin of pins) {
          const projected = pin.at.clone().applyMatrix4(root.matrixWorld).project(camera);
          pin.node.style.transform = `translate(-50%, -50%) translate(${(
            (projected.x * 0.5 + 0.5) * rect.width
          ).toFixed(1)}px, ${((-projected.y * 0.5 + 0.5) * rect.height).toFixed(1)}px)`;
          pin.node.style.opacity = projected.z < 1 ? "1" : "0";
        }
      }
    };
    loop();
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      fitRef.current = null;
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      for (const pin of pins) pin.node.remove();
    };
  }, [mode]);

  return (
    <div className="apple-lab-stage relative">
      <div ref={holder} className="relative w-full" style={{ aspectRatio: "1.52" }} />
      <span className="apple-lab-chip pointer-events-none absolute left-3 top-3 !text-[10px]">
        {mode === "neuron" ? "Neuron · impulse →" : "Reflex · skin → cord → muscle"}
      </span>
      {!ready ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] text-[var(--lab-ink-dim)]">
          building the model…
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => fitRef.current?.()}
        className="apple-lab-chip absolute bottom-3 right-3 !gap-1.5 !px-2.5 !py-1 !text-[10px]"
      >
        <Maximize2 className="h-3 w-3" />
        Fit
      </button>
      <span className="apple-lab-chip pointer-events-none absolute bottom-3 left-3 !text-[10px] max-sm:hidden">
        drag orbit · scroll zoom · right-drag pan
      </span>
    </div>
  );
}
