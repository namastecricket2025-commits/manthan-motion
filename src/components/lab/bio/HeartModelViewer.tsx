import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RotateCcw } from "lucide-react";

/**
 * Heart viewer built on a real textured 3D model (public/models/heart.glb).
 *
 * The model is a single mesh, so labels are numbered markers placed by hand on
 * its surface. `p` is in the model's own coordinates: x = back→front, y = up,
 * z = patient's left(−)→right(+). side "f" = visible from the front, "b" = from
 * the back. Check the labels against a textbook.
 *
 * Two rules keep the numbering readable, because a numbered label that moves is
 * worse than no label at all:
 *
 *   1. The number of a part is its position in PARTS, and nothing else — the
 *      same number on the dot, in the list under the stage and in the read-out.
 *      Numbers are never re-counted from whatever happens to be on screen.
 *   2. Selecting a part never moves the model. A part on the far side is drawn
 *      faded rather than hidden (so the set of numbers never changes as you
 *      orbit), and picking it says so and points at the Back button — only
 *      Front / Back / dragging turn the model.
 *
 * The stage is the lungs' and kidneys' stage: same `lab-split` → stage pane →
 * `lab-deck-pane` structure, so all three organ systems present the model first
 * and put the controls, the read-out and the structure list below it.
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
  { id: "rpv", name: "Right pulmonary veins (back view)", fn: "Bring oxygen-rich blood from the right lung to the right atrium.", color: "#f07890", p: [-0.0218, 0.1329, 0.2722], side: "b" },
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
    pin: null as string | null,
    pinFacing: true,
  });
  const [pin, setPin] = useState<string | null>(null);
  const [facing, setFacing] = useState(true);
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
        d.style.display = c.loaded ? "block" : "none";
        if (!c.loaded) return;
        /* A part on the far side is faded, never removed: the number stays on
           the same piece of anatomy in the same place, whatever the camera does. */
        d.style.opacity = (a.side === "f" ? cx > 0 : cx < 0) ? "1" : "0.42";
        v.set(...a.p);
        group.localToWorld(v);
        v.project(cam);
        d.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      });
      const sel = PARTS.find((a) => a.id === c.pin);
      if (sel) {
        const towards = sel.side === "f" ? cx > 0 : cx < 0;
        if (towards !== c.pinFacing) {
          c.pinFacing = towards;
          setFacing(towards);
        }
      }
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

  useEffect(() => {
    ctl.current.pin = pin;
    if (!pin) setFacing(true);
  }, [pin]);

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
  /**
   * Selecting a part only selects it. It used to also fly the camera to the
   * part's side, which rotated the whole diagram under the cursor — click 13
   * while reading the front view and every number you were looking at swapped
   * places. Facing is now the user's decision (Front / Back / drag), and a
   * picked part that faces away says so instead of spinning the model.
   */
  const pick = (id: string) => {
    setPin(pin === id ? null : id);
  };
  const sel = PARTS.find((p) => p.id === pin);

  const edge = "border-white/10";
  const txt = "text-slate-100";
  const sub = "text-slate-400";
  const btn = (on: boolean) =>
    `cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${edge} ${on ? "bg-[#6f7cff] text-white" : `${txt} hover:bg-white/10`}`;

  return (
    <div className="lab-split">
      <div className="lab-stage-pane lab-glass p-2.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate text-sm font-bold ${txt}`}>{label}</p>
            <p className={`hidden text-[11px] sm:block ${sub}`}>{blurb}</p>
          </div>
          <button type="button" className={btn(false)} onClick={fit}>
            <RotateCcw className="mr-1 inline h-3 w-3" />
            Fit view
          </button>
        </div>
        <div className="lab-model-stage relative h-[58vh] min-h-[340px] overflow-hidden rounded-xl border border-white/10 bg-[#08080a]">
          <div ref={holder} className="absolute inset-0" />
          {!ready && !failed && <div className={`absolute inset-0 grid place-items-center text-sm ${sub}`}>Loading heart model…</div>}
          {failed && <div className={`absolute inset-0 grid place-items-center px-6 text-center text-sm ${sub}`}>Could not load the heart model.</div>}
          {PARTS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              aria-pressed={pin === a.id}
              ref={(el) => {
                dots.current[a.id] = el;
              }}
              onClick={() => pick(a.id)}
              style={{ background: a.color, display: "none" }}
              className={`organ-dot absolute left-0 top-0 -ml-3 -mt-3 h-6 w-6 cursor-pointer rounded-full border-2 border-white text-[11px] font-bold text-white shadow transition-shadow ${pin === a.id ? "z-10 ring-2 ring-white" : ""}`}
            >
              {i + 1}
              {(all || pin === a.id) && (
                <span className="absolute left-7 top-0.5 whitespace-nowrap rounded-md bg-black/90 px-2 py-0.5 text-xs">{a.name}</span>
              )}
            </button>
          ))}
          {sel && !facing && (
            <p className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] rounded-lg border border-white/15 bg-black/75 px-2.5 py-1.5 text-[11px] leading-snug text-slate-200 backdrop-blur-sm">
              {sel.name} faces away from this view — tap <b className="font-semibold text-white">Back</b> to turn the model
              round.
            </p>
          )}
          <p className={`pointer-events-none absolute bottom-2 right-3 hidden text-[10px] ${sub} sm:block`}>
            drag orbit · scroll zoom · tap a numbered dot
          </p>
        </div>
      </div>

      <div className="lab-deck-pane lab-glass-deep space-y-3 p-3.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn(false)} onClick={() => side(1)}>
            Front
          </button>
          <button type="button" className={btn(false)} onClick={() => side(-1)}>
            Back
          </button>
          <button type="button" className={btn(xray)} onClick={() => setXray(!xray)}>
            X-ray
          </button>
          <button type="button" className={btn(all)} onClick={() => setAll(!all)}>
            All labels
          </button>
        </div>

        <div className={`space-y-2 text-xs ${sub}`}>
          <label className="flex items-center gap-2">
            Heart rate
            <input
              type="range"
              min={40}
              max={180}
              value={bpm}
              className="flex-1"
              onChange={(e) => {
                setBpm(+e.target.value);
                ctl.current.bpm = +e.target.value;
              }}
            />
            <b className={txt}>{bpm} bpm</b>
          </label>
          <p>One beat is two moves: the atria fill the ventricles, then the ventricles squeeze. A resting adult runs at 60–100 bpm.</p>
        </div>

        <div className={`min-h-20 rounded-xl border ${edge} p-3 text-xs leading-relaxed ${txt}`}>
          {sel ? (
            <>
              <b style={{ color: sel.color }}>{sel.name}</b>
              <br />
              {sel.fn}
            </>
          ) : (
            <span className={sub}>Tap a numbered dot on the model, or a structure below, to read what it does.</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {PARTS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a.id)}
              aria-pressed={pin === a.id}
              className={`lab-part-row flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs ${edge} ${txt} ${pin === a.id ? "bg-white/10" : ""}`}
            >
              <i className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: a.color }} />
              {i + 1}. {a.name}
            </button>
          ))}
        </div>

        <p className={`text-[10px] leading-relaxed ${sub}`}>
          Blue vessels carry oxygen-poor blood to the lungs; red vessels carry oxygen-rich blood away from them. The
          number of a part is the same on the model, in this list and in the read-out, and it never moves: a part on the
          far side is drawn faded, and Front / Back is what turns the model.
        </p>
      </div>
    </div>
  );
}
