import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RotateCcw } from "lucide-react";

/**
 * Animal and plant cell, built entirely from code (no model files, no licence to check).
 * Hover or tap any organelle for its name and job, use X-ray to see through the membrane or wall,
 * "Cut open" to slice the cell, and the list to fly the camera to an organelle.
 * Shapes are simplified teaching models, not microscope scans.
 */
type Kind = "animal" | "plant";
type Def = { name: string; fn: string; color: string };
const DEFS: Record<string, Def> = {
  membrane: { name: "Plasma membrane", fn: "Phospholipid bilayer with proteins that controls what enters and leaves the cell.", color: "#7fc4ff" },
  wall: { name: "Cell wall", fn: "Rigid cellulose layer outside the membrane. It gives the plant cell its shape and strength.", color: "#8fd16a" },
  nucleus: { name: "Nucleus", fn: "Holds the DNA. The double envelope has pores that let RNA out and proteins in.", color: "#9d8cff" },
  nucleolus: { name: "Nucleolus", fn: "Dense region inside the nucleus where the parts of ribosomes are made.", color: "#8a56d8" },
  rer: { name: "Rough ER", fn: "Folded membranes studded with ribosomes. They make proteins and send them on.", color: "#2fb3a3" },
  ser: { name: "Smooth ER", fn: "Network of tubes with no ribosomes. It makes lipids and helps remove toxins.", color: "#7bd1b5" },
  golgi: { name: "Golgi apparatus", fn: "Stack of flattened sacs that modify, sort and package proteins for export.", color: "#f08fb0" },
  mito: { name: "Mitochondria", fn: "Folded inner membranes (cristae) where respiration releases most of the cell’s ATP.", color: "#ff9a4d" },
  ribo: { name: "Ribosomes", fn: "Tiny protein factories, free in the cytosol or attached to the rough ER.", color: "#f4e08a" },
  lyso: { name: "Lysosomes", fn: "Sacs of digestive enzymes that break down waste and worn-out parts.", color: "#b983ff" },
  centro: { name: "Centrioles", fn: "A pair at right angles that organise the spindle when the cell divides.", color: "#f2d24b" },
  cyto: { name: "Microtubules", fn: "Protein fibres that hold the cell’s shape and act as tracks for transport.", color: "#cfd8e6" },
  vacuole: { name: "Central vacuole", fn: "Large sac of cell sap that stores water and keeps the cell firm (turgor).", color: "#7ac0ff" },
  chloro: { name: "Chloroplasts", fn: "Green organelles with stacks of thylakoids (grana) where photosynthesis makes glucose.", color: "#58c862" },
  plasmo: { name: "Plasmodesmata", fn: "Tiny channels through the cell wall that link neighbouring plant cells.", color: "#e6c85a" },
};
const ORDER: Record<Kind, string[]> = {
  animal: ["membrane", "nucleus", "nucleolus", "rer", "ser", "golgi", "mito", "ribo", "lyso", "centro", "cyto"],
  plant: ["wall", "membrane", "nucleus", "nucleolus", "rer", "golgi", "mito", "ribo", "vacuole", "chloro", "plasmo"],
};

type Mover = { o: THREE.Object3D; y: number; ph: number; spin: number };
type V3 = [number, number, number];

function buildCell(kind: Kind) {
  const group = new THREE.Group();
  const mats: Record<string, THREE.MeshPhysicalMaterial> = {};
  const pick: THREE.Mesh[] = [];
  const movers: Mover[] = [];
  let seed = kind === "animal" ? 7 : 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mat = (key: string, id: string, color: string, o: { op?: number; shell?: boolean; rough?: number } = {}) => {
    if (!mats[key]) {
      const op = o.op ?? 1;
      const m = new THREE.MeshPhysicalMaterial({ color, roughness: o.rough ?? 0.45, metalness: 0, side: THREE.DoubleSide, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
      m.userData = { id, base: op, shell: !!o.shell };
      mats[key] = m;
    }
    return mats[key];
  };
  const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, id: string, shell = false) => {
    const x = new THREE.Mesh(geo, m);
    x.userData = { id, shell };
    parent.add(x);
    pick.push(x);
    return x;
  };
  const dots = (parent: THREE.Object3D, id: string, key: string, color: string, pts: THREE.Vector3[], r: number) => {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), mat(key, id, color), pts.length);
    const d = new THREE.Object3D();
    pts.forEach((p, i) => {
      d.position.copy(p);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.userData = { id, shell: false };
    parent.add(im);
    pick.push(im);
  };
  const fib = (n: number, r: number) =>
    Array.from({ length: n }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / n;
      const t = Math.sqrt(1 - y * y);
      const a = i * 2.399963;
      return new THREE.Vector3(Math.cos(a) * t * r, y * r, Math.sin(a) * t * r);
    });
  const tube = (parent: THREE.Object3D, id: string, key: string, color: string, pts: V3[], r: number) =>
    mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, r, 6), mat(key, id, color), id);

  const nucleus = (p: V3, r: number) => {
    const g = new THREE.Group();
    g.position.set(...p);
    group.add(g);
    mesh(g, new THREE.SphereGeometry(r, 40, 28), mat("nenv", "nucleus", "#9d8cff", { op: 0.22, shell: true }), "nucleus", true);
    dots(g, "nucleus", "npore", "#4b3a9a", fib(34, r * 1.005), 0.045);
    mesh(g, new THREE.TorusKnotGeometry(r * 0.4, r * 0.07, 140, 10, 2, 3), mat("chrom", "nucleus", "#b68cf0"), "nucleus");
    const nu = mesh(g, new THREE.SphereGeometry(r * 0.3, 24, 18), mat("nucleolus", "nucleolus", "#6a3db8"), "nucleolus");
    nu.position.set(r * 0.12, r * 0.08, r * 0.22);
    movers.push({ o: g, y: p[1], ph: rnd() * 6, spin: 0.03 });
  };
  const rer = (p: V3, r: number) => {
    const g = new THREE.Group();
    g.position.set(...p);
    group.add(g);
    const m = mat("rer", "rer", "#2fb3a3", { rough: 0.5 });
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const rr = r * (1.25 + 0.13 * i);
      const ph0 = i * 1.7;
      const th0 = 0.5 + i * 0.15;
      mesh(g, new THREE.SphereGeometry(rr, 40, 20, ph0, 2.6, th0, 1.5), m, "rer");
      for (let k = 0; k < 26; k++) {
        const ph = ph0 + rnd() * 2.6;
        const th = th0 + rnd() * 1.5;
        pts.push(new THREE.Vector3(-rr * Math.cos(ph) * Math.sin(th), rr * Math.cos(th), rr * Math.sin(ph) * Math.sin(th)));
      }
    }
    dots(g, "ribo", "ribo", "#f4e08a", pts, 0.04);
    movers.push({ o: g, y: p[1], ph: rnd() * 6, spin: 0.03 });
  };
  const ser = (p: V3, r: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const pts: V3[] = [];
      let c = new THREE.Vector3(...p).addScaledVector(d, r * 1.45);
      for (let s = 0; s < 6; s++) {
        pts.push([c.x, c.y, c.z]);
        c = c.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.9).addScaledVector(d, 0.25));
      }
      tube(group, "ser", "ser", "#7bd1b5", pts, 0.06);
    }
  };
  const golgi = (p: V3, s: number) => {
    const g = new THREE.Group();
    g.position.set(...p);
    g.rotation.set(0.5, 0.4, 0.3);
    group.add(g);
    const m = mat("golgi", "golgi", "#f08fb0");
    for (let i = 0; i < 6; i++) {
      const d = mesh(g, new THREE.SphereGeometry(1, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, "golgi");
      d.scale.set(s * (1 - 0.07 * i), s * 0.18, s * 0.75 * (1 - 0.07 * i));
      d.position.y = i * s * 0.2;
    }
    const vm = mat("gves", "golgi", "#ffb3cb");
    for (let i = 0; i < 7; i++) {
      const v = mesh(g, new THREE.SphereGeometry(s * 0.1, 12, 10), vm, "golgi");
      const a = (i / 7) * 6.28;
      v.position.set(Math.cos(a) * s * 1.2, rnd() * s, Math.sin(a) * s * 0.9);
    }
    movers.push({ o: g, y: p[1], ph: rnd() * 6, spin: 0.05 });
  };
  const mito = (p: V3) => {
    const g = new THREE.Group();
    g.position.set(...p);
    g.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    group.add(g);
    mesh(g, new THREE.CapsuleGeometry(0.27, 0.8, 6, 18), mat("mo", "mito", "#ff9a4d", { op: 0.5 }), "mito");
    const cm = mat("mc", "mito", "#d9531e");
    for (let i = 0; i < 6; i++) {
      const c = mesh(g, new THREE.CylinderGeometry(0.2, 0.2, 0.035, 20), cm, "mito");
      c.position.y = -0.42 + i * 0.17;
      c.scale.set(1, 1, 0.8 + 0.2 * Math.sin(i * 1.5));
    }
    movers.push({ o: g, y: p[1], ph: rnd() * 6, spin: 0.15 });
  };
  const lyso = (p: V3) => {
    const m = mesh(group, new THREE.SphereGeometry(0.17, 16, 12), mat("ly", "lyso", "#b983ff"), "lyso");
    m.position.set(...p);
    movers.push({ o: m, y: p[1], ph: rnd() * 6, spin: 0 });
  };

  if (kind === "animal") {
    const mem = new THREE.SphereGeometry(1, 64, 48);
    const pa = mem.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const f = 1 + 0.07 * Math.sin(3 * x + 1) * Math.sin(2.3 * y + 0.5) * Math.sin(3 * z) + 0.04 * Math.sin(5 * y + z);
      pa.setXYZ(i, x * f, y * f, z * f);
    }
    mem.scale(4.6, 3.5, 3.6);
    mem.computeVertexNormals();
    mesh(group, mem, mat("mem", "membrane", "#7fc4ff", { op: 0.16, shell: true }), "membrane", true);
    const N: V3 = [-0.9, 0.3, 0];
    nucleus(N, 1.15);
    rer(N, 1.15);
    ser(N, 1.15, 5);
    golgi([1.7, -0.5, 0.9], 0.75);
    const free = (min: number) => {
      for (let t = 0; t < 300; t++) {
        const p = new THREE.Vector3((rnd() * 2 - 1) * 3.9, (rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3);
        if ((p.x / 3.9) ** 2 + (p.y / 3) ** 2 + (p.z / 3) ** 2 < 0.9 && p.distanceTo(new THREE.Vector3(...N)) > min) return p;
      }
      return new THREE.Vector3(2.5, 1, 1);
    };
    for (let i = 0; i < 5; i++) mito(free(2.1).toArray() as V3);
    for (let i = 0; i < 5; i++) lyso(free(2).toArray() as V3);
    const cen = new THREE.Group();
    cen.position.set(1.7, 1.1, 0.2);
    group.add(cen);
    const cm = mat("ce", "centro", "#f2d24b");
    mesh(cen, new THREE.CylinderGeometry(0.09, 0.09, 0.55, 14), cm, "centro");
    const c2 = mesh(cen, new THREE.CylinderGeometry(0.09, 0.09, 0.55, 14), cm, "centro");
    c2.rotation.z = Math.PI / 2;
    c2.position.set(0.3, -0.2, 0);
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      const e = new THREE.Vector3(d.x * 3.7, d.y * 2.8, d.z * 2.9).add(cen.position.clone().multiplyScalar(0.2));
      const mid = cen.position.clone().lerp(e, 0.5).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.5));
      tube(group, "cyto", "cyto", "#cfd8e6", [cen.position.toArray() as V3, mid.toArray() as V3, e.toArray() as V3], 0.022);
    }
    dots(group, "ribo", "ribo", "#f4e08a", Array.from({ length: 90 }, () => free(1.9)), 0.04);
  } else {
    const wallG = new RoundedBoxGeometry(9.4, 5.8, 5.8, 6, 1.0);
    mesh(group, wallG, mat("wall", "wall", "#8fd16a", { op: 0.22, shell: true }), "wall", true);
    mesh(group, new RoundedBoxGeometry(9.0, 5.4, 5.4, 6, 0.95), mat("mem", "membrane", "#7fc4ff", { op: 0.12, shell: true }), "membrane", true);
    const vac = mesh(group, new THREE.SphereGeometry(1, 48, 36), mat("vac", "vacuole", "#7ac0ff", { op: 0.3, shell: true }), "vacuole", true);
    vac.scale.set(3.2, 2.1, 2.1);
    vac.position.set(0.7, 0, 0);
    const N: V3 = [-3.3, 0.9, 0.5];
    nucleus(N, 0.75);
    rer(N, 0.75);
    golgi([-3.0, -1.4, 1.4], 0.6);
    const free = (min: number) => {
      for (let t = 0; t < 400; t++) {
        const p = new THREE.Vector3((rnd() * 2 - 1) * 4.1, (rnd() * 2 - 1) * 2.4, (rnd() * 2 - 1) * 2.4);
        const inVac = ((p.x - 0.7) / 3.45) ** 2 + (p.y / 2.35) ** 2 + (p.z / 2.35) ** 2 < 1;
        if (!inVac && p.distanceTo(new THREE.Vector3(...N)) > min) return p;
      }
      return new THREE.Vector3(3.8, 1.8, 1.5);
    };
    for (let i = 0; i < 4; i++) mito(free(1.6).toArray() as V3);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      g.position.copy(free(1.5));
      g.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      group.add(g);
      const o = mesh(g, new THREE.SphereGeometry(1, 24, 16), mat("cho", "chloro", "#58c862", { op: 0.55 }), "chloro");
      o.scale.set(0.62, 0.32, 0.34);
      const gm = mat("chg", "chloro", "#1f7a35");
      [-0.25, 0, 0.25].forEach((x) => {
        for (let k = 0; k < 4; k++) {
          const d = mesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.022, 14), gm, "chloro");
          d.position.set(x, -0.07 + k * 0.045, 0);
        }
      });
      movers.push({ o: g, y: g.position.y, ph: rnd() * 6, spin: 0.08 });
    }
    const pm = mat("pd", "plasmo", "#e6c85a");
    [[-4.6, 0.6, 0.4], [-4.6, -1, -0.8], [4.6, 0.8, -0.5], [4.6, -0.7, 0.9], [4.6, 1.4, 1.2], [-4.6, -0.3, 1.5]].forEach((p) => {
      const c = mesh(group, new THREE.CylinderGeometry(0.12, 0.12, 0.8, 10), pm, "plasmo");
      c.rotation.z = Math.PI / 2;
      c.position.set(p[0], p[1], p[2]);
    });
    for (let i = 0; i < 5; i++) lyso(free(1.5).toArray() as V3);
    dots(group, "ribo", "ribo", "#f4e08a", Array.from({ length: 70 }, () => free(1.4)), 0.04);
  }
  return { group, mats, pick, movers };
}

export default function CellModelViewer({ kind, theme }: { kind: Kind; theme: "dark" | "light" }) {
  const dark = theme === "dark";
  const holder = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const built = useRef<ReturnType<typeof buildCell> | null>(null);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 10));
  const st = useRef({ xray: false, cutOn: false, auto: true, hov: null as string | null, pin: null as string | null, fly: null as THREE.Vector3 | null, look: null as THREE.Vector3 | null, cam: null as THREE.PerspectiveCamera | null, controls: null as OrbitControls | null, group: null as THREE.Group | null });
  const [pin, setPin] = useState<string | null>(null);
  const [xray, setXray] = useState(false);
  const [cutOn, setCutOn] = useState(false);
  const [cut, setCut] = useState(50);
  const [auto, setAuto] = useState(true);
  const [ready, setReady] = useState(false);
  const R = kind === "animal" ? 3.6 : 2.9;

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const s = st.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const scene = new THREE.Scene();
    scene.environment = envTex;
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    cam.position.set(0, 1.5, 15);
    s.cam = cam;
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    s.controls = controls;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556688, 0.6));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.1);
    d1.position.set(6, 8, 8);
    scene.add(d1);
    const b = buildCell(kind);
    built.current = b;
    s.group = b.group;
    scene.add(b.group);
    setReady(true);
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      cam.aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const rc = new THREE.Raycaster();
    const mp = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mp.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(mp, cam);
      const hits = rc.intersectObjects(b.pick, false).filter((x) => !(s.cutOn && x.point.z > plane.current.constant));
      const h = hits.find((x) => !x.object.userData.shell) ?? hits[0];
      s.hov = h ? (h.object.userData.id as string) : null;
      const t = tip.current;
      if (t) {
        if (h) {
          const d = DEFS[s.hov!];
          t.innerHTML = `<b>${d.name}</b><br/>${d.fn}`;
          t.style.display = "block";
          t.style.left = Math.min(e.clientX - r.left + 14, r.width - 250) + "px";
          t.style.top = e.clientY - r.top + 14 + "px";
        } else t.style.display = "none";
      }
      renderer.domElement.style.cursor = h ? "pointer" : "grab";
    };
    const onLeave = () => {
      s.hov = null;
      if (tip.current) tip.current.style.display = "none";
    };
    const onClick = () => setPin((p) => (s.hov ? (p === s.hov ? null : s.hov) : null));
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("click", onClick);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!still) {
        if (s.auto && !s.fly) b.group.rotation.y += 0.1 * dt;
        b.movers.forEach((m) => {
          m.o.position.y = m.y + 0.05 * Math.sin(t * 0.7 + m.ph);
          m.o.rotation.y += m.spin * dt;
        });
      }
      if (s.fly && s.look) {
        cam.position.lerp(s.fly, 0.1);
        controls.target.lerp(s.look, 0.1);
        if (cam.position.distanceTo(s.fly) < 0.03) s.fly = null;
      }
      controls.update();
      const sel = s.hov || s.pin;
      Object.values(b.mats).forEach((m) => {
        m.emissive.set(sel === m.userData.id ? DEFS[m.userData.id].color : "#000000");
        m.emissiveIntensity = 0.5;
      });
      renderer.render(scene, cam);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("click", onClick);
      b.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      Object.values(b.mats).forEach((m) => m.dispose());
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [kind]);

  useEffect(() => {
    st.current.pin = pin;
  }, [pin]);
  useEffect(() => {
    st.current.auto = auto;
  }, [auto]);
  useEffect(() => {
    st.current.xray = xray;
    Object.values(built.current?.mats ?? {}).forEach((m) => {
      if (m.userData.shell) m.opacity = m.userData.base * (xray ? 0.3 : 1);
    });
  }, [xray, ready, kind]);
  useEffect(() => {
    st.current.cutOn = cutOn;
    plane.current.constant = R - (cut / 100) * 2 * R * 0.98;
    Object.values(built.current?.mats ?? {}).forEach((m) => {
      m.clippingPlanes = cutOn ? [plane.current] : [];
      m.needsUpdate = true;
    });
  }, [cutOn, cut, ready, R, kind]);

  const fit = () => {
    const s = st.current;
    s.fly = new THREE.Vector3(0, 1.5, 15);
    s.look = new THREE.Vector3(0, 0, 0);
  };
  const focus = (id: string) => {
    const s = st.current;
    if (!s.group || !s.cam) return;
    const box = new THREE.Box3();
    s.group.updateMatrixWorld(true);
    built.current?.pick.forEach((m) => {
      if (m.userData.id !== id) return;
      const im = m as THREE.InstancedMesh;
      if (im.isInstancedMesh) im.computeBoundingBox();
      box.expandByObject(m);
    });
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = s.cam.position.clone().sub(s.controls?.target ?? new THREE.Vector3()).normalize();
    s.look = c;
    s.fly = c.clone().addScaledVector(dir, Math.min(14, Math.max(4.5, size * 1.4)));
  };
  const pickId = (id: string) => {
    const next = pin === id ? null : id;
    setPin(next);
    if (next) {
      setAuto(false);
      focus(next);
    }
  };
  const sel = pin ? DEFS[pin] : null;
  const edge = dark ? "border-white/10" : "border-black/10";
  const txt = dark ? "text-slate-100" : "text-slate-900";
  const sub = dark ? "text-slate-400" : "text-slate-600";
  const btn = (on: boolean) => `cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${edge} ${on ? "bg-[#6f7cff] text-white" : `${txt} hover:bg-white/10`}`;

  return (
    <div className="lab-split">
      <div className="lab-stage-pane lab-glass p-2.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate text-sm font-bold ${txt}`}>{kind === "animal" ? "Animal cell" : "Plant cell"}</p>
            <p className={`hidden text-[11px] sm:block ${sub}`}>{kind === "animal" ? "A 3D cell you can turn, cut open and label" : "Cell wall, chloroplasts and one huge vacuole, in 3D"}</p>
          </div>
          <button type="button" className={btn(false)} onClick={fit}>
            <RotateCcw className="mr-1 inline h-3 w-3" />
            Fit view
          </button>
        </div>
        <div className={`relative h-[58vh] min-h-[340px] overflow-hidden rounded-xl border ${edge} ${dark ? "bg-black/25" : "bg-white/60"}`}>
          <div ref={holder} className="absolute inset-0" />
          <div ref={tip} style={{ display: "none" }} className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg bg-black/90 px-2.5 py-1.5 text-[11px] leading-snug text-white" />
          <p className={`pointer-events-none absolute bottom-2 right-3 text-[10px] ${sub}`}>drag orbit · scroll zoom · hover or tap an organelle</p>
        </div>
      </div>
      <div className="lab-deck-pane lab-glass-deep space-y-3 p-3.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn(auto)} onClick={() => setAuto(!auto)}>Auto-rotate</button>
          <button type="button" className={btn(xray)} onClick={() => setXray(!xray)}>X-ray</button>
          <button type="button" className={btn(cutOn)} onClick={() => setCutOn(!cutOn)}>Cut open</button>
        </div>
        <label className={`flex items-center gap-2 text-xs ${sub}`}>
          Cut depth
          <input type="range" min={0} max={100} value={cut} disabled={!cutOn} className="flex-1" onChange={(e) => setCut(+e.target.value)} />
          <b className={txt}>{cutOn ? `${cut}%` : "off"}</b>
        </label>
        <div className={`min-h-20 rounded-xl border ${edge} p-3 text-xs leading-relaxed ${txt}`}>
          {sel ? (<><b style={{ color: sel.color }}>{sel.name}</b><br />{sel.fn}</>) : <span className={sub}>Hover or select a structure to see what it does.</span>}
        </div>
        <div className="flex flex-col gap-1">
          {ORDER[kind].map((id) => (
            <button key={id} type="button" onClick={() => pickId(id)} onMouseEnter={() => (st.current.hov = id)} onMouseLeave={() => (st.current.hov = null)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs ${edge} ${txt} ${pin === id ? "bg-white/10" : ""}`}>
              <i className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: DEFS[id].color }} />
              {DEFS[id].name}
            </button>
          ))}
        </div>
        <p className={`text-[10px] leading-relaxed ${sub}`}>Clicking a structure flies the camera to it. Organelles are simplified and not to scale, so use this as a teaching model alongside your textbook.</p>
      </div>
    </div>
  );
}
