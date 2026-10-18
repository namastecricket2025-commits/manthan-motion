/**
 * The small parts every physics bench is assembled from.
 *
 * They live here rather than inside `PhysicsVectorLab` because a bench can be
 * its own file once it grows past a screen of geometry (Dynamics is), and two
 * copies of a labelled slider is exactly how two benches drift apart. Diagram
 * colours are tokens, never literals: `data-lab-theme="light"` on a bench root
 * deepens the whole drawing to ink-on-paper without any bench knowing it.
 */
export const VIOLET = "var(--lab-diagram-violet)";
export const CYAN = "var(--lab-diagram-cyan)";
export const AMBER = "var(--lab-diagram-amber)";
export const MINT = "var(--lab-diagram-mint)";
/** Ink and plate are RGB triples, so every line can pick its own alpha. */
export const ink = (alpha: number) => `rgba(var(--lab-diagram-ink), ${alpha})`;
export const plate = (alpha: number) => `rgba(var(--lab-diagram-plate), ${alpha})`;

export function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="apple-lab-micro">{label}</span>
        <span className="apple-lab-value text-[12.5px] font-semibold">
          {format ? format(value) : value.toFixed(step < 1 ? 2 : 0)}
          <span className="ml-1 text-[11px] text-[var(--lab-ink-dim)]">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        className="apple-lab-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="apple-lab-card px-3 py-2.5">
      <p className="apple-lab-micro">{label}</p>
      <p className="apple-lab-value mt-1 text-[15px] font-semibold">{value}</p>
    </div>
  );
}

/** A row of buttons that choose one option — the picker every bench leans on. */
export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <p className="apple-lab-micro">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            data-active={option.id === value}
            className="apple-lab-btn !px-2.5 !py-1 !text-[11px]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
