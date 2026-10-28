import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RotateCcw } from "lucide-react";

/**
 * Heart viewer built on a real textured 3D model (public/models/heart.glb).
 * The model is a single mesh, so labels are numbered markers placed by hand on
 * its surface. `p` is in the model's own coordinates: x = back→front, y = up,
 * z = patient's left(−)→right(+). side "f" = visible from the front, "b" = from
 * the back. Check the labels against a textbook.
 */
type Part = { id: string; name: string; fn: string; color: string; p: [number, number, number]; side: "f" | "b" };

const PARTS: Part[] = [
  { id: "aorta", name: "Ascending aorta", fn: "Carries oxygen-rich blood from the left ventricle up to the arch and on to the body.", color: "#f0506a", p: [0.0964, 0.2897, 0.0254], side: "f" },
  { id: "arch", name: "Aortic arch and branches", fn: "The arch gives off three branches that supply the head and arms.", color: "#f0506a", p: [0.0103, 0.4431, 0.0233], side: "f" },
  { id: "svc", name: "Superior vena cava", fn: "Returns oxygen-poor blood from the head and arms to the right atrium.", color: "#4f9bea", p: [0.0785, 0.3694, 0.1647], side: "f" },
  { id: "ivc", name: "Inferior vena cava", fn: "Returns oxygen-poor blood from the lower body to the right atrium.", color: "#4f9bea", p: [0.0768, -0.4239, 0.1808], side: "f" },
  { id: "pt", name: "Pulmonary trunk", fn: "Leaves the right ventricle and carries oxygen-poor blood towards the lungs.", color: "#4f9bea", p: [0.0943, 0.1782, -0.0389], side: "f" },
  { id: "lpa", name: "Left pulmonary artery", fn: "Carries oxygen-poor blood to the left lung.", color: "#4f9bea", p: [0.0054, 0.2546, -0.19], side: "f" },
  { id: "rpa", name: "Right pulmonary artery", fn: "Carries oxygen-poor blood to the right lung.", color: "#4f9bea", p: [0.0352, 0.2286, 0.2288], side: "f" },
  { id: "ra", name: "Right atrium", fn: "Receives oxygen-poor blood from the venae cavae.", color: "#d0608a", p: [0.2336, -0.1263, 0.1907], side: "f" },
  { id: "rv", name: "Right ventricle", fn: "Pumps oxygen-poor blood to the lungs through the pulmonary trunk.", color: "#d0608a", p: [0.2393, -0.2002, 0.0338], side: "f" },
  { id: "lv", name: "Left ventricle", fn: "Thickest chamber. Pumps oxygen-rich blood to the whole body.", color: "#f0705a", p: [0.1882, -0.1977, -0.1884], side: "f" },
  { id: "apex", name: "Apex", fn: "Pointed tip of the heart, formed by the left ventricle.", color: "#f0705a", p: [0.0554, -0.3945, -0.2896], side: "f" },
  { id: "lad", name: "Coronary arteries and fat", fn: "Vessels in the grooves between chambers feed the heart muscle itself.", color: "#f4a640", p: [0.1634, -0.0294, -0.0766], side: "f" },
  { id: "la", name: "Left atrium (back view)", fn: "Receives oxygen-rich blood from the lungs through the pulmonary veins.", color: "#f07890", p: [-0.1622, 0.0992, 0.0096], side: "b" },
  { id: "lpv", name: "Left pulmonary veins (back view)", fn: "Bring oxygen-rich blood from the left lung to the left atrium.", color: "#f07890", p: [-0.138, 0.1218, -0.1915], side: "b" },
  { id: "rpv", name: "Right pulmonary veins (back view)", fn: "Bring oxygen-rich blood from the right lung to the left atrium.", color: "#f07890", p: [-0.0218, 0.1329, 0.2722], side: "b" },
];

/**
 * Heartbeat without moving the whole model: the ventricles squeeze toward their own centre and the atria contract a
 * little just before them. Weights are worked out once from the vertex positions (model coordinates: x front, y up,
 * z patient's left(-)/right(+)); the great vessels and the venae cavae stay still.
 */
type BeatRig = { pos: THREE.BufferAttribute; base: Float32Array; ids: Uint32Array; dv: Float32Array; da: Float32Array; rest: boolean };
function makeBeat(g: THREE.BufferGeometry): BeatRig {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as ArrayLike<number>);
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const AV = [0, -0.2, -0.06];
  const AA = [-0.03, 0.08, 0.05];
  const ids: number[] = [];
  const dv: number[] = [];
  const da: number[] = [];
  for (let i = 0; i < base.length / 3; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    const ivc = z > 0.12 && y < -0.28;
    const wv = ivc ? 0 : sm(0.1, -0.06, y);
    const wa = sm(-0.02, 0.04, y) * (1 - sm(0.12, 0.18, y)) * (1 - sm(0.2, 0.32, Math.abs(z - 0.04)));
    if (wv < 0.01 && wa < 0.01) continue;
    ids.push(i);
    dv.push((AV[0] - x) * wv, (AV[1] - y) * wv, (AV[2] - z) * wv);
    da.push((AA[0] - x) * wa, (AA[1] - y) * wa, (AA[2] - z) * wa);
  }
  return { pos, base, ids: Uint32Array.from(ids), dv: Float32Array.from(dv), da: Float32Array.from(da), rest: true };
}
function applyBeat(r: BeatRig, ph: number) {
  const win = (a: number, b: number) => (ph > a && ph < b ? Math.sin((Math.PI * (ph - a)) / (b - a)) ** 2 : 0);
  const sa = win(0, 0.14);
  const sv = win(0.14, 0.45);
  const still = sa + sv === 0;
  if (still && r.rest) return;
  r.rest = still;
  const ka = 0.05 * sa;
  const kv = 0.07 * sv;
  const arr = r.pos.array as Float32Array;
  for (let k = 0; k < r.ids.length; k++) {
    const i = r.ids[k] * 3;
    for (let c = 0; c < 3; c++) arr[i + c] = r.base[i + c] + r.dv[k * 3 + c] * kv + r.da[k * 3 + c] * ka;
  }
  r.pos.needsUpdate = true;
}

const MODEL_URL = "/models/heart.glb";
const SCALE = 8;

export default function HeartModelViewer({ label, blurb }: { label: string; blurb: string; theme?: "dark" | "light" }) {
  const holder = useRef<HTMLDivElement>(null);
  const dots = useRef<Record<string, HTMLButtonElement | null>>({});
  const ctl = useRef({
    bpm: 72,
    fly: null as THREE.Vector3 | null,
    loaded: false,
    cam: null as THREE.PerspectiveCamera | null,
    controls: null as OrbitControls | null,
  });
  const [pin, setPin] = useState<string | null>(null);
  const [xray, setXray] = useState(false);
  const [all, setAll] = useState(false);
  const [bpm, setBpm] = useState(72);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const mats = useRef<THREE.Material[]>([]);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const c = ctl.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    scene.environment = envTex;
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    cam.position.set(12, 0.8, 0);
    c.cam = cam;
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    c.controls = controls;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556688, 0.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.1);
    d1.position.set(6, 6, 4);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.5);
    d2.position.set(-6, 2, -5);
    scene.add(d2);
    const group = new THREE.Group();
    group.scale.setScalar(SCALE);
    scene.add(group);
    let disposed = false;
    let beat: BeatRig | null = null;
    new GLTFLoader().load(
      MODEL_URL,
      (g) => {
        if (disposed) return;
        group.add(g.scene);
        g.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          // heart.glb ships without normals; without them the lit material renders black
          mesh.geometry.computeVertexNormals();
          const old = mesh.material as THREE.MeshStandardMaterial;
          const mat = new THREE.MeshPhysicalMaterial({ map: old.map, normalMap: old.normalMap, roughness: 0.5, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.3, envMapIntensity: 0.8 });
          old.dispose();
          mesh.material = mat;
          mats.current.push(mat);
          if (!beat) beat = makeBeat(mesh.geometry);
        });
        c.loaded = true;
        setReady(true);
      },
      undefined,
      () => setFailed(true),
    );
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      cam.aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    const v = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const ph = ((((performance.now() - t0) / 1000) * c.bpm) / 60) % 1;
      if (beat && !still) applyBeat(beat, ph);
      if (c.fly) {
        cam.position.lerp(c.fly, 0.12);
        if (cam.position.distanceTo(c.fly) < 0.05) c.fly = null;
      }
      controls.update();
      group.updateMatrixWorld();
      const cx = cam.position.clone().normalize().x;
      const w = el.clientWidth;
      const h = el.clientHeight;
      PARTS.forEach((a) => {
        const d = dots.current[a.id];
        if (!d) return;
        const visible = c.loaded && (a.side === "f" ? cx > 0.1 : cx < -0.1);
        d.style.display = visible ? "block" : "none";
        if (!visible) return;
        v.set(...a.p);
        group.localToWorld(v);
        v.project(cam);
        d.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      });
      renderer.render(scene, cam);
    };
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        if (mat) {
          mat.map?.dispose();
          mat.normalMap?.dispose();
          mat.metalnessMap?.dispose();
          mat.dispose();
        }
      });
      mats.current = [];
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    mats.current.forEach((m) => {
      m.transparent = xray;
      m.opacity = xray ? 0.3 : 1;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    });
  }, [xray, ready]);

  const side = (s: 1 | -1) => {
    const cam = ctl.current.cam;
    if (!cam) return;
    const d = cam.position.length();
    ctl.current.fly = new THREE.Vector3(s * d * 0.97, d * 0.07, 0);
  };
  const fit = () => {
    ctl.current.fly = new THREE.Vector3(12, 0.8, 0);
    ctl.current.controls?.target.set(0, 0, 0);
  };
  const pick = (id: string) => {
    const next = pin === id ? null : id;
    setPin(next);
    const a = PARTS.find((p) => p.id === next);
    const cam = ctl.current.cam;
    if (a && cam) {
      const cx = cam.position.clone().normalize().x;
      if ((a.side === "f" && cx < 0.3) || (a.side === "b" && cx > -0.3)) side(a.side === "f" ? 1 : -1);
    }
  };
  const sel = PARTS.find((p) => p.id === pin);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      {/* ── the model ── */}
      <div className="apple-lab-panel apple-lab-glass">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="apple-lab-micro">{label}</p>
            <h3 className="apple-lab-title mt-1 text-lg">{blurb}</h3>
          </div>
          <button type="button" className="apple-lab-btn !px-3 !py-2" onClick={fit}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fit view</span>
          </button>
        </div>

        <div className="organ-viewbar mt-4">
          <div className="organ-seg" role="group" aria-label="Heart view">
            <button type="button" onClick={() => side(1)}>
              Front
            </button>
            <button type="button" onClick={() => side(-1)}>
              Back
            </button>
            <button type="button" data-active={xray} onClick={() => setXray((v) => !v)} aria-pressed={xray}>
              X-ray
            </button>
          </div>
          <span className="organ-viewhint">
            {xray ? "The outer muscle turns glass so the chambers show through" : "A real scanned model — drag to turn it"}
          </span>
        </div>

        <div className="apple-lab-stage mt-3 aspect-[16/10] min-h-[300px]">
          <div ref={holder} className="absolute inset-0" />
          {!ready && !failed && (
            <div className="absolute inset-0 grid place-items-center text-sm text-[var(--lab-ink-dim)]">
              Loading the heart model…
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[var(--lab-ink-dim)]">
              The heart model could not load. Check your connection and reload the lab.
            </div>
          )}
          {PARTS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              ref={(el) => {
                dots.current[a.id] = el;
              }}
              onClick={() => pick(a.id)}
              style={{ background: a.color, display: "none" }}
              className={`absolute left-0 top-0 -ml-3 -mt-3 h-6 w-6 cursor-pointer rounded-full border-2 border-white text-[11px] font-bold text-white shadow ${pin === a.id ? "z-10 scale-125" : ""}`}
            >
              {i + 1}
              {(all || pin === a.id) && (
                <span className="absolute left-7 top-0.5 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[10px] font-medium text-white">
                  {a.name}
                </span>
              )}
            </button>
          ))}
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-sm">
            drag orbit · scroll zoom · click a dot
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="apple-lab-micro">Heart rate</span>
          <span className="apple-lab-value text-[12px] tabular-nums">{bpm} bpm</span>
        </div>
        <input
          type="range"
          className="apple-lab-range mt-1.5"
          min={40}
          max={180}
          value={bpm}
          aria-label="Heart rate"
          onChange={(e) => {
            setBpm(+e.target.value);
            ctl.current.bpm = +e.target.value;
          }}
        />
      </div>

      {/* ── structures ── */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="apple-lab-panel apple-lab-glass">
          <div className="flex items-center justify-between gap-3">
            <p className="apple-lab-micro">Structures</p>
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1 !text-[10px]"
              data-active={all}
              aria-pressed={all}
              onClick={() => setAll((v) => !v)}
            >
              {all ? "Hide labels" : "All labels"}
            </button>
          </div>

          {sel ? (
            <div
              className="apple-lab-card mt-3 px-3.5 py-3"
              style={{ borderColor: `color-mix(in srgb, ${sel.color} 46%, transparent)` }}
            >
              <p className="apple-lab-micro" style={{ color: sel.color }}>
                {sel.side === "f" ? "Front view" : "Back view"}
              </p>
              <p className="apple-lab-value mt-1 text-[14px] font-semibold leading-tight">{sel.name}</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">{sel.fn}</p>
            </div>
          ) : (
            <p className="apple-lab-note mt-2">
              Tap a numbered dot on the model, or a structure below, to read what it does.
            </p>
          )}

          <div className="organ-scroll mt-2 max-h-[330px] overflow-y-auto pr-1">
            <div className="mt-1 flex flex-col gap-1">
              {PARTS.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pick(a.id)}
                  aria-pressed={pin === a.id}
                  className="organ-row"
                  data-active={pin === a.id}
                >
                  <span
                    className="organ-row__dot"
                    style={{ background: a.color, boxShadow: `0 0 10px ${a.color}55` }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold">
                    {i + 1}. {a.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="apple-lab-panel apple-lab-glass">
          <p className="apple-lab-micro">Colour key</p>
          <p className="apple-lab-note mt-2">
            Blue vessels carry oxygen-poor blood to the lungs; red vessels carry oxygen-rich blood
            away from them. Labels sit on one scanned model, so check them against your textbook.
          </p>
        </div>
      </div>
    </div>
  );
}
