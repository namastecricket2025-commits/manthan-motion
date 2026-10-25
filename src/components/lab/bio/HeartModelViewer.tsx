import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    cam.position.set(12, 0.8, 0);
    c.cam = cam;
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    c.controls = controls;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556688, 1.6));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.4);
    d1.position.set(6, 6, 4);
    scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.8);
    d2.position.set(-6, 2, -5);
    scene.add(d2);
    const group = new THREE.Group();
    group.scale.setScalar(SCALE);
    scene.add(group);
    let disposed = false;
    new GLTFLoader().load(
      MODEL_URL,
      (g) => {
        if (disposed) return;
        group.add(g.scene);
        g.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m) mats.current.push(m);
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
      const pulse = still ? 0 : ph < 0.15 ? Math.sin((Math.PI * ph) / 0.15) : 0;
      group.scale.setScalar(SCALE * (1 + 0.012 * pulse));
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
    // Deliberately does not move the camera. Swinging the model round to face
    // the picked side made the numbered dots jump to new places, so the dot
    // you just clicked was no longer where you clicked it. Keep the heart
    // exactly where the student left it; Front/Back are there for turning.
    setPin((current) => (current === id ? null : id));
  };
  const sel = PARTS.find((p) => p.id === pin);
  /* The stage, its header and the deck below are one dark instrument face in
     both themes — the model needs a black studio behind it, and a panel split
     between a black stage and a paper deck read as two different tools. The
     ink therefore stays light in light mode too; the page around the panel is
     what follows the theme. */
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
          {!ready && !failed && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
              Loading the heart model…
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-slate-400">
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
              className={`organ-dot absolute left-0 top-0 cursor-pointer rounded-full border-2 border-white text-[11px] font-bold text-white shadow ${
                pin === a.id
                  ? "z-10 -ml-3.5 -mt-3.5 h-7 w-7 ring-2 ring-white/70"
                  : "-ml-3 -mt-3 h-6 w-6"
              }`}
            >
              {i + 1}
              {(all || pin === a.id) && (
                <span className="absolute left-8 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[10px] font-medium text-white">
                  {a.name}
                </span>
              )}
            </button>
          ))}
          <p className="pointer-events-none absolute bottom-2 right-3 hidden text-[10px] text-slate-400 sm:block">
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
          <button type="button" className={btn(xray)} onClick={() => setXray((v) => !v)} aria-pressed={xray}>
            X-ray
          </button>
          <button type="button" className={btn(all)} onClick={() => setAll((v) => !v)} aria-pressed={all}>
            All labels
          </button>
        </div>

        <label className={`flex items-center gap-2 text-xs ${sub}`}>
          Heart rate
          <input
            type="range"
            min={40}
            max={180}
            value={bpm}
            className="flex-1"
            aria-label="Heart rate"
            onChange={(e) => {
              setBpm(+e.target.value);
              ctl.current.bpm = +e.target.value;
            }}
          />
          <b className={`${txt} tabular-nums`}>{bpm} bpm</b>
        </label>

        <div className={`min-h-20 rounded-xl border ${edge} p-3 text-xs leading-relaxed ${txt}`}>
          {sel ? (
            <>
              <b style={{ color: sel.color }}>{sel.name}</b>
              <br />
              {sel.fn}
            </>
          ) : (
            <span className={sub}>
              Tap a numbered dot on the model, or a structure below, to read what it does.
            </span>
          )}
        </div>

        <div className="organ-scroll max-h-[240px] overflow-y-auto pr-1">
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

        <p className={`text-[10px] leading-relaxed ${sub}`}>
          Blue vessels carry oxygen-poor blood to the lungs; red vessels carry oxygen-rich blood
          away from them. Labels were placed by hand on one scanned model, so check them against
          your textbook.
        </p>
      </div>
    </div>
  );
}
