import { useMemo, useState, type ReactNode } from "react";
import { Check, Focus, Lightbulb, RotateCcw } from "lucide-react";
import { Picker, Questions, Range, Readout } from "@/components/lab/bench-atoms";
import { useRecorder } from "@/components/lab/practical/useRecorder";
import { ShareSetup, useBenchPreset } from "@/components/lab/practical/preset";

/**
 * The microscope practical.
 *
 * A slide is only a specimen once it is in focus. The controls here are the
 * real ones — objective, coarse and fine focus, lamp — and the image is blurred
 * by the distance from focus, so clarity is computed, not decorated. The label
 * question appears only when the field is actually sharp, because identifying
 * a structure you cannot see is guessing, not observation.
 */

type SlideId = "onion" | "blood" | "cheek";
type Objective = 4 | 10 | 40;

const OBJECTIVES: Array<{ id: string; label: string }> = [
  { id: "4", label: "4×" },
  { id: "10", label: "10×" },
  { id: "40", label: "40×" },
];

const SLIDES: Array<{
  id: SlideId;
  name: string;
  stain: string;
  fieldMm: Record<Objective, number>;
  question: { q: string; options: string[]; correct: number; note: string };
}> = [
  {
    id: "onion",
    name: "Onion peel",
    stain: "Safranin",
    fieldMm: { 4: 4.5, 10: 1.8, 40: 0.45 },
    question: {
      q: "The field shows brick-like compartments with a central body. What are they?",
      options: [
        "Plant cells, each with a cell wall and a nucleus",
        "A single cell with many nuclei",
        "Blood vessels running through the peel",
      ],
      correct: 0,
      note:
        "Onion epidermis is a sheet of plant cells. The wall is visible as the shared boundary; the central body is the nucleus, pushed to the edge by the vacuole.",
    },
  },
  {
    id: "blood",
    name: "Human blood smear",
    stain: "Leishman",
    fieldMm: { 4: 4.5, 10: 1.8, 40: 0.45 },
    question: {
      q: "Most of the field is filled with small pale-centred discs. What are they?",
      options: [
        "Red blood cells (erythrocytes)",
        "Nerve cells",
        "Plant cells without a wall",
      ],
      correct: 0,
      note:
        "Erythrocytes are biconcave and have no nucleus in humans. The larger, darker cell is a white cell; platelets are the tiny specks between them.",
    },
  },
  {
    id: "cheek",
    name: "Cheek cells",
    stain: "Methylene blue",
    fieldMm: { 4: 4.5, 10: 1.8, 40: 0.45 },
    question: {
      q: "These irregular cells have a nucleus. Which structure do they lack?",
      options: ["A cell wall", "A cell membrane", "Cytoplasm"],
      correct: 0,
      note:
        "Animal cells have a membrane but no cell wall. That is why they squash into irregular shapes on a slide instead of holding a fixed brick outline.",
    },
  },
];

export function MicroscopeBench() {
  const { preset, task } = useBenchPreset<{
    slide?: SlideId;
    objective?: Objective;
    coarse?: number;
    fine?: number;
    light?: number;
  }>();

  const initialSlide = SLIDES.find((entry) => entry.id === preset?.slide) ?? SLIDES[0];
  const initialObjective: Objective =
    preset?.objective === 4 || preset?.objective === 10 || preset?.objective === 40
      ? preset.objective
      : 10;

  const [slideId, setSlideId] = useState<SlideId>(initialSlide.id);
  const [objective, setObjective] = useState<Objective>(initialObjective);
  const [coarse, setCoarse] = useState(() =>
    typeof preset?.coarse === "number" ? Math.min(100, Math.max(0, preset.coarse)) : 38,
  );
  const [fine, setFine] = useState(() =>
    typeof preset?.fine === "number" ? Math.min(10, Math.max(-10, preset.fine)) : 0,
  );
  const [light, setLight] = useState(() =>
    typeof preset?.light === "number" ? Math.min(100, Math.max(0, preset.light)) : 62,
  );
  const [answer, setAnswer] = useState<number | null>(null);
  const recorder = useRecorder();

  const slide = useMemo(
    () => SLIDES.find((entry) => entry.id === slideId) ?? SLIDES[0],
    [slideId],
  );

  /* A 40× objective has a much shallower depth of field: the same focus error
     that is nearly sharp at 4× is unusable at 40×. */
  const sensitivity = objective === 40 ? 1.7 : objective === 10 ? 1 : 0.6;
  const focusError = Math.abs(coarse + fine - 50);
  const blur = Math.min(16, focusError * 0.32 * sensitivity);
  const lightFactor = Math.min(1, light / 55);
  const clarity = Math.max(0, Math.round((1 - blur / 14) * lightFactor * 100));
  const sharp = clarity >= 82 && blur < 2.2;
  const magnification = objective * 10;

  const resetFocus = () => {
    setCoarse(38);
    setFine(0);
    setLight(62);
    setAnswer(null);
    recorder.reset();
  };

  const changeSlide = (next: SlideId) => {
    setSlideId(next);
    setAnswer(null);
    recorder.reset();
  };

  const record = () => {
    void recorder.record("biology", `Microscope · ${slide.name}`, [
      { label: "Magnification", value: magnification, unit: "×" },
      { label: "Field diameter", value: slide.fieldMm[objective], unit: "mm" },
      { label: "Focus", value: clarity, unit: "%" },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      {task ? (
        <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--lab-ink-dim)]">
          <span className="apple-lab-micro">Task</span>
          <p className="mt-0.5 text-[var(--lab-ink)]">{task}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="apple-lab-card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="apple-lab-micro">Field of view</p>
              <p className="apple-lab-value mt-1 text-[15px] font-semibold">
                {slide.name} · {slide.stain}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <Picker
                label="Slide"
                value={slideId}
                options={SLIDES.map((entry) => ({ id: entry.id, label: entry.name }))}
                onChange={changeSlide}
              />
              <Picker
                label="Objective"
                value={String(objective)}
                options={OBJECTIVES}
                onChange={(next) => {
                  setObjective(Number(next) as Objective);
                  setAnswer(null);
                  recorder.reset();
                }}
              />
            </div>
          </div>

          <div className="mx-auto w-full max-w-[440px]">
            <svg viewBox="0 0 420 420" className="block w-full" role="img" aria-label={`${slide.name} under the microscope, ${clarity}% clarity`}>
              <defs>
                <filter id={`micro-blur-${slide.id}`}>
                  <feGaussianBlur stdDeviation={blur} />
                </filter>
                <radialGradient id={`micro-light-${slide.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={`rgba(255, 248, 225, ${0.1 + lightFactor * 0.12})`} />
                  <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
                </radialGradient>
                <clipPath id={`micro-field-${slide.id}`}>
                  <circle cx="210" cy="210" r="196" />
                </clipPath>
              </defs>

              <circle cx="210" cy="210" r="204" fill="rgba(var(--lab-diagram-plate), 0.9)" stroke="rgba(var(--lab-diagram-ink), 0.28)" strokeWidth="2" />
              <g clipPath={`url(#micro-field-${slide.id})`}>
                <rect x="0" y="0" width="420" height="420" fill={`rgba(255, 250, 236, ${0.14 + lightFactor * 0.22})`} />
                <g
                  filter={`url(#micro-blur-${slide.id})`}
                  opacity={
                    (0.55 + Math.min(1, light) * 0.0045) *
                    (objective === 40 ? 0.9 : objective === 10 ? 0.96 : 1)
                  }
                >
                  {slide.id === "onion" ? <OnionField objective={objective} /> : null}
                  {slide.id === "blood" ? <BloodField objective={objective} /> : null}
                  {slide.id === "cheek" ? <CheekField objective={objective} /> : null}
                </g>
                <rect x="0" y="0" width="420" height="420" fill={`url(#micro-light-${slide.id})`} />
                <text
                  x="210"
                  y="392"
                  textAnchor="middle"
                  fontSize="10"
                  letterSpacing="0.1em"
                  fill="rgba(40, 32, 26, 0.58)"
                >
                  {objective}× · FIELD {slide.fieldMm[objective].toFixed(2)} mm
                </text>
              </g>
              <circle cx="210" cy="210" r="196" fill="none" stroke="rgba(var(--lab-diagram-ink), 0.4)" strokeWidth="2" />
              {/* dark field edge as illumination falls off */}
              <circle cx="210" cy="210" r="196" fill="none" stroke="rgba(0, 0, 0, 0.16)" strokeWidth="18" />
            </svg>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Range
                label="Coarse focus"
                value={coarse}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={setCoarse}
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <Range
                label="Fine focus"
                value={fine}
                min={-10}
                max={10}
                step={0.5}
                unit=""
                format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`}
                onChange={setFine}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Range
                label="Lamp"
                value={light}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={setLight}
              />
            </div>
            <button type="button" className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]" onClick={resetFocus}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset focus
            </button>
          </div>

          {sharp ? (
            <div className="rounded-lg border border-[var(--lab-line)] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--lab-ink)]">
                <Focus className="h-3.5 w-3.5 text-[var(--lab-diagram-mint)]" />
                Field is sharp — {clarity}% clarity
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
                Now identify what you are looking at.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--lab-ink-dim)]">
              <Lightbulb className="h-3.5 w-3.5" />
              {light < 25
                ? "Too little light: open the lamp before touching focus."
                : blur > 2.2
                  ? "The field is still soft. Move the coarse focus, then the fine."
                  : "Nearly there — adjust the fine focus a little."}
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-2">
          <Readout label="Magnification" value={`${magnification}× (${objective}× objective, 10× eyepiece)`} />
          <Readout label="Field diameter" value={`${slide.fieldMm[objective].toFixed(2)} mm`} />
          <Readout label="Clarity" value={`${clarity}%`} />
          <Readout label="Depth of field" value={objective === 40 ? "Very shallow" : objective === 10 ? "Moderate" : "Wide"} />

          <div className="apple-lab-card px-3 py-2.5">
            <p className="apple-lab-micro">Focus order</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
              Focus at low power first, then change to the high objective and
              use only the fine knob. The 40× lens is close enough to the slide
              that coarse focus can crack it.
            </p>
          </div>

          {sharp ? (
            <button type="button" className="apple-lab-btn !px-3 !py-1.5 !text-[11.5px]" onClick={record} disabled={recorder.state === "saving"}>
              {recorder.state === "done" ? <Check className="h-3.5 w-3.5" /> : null}
              {recorder.state === "saving" ? "Recording…" : recorder.state === "done" ? "Recorded" : "Record this field"}
            </button>
          ) : null}
          {recorder.message ? (
            <span className="text-[10.5px] leading-relaxed text-[var(--lab-ink-dim)]">{recorder.message}</span>
          ) : null}

          <ShareSetup
            subject="biology"
            bench="microscope"
            preset={{ slide: slide.id, objective, coarse, fine, light }}
          />
        </aside>
      </div>

      {sharp ? (
        <div className="apple-lab-card p-4">
          <p className="apple-lab-micro">Identify</p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--lab-ink)]">{slide.question.q}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {slide.question.options.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => setAnswer(index)}
                className="rounded-lg border px-3 py-2 text-left text-[11.5px] leading-relaxed transition-colors"
                style={{
                  borderColor:
                    answer === index
                      ? index === slide.question.correct
                        ? "rgba(var(--lab-diagram-mint), 0.65)"
                        : "rgba(var(--lab-diagram-rose), 0.5)"
                      : "var(--lab-line)",
                  color: "var(--lab-ink)",
                }}
              >
                {option}
              </button>
            ))}
          </div>
          {answer === slide.question.correct ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
              {slide.question.note}
            </p>
          ) : answer !== null ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--lab-ink-dim)]">
              Not that one. Look at the boundary around each cell before deciding
              between plant and animal tissue.
            </p>
          ) : null}
        </div>
      ) : null}

      <Questions
        items={[
          {
            q: "Why does the field get darker at 40×?",
            a: "The field diameter falls as magnification rises, so the same lamp spreads over less specimen but the objective's small aperture admits less light. Open the lamp a little after switching up.",
          },
          {
            q: "Why is a stain used at all?",
            a: "Living cells are almost transparent. A stain binds particular structures — safranin to the plant wall, methylene blue to the nucleus — so the boundary and the nucleus become visible.",
          },
        ]}
      />
    </div>
  );
}

/* Deterministic fields keep the slide identical across renders, which is what a
   prepared slide is: the same specimen every time you look down the tube. */

function OnionField({ objective }: { objective: Objective }) {
  const cells: ReactNode[] = [];
  const scale = objective === 4 ? 0.52 : objective === 10 ? 1 : 2.05;
  const w = 74 * scale;
  const h = 62 * scale;
  const gap = 6 * scale;
  const cols = Math.ceil(440 / (w + gap)) + 1;
  const rows = Math.ceil(440 / (h + gap)) + 1;
  let key = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = -20 + col * (w + gap) + (row % 2 === 0 ? 0 : w * 0.18);
      const y = -20 + row * (h + gap);
      const nx = x + w * (0.35 + ((row + col) % 3) * 0.12);
      const ny = y + h * (0.4 + ((row * 2 + col) % 2) * 0.12);
      cells.push(
        <g key={key++}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={6 * scale}
            fill="rgba(186, 214, 126, 0.22)"
            stroke="rgba(116, 150, 62, 0.75)"
            strokeWidth={Math.max(1, 2 * scale)}
          />
          <circle cx={nx} cy={ny} r={6 * scale} fill="rgba(120, 92, 48, 0.75)" />
          <circle cx={nx - 2 * scale} cy={ny - 2 * scale} r={2 * scale} fill="rgba(245, 232, 196, 0.7)" />
        </g>,
      );
    }
  }
  return <>{cells}</>;
}

function BloodField({ objective }: { objective: Objective }) {
  const discs: ReactNode[] = [];
  const scale = objective === 4 ? 0.45 : objective === 10 ? 1 : 2.1;
  const count = objective === 4 ? 82 : objective === 10 ? 46 : 22;
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = 0; index < count; index += 1) {
    const x = 26 + next() * 368;
    const y = 26 + next() * 368;
    const r = (9 + next() * 3) * scale;
    discs.push(
      <g key={index}>
        <circle cx={x} cy={y} r={r} fill="rgba(196, 92, 88, 0.6)" stroke="rgba(132, 48, 46, 0.5)" />
        <circle cx={x} cy={y} r={r * 0.5} fill="rgba(236, 178, 164, 0.45)" />
      </g>,
    );
  }
  return (
    <>
      {discs}
      <circle cx="300" cy="128" r={17 * scale} fill="rgba(120, 108, 176, 0.55)" stroke="rgba(80, 68, 140, 0.65)" />
      <circle cx="300" cy="128" r={8 * scale} fill="rgba(96, 84, 150, 0.6)" />
    </>
  );
}

function CheekField({ objective }: { objective: Objective }) {
  const cells: ReactNode[] = [];
  const scale = objective === 4 ? 0.5 : objective === 10 ? 1 : 2.1;
  const count = objective === 4 ? 30 : objective === 10 ? 13 : 7;
  let seed = 11;
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = 0; index < count; index += 1) {
    const x = 50 + next() * 310;
    const y = 44 + next() * 320;
    const rx = (28 + next() * 18) * scale;
    const ry = (22 + next() * 14) * scale;
    const rotate = next() * 180;
    cells.push(
      <g key={index} transform={`rotate(${rotate} ${x} ${y})`}>
        <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="rgba(150, 188, 208, 0.18)" stroke="rgba(104, 144, 168, 0.7)" strokeWidth={Math.max(1, 1.8 * scale)} />
        <ellipse cx={x + 3 * scale} cy={y - 2 * scale} rx={6.5 * scale} ry={5 * scale} fill="rgba(74, 92, 140, 0.65)" />
      </g>,
    );
  }
  return <>{cells}</>;
}

export default MicroscopeBench;
