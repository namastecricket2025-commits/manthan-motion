import { useState } from "react";
import { Check, Eye, RotateCcw, Thermometer, Waves } from "lucide-react";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Questions, Range } from "@/components/lab/bench-atoms";

/**
 * Chemistry glassware, not a shelf of clip art.
 *
 * Each piece has a purpose, a method and a visual that responds to the control
 * appropriate to it: a meniscus you can read from the wrong eye level, a
 * burette you can dispense from, a pipette that fills and drains, a balance
 * that tares. Pieces whose whole point is their shape (a funnel, a spatula)
 * carry no invented control; they explain what they are for and how to hold
 * them.
 */

type InstrumentId =
  | "cylinder"
  | "beaker"
  | "test-tube"
  | "pipette"
  | "burette"
  | "thermometer"
  | "flask"
  | "funnel"
  | "wash-bottle"
  | "balance"
  | "spatula"
  | "clamp";

type Instrument = {
  id: InstrumentId;
  name: string;
  purpose: string;
  use: string[];
  accuracy: string;
  capacity: string;
};

const INSTRUMENTS: Instrument[] = [
  {
    id: "cylinder",
    name: "Measuring cylinder",
    purpose: "Measures a volume of liquid to the nearest graduation; the general-purpose volumetric tool.",
    use: [
      "Stand it on a level bench and read the bottom of the meniscus.",
      "Bring your eye level with the meniscus; looking down or up gives a parallax error.",
      "Choose the smallest cylinder that holds the volume — a 250 mL cylinder cannot read 5 mL well.",
    ],
    accuracy: "Typical school cylinder: ±1 mL on 100 mL, read to 1 mL.",
    capacity: "10, 50, 100, 250 and 1000 mL",
  },
  {
    id: "beaker",
    name: "Beaker",
    purpose: "Holds, mixes and heats liquids. Its rough graduations are a guide, not a measurement.",
    use: [
      "Use it for dissolving, stirring and heating, not for a precise volume.",
      "Add liquid below the graduation you think you need, then transfer to a cylinder.",
      "Never heat a beaker that is cracked, and point the mouth away from you.",
    ],
    accuracy: "Approximate only; the scale is typically ±5%.",
    capacity: "50, 100, 250, 400 and 600 mL",
  },
  {
    id: "test-tube",
    name: "Test tube",
    purpose: "Runs small-scale reactions and heating tests with a few millilitres of reagent.",
    use: [
      "Fill no more than one-fifth full when heating.",
      "Hold it with a tube holder and move the mouth through the flame; never point it at anyone.",
      "Use a test-tube rack, not the bench, when it is hot.",
    ],
    accuracy: "Not volumetric; use a graduated tube when a volume matters.",
    capacity: "Usually 10–20 mL",
  },
  {
    id: "pipette",
    name: "Pipette",
    purpose: "Delivers one fixed, accurate volume — the tool for a titration aliquot.",
    use: [
      "Rinse with the liquid it will deliver, then fill above the mark.",
      "Set the meniscus exactly on the mark with the bulb, not your mouth.",
      "Let it drain under gravity; do not blow out the last drop unless the pipette is marked 'blow out'.",
    ],
    accuracy: "A grade-A 25 mL pipette is typically ±0.03 mL.",
    capacity: "10, 20, 25 and 50 mL",
  },
  {
    id: "burette",
    name: "Burette",
    purpose: "Delivers a variable, measured volume drop by drop — the titrant side of a titration.",
    use: [
      "Rinse with titrant, fill, and remove the air gap below the tap.",
      "Record the initial reading at eye level before you start.",
      "Run the first titration quickly, then add dropwise near the endpoint.",
    ],
    accuracy: "50 mL burette: 0.1 mL graduations, read to 0.05 mL.",
    capacity: "25 or 50 mL",
  },
  {
    id: "thermometer",
    name: "Thermometer",
    purpose: "Measures temperature; in chemistry it also shows whether a reaction is exothermic.",
    use: [
      "Immerse the bulb fully in the liquid, without touching the glass wall.",
      "Wait for the column to stop moving before reading.",
      "Read at eye level and keep the bulb in the liquid while the reaction runs.",
    ],
    accuracy: "School mercury/alcohol thermometer: usually ±0.5 °C.",
    capacity: "−10 to 110 °C often; check the range before heating.",
  },
  {
    id: "flask",
    name: "Conical flask",
    purpose: "Holds the analyte during a titration; the conical shape makes swirling safe.",
    use: [
      "Pipette the analyte into the flask, then add two drops of indicator.",
      "Swirl continuously while the titrant runs in.",
      "Rinse the walls with distilled water near the endpoint; it does not change the moles.",
    ],
    accuracy: "Not volumetric; the delivered volume comes from the pipette.",
    capacity: "100, 250 and 500 mL",
  },
  {
    id: "funnel",
    name: "Filter funnel",
    purpose: "Holds filter paper for separating a solid from a liquid.",
    use: [
      "Fold the paper in half, then in half again, and open it into a cone.",
      "Wet the paper so it seals to the funnel, and keep the stem full of liquid.",
      "Pour down a glass rod; do not fill the cone to the brim.",
    ],
    accuracy: "Separation only, not measurement.",
    capacity: "Dependent on the cone and paper",
  },
  {
    id: "wash-bottle",
    name: "Wash bottle",
    purpose: "Delivers distilled water for rinsing glassware and washing a precipitate onto a filter.",
    use: [
      "Keep the spout above the vessel, not inside it.",
      "Use distilled water, not tap water, when the rinse affects the result.",
      "Squeeze gently; a wash bottle is not a measuring tool.",
    ],
    accuracy: "Not volumetric.",
    capacity: "250 or 500 mL",
  },
  {
    id: "balance",
    name: "Electronic balance",
    purpose: "Measures mass; the tare button removes the mass of the weighing boat.",
    use: [
      "Place the clean, dry boat on the pan and press Tare.",
      "Add the solid with a spatula; never pour directly from the reagent bottle.",
      "Close the draft shield before reading and record the mass with its unit.",
    ],
    accuracy: "School balance: usually 0.01 g or 0.001 g.",
    capacity: "Often 200–600 g maximum",
  },
  {
    id: "spatula",
    name: "Spatula",
    purpose: "Transfers small amounts of solid reagent without contaminating the stock bottle.",
    use: [
      "Use a clean, dry spatula for each reagent.",
      "Hold the bottle's cap in your hand, not on the bench.",
      "Return the unused solid to the bottle only if it never left the spatula.",
    ],
    accuracy: "Transfer only.",
    capacity: "Micro-spatula or standard",
  },
  {
    id: "clamp",
    name: "Retort stand and clamp",
    purpose: "Holds glassware safely above the bench during a reaction or titration.",
    use: [
      "Clamp the burette vertically; a tilted burette changes the hydrostatic pressure.",
      "Clamp low on a flask, never on the neck alone.",
      "Keep the base under the centre of mass so it cannot tip.",
    ],
    accuracy: "Support only.",
    capacity: "Match the clamp to the glassware",
  },
];

type EyeLevel = "level" | "above" | "below";

const ink = (alpha: number) => `rgba(var(--lab-diagram-ink), ${alpha})`;
const liquid = "rgba(var(--lab-diagram-cyan), 0.45)";
const liquidDim = "rgba(var(--lab-diagram-cyan), 0.2)";

export function ChemistryInstruments() {
  const [selected, setSelected] = useState<InstrumentId>("cylinder");
  const [volume, setVolume] = useState(42);
  const [capacity, setCapacity] = useState(100);
  const [eye, setEye] = useState<EyeLevel>("level");
  const [stirring, setStirring] = useState(false);
  const [testVolume, setTestVolume] = useState(6);
  const [heated, setHeated] = useState(false);
  const [pipetteSize, setPipetteSize] = useState(25);
  const [pipetteFilled, setPipetteFilled] = useState(false);
  const [dispensed, setDispensed] = useState(12.4);
  const [temperature, setTemperature] = useState(28);
  const [immersed, setImmersed] = useState(true);
  const [sample, setSample] = useState(12.5);
  const [tared, setTared] = useState(false);
  const [tareOffset, setTareOffset] = useState(0);

  const instrument = INSTRUMENTS.find((entry) => entry.id === selected) ?? INSTRUMENTS[0];
  const fraction = Math.min(1, Math.max(0, volume / Math.max(1, capacity)));
  /* Parallax is a real offset in millilitres, not a one-decimal nudge: looking
     down on a 100 mL cylinder over-reads by roughly 2–3 mL, which is enough to
     change the answer. It scales with the cylinder's bore, so a 250 mL one is
     worse than a 50 mL one — that is why you choose the smallest cylinder that
     holds the volume. */
  const parallaxMl =
    eye === "level" ? 0 : (eye === "above" ? 1 : -1) * Math.max(1.5, capacity * 0.03);
  const cylinderReading = Math.max(0, Math.min(capacity, volume + parallaxMl));
  /* Screen positions of the true meniscus and the level the eye *thinks* it is
     reading. The liquid never moves with the eye; only the apparent line does. */
  const trueLevel = 242 - fraction * 190;
  const apparentFraction = Math.min(1, Math.max(0, (volume + parallaxMl) / Math.max(1, capacity)));
  const apparentLevel = 242 - apparentFraction * 190;
  const eyeY = trueLevel + (eye === "above" ? -52 : eye === "below" ? 52 : 0);

  const pick = (id: InstrumentId) => {
    setSelected(id);
    setEye("level");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {INSTRUMENTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
            data-active={selected === entry.id}
            aria-pressed={selected === entry.id}
            onClick={() => pick(entry.id)}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="apple-lab-card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="apple-lab-micro">Apparatus</p>
              <h3 className="apple-lab-title mt-1 text-[17px]">{instrument.name}</h3>
            </div>
            <span className="apple-lab-chip">{instrument.capacity}</span>
          </div>

          <div className="mx-auto w-full max-w-[320px] rounded-xl border border-[var(--lab-line-soft)] bg-[color-mix(in_srgb,var(--lab-ink)_2%,transparent)] p-2">
            <svg
              viewBox="0 0 240 280"
              className="block w-full"
              role="img"
              aria-label={`${instrument.name} diagram`}
            >
              <defs>
                <clipPath id="chem-cylinder-clip">
                  <rect x="90" y="34" width="60" height="208" rx="7" />
                </clipPath>
                <clipPath id="chem-beaker-clip">
                  <path d="M62 72 h116 v130 a22 22 0 0 1 -22 22 H84 a22 22 0 0 1 -22 -22 Z" />
                </clipPath>
                <clipPath id="chem-tube-clip">
                  <path d="M100 36 h40 v180 a20 20 0 0 1 -40 0 Z" />
                </clipPath>
              </defs>

              {selected === "cylinder" ? (
                <g>
                  {/* The sight line is drawn first, behind the glass, so the
                      cylinder still reads as an object. An eye above the
                      meniscus looks down and crosses the scale higher than
                      the true level; an eye below crosses it lower. */}
                  <line
                    x1="56"
                    y1={eyeY}
                    x2="150"
                    y2={apparentLevel}
                    stroke={eye === "level" ? ink(0.35) : "var(--lab-diagram-amber)"}
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    opacity={eye === "level" ? 0.7 : 0.9}
                  />
                  <g transform={`translate(44 ${eyeY})`}>
                    <path
                      d="M-9 0 C-5 -7 5 -7 9 0 C5 7 -5 7 -9 0 Z"
                      fill="none"
                      stroke={eye === "level" ? ink(0.6) : "var(--lab-diagram-amber)"}
                      strokeWidth="1.3"
                    />
                    <circle
                      cx="0"
                      cy="0"
                      r="2.4"
                      fill={eye === "level" ? ink(0.6) : "var(--lab-diagram-amber)"}
                    />
                    <text
                      x="0"
                      y={eye === "above" ? -14 : 19}
                      textAnchor="middle"
                      fontSize="7"
                      fill={ink(0.55)}
                    >
                      eye
                    </text>
                  </g>

                  <rect x="90" y="34" width="60" height="208" rx="7" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <g clipPath="url(#chem-cylinder-clip)">
                    <rect x="90" y={trueLevel} width="60" height={242 - trueLevel} fill={liquid} />
                    <path
                      d={`M90 ${trueLevel} Q120 ${trueLevel - 6} 150 ${trueLevel}`}
                      fill="none"
                      stroke={ink(0.3)}
                      strokeWidth="1"
                    />
                  </g>
                  {/* The apparent meniscus: only shown when the eye is off
                      level, so the error has a visible line to point at. */}
                  {eye !== "level" ? (
                    <>
                      <line
                        x1="90"
                        y1={apparentLevel}
                        x2="150"
                        y2={apparentLevel}
                        stroke="var(--lab-diagram-amber)"
                        strokeWidth="1.4"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="154"
                        y={apparentLevel + 3}
                        fontSize="7"
                        fill="var(--lab-diagram-amber)"
                      >
                        {cylinderReading.toFixed(1)}
                      </text>
                    </>
                  ) : null}
                  {Array.from({ length: 11 }).map((_, index) => {
                    const y = 232 - (index / 10) * 190;
                    return (
                      <g key={index}>
                        <line x1="138" y1={y} x2={index % 5 === 0 ? "126" : "132"} y2={y} stroke={ink(0.45)} strokeWidth="1" />
                        {index % 5 === 0 ? (
                          <text x="120" y={y + 3} textAnchor="end" fontSize="7" fill={ink(0.58)}>
                            {Math.round((capacity * index) / 10)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                  <path d="M88 246 h64" stroke={ink(0.5)} strokeWidth="2" />
                </g>
              ) : null}

              {selected === "beaker" ? (
                <g>
                  <path d="M62 72 h116 v130 a22 22 0 0 1 -22 22 H84 a22 22 0 0 1 -22 -22 Z" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <g clipPath="url(#chem-beaker-clip)">
                    <rect x="62" y={224 - Math.min(1, volume / 250) * 130} width="116" height={Math.min(1, volume / 250) * 130} fill={liquidDim} />
                    {stirring ? (
                      <>
                        <path d="M84 196 C108 184 128 208 154 196" fill="none" stroke={ink(0.36)} strokeWidth="1.4" />
                        <path d="M84 208 C108 196 128 220 154 208" fill="none" stroke={ink(0.25)} strokeWidth="1.2" />
                      </>
                    ) : null}
                  </g>
                  <path d="M62 72 q-12 -4 -16 -14" fill="none" stroke={ink(0.45)} strokeWidth="2" />
                  {[220, 180, 140, 100].map((y, index) => (
                    <g key={y}>
                      <line x1={150} y1={y} x2={160} y2={y} stroke={ink(0.4)} />
                      <text x={142} y={y + 3} textAnchor="end" fontSize="7" fill={ink(0.55)}>
                        {[200, 150, 100, 50][index]}
                      </text>
                    </g>
                  ))}
                </g>
              ) : null}

              {selected === "test-tube" ? (
                <g>
                  <path d="M100 36 h40 v180 a20 20 0 0 1 -40 0 Z" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <g clipPath="url(#chem-tube-clip)">
                    <rect x="100" y={236 - Math.min(1, testVolume / 20) * 150} width="40" height={Math.min(1, testVolume / 20) * 150} fill={liquid} />
                  </g>
                  {heated ? (
                    <g>
                      <path d="M102 248 q-14 18 0 28 q14 -10 0 -28" fill="var(--lab-diagram-amber)" opacity="0.6" />
                      <path d="M138 248 q14 18 0 28 q-14 -10 0 -28" fill="var(--lab-diagram-amber)" opacity="0.45" />
                    </g>
                  ) : null}
                  <text x="120" y="26" textAnchor="middle" fontSize="8" fill={ink(0.55)}>
                    heat gently
                  </text>
                </g>
              ) : null}

              {selected === "pipette" ? (
                <g>
                  <path d="M120 30 v180" stroke={ink(0.5)} strokeWidth="3" />
                  <ellipse cx="120" cy="94" rx="24" ry="40" fill={ink(0.035)} stroke={ink(0.5)} strokeWidth="1.4" />
                  <path d="M120 238 l-7 -28 h14 z" fill={ink(0.35)} />
                  <rect x="100" y="62" width="40" height="20" rx="4" fill={ink(0.04)} stroke={ink(0.4)} />
                  <text x="120" y="76" textAnchor="middle" fontSize="8" fill={ink(0.6)}>
                    bulb
                  </text>
                  {pipetteFilled ? (
                    <path d="M120 196 v38" stroke={liquid} strokeWidth="3" />
                  ) : null}
                  <text x="120" y="266" textAnchor="middle" fontSize="8" fill={ink(0.55)}>
                    {pipetteFilled ? `${pipetteSize} mL ready` : "press Fill"}
                  </text>
                </g>
              ) : null}

              {selected === "burette" ? (
                <g>
                  <rect x="108" y="28" width="24" height="184" rx="3" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.4" />
                  <rect x="108" y={28 + (dispensed / 50) * 160} width="24" height={212 - (dispensed / 50) * 160} fill={liquidDim} />
                  <path d="M120 212 v26" stroke={ink(0.5)} strokeWidth="4" />
                  <circle cx="120" cy="242" r="7" fill={ink(0.12)} stroke={ink(0.5)} />
                  <path d="M120 249 v14" stroke={ink(0.5)} strokeWidth="2" />
                  {Array.from({ length: 11 }).map((_, index) => {
                    const y = 34 + (index / 10) * 168;
                    return (
                      <g key={index}>
                        <line x1="108" y1={y} x2={index % 5 === 0 ? "98" : "103"} y2={y} stroke={ink(0.45)} />
                        {index % 5 === 0 ? (
                          <text x="94" y={y + 3} textAnchor="end" fontSize="7" fill={ink(0.58)}>
                            {index * 5}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              ) : null}

              {selected === "thermometer" ? (
                <g>
                  <rect x="113" y="28" width="14" height="190" rx="7" fill={ink(0.025)} stroke={ink(0.5)} strokeWidth="1.2" />
                  <circle cx="120" cy="232" r="16" fill={ink(0.05)} stroke={ink(0.5)} strokeWidth="1.2" />
                  <rect x="118" y="40" width="4" height={Math.min(1, Math.max(0, (temperature + 10) / 120)) * 188} fill="var(--lab-diagram-rose)" opacity="0.75" />
                  <circle cx="120" cy="232" r="10" fill="var(--lab-diagram-rose)" opacity="0.72" />
                  {[100, 80, 60, 40, 20, 0].map((value, index) => (
                    <g key={value}>
                      <line x1="127" y1={40 + index * 31} x2="136" y2={40 + index * 31} stroke={ink(0.4)} />
                      <text x="140" y={43 + index * 31} fontSize="7" fill={ink(0.55)}>
                        {value}
                      </text>
                    </g>
                  ))}
                </g>
              ) : null}

              {selected === "flask" ? (
                <g>
                  <path d="M100 34 h40 v66 l52 142 a18 18 0 0 1 -16 22 H64 a18 18 0 0 1 -16 -22 l52 -142 Z" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <path d="M82 196 q38 -10 76 0 l18 46 H64 Z" fill={liquidDim} />
                  <rect x="97" y="28" width="46" height="8" rx="4" fill={ink(0.08)} stroke={ink(0.45)} />
                </g>
              ) : null}

              {selected === "funnel" ? (
                <g>
                  <path d="M44 56 H196 L128 150 V236 H112 V150 Z" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <path d="M74 72 H166 L128 136 Z" fill={ink(0.05)} stroke={ink(0.28)} />
                  <path d="M112 214 h16" stroke={ink(0.45)} strokeWidth="2" />
                  <path d="M120 236 v20" stroke={liquid} strokeWidth="3" />
                </g>
              ) : null}

              {selected === "wash-bottle" ? (
                <g>
                  <path d="M82 118 h76 v120 a18 18 0 0 1 -18 18 h-40 a18 18 0 0 1 -18 -18 Z" fill={ink(0.025)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <rect x="96" y="78" width="48" height="40" rx="8" fill={ink(0.035)} stroke={ink(0.45)} />
                  <path d="M144 90 C180 76 196 58 188 34" fill="none" stroke={ink(0.5)} strokeWidth="4" strokeLinecap="round" />
                  <path d="M82 152 h76" stroke={liquidDim} strokeWidth="50" />
                  <path d="M120 118 v80" stroke={liquid} strokeWidth="24" opacity="0.5" />
                </g>
              ) : null}

              {selected === "balance" ? (
                <g>
                  <rect x="44" y="180" width="152" height="54" rx="10" fill={ink(0.04)} stroke={ink(0.52)} strokeWidth="1.6" />
                  <rect x="72" y="118" width="96" height="56" rx="8" fill={ink(0.025)} stroke={ink(0.45)} />
                  <rect x="84" y="146" width="72" height="18" rx="3" fill={ink(0.08)} stroke={ink(0.25)} />
                  <text x="120" y="159" textAnchor="middle" fontSize="10" fill={ink(0.75)}>
                    {tared ? (sample - tareOffset).toFixed(2) : sample.toFixed(2)} g
                  </text>
                  <rect x="82" y="104" width="76" height="8" rx="4" fill={ink(0.06)} stroke={ink(0.4)} />
                  <circle cx="120" cy="208" r="7" fill={ink(0.12)} stroke={ink(0.4)} />
                </g>
              ) : null}

              {selected === "spatula" ? (
                <g>
                  <path d="M48 56 L170 178" stroke={ink(0.55)} strokeWidth="8" strokeLinecap="round" />
                  <path d="M170 178 L206 214" stroke={ink(0.55)} strokeWidth="20" strokeLinecap="round" />
                  <path d="M48 56 L30 38" stroke={ink(0.4)} strokeWidth="4" strokeLinecap="round" />
                  <circle cx="126" cy="134" r="3" fill={ink(0.55)} />
                </g>
              ) : null}

              {selected === "clamp" ? (
                <g>
                  <rect x="112" y="220" width="16" height="16" rx="4" fill={ink(0.12)} stroke={ink(0.5)} />
                  <rect x="46" y="226" width="150" height="10" rx="5" fill={ink(0.06)} stroke={ink(0.45)} />
                  <rect x="112" y="42" width="16" height="184" fill={ink(0.04)} stroke={ink(0.45)} />
                  <path d="M120 82 h44 v20 h-44" fill={ink(0.04)} stroke={ink(0.5)} />
                  <path d="M168 74 v36" stroke={ink(0.45)} strokeWidth="5" strokeLinecap="round" />
                  <rect x="174" y="88" width="26" height="8" rx="4" fill={ink(0.15)} />
                </g>
              ) : null}
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="apple-lab-chip">{instrument.accuracy}</span>
            {selected === "cylinder" ? (
              <span className="apple-lab-chip">
                {eye === "level"
                  ? "eye level · true reading"
                  : eye === "above"
                    ? `eye above · reads ${parallaxMl.toFixed(1)} mL high`
                    : `eye below · reads ${Math.abs(parallaxMl).toFixed(1)} mL low`}
              </span>
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div className="apple-lab-card p-3.5">
            <p className="apple-lab-micro">What it is for</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--lab-ink-dim)]">
              {instrument.purpose}
            </p>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--lab-ink-micro)]">
              How to use it
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {instrument.use.map((step, index) => (
                <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--lab-line)] text-[8px] text-[var(--lab-ink)]">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <div className="apple-lab-card p-3.5">
            <p className="apple-lab-micro">Control</p>
            {selected === "cylinder" ? (
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[var(--lab-ink-dim)]">Cylinder capacity</span>
                  <ChoiceSelect
                    variant="lab"
                    value={String(capacity)}
                    onChange={(next) => {
                      const value = Number(next);
                      setCapacity(value);
                      setVolume((current) => Math.min(current, value));
                    }}
                    ariaLabel="Cylinder capacity"
                    options={[50, 100, 250].map((value) => ({
                      value: String(value),
                      label: `${value} mL`,
                    }))}
                  />
                </div>
                <Range
                  label="Volume"
                  value={volume}
                  min={0}
                  max={capacity}
                  step={1}
                  unit="mL"
                  onChange={setVolume}
                />
                <div className="flex flex-wrap gap-1.5">
                  {(["level", "above", "below"] as EyeLevel[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      data-active={eye === value}
                      className="apple-lab-btn !px-2.5 !py-1 !text-[10.5px]"
                      onClick={() => setEye(value)}
                    >
                      <Eye className="h-3 w-3" />
                      {value === "level" ? "At eye level" : `From ${value}`}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
                  <p className="text-[10.5px] text-[var(--lab-ink-dim)]">Read at the meniscus</p>
                  <p className="mt-0.5 font-mono text-[16px] font-semibold">
                    {cylinderReading.toFixed(1)} mL
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--lab-ink-dim)]">
                    {eye === "level"
                      ? "Your eye is level with the meniscus, so the reading is the true volume."
                      : eye === "above"
                        ? `Looking down makes the meniscus appear higher on the scale, so you read ${parallaxMl.toFixed(1)} mL too much.`
                        : `Looking up makes the meniscus appear lower on the scale, so you read ${Math.abs(parallaxMl).toFixed(1)} mL too little.`}
                  </p>
                </div>
              </div>
            ) : null}

            {selected === "beaker" ? (
              <div className="mt-2 flex flex-col gap-3">
                <Range label="Liquid" value={volume} min={0} max={250} step={5} unit="mL" onChange={setVolume} />
                <button
                  type="button"
                  className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
                  data-active={stirring}
                  aria-pressed={stirring}
                  onClick={() => setStirring((value) => !value)}
                >
                  <Waves className="h-3.5 w-3.5" />
                  {stirring ? "Stirring" : "Stir"}
                </button>
                <p className="text-[10.5px] leading-relaxed text-[var(--lab-ink-dim)]">
                  The graduations are a guide. For a volume you will calculate with,
                  transfer to a measuring cylinder or pipette.
                </p>
              </div>
            ) : null}

            {selected === "test-tube" ? (
              <div className="mt-2 flex flex-col gap-3">
                <Range label="Reagent" value={testVolume} min={1} max={20} step={1} unit="mL" onChange={setTestVolume} />
                <button
                  type="button"
                  className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
                  data-active={heated}
                  aria-pressed={heated}
                  onClick={() => setHeated((value) => !value)}
                >
                  <Thermometer className="h-3.5 w-3.5" />
                  {heated ? "Heating" : "Heat gently"}
                </button>
                <p className="text-[10.5px] leading-relaxed text-[var(--lab-ink-dim)]">
                  {testVolume > 4
                    ? "That is too full to heat safely. A tube should be no more than one-fifth full."
                    : "At this level the liquid can expand without spitting out of the tube."}
                </p>
              </div>
            ) : null}

            {selected === "pipette" ? (
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-[var(--lab-ink-dim)]">Pipette size</span>
                  <ChoiceSelect
                    variant="lab"
                    value={String(pipetteSize)}
                    onChange={(next) => {
                      setPipetteSize(Number(next));
                      setPipetteFilled(false);
                    }}
                    ariaLabel="Pipette size"
                    options={[10, 20, 25, 50].map((value) => ({
                      value: String(value),
                      label: `${value} mL`,
                    }))}
                  />
                </div>
                <button
                  type="button"
                  className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
                  onClick={() => setPipetteFilled((value) => !value)}
                >
                  {pipetteFilled ? "Drain" : "Fill"}
                </button>
                <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
                  <p className="text-[10.5px] text-[var(--lab-ink-dim)]">Delivered</p>
                  <p className="font-mono text-[16px] font-semibold">
                    {pipetteFilled ? `${pipetteSize}.00 mL ready` : "0.00 mL"}
                  </p>
                </div>
              </div>
            ) : null}

            {selected === "burette" ? (
              <div className="mt-2 flex flex-col gap-3">
                <Range label="Titrant delivered" value={dispensed} min={0} max={50} step={0.1} unit="mL" onChange={setDispensed} />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="apple-lab-btn !px-2.5 !py-1 !text-[10.5px]"
                    onClick={() => setDispensed(0)}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Fill to zero
                  </button>
                  <button
                    type="button"
                    className="apple-lab-btn !px-2.5 !py-1 !text-[10.5px]"
                    onClick={() => setDispensed((value) => Math.min(50, Math.round((value + 1) * 10) / 10))}
                  >
                    Dispense 1.00 mL
                  </button>
                </div>
                <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
                  <p className="text-[10.5px] text-[var(--lab-ink-dim)]">Final reading</p>
                  <p className="font-mono text-[16px] font-semibold">{dispensed.toFixed(2)} mL</p>
                </div>
              </div>
            ) : null}

            {selected === "thermometer" ? (
              <div className="mt-2 flex flex-col gap-3">
                <Range label="Liquid temperature" value={temperature} min={-10} max={110} step={1} unit="°C" onChange={setTemperature} />
                <button
                  type="button"
                  className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
                  data-active={immersed}
                  aria-pressed={immersed}
                  onClick={() => setImmersed((value) => !value)}
                >
                  <Thermometer className="h-3.5 w-3.5" />
                  {immersed ? "Bulb immersed" : "Bulb in air"}
                </button>
                <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
                  <p className="text-[10.5px] text-[var(--lab-ink-dim)]">Reading</p>
                  <p className="font-mono text-[16px] font-semibold">
                    {(immersed ? temperature : 25).toFixed(1)} °C
                  </p>
                  {!immersed ? (
                    <p className="mt-1 text-[10px] text-[var(--lab-diagram-rose)]">
                      The bulb is in air, so it is reading the room, not the liquid.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selected === "balance" ? (
              <div className="mt-2 flex flex-col gap-3">
                <Range label="Sample on the boat" value={sample} min={0} max={200} step={0.01} unit="g" onChange={setSample} />
                <button
                  type="button"
                  className="apple-lab-btn !px-3 !py-1.5 !text-[11px]"
                  data-active={tared}
                  aria-pressed={tared}
                  onClick={() => {
                    if (tared) {
                      setTared(false);
                      setTareOffset(0);
                    } else {
                      setTared(true);
                      setTareOffset(sample);
                    }
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  {tared ? "Tare active" : "Tare the boat"}
                </button>
                <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
                  <p className="text-[10.5px] text-[var(--lab-ink-dim)]">Display</p>
                  <p className="font-mono text-[16px] font-semibold">
                    {(tared ? sample - tareOffset : sample).toFixed(2)} g
                  </p>
                </div>
              </div>
            ) : null}

            {["flask", "funnel", "wash-bottle", "spatula", "clamp"].includes(selected) ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                This piece has no variable to set: its function is its shape and
                how it is held. The steps on the left are the interaction.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <Questions
        items={[
          {
            q: "Why can a beaker not replace a measuring cylinder?",
            a: "Its graduations are approximate and its wide diameter makes the meniscus hard to locate. A cylinder's narrow bore turns a small volume change into a visible height change.",
          },
          {
            q: "Why does the pipette need to be rinsed with the liquid it will deliver?",
            a: "Water left in the tip dilutes the aliquot. Rinsing with the same solution leaves the tip at the solution's concentration, so the delivered volume is the volume that was measured.",
          },
          {
            q: "Why is a burette read to 0.05 mL when its marks are 0.1 mL apart?",
            a: "The meniscus can be estimated to half a division. Recording to 0.05 mL reflects that estimate; it does not claim a finer graduation than the glass has.",
          },
        ]}
      />
    </div>
  );
}

export default ChemistryInstruments;
