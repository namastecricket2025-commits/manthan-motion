import functionPlot, {
  type Chart,
  type FunctionPlotDatum,
  type FunctionPlotOptions,
} from "function-plot";
import { parse } from "mathjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

/**
 * The Math Lab's graphing calculator.
 *
 * A real one: several functions at once, a grid with labelled axes, drag to
 * pan, scroll or pinch to zoom, and — the part that makes it a teaching tool
 * rather than a plotter — a slider for every free letter in the expressions.
 * Type `a*x^2 + b` and two sliders appear; move them and the parabola glides.
 *
 * The plotting itself is `function-plot` (MIT), which brings the grid, the axes
 * and the zoom/pan behaviour; the parameter sliders are this component's own,
 * driving the same expressions through the library's `scope`. No API keys and
 * no network calls — it is arithmetic in the browser.
 *
 * LaTeX that a student pastes from the notebook is normalised into the plain
 * maths syntax the evaluator reads, so `\frac{1}{2}x^{2}` and `0.5*x^2` plot
 * the same curve.
 */

const COLORS = ["#4f7cff", "#e0568a", "#12b886", "#f59f00", "#9c6ade"];

const DEFAULT_DOMAIN = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };

/** Names that are functions or constants, never sliders. */
const RESERVED = new Set([
  "x", "pi", "PI", "e", "E", "i", "tau", "phi", "Infinity", "NaN",
  "sin", "cos", "tan", "cot", "sec", "csc", "asin", "acos", "atan", "acot",
  "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
  "log", "ln", "log10", "log2", "exp", "sqrt", "cbrt", "abs", "sign",
  "floor", "ceil", "round", "min", "max", "pow", "mod", "nthRoot",
  "factorial", "gamma", "atan2", "hypot",
]);

/** Turn pasted LaTeX into the plain syntax the evaluator reads. */
function normalizeExpression(raw: string) {
  return raw
    .replace(/\\left|\\right/g, "")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/\\sqrt\[3\]\{([^{}]+)\}/g, "cbrt($1)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\theta/g, "theta")
    .replace(/\\log/g, "log")
    .replace(/\\ln/g, "log")
    .replace(/\\exp/g, "exp")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** The free letters in the expressions — the ones that become sliders. */
function parametersIn(expressions: string[]): string[] {
  const names = new Set<string>();
  for (const expression of expressions) {
    const cleaned = normalizeExpression(expression);
    if (!cleaned) continue;
    try {
      parse(cleaned).traverse((node) => {
        if (node.type !== "SymbolNode") return;
        const name = (node as unknown as { name?: string }).name;
        if (!name || RESERVED.has(name)) return;
        // Single letters and short named ones like `k1` are what a student
        // reaches for; a long identifier is almost always a typo.
        if (!/^[a-zA-Z][a-zA-Z0-9]?$/.test(name)) return;
        names.add(name);
      });
    } catch {
      // A half-typed expression has no parameters yet; it is still being typed.
    }
  }
  return [...names].sort();
}

interface Line {
  id: string;
  expr: string;
}

let lineCounter = 0;
const nextId = () => `f${(lineCounter += 1)}`;

export function GraphingCalculator() {
  const [lines, setLines] = useState<Line[]>([{ id: nextId(), expr: "a*x^2 + b" }]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef<FunctionPlotOptions | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const parameters = useMemo(() => parametersIn(lines.map((line) => line.expr)), [lines]);

  /**
   * Report a plotting failure on the next frame.
   *
   * Drawing into the SVG function-plot owns is a side effect on an external
   * system, so its outcome is delivered a frame later rather than setting state
   * in the middle of the effect that asked for the draw.
   */
  const reportError = useCallback((message: string | null) => {
    requestAnimationFrame(() => setError(message));
  }, []);

  /**
   * Draw the current options again.
   *
   * Because the same options object is reused, function-plot keeps its chart
   * instance — and `draw()` writes the live zoom domain back into the options
   * first, so moving a slider never throws away the student's pan and zoom.
   */
  const redraw = useCallback(() => {
    const options = optionsRef.current;
    if (!options) return;
    try {
      chartRef.current = functionPlot(options);
      reportError(null);
    } catch {
      // An expression the evaluator cannot read breaks the whole chart, so the
      // message names the likely cause instead of leaving a blank panel.
      reportError("One of those expressions could not be plotted. Check the brackets and try again.");
    }
  }, [reportError]);

  /** Keep `options.data` in step with the typed lines and the slider values. */
  const syncData = useCallback(
    (currentLines: Line[], currentValues: Record<string, number>) => {
      const options = optionsRef.current;
      if (!options) return;
      const scope: Record<string, number> = {};
      for (const name of parametersIn(currentLines.map((line) => line.expr))) {
        scope[name] = currentValues[name] ?? 1;
      }
      const previous = new Map((options.data ?? []).map((datum) => [datum.fn, datum]));
      const next: FunctionPlotDatum[] = [];
      for (const line of currentLines) {
        const fn = normalizeExpression(line.expr);
        if (!fn) continue;
        const index = next.length;
        const reused = previous.get(fn);
        if (reused) {
          reused.color = COLORS[index % COLORS.length];
          reused.scope = { ...scope };
          next.push(reused);
        } else {
          next.push({ fn, color: COLORS[index % COLORS.length], scope: { ...scope } });
        }
      }
      options.data = next;
    },
    [],
  );

  // Build the chart once, then keep it in step. A second invocation (React
  // re-running effects) redraws rather than stacking chart instances.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => ({ width: Math.max(280, Math.round(node.clientWidth || 640)), height: 380 });

    if (!optionsRef.current) {
      const size = measure();
      optionsRef.current = {
        target: node,
        width: size.width,
        height: size.height,
        grid: true,
        xAxis: { domain: [DEFAULT_DOMAIN.xMin, DEFAULT_DOMAIN.xMax], label: "x", position: "sticky" },
        yAxis: { domain: [DEFAULT_DOMAIN.yMin, DEFAULT_DOMAIN.yMax], label: "y", position: "sticky" },
        tip: { xLine: true, yLine: true },
        data: [],
      };
    }

    const observer = new ResizeObserver(() => {
      const options = optionsRef.current;
      if (!options) return;
      const size = measure();
      if (options.width === size.width) return;
      options.width = size.width;
      options.height = size.height;
      redraw();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      // Leaving the Graph tab or the page tears the chart down with it: the
      // SVG is removed, and the refs are cleared so a remount builds a fresh
      // chart instead of drawing into a detached node.
      if (node) node.innerHTML = "";
      chartRef.current = null;
      optionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The functions and the slider values are the inputs; the window is separate
  // so a slider drag never rebuilds the axes.
  useEffect(() => {
    syncData(lines, values);
    redraw();
  }, [lines, values, syncData, redraw]);

  useEffect(() => {
    const options = optionsRef.current;
    if (!options) return;
    if (options.xAxis) options.xAxis.domain = [domain.xMin, domain.xMax];
    if (options.yAxis) options.yAxis.domain = [domain.yMin, domain.yMax];
    redraw();
  }, [domain, redraw]);

  return (
    <div className="mathlab-graphcalc">
      <header className="mathlab-graphcalc__head">
        <div>
          <p className="mathlab-card__kicker">Graphing calculator</p>
          <h2 className="mathlab-card__title">Plot it, then move it</h2>
        </div>
        <button
          type="button"
          className="mathlab-tab-action"
          onClick={() => {
            setDomain(DEFAULT_DOMAIN);
            setValues({});
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset view
        </button>
      </header>

      <p className="mathlab-graphcalc__hint">
        Type a function of <span className="mathlab-mono">x</span>. Drag to pan, scroll or pinch to
        zoom, and any other letter becomes a slider you can move.
      </p>

      <div className="mathlab-graphcalc__lines">
        {lines.map((line, index) => (
          <div key={line.id} className="mathlab-graphcalc__line">
            <span className="mathlab-graphcalc__dot" style={{ background: COLORS[index % COLORS.length] }} aria-hidden />
            <span className="mathlab-graphcalc__prefix">y =</span>
            <input
              value={line.expr}
              onChange={(event) =>
                setLines((current) =>
                  current.map((entry) =>
                    entry.id === line.id ? { ...entry, expr: event.target.value } : entry,
                  ),
                )
              }
              spellCheck={false}
              autoComplete="off"
              aria-label={`Function ${index + 1}`}
              placeholder="e.g. a*x^2 + b"
              className="mathlab-graphcalc__input"
            />
            <button
              type="button"
              className="mathlab-tool"
              onClick={() =>
                setLines((current) =>
                  current.length === 1
                    ? [{ id: current[0].id, expr: "" }]
                    : current.filter((entry) => entry.id !== line.id),
                )
              }
              aria-label={`Remove function ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mathlab-tab-action"
          onClick={() => setLines((current) => [...current, { id: nextId(), expr: "" }])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add function
        </button>
      </div>

      {error ? <p className="mathlab-error">{error}</p> : null}

      <div className="mathlab-graphcalc__canvas">
        <div ref={containerRef} className="mathlab-fp" />
      </div>

      {parameters.length ? (
        <div className="mathlab-sliders">
          {parameters.map((name) => {
            const value = values[name] ?? 1;
            return (
              <label key={name} className="mathlab-slider">
                <span className="mathlab-slider__name">{name}</span>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.1}
                  value={value}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [name]: Number(event.target.value) }))
                  }
                  aria-label={`Parameter ${name}`}
                />
                <span className="mathlab-slider__value">{value.toFixed(1)}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="mathlab-domains">
        <span className="mathlab-domains__label">Window</span>
        {(
          [
            ["xMin", "x min"],
            ["xMax", "x max"],
            ["yMin", "y min"],
            ["yMax", "y max"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="mathlab-domain">
            <span>{label}</span>
            <input
              type="number"
              value={domain[key]}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                setDomain((current) => ({ ...current, [key]: parsed }));
              }}
              aria-label={label}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default GraphingCalculator;
