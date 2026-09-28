import { evaluate, format } from "mathjs";
import { useCallback, useMemo, useState } from "react";
import { Delete, Eraser, X } from "lucide-react";

/**
 * The Math Lab's scientific calculator.
 *
 * Real arithmetic in the browser through mathjs — the same engine the rest of
 * the Lab already leans on — with a degree/radian switch that genuinely changes
 * how the trigonometry is read, because `sin 30` means half in a classroom and
 * something else entirely to a library in radian mode.
 *
 * The tape is this session's own calculations, kept in memory. Nothing is
 * stored, nothing is seeded, and nothing pretends to be a history that was
 * never computed.
 */

/** Trigonometry in degrees, for the way school questions are written. */
const DEGREE_SCOPE = {
  sin: (x: number) => Math.sin((x * Math.PI) / 180),
  cos: (x: number) => Math.cos((x * Math.PI) / 180),
  tan: (x: number) => Math.tan((x * Math.PI) / 180),
  asin: (x: number) => (Math.asin(x) * 180) / Math.PI,
  acos: (x: number) => (Math.acos(x) * 180) / Math.PI,
  atan: (x: number) => (Math.atan(x) * 180) / Math.PI,
};

type Key =
  | { label: string; insert: string; kind?: "fn" | "op" | "digit" }
  | { label: string; action: "clear" | "back" | "equals"; kind?: "fn" | "op" | "digit" };

/** Five columns, seven rows — a full grid with nothing left over. */
const KEYS: Key[] = [
  { label: "mod", insert: "mod(", kind: "fn" },
  { label: "C", action: "clear", kind: "fn" },
  { label: "⌫", action: "back", kind: "fn" },
  { label: "(", insert: "(", kind: "op" },
  { label: ")", insert: ")", kind: "op" },

  { label: "sin", insert: "sin(", kind: "fn" },
  { label: "cos", insert: "cos(", kind: "fn" },
  { label: "tan", insert: "tan(", kind: "fn" },
  { label: "π", insert: "pi", kind: "fn" },
  { label: "e", insert: "e", kind: "fn" },

  { label: "x²", insert: "^2", kind: "fn" },
  { label: "xʸ", insert: "^", kind: "fn" },
  { label: "√", insert: "sqrt(", kind: "fn" },
  { label: "log", insert: "log10(", kind: "fn" },
  { label: "ln", insert: "log(", kind: "fn" },

  { label: "7", insert: "7", kind: "digit" },
  { label: "8", insert: "8", kind: "digit" },
  { label: "9", insert: "9", kind: "digit" },
  { label: "÷", insert: "/", kind: "op" },
  { label: "%", insert: "%", kind: "op" },

  { label: "4", insert: "4", kind: "digit" },
  { label: "5", insert: "5", kind: "digit" },
  { label: "6", insert: "6", kind: "digit" },
  { label: "×", insert: "*", kind: "op" },
  { label: "!", insert: "!", kind: "op" },

  { label: "1", insert: "1", kind: "digit" },
  { label: "2", insert: "2", kind: "digit" },
  { label: "3", insert: "3", kind: "digit" },
  { label: "−", insert: "-", kind: "op" },
  { label: "1/x", insert: "^(-1)", kind: "fn" },

  { label: "0", insert: "0", kind: "digit" },
  { label: ".", insert: ".", kind: "digit" },
  { label: "=", action: "equals", kind: "op" },
  { label: "+", insert: "+", kind: "op" },
  { label: "abs", insert: "abs(", kind: "fn" },
];

export function ScientificCalculator({ onClose }: { onClose?: () => void }) {
  const [expr, setExpr] = useState("");
  const [degrees, setDegrees] = useState(true);
  const [tape, setTape] = useState<Array<{ expr: string; result: string }>>([]);

  /** Evaluate without throwing: a half-typed expression has no answer yet. */
  const compute = useCallback(
    (source: string): { result: string } | { error: string } => {
      const trimmed = source.trim();
      if (!trimmed) return { error: "" };
      try {
        const value = evaluate(trimmed, degrees ? DEGREE_SCOPE : {});
        if (typeof value === "number") {
          if (!Number.isFinite(value)) return { error: "That works out to something undefined." };
          return { result: format(value, { precision: 12 }) };
        }
        const printed = format(value, { precision: 12 });
        return { result: printed };
      } catch {
        return { error: "Not a complete expression yet." };
      }
    },
    [degrees],
  );

  const preview = useMemo(() => compute(expr), [compute, expr]);
  const answer = "result" in preview ? preview.result : null;

  const press = (key: Key) => {
    if ("insert" in key) {
      setExpr((current) => current + key.insert);
      return;
    }
    if (key.action === "clear") {
      setExpr("");
      return;
    }
    if (key.action === "back") {
      setExpr((current) => current.slice(0, -1));
      return;
    }
    // Equals only records a line that actually produced a number.
    const outcome = compute(expr);
    if ("result" in outcome && expr.trim()) {
      setTape((current) => [{ expr, result: outcome.result }, ...current].slice(0, 8));
    }
  };

  return (
    <div className="mathlab-calc">
      <header className="mathlab-calc__head">
        <div className="flex items-center gap-2">
          <span className="mathlab-card__kicker">Calculator</span>
          <button
            type="button"
            className={"mathlab-calc__angle" + (degrees ? " is-deg" : "")}
            onClick={() => setDegrees((current) => !current)}
            aria-pressed={degrees}
          >
            {degrees ? "DEG" : "RAD"}
          </button>
        </div>
        {onClose ? (
          <button type="button" className="mathlab-tool" onClick={onClose} aria-label="Close calculator">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="mathlab-calc__screen">
        <input
          value={expr}
          onChange={(event) => setExpr(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              press({ label: "=", action: "equals" });
            }
          }}
          placeholder="Type or tap a calculation"
          aria-label="Calculation"
          spellCheck={false}
          autoComplete="off"
          className="mathlab-calc__expr"
        />
        <p className="mathlab-calc__result" aria-live="polite">
          {answer !== null
            ? `= ${answer}`
            : "error" in preview && preview.error
              ? preview.error
              : "= "}
        </p>
      </div>

      <div className="mathlab-calc__keys">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            className={
              "mathlab-calc__key" +
              (key.kind === "op" ? " is-op" : key.kind === "fn" ? " is-fn" : "") +
              ("action" in key && key.action === "equals" ? " is-equals" : "")
            }
            onClick={() => press(key)}
            aria-label={key.label}
          >
            {key.label === "⌫" ? <Delete className="h-4 w-4" /> : key.label === "C" ? <Eraser className="h-4 w-4" /> : key.label}
          </button>
        ))}
      </div>

      {tape.length ? (
        <div className="mathlab-calc__tape">
          <p className="mathlab-calc__tapehead">This session</p>
          <ul>
            {tape.map((entry, index) => (
              <li key={`${entry.expr}-${index}`}>
                <button type="button" onClick={() => setExpr(entry.expr)}>
                  <span className="mathlab-calc__tapeexpr">{entry.expr}</span>
                  <span className="mathlab-calc__taperesult">{entry.result}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default ScientificCalculator;
