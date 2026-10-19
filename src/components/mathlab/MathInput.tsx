import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Calculator, Keyboard, TextCursorInput, Trash2 } from "lucide-react";
import { problemLabel, splitProblems, uprightWords } from "@/components/mathlab/problems";

/**
 * The Math Lab's question field.
 *
 * Two ways in, both real:
 *
 *   • A MathLive field — a proper maths editor, so a fraction is a fraction and
 *     a root is a root rather than a line of punctuation. MathLive brings its
 *     own virtual keyboard, which is the "math keyboard" for fractions, roots,
 *     powers and symbols; the toolbar button below toggles it.
 *   • A plain text field, for a word problem the student would rather type in
 *     sentences.
 *
 * MathLive is loaded lazily, and if it cannot load the field quietly stays a
 * text field rather than leaving the student with a dead box. A symbol pad is
 * always available underneath, inserting LaTeX into whichever field is active —
 * so fractions, roots and powers are one tap away even without the editor.
 */

export interface MathInputHandle {
  /** Put a LaTeX snippet into whichever field is active. */
  insert: (snippet: string) => void;
}

const SYMBOL_GROUPS: Array<{ label: string; keys: Array<{ tex: string; hint: string }> }> = [
  {
    label: "Fraction",
    keys: [
      { tex: "\\frac{}{}", hint: "a over b" },
      { tex: "\\frac{1}{2}", hint: "one half" },
      { tex: "\\dfrac{}{}", hint: "large fraction" },
      { tex: "\\tfrac{}{}", hint: "small fraction" },
    ],
  },
  {
    label: "Power & root",
    keys: [
      { tex: "^{2}", hint: "squared" },
      { tex: "^{}", hint: "to the power" },
      { tex: "\\sqrt{}", hint: "square root" },
      { tex: "\\sqrt[3]{}", hint: "cube root" },
      { tex: "\\sqrt[n]{}", hint: "nth root" },
    ],
  },
  {
    label: "Symbol",
    keys: [
      { tex: "\\times", hint: "times" },
      { tex: "\\div", hint: "divided by" },
      { tex: "\\pm", hint: "plus or minus" },
      { tex: "\\le", hint: "less or equal" },
      { tex: "\\ge", hint: "greater or equal" },
      { tex: "\\ne", hint: "not equal" },
      { tex: "\\approx", hint: "approximately" },
      { tex: "\\infty", hint: "infinity" },
      { tex: "\\cdot", hint: "dot product" },
      { tex: "\\%", hint: "percent" },
      { tex: "\\pi", hint: "pi" },
      { tex: "\\theta", hint: "theta" },
    ],
  },
  {
    label: "Greek",
    keys: [
      { tex: "\\alpha", hint: "alpha" },
      { tex: "\\beta", hint: "beta" },
      { tex: "\\gamma", hint: "gamma" },
      { tex: "\\Delta", hint: "delta" },
      { tex: "\\lambda", hint: "lambda" },
      { tex: "\\mu", hint: "mu" },
      { tex: "\\Sigma", hint: "sigma" },
      { tex: "\\int", hint: "integral" },
      { tex: "\\sum", hint: "sum" },
      { tex: "\\lim_{x \\to 0}", hint: "limit" },
    ],
  },
  {
    label: "Structure",
    keys: [
      { tex: "\\begin{aligned} & \\\\ & \\end{aligned}", hint: "aligned lines" },
      { tex: "\\text{}", hint: "a word" },
      { tex: "\\left( \\right)", hint: "brackets" },
      { tex: "\\begin{cases} & \\\\ & \\end{cases}", hint: "cases" },
    ],
  },
];

type MathfieldLike = {
  value: string;
  insert: (snippet: string) => boolean;
  focus: () => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  mathVirtualKeyboardPolicy: string;
  style: CSSStyleDeclaration;
  className: string;
};

export const MathInput = forwardRef<
  MathInputHandle,
  {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    ariaLabel: string;
  }
>(function MathInput({ value, onChange, placeholder, ariaLabel }, ref) {
  const [mode, setMode] = useState<"math" | "text">("math");
  const [padOpen, setPadOpen] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldLike | null>(null);
  const textRef = useRef<HTMLInputElement | null>(null);
  // True while the component itself is writing into the editor, so the editor's
  // own change event is not mistaken for the student typing.
  const applyingRef = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
  /** Several problems in one box are shown as one chip each, never as one
   *  italic run of maths with an English word buried in it. */
  const problems = useMemo(() => splitProblems(value), [value]);

  const toggleVirtualKeyboard = useCallback(() => {
    const board = (
      window as unknown as {
        mathVirtualKeyboard?: { show: () => void; hide: () => void; visible: boolean };
      }
    ).mathVirtualKeyboard;
    if (!board) return;
    if (board.visible) {
      board.hide();
      setKeyboardVisible(false);
    } else {
      board.show();
      setKeyboardVisible(true);
    }
  }, []);

  // Bring MathLive in on demand. A failure here leaves the text field standing,
  // which is the honest outcome: no maths editor, but a working question box.
  useEffect(() => {
    if (mode !== "math") return;
    let cancelled = false;
    const holder = holderRef.current;

    void import("mathlive")
      .then(({ MathfieldElement }) => {
        if (cancelled || !holder || fieldRef.current) return;
        const field = new MathfieldElement() as unknown as MathfieldLike;
        field.className = "mathlab-mathfield";
        field.setAttribute("placeholder", placeholder);
        field.setAttribute("aria-label", ariaLabel);
        // The on-screen keyboard is opened from the toolbar, not automatically.
        field.mathVirtualKeyboardPolicy = "manual";
        field.setAttribute("smart-fence", "on");
        field.setAttribute("virtual-keyboard-mode", "manual");
        /* English connectives belong upright, in \\text{…}: a bare "and" in
           math mode is three italic variables and runs into the next fraction.
           Rewriting the value here means no word is ever rendered as maths. */
        const uprightField = () => {
          const raw = field.value;
          const upright = uprightWords(raw);
          if (upright === raw) return raw;
          applyingRef.current = true;
          field.value = upright;
          applyingRef.current = false;
          return upright;
        };
        const handleInput = () => {
          if (applyingRef.current) return;
          onChange(uprightField());
        };
        const handleBlur = () => {
          if (applyingRef.current) return;
          onChange(uprightField());
        };
        field.addEventListener("input", handleInput);
        field.addEventListener("blur", handleBlur);
        holder.innerHTML = "";
        holder.appendChild(field as unknown as Node);
        fieldRef.current = field;
        applyingRef.current = true;
        field.value = latestValue.current;
        applyingRef.current = false;
        setEditorReady(true);
      })
      .catch(() => {
        if (!cancelled) setEditorReady(false);
      });

    return () => {
      cancelled = true;
      fieldRef.current = null;
      setEditorReady(false);
      if (holder) holder.innerHTML = "";
    };
    // Recreated only when the mode or the labels change; the value is pushed
    // across by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, placeholder, ariaLabel]);

  // Push a value the parent changed (a solve, a reset, dictation) into the
  // editor without echoing it straight back as student input.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field || mode !== "math") return;
    const upright = uprightWords(value);
    if (field.value === upright) return;
    applyingRef.current = true;
    field.value = upright;
    applyingRef.current = false;
  }, [value, mode, editorReady]);

  /** Put a snippet into whichever field currently owns the input. */
  const insertSnippet = useCallback(
    (snippet: string) => {
      const field = fieldRef.current;
      if (mode === "math" && field) {
        field.focus();
        if (field.insert(snippet)) {
          onChange(field.value);
          return;
        }
        applyingRef.current = true;
        const next = `${field.value}${snippet}`;
        field.value = next;
        applyingRef.current = false;
        onChange(next);
        return;
      }
      const input = textRef.current;
      const current = latestValue.current;
      const start = input?.selectionStart ?? current.length;
      const end = input?.selectionEnd ?? current.length;
      onChange(`${current.slice(0, start)}${snippet}${current.slice(end)}`);
      // Put the caret after what was inserted, once React has re-rendered.
      requestAnimationFrame(() => {
        const node = textRef.current;
        if (!node) return;
        const caret = start + snippet.length;
        node.setSelectionRange(caret, caret);
      });
    },
    [mode, onChange],
  );

  useImperativeHandle(ref, () => ({ insert: insertSnippet }), [insertSnippet]);

  const mathMode = mode === "math";
  const showFallbackText = !mathMode || !editorReady;

  return (
    <div className="mathlab-inputwrap">
      <div className="mathlab-inputmode" role="tablist" aria-label="How to enter the question">
        <button
          type="button"
          role="tab"
          aria-selected={mathMode}
          className={"mathlab-modetab" + (mathMode ? " is-active" : "")}
          onClick={() => setMode("math")}
        >
          <Calculator className="h-3.5 w-3.5" />
          Math keyboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!mathMode}
          className={"mathlab-modetab" + (!mathMode ? " is-active" : "")}
          onClick={() => setMode("text")}
        >
          <TextCursorInput className="h-3.5 w-3.5" />
          Type words
        </button>
      </div>

      <div className="mathlab-inputfield">
        {/* The editor mounts here. When MathLive has not (yet) loaded, this
            stays an empty holder and the text field below carries the input. */}
        {mathMode ? <div ref={holderRef} className="mathlab-mathfield-host" /> : null}
        {showFallbackText ? (
          <input
            ref={textRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="mathlab-input__field"
          />
        ) : null}
      </div>

      <div className="mathlab-inputtools">
        {mathMode && editorReady ? (
          <button
            type="button"
            className={"mathlab-tool mathlab-tool--wide" + (keyboardVisible ? " is-live" : "")}
            onClick={toggleVirtualKeyboard}
            aria-pressed={keyboardVisible}
          >
            <Keyboard className="h-4 w-4" />
            {keyboardVisible ? "Hide symbols" : "Symbol keyboard"}
          </button>
        ) : null}
        <button
          type="button"
          className={"mathlab-tool mathlab-tool--wide" + (padOpen ? " is-live" : "")}
          onClick={() => setPadOpen((open) => !open)}
          aria-expanded={padOpen}
        >
          {padOpen ? "Hide pad" : "Symbol pad"}
        </button>
        {value ? (
          <button
            type="button"
            className="mathlab-tool"
            onClick={() => onChange("")}
            aria-label="Clear the question"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {problems.length > 1 ? (
        <div className="mathlab-detected" aria-label="Problems found in the box">
          <span className="mathlab-detected__label">
            {problems.length} problems
          </span>
          <ol className="mathlab-detected__list">
            {problems.map((problem, index) => (
              <li key={`${index}-${problem}`} className="mathlab-detected__chip">
                <span className="mathlab-detected__index" aria-hidden>
                  {index + 1}
                </span>
                <span className="mathlab-detected__text">
                  {problemLabel(problem)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {padOpen ? (
        <div className="mathlab-pad">
          {SYMBOL_GROUPS.map((group) => (
            <div key={group.label} className="mathlab-pad__group">
              <span className="mathlab-pad__label">{group.label}</span>
              <div className="mathlab-pad__keys">
                {group.keys.map((key) => (
                  <button
                    key={key.tex}
                    type="button"
                    className="mathlab-pad__key"
                    title={key.hint}
                    aria-label={key.hint}
                    onClick={() => insertSnippet(key.tex)}
                  >
                    {key.hint}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

export default MathInput;
