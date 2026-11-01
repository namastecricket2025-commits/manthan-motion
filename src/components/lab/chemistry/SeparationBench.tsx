import {
  BenchStage,
  LiveDot,
  Picker,
  Questions,
  StageStat,
  StageToggle,
  ink,
  plate,
  AMBER,
  CYAN,
  VIOLET,
} from "@/components/lab/bench-atoms";
import { useAnimationFrame } from "motion/react";
import { useMemo, useRef, useState } from "react";

/**
 * Separation techniques — Class 9.
 *
 * Separation is not a recipe list; it is a decision made from what the mixture
 * is made of. The bench asks for both halves: choose the mixture, then choose
 * the technique — and it answers with why, in terms of the property the
 * technique uses.
 *
 *   sand + water        insoluble solid      → filtration
 *   salt solution       dissolved solid      → evaporation (or distillation)
 *   ink                 dyes in a solvent    → chromatography
 *   oil + water         immiscible liquids   → separating funnel
 *   ammonium chloride   sublimes on heating  → sublimation
 *   iron + sulphur      one part is magnetic → magnetic separation
 *
 * The apparatus changes with the technique, and the progress slider runs it:
 * filtrate drips, the solvent front climbs the paper, the lower layer taps off.
 * A wrong pairing is not just marked wrong — it says which property is missing,
 * which is the actual lesson.
 */

type MixtureId = "sand" | "salt" | "ink" | "oil" | "ammonium" | "iron";
type TechniqueId = "filtration" | "evaporation" | "distillation" | "chromatography" | "funnel" | "sublimation" | "magnetic";

const MIXTURES: Array<{ id: MixtureId; label: string; make: string }> = [
  { id: "sand", label: "Sand + water", make: "a solid that does not dissolve" },
  { id: "salt", label: "Salt solution", make: "a solid dissolved in water" },
  { id: "ink", label: "Ink", make: "dyes dissolved in a solvent" },
  { id: "oil", label: "Oil + water", make: "two liquids that do not mix" },
  { id: "ammonium", label: "Ammonium chloride + salt", make: "one solid sublimes, the other does not" },
  { id: "iron", label: "Iron filings + sulphur", make: "one component is magnetic" },
];

const TECHNIQUES: Array<{
  id: TechniqueId;
  label: string;
  principle: string;
  valid: MixtureId[];
  gives: string;
  fail: string;
}> = [
  {
    id: "filtration",
    label: "Filtration",
    principle: "A filter paper passes the liquid but holds back an insoluble solid.",
    valid: ["sand"],
    gives: "Residue on the paper · clear filtrate below",
    fail: "Filtration needs a solid that does not dissolve. Here the solid is either dissolved or there is no solid at all, so the paper lets everything through.",
  },
  {
    id: "evaporation",
    label: "Evaporation",
    principle: "The solvent is driven off as vapour, leaving the dissolved solid behind.",
    valid: ["salt"],
    gives: "Solid crystals in the dish · water lost as vapour",
    fail: "Evaporation leaves whatever was dissolved. With no dissolved solid in the mixture, there is nothing left in the dish once the liquid is gone.",
  },
  {
    id: "distillation",
    label: "Distillation",
    principle: "The liquid is boiled off and condensed back — the solvent is recovered, not lost.",
    valid: ["salt", "sand"],
    gives: "Pure condensed liquid · solid left in the flask",
    fail: "Distillation recovers a liquid from a solid or from a less volatile liquid. This mixture is either two liquids that distil together or a solid that is not in solution.",
  },
  {
    id: "chromatography",
    label: "Chromatography",
    principle: "Components move up the paper at different speeds because they are differently soluble.",
    valid: ["ink"],
    gives: "Separate coloured bands along the paper",
    fail: "Chromatography separates things that are all dissolved and travel at different speeds. A single dissolved solid, or an undissolved one, gives no bands.",
  },
  {
    id: "funnel",
    label: "Separating funnel",
    principle: "Two immiscible liquids settle in layers; the denser one is tapped off first.",
    valid: ["oil"],
    gives: "Water layer below · oil layer above",
    fail: "A separating funnel needs two liquids that do not mix and settle in layers. A solution stays mixed, and a solid cannot be tapped off.",
  },
  {
    id: "sublimation",
    label: "Sublimation",
    principle: "On gentle heating one solid turns straight to vapour and re-forms as crystals on a cold surface.",
    valid: ["ammonium"],
    gives: "Ammonium chloride crystals on the cold funnel · salt left below",
    fail: "Sublimation needs a solid that changes straight to vapour. None of these components does, so heating only drives off water or burns the mixture.",
  },
  {
    id: "magnetic",
    label: "Magnetic separation",
    principle: "A magnet lifts the magnetic component and leaves the rest.",
    valid: ["iron"],
    gives: "Iron filings on the magnet · sulphur left in the dish",
    fail: "Magnetic separation needs one component a magnet can attract. Nothing here is magnetic — sand, salt, dyes and oil all ignore it.",
  },
];

const FAIL_REASON: Record<TechniqueId, string> = {
  filtration: "no insoluble solid to catch",
  evaporation: "nothing dissolved to leave behind",
  distillation: "no liquid to recover from a solid or a single liquid",
  chromatography: "nothing that travels at different speeds",
  funnel: "no two immiscible layers",
  sublimation: "no solid that sublimes",
  magnetic: "nothing magnetic",
};

const W = 860;
const H = 440;

/** Seconds one full apparatus run takes. */
const RUN_SECONDS = 9;

export function SeparationBench() {
  const [mixture, setMixture] = useState<MixtureId>("sand");
  const [technique, setTechnique] = useState<TechniqueId>("filtration");
  const [t, setT] = useState(0.35);
  const [running, setRunning] = useState(false);

  const mix = MIXTURES.find((m) => m.id === mixture)!;
  const tech = TECHNIQUES.find((x) => x.id === technique)!;
  const works = tech.valid.includes(mixture);

  /* ---- the clock ------------------------------------------------------ */
  const last = useRef<number | null>(null);
  useAnimationFrame((now) => {
    if (!running) {
      last.current = now;
      return;
    }
    if (last.current === null) last.current = now;
    const dt = Math.min(64, now - last.current);
    last.current = now;
    const next = t + dt / 1000 / RUN_SECONDS;
    if (next >= 1) {
      setT(1);
      setRunning(false);
    } else {
      setT(next);
    }
  });

  const toggleRun = () => {
    if (!running && t >= 0.999) setT(0);
    last.current = null;
    setRunning((value) => !value);
  };

  const verdict = useMemo(() => {
    if (works) {
      return {
        ok: true,
        title: `${tech.label} separates ${mix.label.toLowerCase()}.`,
        body: `${tech.principle} ${tech.gives}.`,
      };
    }
    return {
      ok: false,
      title: `${tech.label} will not separate this mixture.`,
      body: `${tech.fail} (${FAIL_REASON[technique]})`,
    };
  }, [works, tech, mix, technique]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.9fr)] lg:items-start">
      <BenchStage
        kicker="Class 9 · Separation of substances"
        title={`Run the ${tech.label.toLowerCase()} and watch what separates`}
        meta={
          <>
            <span className="apple-lab-chip">{mix.label}</span>
            <LiveDot on={running} label={running ? "running" : t >= 1 ? "finished" : works ? "works here" : "wrong pairing"} />
          </>
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <div className="sm:max-w-[260px]">
              <Picker label="Mixture on the bench" value={mixture} options={MIXTURES.map((m) => ({ id: m.id, label: m.label }))} onChange={(next) => { setMixture(next); setRunning(false); setT(0.35); }} />
            </div>
            <div className="sm:max-w-[300px]">
              <Picker label="Technique" value={technique} options={TECHNIQUES.map((x) => ({ id: x.id, label: x.label }))} onChange={(next) => { setTechnique(next); setRunning(false); setT(0.35); }} />
            </div>
          </div>
        }
        rail={
          <>
            <button
              type="button"
              className={`apple-lab-btn ${running ? "apple-lab-btn--stop" : "apple-lab-btn--run"}`}
              onClick={toggleRun}
            >
              {running ? "Pause" : t >= 1 ? "Run it again" : t > 0 ? "Resume" : "Run the apparatus"}
            </button>
            <button type="button" className="apple-lab-btn" onClick={() => { setRunning(false); setT(0); }} disabled={t === 0}>
              Reset
            </button>
            <span className="lab-stage-track" aria-hidden="true">
              <i style={{ width: `${(t * 100).toFixed(0)}%` }} />
            </span>
            <span className="apple-lab-value text-[12px] font-semibold tabular-nums">
              {Math.round(t * 100)}% · {tech.label.toLowerCase()}
            </span>
          </>
        }
        stats={
          <>
            <StageStat label="Mixture" value={mix.label} />
            <StageStat label="It is" value={mix.make} tone="cyan" />
            <StageStat label="Technique" value={tech.label} tone={works ? "mint" : "amber"} />
            <StageStat label="You get" value={works ? tech.gives : "— nothing — wrong property"} tone={works ? "mint" : "amber"} />
          </>
        }
        note={
          works
            ? `${tech.principle} Watch the run: ${tech.gives.toLowerCase()}.`
            : `${mix.label} is ${mix.make}. ${tech.fail}`
        }
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Apparatus for ${tech.label.toLowerCase()}`}>
          {/* One shared enlargement around the apparatus' own centre. The
              drawings were authored small in a 720-wide plate, which left a
              third of the card empty on a laptop; the new plate is wider and
              taller, so the same group is centred on its middle and grown a
              little further. */}
          <g transform="translate(430 222) scale(1.16) translate(-360 -196)">
            {technique === "filtration" && <Filtration t={t} />}
            {technique === "evaporation" && <Evaporation t={t} />}
            {technique === "distillation" && <Distillation t={t} />}
            {technique === "chromatography" && <Chromatography t={t} />}
            {technique === "funnel" && <SeparatingFunnel t={t} />}
            {technique === "sublimation" && <Sublimation t={t} />}
            {technique === "magnetic" && <Magnetic t={t} />}
          </g>
        </svg>
      </BenchStage>

      <div className="flex flex-col gap-3">
        {/* The verdict belongs beside the choice, not on top of the drawing. */}
        <div
          className={`rounded-xl border px-3.5 py-3 ${works ? "border-[color-mix(in_srgb,var(--lab-diagram-mint)_45%,transparent)]" : "border-[color-mix(in_srgb,var(--lab-diagram-amber)_45%,transparent)]"}`}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: works ? "var(--lab-diagram-mint)" : "var(--lab-diagram-amber)" }}>
            <i className="h-1.5 w-1.5 rounded-full" style={{ background: works ? "var(--lab-diagram-mint)" : "var(--lab-diagram-amber)" }} />
            {works ? "This one works" : "This one cannot work"}
          </p>
          <p className="mt-1.5 text-[12.5px] font-semibold leading-snug">{verdict.title}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">{verdict.body}</p>
        </div>

        <div className="apple-lab-card px-3 py-2.5">
          <p className="apple-lab-micro">The rule behind all seven</p>
          <p className="apple-lab-value mt-1 text-[12.5px] leading-relaxed">
            Every separation technique exploits one difference: particle size, solubility, boiling
            point, adsorption, density, the ability to sublime, or magnetism. Name the difference
            first and the technique follows.
          </p>
        </div>

        <Questions
          columns={1}
          items={[
            { q: "Why can't filtration separate salt from water?", a: "Salt is dissolved, so it passes through the filter paper with the water. Filtration only holds back particles big enough to be trapped — it separates by size, not by dissolving." },
            { q: "Why is distillation better than evaporation for sea water?", a: "Evaporation gives you the salt but loses the water. Distillation condenses the vapour and keeps the water too, which is what a coastal or arid region actually needs." },
            { q: "Why do the ink bands separate?", a: "Each dye has a different solubility and sticks to the paper differently, so the solvent carries them up at different speeds. The most soluble, least sticky dye travels furthest." },
            { q: "Why must the ammonium chloride be heated gently?", a: "It sublimes below the temperature at which the salt would melt or react. Strong heating chars the mixture and the white crystals on the cold surface stop being ammonium chloride." },
          ]}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Apparatus plates                                                    */
/* ------------------------------------------------------------------ */

function Filtration({ t }: { t: number }) {
  const filtrate = 0.25 + 0.55 * t;
  const sandInPaper = Math.min(1, t * 2.2);
  return (
    <g>
      {/* Funnel */}
      <path d="M 300 70 L 420 70 L 372 148 L 348 148 Z" fill={plate(0.5)} stroke={ink(0.45)} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M 348 148 L 348 186 L 372 186 L 372 148" fill={plate(0.5)} stroke={ink(0.45)} strokeWidth={1.8} />
      {/* Filter paper cone */}
      <path d="M 308 78 L 412 78 L 368 142 L 352 142 Z" fill={plate(0.75)} stroke={ink(0.28)} strokeWidth={1.2} />
      <path d="M 312 82 L 408 82 L 366 136 L 354 136 Z" fill={`rgba(190, 150, 90, ${0.25 + 0.5 * sandInPaper})`} />
      {/* Muddy mixture above the paper, clearing as it filters */}
      <rect x={312} y={86} width={96} height={14} fill={`rgba(150, 120, 80, ${0.55 * (1 - t)})`} />
      {/* Drips */}
      {[0, 1, 2].map((i) => {
        const phase = (t * 3 + i / 3) % 1;
        if (t <= 0.02) return null;
        return <circle key={i} cx={360} cy={196 + phase * 60} r={2.6} fill={CYAN} opacity={1 - phase * 0.4} />;
      })}
      {/* Beaker */}
      <path d="M 300 260 L 300 320 Q 300 330 312 330 L 408 330 Q 420 330 420 320 L 420 260" fill={plate(0.35)} stroke={ink(0.4)} strokeWidth={1.6} />
      <rect x={302} y={330 - filtrate * 58} width={116} height={filtrate * 58} fill={CYAN} opacity={0.28} />
      <text x={360} y={348} textAnchor="middle" fontSize={10.5} fill={ink(0.55)}>filtrate</text>
      <text x={460} y={110} fontSize={10.5} fill={ink(0.6)}>filter paper</text>
      <line x1={430} y1={108} x2={408} y2={94} stroke={ink(0.3)} strokeWidth={1} />
      <text x={460} y={150} fontSize={10.5} fill={ink(0.6)}>insoluble solid stays</text>
      <line x1={452} y1={146} x2={390} y2={126} stroke={ink(0.3)} strokeWidth={1} />
    </g>
  );
}

function Evaporation({ t }: { t: number }) {
  const level = 0.75 - 0.65 * t;
  return (
    <g>
      {/* Burner, under the dish */}
      <path d="M 330 330 L 390 330 L 378 310 L 342 310 Z" fill={plate(0.6)} stroke={ink(0.35)} strokeWidth={1.4} />
      <path d="M 360 310 Q 352 298 360 288 Q 368 278 360 268" fill="none" stroke={AMBER} strokeWidth={2.2} opacity={0.65} />
      {/* Shallow evaporating dish */}
      <path d="M 280 240 L 440 240 L 420 268 Q 360 284 300 268 Z" fill={plate(0.55)} stroke={ink(0.45)} strokeWidth={1.8} />
      <path d={`M 296 ${268 - level * 18} L 424 ${268 - level * 18} L 412 ${268 - level * 8} Q 360 ${278 - level * 6} 308 ${268 - level * 8} Z`} fill={CYAN} opacity={0.35} />
      {/* Salt crystals appear as the water leaves */}
      {Array.from({ length: 18 }, (_, i) => {
        const appear = t * 18 > i + 2;
        const x = 318 + ((i * 37) % 84);
        const y = 266 + ((i * 13) % 10);
        return appear ? <rect key={i} x={x} y={y} width={4} height={4} fill={ink(0.6)} transform={`rotate(35 ${x} ${y})`} /> : null;
      })}
      {/* Steam */}
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M ${330 + i * 18} 236 Q ${322 + i * 18} 214 ${334 + i * 18} 196 Q ${344 + i * 18} 180 ${336 + i * 18} 164`}
          fill="none"
          stroke={ink(0.22)}
          strokeWidth={1.6}
          strokeDasharray="4 5"
          opacity={Math.max(0.15, t)}
        />
      ))}
      <text x={466} y={206} fontSize={10.5} fill={ink(0.55)}>water leaves as vapour</text>
      <text x={466} y={256} fontSize={10.5} fill={ink(0.55)}>salt stays in the dish</text>
    </g>
  );
}

function Distillation({ t }: { t: number }) {
  const flaskLevel = 0.55 - 0.3 * t;
  const receive = 0.16 + 0.5 * t;
  return (
    <g>
      {/* Round-bottom flask */}
      <path d={`M 214 250 Q 178 250 178 216 Q 178 182 214 182 Q 250 182 250 216 Q 250 250 214 250`} fill={plate(0.5)} stroke={ink(0.45)} strokeWidth={1.8} />
      <path d="M 214 182 L 214 140 L 246 140" fill="none" stroke={ink(0.45)} strokeWidth={1.8} />
      <path d={`M 184 ${248 - flaskLevel * 30} Q 214 ${260 - flaskLevel * 34} 244 ${248 - flaskLevel * 30} L 244 246 Q 214 ${260} 184 246 Z`} fill={CYAN} opacity={0.32} />
      {/* Liebig condenser */}
      <rect x={246} y={128} width={210} height={22} rx={11} fill={plate(0.45)} stroke={ink(0.4)} strokeWidth={1.5} transform="rotate(0 246 128)" />
      <line x1={246} y1={139} x2={456} y2={139} stroke={ink(0.3)} strokeWidth={1} strokeDasharray="6 6" />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M ${258 + i * 22} 132 q 6 7 0 14`} fill="none" stroke={CYAN} strokeWidth={1.2} opacity={0.5} />
      ))}
      {/* Bend down into receiver */}
      <path d="M 456 139 L 500 139 L 500 196" fill="none" stroke={ink(0.45)} strokeWidth={1.8} />
      {/* Drops */}
      {t > 0.02 ? [0, 1].map((i) => <circle key={i} cx={500} cy={204 + ((t * 2 + i / 2) % 1) * 30} r={2.4} fill={CYAN} />) : null}
      {/* Receiver */}
      <path d="M 462 236 L 462 300 Q 462 310 474 310 L 526 310 Q 538 300 538 300 L 538 236" fill={plate(0.35)} stroke={ink(0.4)} strokeWidth={1.6} />
      <rect x={464} y={310 - receive * 60} width={72} height={receive * 60} fill={CYAN} opacity={0.3} />
      <text x={500} y={330} textAnchor="middle" fontSize={10.5} fill={ink(0.55)}>condensed liquid</text>
      <text x={214} y={130} textAnchor="middle" fontSize={10.5} fill={ink(0.55)}>solution</text>
      <text x={352} y={116} textAnchor="middle" fontSize={10.5} fill={ink(0.55)}>cold water around the tube</text>
    </g>
  );
}

function Chromatography({ t }: { t: number }) {
  const paperX = 300;
  const paperW = 120;
  const paperTop = 60;
  const paperBottom = 300;
  /* The pool in the beaker never rises above its rim; it is the solvent front
     on the paper that climbs, which is what the bands mark. */
  const solventTop = Math.max(202, paperBottom - 10 - t * 90);
  const originY = 250;
  return (
    <g>
      {/* Beaker */}
      <path d="M 270 200 L 270 320 Q 270 330 282 330 L 438 330 Q 450 330 450 320 L 450 200" fill={plate(0.28)} stroke={ink(0.4)} strokeWidth={1.6} />
      {/* Solvent */}
      <rect x={272} y={solventTop} width={176} height={330 - solventTop} fill={CYAN} opacity={0.16} />
      <line x1={272} y1={solventTop} x2={448} y2={solventTop} stroke={CYAN} strokeWidth={1.4} opacity={0.6} />
      {/* Paper */}
      <rect x={paperX} y={paperTop} width={paperW} height={paperBottom - paperTop} fill={plate(0.85)} stroke={ink(0.35)} strokeWidth={1.3} />
      {/* The mixture line, and the bands that separate from it */}
      {t < 0.06 ? <rect x={paperX + 12} y={originY} width={paperW - 24} height={5} fill={VIOLET} /> : null}
      {(() => {
        const bands = [
          { dye: "#c2554f", speed: 1.0 },
          { dye: "#c9a227", speed: 0.78 },
          { dye: "#4f7fc2", speed: 0.55 },
        ];
        return bands.map((band, i) => {
          const y = originY - t * 180 * band.speed;
          const h = 7 + i * 2;
          return <rect key={i} x={paperX + 14} y={Math.max(paperTop + 6, y)} width={paperW - 28} height={h} fill={band.dye} opacity={Math.min(0.9, 0.35 + t)} rx={2} />;
        });
      })()}
      <text x={440} y={70} textAnchor="end" fontSize={10.5} fill={ink(0.55)}>solvent front climbs</text>
      <text x={440} y={originY + 20} textAnchor="end" fontSize={10.5} fill={ink(0.55)}>spot of ink at the start</text>
      <line x1={438} y1={originY + 16} x2={paperX + paperW + 4} y2={originY} stroke={ink(0.3)} strokeWidth={1} />
    </g>
  );
}

function SeparatingFunnel({ t }: { t: number }) {
  const lower = 0.52 - 0.44 * t;
  return (
    <g>
      {/* Funnel body */}
      <path d="M 310 70 L 430 70 L 416 140 L 398 200 L 342 200 L 324 140 Z" fill={plate(0.4)} stroke={ink(0.45)} strokeWidth={1.8} strokeLinejoin="round" />
      {/* Water layer (denser, below) shrinks as it is tapped off. */}
      <path d={`M 326 130 L 414 130 L ${398 - (398 - 342) * (1 - lower)} ${130 + lower * 68} L ${342 + (398 - 342) * (1 - lower)} ${130 + lower * 68} Z`} fill={CYAN} opacity={0.28} />
      <rect x={327} y={74} width={86} height={54} fill={AMBER} opacity={0.16} />
      <line x1={326} y1={128} x2={414} y2={128} stroke={ink(0.35)} strokeWidth={1.4} />
      <text x={450} y={100} fontSize={10.5} fill={AMBER}>oil (less dense)</text>
      <text x={450} y={150} fontSize={10.5} fill={CYAN}>water (denser)</text>
      {/* Stopcock and stem */}
      <path d="M 362 200 L 378 200 L 378 232 L 362 232 Z" fill={plate(0.7)} stroke={ink(0.45)} strokeWidth={1.5} />
      <circle cx={370} cy={216} r={10} fill={plate(1)} stroke={ink(0.5)} strokeWidth={2} />
      <line x1={360} y1={216} x2={380} y2={216} stroke={ink(0.55)} strokeWidth={2} />
      {t > 0.02 && <circle cx={370} cy={246 + ((t * 3) % 1) * 20} r={2.6} fill={CYAN} />}
      {/* Beaker */}
      <path d="M 330 280 L 330 330 L 410 330 L 410 280" fill={plate(0.35)} stroke={ink(0.4)} strokeWidth={1.6} />
      <rect x={332} y={330 - t * 44} width={76} height={t * 44} fill={CYAN} opacity={0.3} />
      <text x={370} y={346} textAnchor="middle" fontSize={10.5} fill={ink(0.55)}>denser layer run off</text>
    </g>
  );
}

function Sublimation({ t }: { t: number }) {
  return (
    <g>
      {/* Burner, clear of the dish */}
      <path d="M 320 344 L 380 344 L 368 326 L 332 326 Z" fill={plate(0.6)} stroke={ink(0.35)} strokeWidth={1.4} />
      <path d="M 350 326 Q 342 320 350 314 Q 358 308 350 302" fill="none" stroke={AMBER} strokeWidth={2} opacity={0.6} />
      {/* Dish */}
      <path d="M 270 286 L 430 286 L 414 306 Q 350 316 286 306 Z" fill={plate(0.55)} stroke={ink(0.45)} strokeWidth={1.8} />
      {/* Mixture: salt stays grey, ammonium chloride disappears */}
      <rect x={292} y={296} width={116} height={6} fill={ink(0.45)} opacity={0.6} />
      <rect x={292} y={296} width={116 * (1 - t * 0.9)} height={6} fill={VIOLET} opacity={0.35} />
      {/* Vapour rising into the cold funnel */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={310 + i * 24} cy={272 - ((t * 80 + i * 14) % 80)} r={3.2} fill={VIOLET} opacity={Math.max(0.12, t * 0.7 - i * 0.08)} />
      ))}
      {/* Inverted funnel */}
      <path d="M 274 120 L 426 120 L 382 210 L 318 210 Z" fill={plate(0.3)} stroke={ink(0.45)} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M 340 120 L 340 92 L 360 92 L 360 120" fill={plate(0.3)} stroke={ink(0.45)} strokeWidth={1.6} />
      {/* Crystals collecting on the cold surface */}
      {Array.from({ length: 22 }, (_, i) => {
        const appear = i < t * 24;
        if (!appear) return null;
        const x = 292 + ((i * 31) % 116);
        const y = 136 + ((i * 17) % 46);
        return <circle key={i} cx={x} cy={y} r={1.8 + (i % 3) * 0.5} fill={plate(1)} opacity={0.8} />;
      })}
      <text x={450} y={130} fontSize={10.5} fill={ink(0.55)}>cold surface</text>
      <text x={450} y={160} fontSize={10.5} fill={ink(0.55)}>crystals re-form here</text>
      <text x={450} y={300} fontSize={10.5} fill={ink(0.55)}>salt is left behind</text>
    </g>
  );
}

function Magnetic({ t }: { t: number }) {
  const liftX = 240 - t * 60;
  const liftY = 120 + t * 70;
  return (
    <g>
      {/* Dish */}
      <path d="M 250 250 L 470 250 L 452 300 Q 360 316 268 300 Z" fill={plate(0.5)} stroke={ink(0.45)} strokeWidth={1.8} />
      {/* Sulphur powder */}
      {Array.from({ length: 40 }, (_, i) => {
        const x = 278 + ((i * 29) % 160);
        const y = 276 + ((i * 11) % 20);
        return <circle key={i} cx={x} cy={y} r={2.1} fill="#c9a227" opacity={0.75} />;
      })}
      {/* Iron filings, lifting toward the magnet. */}
      {Array.from({ length: 26 }, (_, i) => {
        const startX = 280 + ((i * 53) % 156);
        const startY = 274 + ((i * 7) % 18);
        const frac = Math.min(1, Math.max(0, t * 1.2 - (i % 5) * 0.06));
        /* Filings cluster under the two pole faces, not at the magnet's corner. */
        const endX = liftX + (i % 2 === 0 ? 11 : 45) + ((i * 13) % 7) - 3;
        const endY = liftY + 52 + ((i * 5) % 6);
        const x = startX + (endX - startX) * frac;
        const y = startY + (endY - startY) * frac;
        return <line key={i} x1={x} y1={y} x2={x + 4} y2={y - 4} stroke={ink(0.65)} strokeWidth={1.5} strokeLinecap="round" />;
      })}
      {/* Magnet */}
      <g transform={`translate(${liftX} ${liftY})`}>
        <path d="M 0 0 L 22 0 L 22 46 L 0 46 Z" fill="#b35a4a" />
        <path d="M 34 0 L 56 0 L 56 46 L 34 46 Z" fill="#4f7fc2" />
        <path d="M 0 30 L 56 30 L 56 46 L 0 46 Z" fill={plate(0.9)} stroke={ink(0.3)} strokeWidth={1} />
        <text x={11} y={18} fontSize={11} textAnchor="middle" fill="#fff">N</text>
        <text x={45} y={18} fontSize={11} textAnchor="middle" fill="#fff">S</text>
      </g>
      <text x={492} y={110} fontSize={10.5} fill={ink(0.55)}>magnet lifts the iron</text>
      <text x={492} y={300} fontSize={10.5} fill={ink(0.55)}>sulphur stays</text>
    </g>
  );
}

export default SeparationBench;
