/*
 * Verification for the three reported problems.
 *
 * Each assertion is written against the thing that FAILED, not against the
 * thing that is convenient to check:
 *
 *  1. Light mode "does not look good"  → the filled action is now bright amber
 *     with a near-black label. The failure modes that matter are numeric: a
 *     label on amber that misses AA, and any element that kept a light label
 *     while its fill stayed deep (which is exactly how the old caramel button
 *     failed on hover).
 *  2. Math Lab mesh wave              → the sheet must never draw before its
 *     box is measured, must be clipped to that box, and must stop flowing while
 *     the workspace is gated.
 *  3. Avia sending the first word     → the recogniser must keep listening
 *     through pauses, and the send must be gated by a silence timer rather than
 *     fired from the result handler.
 */
const fs = require("fs");
const path = require("path");

let pass = 0;
const failures = [];
function ok(cond, label, extra) {
  if (cond) {
    pass++;
    console.log("  ok   " + label + (extra ? "  [" + extra + "]" : ""));
  } else {
    failures.push(label + (extra ? "  [" + extra + "]" : ""));
    console.log("  FAIL " + label + (extra ? "  [" + extra + "]" : ""));
  }
}
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

/* ---------------- colour maths ---------------- */
const rgb = (h) => {
  h = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = (h) => {
  const [r, g, b] = rgb(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const over = (fg, alpha, bg) => {
  const f = rgb(fg);
  const b = rgb(bg);
  return (
    "#" +
    f
      .map((v, i) =>
        Math.round(v * alpha + b[i] * (1 - alpha))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
};

/* ---------------- 1. the light theme's button ---------------- */
console.log("\n== 1. light mode: amber fill, dark label ==");
const css = read("src/index.css");
const darkAt = css.indexOf('.dark,\n[data-theme="dark"] {');
const lightCss = css.slice(0, darkAt);
const lightToken = (name) => {
  const m = lightCss.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})"));
  return m ? m[1].toLowerCase() : null;
};
const ink = lightToken("signal");
const fill = lightToken("signal-strong");
const label = lightToken("primary-foreground");
const primary = /--primary:\s*var\(--([a-z-]+)\)/.exec(lightCss);
const hoverFill = over(fill, 0.88, "#000000");

ok(fill === "#fbbf24", "the light filled action is the bright amber", String(fill));
ok(ink === "#b45309", "the light accent as TYPE is still the deep caramel", String(ink));
ok(contrast(ink, lightToken("ink")) >= 4.5, "accent text on the canvas still passes AA", contrast(ink, lightToken("ink")).toFixed(2) + ":1");
ok(contrast(ink, lightToken("panel")) >= 4.5, "accent text on a panel still passes AA", contrast(ink, lightToken("panel")).toFixed(2) + ":1");
ok(primary && primary[1] === "signal-strong", "the light primary button is filled with the bright amber", primary ? primary[1] : "missing");
ok(contrast(label, fill) >= 4.5, "its label on the amber fill", contrast(label, fill).toFixed(2) + ":1 on " + fill);
ok(contrast(label, hoverFill) >= 4.5, "its label on the hover fill", contrast(label, hoverFill).toFixed(2) + ":1 on " + hoverFill);
ok(lum(fill) > lum(ink), "the fill is brighter than the type colour (a highlighter, not a second caramel)");

/* Every element whose label is `--primary-foreground` must sit on the action
   tone. A deep `--signal` / `--signal-2` fill under that label is the exact
   shape of the bug the old caramel button had on hover. */
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".css")) out.push(p);
  }
  return out;
};
const offenders = [];
for (const f of walk(path.join(process.cwd(), "src"))) {
  const src = fs.readFileSync(f, "utf8");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[2];
    if (!/color:\s*var\(--primary-foreground\)/.test(body)) continue;
    const fills = [...body.matchAll(/(?:background(?:-color)?|fill)\s*:\s*([^;]+);/g)].map((x) =>
      x[1].replace(/\s+/g, " ")
    );
    const deep = fills.filter(
      (v) => /(var\(--signal-2\)|var\(--signal\))(?!-)/.test(v) && !/--signal-strong/.test(v)
    );
    /* The dark block's hover rule is the one legitimate case: in the dark theme
       `--signal-2` is #e4e4e7, a light fill, and the light theme overrides it. */
    const sel = m[1].replace(/\s+/g, " ");
    const darkOnly = sel.includes(".moving-border:hover");
    if (deep.length && !darkOnly) offenders.push(path.relative(process.cwd(), f) + " :: " + sel.slice(0, 60));
  }
}
ok(offenders.length === 0, "no CSS rule paints a `--primary-foreground` label on a deep amber fill", offenders.join(" | "));

const avia = read("src/components/voice/avia.css");
const sendBlock = /\.avia-send \{([^}]*)\}/.exec(avia);
ok(!!sendBlock && !/var\(--signal-2\)/.test(sendBlock[1]), "the Avia send button's fill no longer ends in the deep caramel");
const orbBlock = /\.avia-fab__core \{([^}]*)\}/.exec(avia);
ok(!!orbBlock && !/var\(--signal-2\)/.test(orbBlock[1]), "nor does the Avia orb core");
const checkout = read("src/components/plans/CheckoutModal.tsx");
ok(!/var\(--signal-2\) 100%\)/.test(checkout), "nor the checkout pill's gradient");

/* Knobs ride the filled track, so a knob hardcoded white is the same bug in a
   different element: the settings switch shipped white-on-white in the dark
   theme and would have been ~1.5:1 on the new bright amber in the light one. */
const settings = read("src/components/settings/settings.css");
const checkedKnob = /\.set-switch \[data-slot="switch-thumb"\]\[data-state="checked"\] \{([^}]*)\}/.exec(settings);
ok(!!checkedKnob && /background:\s*var\(--primary-foreground\)/.test(checkedKnob[1]), "the checked switch knob rides the fill, not a hardcoded white");
ok(contrast(label, fill) >= 4.5 && contrast(label, "#ffffff") >= 4.5, "…which is legible on the light fill AND on the dark theme's white track", contrast(label, fill).toFixed(2) + ":1 / " + contrast(label, "#ffffff").toFixed(2) + ":1");
const sliderThumb = /\.set-slider \[data-slot="slider-thumb"\] \{([^}]*)\}/.exec(settings);
ok(!!sliderThumb && /0 0 0 0\.5px rgba\(0, 0, 0, 0\.3\d?\)/.test(sliderThumb[1]), "the slider knob keeps a hairline ring for the light-filled range");

/* ---------------- 2. the Math Lab plane ---------------- */
console.log("\n== 2. Math Lab: bounded, measured, and quiet when gated ==");
const field = read("src/components/mathlab/MathField3D.tsx");
const loopStart = field.indexOf("useRaf((dt, t) => {");
const loop = field.slice(loopStart, loopStart + 1400);
ok(loopStart > 0, "the frame loop is where we think it is");
const guardAt = loop.indexOf("if (w < 2 || h < 2) return;");
const syncAt = loop.indexOf("syncViewport(");
ok(guardAt > 0, "the loop refuses to draw before the canvas has a real box");
ok(guardAt > 0 && syncAt > guardAt, "…and that guard runs BEFORE any renderer size is applied", "guard@" + guardAt + " sync@" + syncAt);
ok(/quiet = false/.test(field), "the component takes the quiet flag");
ok(/quietRef\.current = quiet/.test(field), "…and mirrors it for the frame loop");
ok(/const hush = hushed \? 0\.25 : 1;/.test(field), "the gated state drops the sheet to a backdrop", "0.25x");
ok(/const time = waveTime\.current;/.test(field), "the wave clock freezes while gated");
ok(/time \* 0\.62/.test(field), "the field math reads the frozen clock, not the live one");
const lab = read("src/components/mathlab/MathLab.tsx");
ok(/<MathField3D[^>]*quiet=\{locked\}/.test(lab), "MathLab passes the gate state into the field");
const mlCss = read("src/components/mathlab/mathlab.css");
const fieldCss = /\.mathlab-field \{([^}]*)\}/.exec(mlCss)[1];
ok(/overflow: hidden/.test(fieldCss), "the plane is clipped to its own box");
ok(/contain: paint/.test(fieldCss), "…and never paints outside it");
const h = /height:\s*clamp\(([^)]*)\)/.exec(fieldCss);
const maxPx = h ? parseInt(h[1].split(",")[2], 10) : 0;
const vh = h ? parseFloat(h[1].split(",")[1]) : 0;
ok(maxPx <= 460 && vh <= 46, "the plane is a band, not half the viewport", h ? h[0] : "missing");

/* ---------------- 3. the Avia microphone ---------------- */
console.log("\n== 3. Avia waits for a pause before answering ==");
const widget = read("src/components/voice/AviaWidget.tsx");
ok(/const SILENCE_MS = \d+;/.test(widget), "there is a silence window", /SILENCE_MS = (\d+)/.exec(widget)?.[1] + "ms");
ok(/recognition\.continuous = true;/.test(widget), "the recogniser keeps listening through short pauses");
ok(/recognition\.interimResults = true;/.test(widget), "partial words are taken as they arrive");
const resultHandler = widget.slice(widget.indexOf("recognition.onresult ="), widget.indexOf("recognition.onerror ="));
ok(!!resultHandler && !/sendRef\.current/.test(resultHandler), "onresult does not send anything");
ok(/armSilence\(\)/.test(resultHandler), "…it re-arms the pause timer instead");
ok(/heardRef\.current = \(settled \+ pending\)/.test(resultHandler), "it rebuilds one buffer from settled + in-flight results");
ok(/setDraft\(heardRef\.current\)/.test(resultHandler), "the student can watch the sentence being written");
const commitFn = widget.slice(widget.indexOf("const commit = useCallback("), widget.indexOf("const stopListening = useCallback("));
ok(commitFn.length > 0, "commit is defined before the listeners that call it");
ok(/clearSilence\(\);/.test(commitFn), "commit cancels the pending pause timer");
ok(/if \(!transcript \|\| sentRef\.current\) return;/.test(commitFn), "commit sends at most once per session");
ok(/recognitionRef\.current = null;/.test(commitFn), "commit detaches the recogniser so onend cannot double-send");
ok(/\bcommit\(\);/.test(widget.slice(widget.indexOf("if (recognitionRef.current) {"))), "tapping the mic while it listens commits immediately");
const errorHandler = widget.slice(widget.indexOf("recognition.onerror ="), widget.indexOf("recognition.onend ="));
ok(/if \(heardRef\.current\.trim\(\)\) \{[\s\S]{0,120}commit\(\);/.test(errorHandler), "a recognition error keeps what was already heard");
const endHandler = widget.slice(widget.indexOf("recognition.onend ="), widget.indexOf("recognitionRef.current = recognition;"));
ok(/if \(heardRef\.current\.trim\(\)\) commit\(\);/.test(endHandler), "an engine-ended session commits rather than drops");

console.log("\n" + pass + " passed, " + failures.length + " failed");
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
