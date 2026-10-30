import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { useStillMotion } from "@/lib/motion";
import {
  buildTract,
  formWeights,
  loadOrgans,
  STAGE_CAMERA,
  STAGE_CURVES,
  STAGE_FOOD_SIZE,
  toScene,
  type Tract,
} from "@/components/lab/bio/digestive-model";

/**
 * The digestive plate.
 *
 * This one is a journey rather than a structure: food is followed from the
 * mouth to the rectum, and the point of the plate is that the food changes as
 * it goes — a chewed bolus, a chyme cloud, nutrients crossing into the blood,
 * formed waste. Those are four objects that cross-fade along the route, so the
 * change happens while the food is inside an organ, not at the cut between two
 * stops.
 *
 * The liver is a real NIH Human Reference Atlas mesh. The mouth, throat,
 * oesophagus, stomach, gut and accessory ducts are modelled as one continuous
 * lumen, because stitched scans leave cut ends exactly where the eye looks
 * first. See digestive-model.ts.
 *
 * The mouth is part of the model, not a drawing in the margin: an oval face cut
 * open, teeth on its rim, the tongue on the floor and a pharynx that meets the
 * oesophagus at its own first point. The bolus starts between the teeth, so the
 * first stop is something you watch rather than something you are told.
 *
 * The organ holding the food fades to a third of its opacity while the rest
 * stay solid, so the bolus is visible without making the whole model ghostly.
 * The camera glides to each stop; dragging takes it back.
 */

type Stage = {
  id: string;
  name: string;
  short: string;
  /** Real time spent at this stop. The animation is not this. */
  duration: string;
  /** What the food is called here. */
  form: string;
  absorbs: string;
  what: string;
  qa: Array<{ q: string; a: string }>;
  /** Seconds of animation for this stage. */
  seconds: number;
};

const STAGES: Stage[] = [
  {
    id: "mouth",
    name: "Mouth",
    short: "Mouth",
    duration: "≈ 30 s",
    form: "Bolus",
    absorbs: "Nothing — digestion starts",
    what: "Teeth cut and grind while saliva wets the food and its amylase begins breaking starch into sugars. The tongue shapes the mass into a bolus and pushes it to the back of the mouth.",
    qa: [
      {
        q: "Why doesn't food go down the windpipe?",
        a: "The epiglottis folds over the larynx during the swallow, and the bolus is steered into the oesophagus behind it. Talking while swallowing is what defeats that flap.",
      },
      {
        q: "Why does saliva matter?",
        a: "It lubricates the bolus and starts starch digestion. Without it, dry food is genuinely hard to swallow — which is why you produce about a litre a day.",
      },
    ],
    seconds: 2.6,
  },
  {
    id: "oesophagus",
    name: "Oesophagus",
    short: "Oesophagus",
    duration: "≈ 8 s",
    form: "Bolus",
    absorbs: "Nothing — transport",
    what: "Not a slide. A ring of circular muscle behind the bolus squeezes while the longitudinal layer ahead shortens, so a wave — peristalsis — carries it down. Gravity helps, but you can swallow lying down, or upside down.",
    qa: [
      {
        q: "How does it move without gravity?",
        a: "Peristalsis. The tube's muscle layers make a travelling contraction; the bolus is pushed, not dropped.",
      },
      {
        q: "Why doesn't it come back up?",
        a: "The lower oesophageal sphincter stays closed except during a swallow. Reflux is that valve opening when it should not.",
      },
    ],
    seconds: 1.7,
  },
  {
    id: "stomach",
    name: "Stomach",
    short: "Stomach",
    duration: "2–4 h",
    form: "Chyme",
    absorbs: "Water, alcohol, some drugs",
    what: "Acid at pH 1.5–3.5 unfolds proteins and pepsin starts cutting them. Three muscle layers churn the bolus into chyme, and the pylorus lets it out a spoonful at a time. Watch the lump break down into a cloud here — that is the churning.",
    qa: [
      {
        q: "Why doesn't acid digest the stomach?",
        a: "The lining secretes a bicarbonate-rich mucus and replaces its cells every few days. The acid is dangerous to that lining — an ulcer is what happens when the protection fails.",
      },
      {
        q: "Why does food stay so long?",
        a: "The pylorus meters chyme out by particle size. Fat slows emptying, which is why a rich meal keeps you full for hours.",
      },
    ],
    seconds: 3.2,
  },
  {
    id: "small",
    name: "Small intestine",
    short: "Small intestine",
    duration: "4–6 h",
    form: "Chyme → nutrients",
    absorbs: "≈ 90% of nutrients and most water",
    what: "The duodenum neutralises acid with bicarbonate and receives bile and pancreatic enzymes. Villi and microvilli give about 250 m² of absorbing surface; amino acids, sugars and fats cross into blood and lymph here. The cloud thins out into single nutrients as it runs.",
    qa: [
      {
        q: "Why is it so long?",
        a: "Area and time. Six to seven metres folded into the abdomen, with villi on top, is what it takes to absorb a day's food.",
      },
      {
        q: "Where does bile come from?",
        a: "The liver makes it, the gallbladder stores it, and the duodenum receives it to emulsify fat into droplets the enzymes can attack.",
      },
    ],
    seconds: 3.8,
  },
  {
    id: "large",
    name: "Large intestine",
    short: "Large intestine",
    duration: "12–48 h",
    form: "Waste",
    absorbs: "Water and electrolytes",
    what: "What is left is mostly fibre, bacteria and water. The colon reclaims the water and salts, its haustral pouches knead the residue, and gut bacteria ferment fibre and make vitamin K and some B vitamins. The stream compacts into a formed mass as the water leaves.",
    qa: [
      {
        q: "Why does it take so long?",
        a: "Water recovery is slow. The longer the transit, the drier the stool — which is why the colon is where constipation happens.",
      },
      {
        q: "Why is it segmented?",
        a: "The haustra are pouches between the taeniae coli. They knead and hold the contents instead of pushing them steadily along.",
      },
    ],
    seconds: 4.2,
  },
  {
    id: "rectum",
    name: "Rectum",
    short: "Rectum",
    duration: "Minutes to hours",
    form: "Faeces",
    absorbs: "Water, before storage",
    what: "The rectum stores the waste until stretch receptors signal fullness. The internal sphincter is involuntary; the external one is skeletal muscle you control, which is what buys the time to find a bathroom.",
    qa: [
      {
        q: "Why can it wait?",
        a: "Two sphincters: one smooth muscle that opens reflexively, one you control. The cortex can hold the second shut for a while.",
      },
      {
        q: "What happens if you hold it too long?",
        a: "The colon keeps reclaiming water, so the stool hardens. The signal also fades, which is how people lose the urge.",
      },
    ],
    seconds: 1.7,
  },
];

const ACCESSORY = [
  {
    name: "Liver",
    color: "#6b3a34",
    note: "makes bile and processes everything the gut absorbs.",
  },
  {
    name: "Gallbladder",
    color: "#7f8a5f",
    note: "stores bile and squeezes it into the duodenum when fat arrives.",
  },
  {
    name: "Pancreas",
    color: "#c9a97a",
    note: "sends bicarbonate and enzymes for fat, protein and starch.",
  },
];

const LABELS: Array<{ id: string; text: string }> = [
  { id: "liver", text: "Liver" },
  { id: "stomach", text: "Stomach" },
  { id: "gallbladder", text: "Gallbladder" },
  { id: "pancreas", text: "Pancreas" },
  { id: "small", text: "Small intestine" },
  { id: "large", text: "Large intestine" },
  { id: "rectum", text: "Rectum" },
];

export default function DigestiveStage({ label, blurb }: { label: string; blurb: string }) {
  const still = useStillMotion();
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const engineRef = useRef<{ fit: () => void; focus: (index: number) => void } | null>(null);
  const ctl = useRef({
    stage: 0,
    progress: 0,
    running: false,
    revealed: false,
    arrived: false,
  });

  const entry = STAGES[stage];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

    const tract: Tract = buildTract();
    scene.add(tract.group);

    /* The plate is tall and narrow — the oesophagus cut at the top, the rectum
       at the bottom — so home is pulled back far enough to hold both ends. */
    const home = {
      target: toScene([0.015, 0.305, 0.0]),
      look: toScene([0.015, 0.305, 0.0]).add(new THREE.Vector3(0.5, 0.12, 6.1)),
    };
    camera.position.copy(home.look);

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(home.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.6;
    controls.maxDistance = 9;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI - 0.2;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x131a25, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(3.5, 5.5, 4.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe7ff, 0.5);
    fill.position.set(-4.5, 1.5, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(-3, 4, -5);
    scene.add(rim);

    let disposed = false;
    let pending = 0;
    const settle = () => {
      pending -= 1;
      if (pending <= 0 && !disposed) setLoading(false);
    };
    pending = loadOrgans(tract, settle, settle);

    const camGoal = camera.position.clone();
    const targetGoal = controls.target.clone();
    let glide = false;

    const focus = (index: number) => {
      const stop = STAGE_CAMERA[Math.min(index, STAGE_CAMERA.length - 1)];
      const target = toScene(stop.at);
      const direction = new THREE.Vector3(
        Math.sin(stop.azimuth),
        0.16,
        Math.cos(stop.azimuth),
      ).normalize();
      camGoal.copy(target).add(direction.multiplyScalar(stop.distance));
      targetGoal.copy(target);
      glide = true;
    };

    const fit = () => {
      camGoal.copy(home.look);
      targetGoal.copy(home.target);
      glide = true;
    };
    engineRef.current = { fit, focus };

    const stopDrag = () => {
      glide = false;
    };
    controls.addEventListener("start", stopDrag);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let raf = 0;
    let last = performance.now();
    const projected = new THREE.Vector3();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const state = ctl.current;
      if (state.running) {
        state.progress += dt / STAGES[state.stage].seconds;
        if (state.progress >= 1) {
          if (state.stage < STAGES.length - 1) {
            state.stage += 1;
            state.progress = 0;
            setStage(state.stage);
            focus(state.stage);
          } else {
            state.progress = 1;
            state.running = false;
            state.arrived = true;
            setRunning(false);
            setArrived(true);
          }
        }
      }

      const overall = (state.stage + state.progress) / STAGES.length;
      if (state.revealed) {
        const point = STAGE_CURVES[state.stage].getPointAt(
          Math.min(1, Math.max(0, state.progress)),
        );
        tract.food.set(
          formWeights(overall),
          point,
          STAGE_FOOD_SIZE[Math.min(state.stage, STAGE_FOOD_SIZE.length - 1)],
          now / 1000,
        );
      } else {
        tract.food.root.visible = false;
      }

      for (const item of tract.fading) {
        const material = item.material as THREE.MeshPhysicalMaterial;
        const goal = item.stages.includes(state.stage) ? 0.3 : 1;
        let next = material.opacity + (goal - material.opacity) * 0.1;
        if (Math.abs(next - goal) < 0.004) next = goal;
        material.opacity = next;
        const transparent = next < 0.995;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.depthWrite = !transparent;
          material.needsUpdate = true;
        }
      }

      if (glide) {
        controls.target.lerp(targetGoal, 0.07);
        camera.position.lerp(camGoal, 0.07);
        if (
          camera.position.distanceTo(camGoal) < 0.01 &&
          controls.target.distanceTo(targetGoal) < 0.004
        ) {
          glide = false;
        }
      }

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${overall.toFixed(4)})`;
      }

      controls.update();
      renderer.render(scene, camera);

      /* The labels are pinned to points on the organs, so they follow an orbit
         and dim when their organ turns away. */
      const rect = canvas.getBoundingClientRect();
      for (const item of LABELS) {
        const el = labelRefs.current[item.id];
        if (!el) continue;
        const anchor = tract.anchors[item.id];
        if (!anchor) continue;
        projected.copy(anchor).applyMatrix4(tract.body.matrixWorld).project(camera);
        const visible = projected.z < 1;
        el.style.opacity = visible ? (projected.z > 0.985 ? "0.45" : "1") : "0";
        el.style.transform = `translate(-50%, -50%) translate(${((projected.x * 0.5 + 0.5) * rect.width).toFixed(1)}px, ${((-projected.y * 0.5 + 0.5) * rect.height).toFixed(1)}px)`;
      }
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.removeEventListener("start", stopDrag);
      controls.dispose();
      engineRef.current = null;
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      scene.clear();
      renderer.dispose();
    };
  }, []);

  const goTo = (index: number) => {
    ctl.current.stage = index;
    ctl.current.progress = 0.18;
    ctl.current.running = false;
    ctl.current.revealed = true;
    ctl.current.arrived = false;
    setStage(index);
    setRevealed(true);
    setArrived(false);
    setRunning(false);
    engineRef.current?.focus(index);
  };

  const toggle = () => {
    if (running) {
      ctl.current.running = false;
      setRunning(false);
      return;
    }
    if (still) {
      ctl.current.stage = STAGES.length - 1;
      ctl.current.progress = 1;
      ctl.current.revealed = true;
      ctl.current.arrived = true;
      ctl.current.running = false;
      setStage(STAGES.length - 1);
      setRevealed(true);
      setArrived(true);
      setRunning(false);
      engineRef.current?.focus(STAGES.length - 1);
      return;
    }
    if (ctl.current.arrived) {
      ctl.current.stage = 0;
      ctl.current.progress = 0;
      setStage(0);
      setArrived(false);
      engineRef.current?.focus(0);
    }
    ctl.current.revealed = true;
    ctl.current.running = true;
    setRevealed(true);
    setArrived(false);
    setRunning(true);
  };

  const reset = () => {
    ctl.current = {
      stage: 0,
      progress: 0,
      running: false,
      revealed: false,
      arrived: false,
    };
    setStage(0);
    setRevealed(false);
    setArrived(false);
    setRunning(false);
    engineRef.current?.fit();
  };

  const status = running ? "Travelling" : arrived ? "Delivered" : revealed ? "Paused" : "Idle";

  return (
    <div className="flex flex-col gap-3">
      <div className="apple-lab-card p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Digestive journey">
            {STAGES.map((stop, index) => (
              <button
                key={stop.id}
                type="button"
                role="tab"
                aria-selected={stage === index}
                data-active={stage === index}
                onClick={() => goTo(index)}
                className="apple-lab-btn !gap-1.5 !px-2.5 !py-1.5 !text-[11px]"
              >
                <span className="text-[9px] tabular-nums opacity-55">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {stop.short}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="apple-lab-btn apple-lab-btn--solid !px-3 !py-1.5 !text-[11.5px]"
              onClick={toggle}
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pause" : arrived ? "Run again" : "Run"}
            </button>
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1.5"
              onClick={reset}
              aria-label="Reset the journey"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="apple-lab-btn !px-2.5 !py-1.5"
              onClick={() => engineRef.current?.fit()}
              aria-label="Fit the tract in view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[var(--lab-line-soft)]">
          <div
            ref={barRef}
            className="h-full w-full origin-left rounded-full bg-[var(--lab-ink-dim)]"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="apple-lab-card relative overflow-hidden p-2.5 sm:p-3">
          <div className="mb-2 flex items-start justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="apple-lab-title truncate text-[13px]">{label}</p>
              <p className="truncate text-[11px] text-[var(--lab-ink-dim)]">{blurb}</p>
            </div>
            <span className="apple-lab-chip shrink-0">{status}</span>
          </div>

          <div className="apple-lab-stage relative">
            <canvas
              ref={canvasRef}
              className="apple-lab-stage__canvas"
              style={{ aspectRatio: "1.22" }}
              role="img"
              aria-label="Interactive 3D digestive tract built from NIH reference anatomy. Drag to orbit, scroll to zoom, right-drag to pan."
              onContextMenu={(event) => event.preventDefault()}
            />

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {LABELS.map((item) => (
                <span
                  key={item.id}
                  ref={(node) => {
                    labelRefs.current[item.id] = node;
                  }}
                  className="absolute left-0 top-0 flex items-center gap-1.5 whitespace-nowrap text-[9.5px] font-medium uppercase tracking-[0.14em] text-[var(--lab-ink-micro)] transition-opacity duration-200 max-sm:hidden"
                >
                  <i className="h-1 w-1 rounded-full bg-[var(--lab-ink-dim)]" />
                  {item.text}
                </span>
              ))}
            </div>

            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
              <span className="apple-lab-chip">
                {String(stage + 1).padStart(2, "0")} · {entry.name}
              </span>
              <span className="apple-lab-chip">{entry.form}</span>
              {loading ? <span className="apple-lab-chip">loading anatomy</span> : null}
            </div>

            <span className="apple-lab-chip pointer-events-none absolute bottom-3 right-3 !text-[10px] max-sm:hidden">
              drag orbit · scroll zoom · right-drag pan
            </span>
          </div>

          <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-[var(--lab-ink-micro)]">
            The liver is a NIH Human Reference Atlas mesh; the mouth, throat,
            oesophagus, stomach, gut and ducts are modelled as one continuous
            lumen, so the food never crosses a cut edge. The mouth is cut open
            above the oesophagus and the bolus starts between its teeth. The
            route through the gut follows the same centre-line the tube is
            built on; it does not trace every metre of the small intestine.
            Times on the panel are the body's, not the animation's.
          </p>
        </div>

        <aside className="flex flex-col gap-3">
          <section className="apple-lab-card p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="apple-lab-micro">Journey</p>
              <span className="text-[10.5px] text-[var(--lab-ink-micro)]">
                {stage + 1} / {STAGES.length}
              </span>
            </div>

            <h3 className="apple-lab-title mt-1.5 text-[17px]">{entry.name}</h3>

            <div className="mt-2 flex flex-col">
              <Reading label="Duration" value={entry.duration} />
              <Reading label="Food form" value={entry.form} />
              <Reading label="Absorbed" value={entry.absorbs} />
            </div>

            <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
              {entry.what}
            </p>

            <div className="mt-3 border-t border-[var(--lab-line-soft)] pt-2.5">
              <p className="apple-lab-micro">Questions here</p>
              <div className="mt-1.5 flex flex-col gap-2">
                {entry.qa.map((item) => (
                  <div key={item.q}>
                    <p className="text-[11.5px] font-semibold text-[var(--lab-ink)]">
                      {item.q}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="apple-lab-card p-3.5">
            <p className="apple-lab-micro">Also on the plate</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {ACCESSORY.map((organ) => (
                <p key={organ.name} className="flex gap-2 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  <i
                    className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: organ.color }}
                  />
                  <span>
                    <b className="font-semibold text-[var(--lab-ink)]">{organ.name}</b> —{" "}
                    {organ.note}
                  </span>
                </p>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--lab-line-soft)] pt-2.5 text-center">
              <Stat label="Length" value="8–9 m" />
              <Stat label="Transit" value="1–3 days" />
              <Stat label="Surface" value="≈ 250 m²" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--lab-line-soft)] py-1.5 text-[11.5px] last:border-0">
      <span className="shrink-0 text-[var(--lab-ink-dim)]">{label}</span>
      <span className="apple-lab-value text-right font-semibold">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="apple-lab-micro">{label}</p>
      <p className="apple-lab-value mt-1 text-[12px] font-semibold">{value}</p>
    </div>
  );
}
