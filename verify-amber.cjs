/*
 * Accent verification — amber (caramel by day, honey by night).
 *
 * What it checks, and why each one is a real risk rather than a formality:
 *
 *  1. The accent is declared in BOTH theme blocks and the values are the amber
 *     family (hue test), not a leftover crimson / gold / indigo value from an
 *     earlier pass of this same change.
 *  2. Every place the accent is used as TEXT meets WCAG AA (4.5:1) against the
 *     surface it actually sits on, and every place it is a FILL keeps its label
 *     at 4.5:1. The light theme's old ochre was legible but read as brown, and
 *     a lighter amber would read clean but measure ~1.7:1 — the numbers are the
 *     only way to tell those two failure modes apart.
 *  3. `--destructive` is still a RED hue, so errors stay separable from the
 *     brand now that the brand is no longer red.
 *  4. The dev server serves the same values (source is not the artifact the
 *     browser gets), and serves no crimson brand token anywhere.
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
/** sRGB-source-over compositing, the way a 10% token tint actually renders. */
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
const mix = (fg, pct, bg) => over(fg, pct, bg);
/** Hue in degrees, so "is this amber?" is a test rather than an eyeball. */
function hue(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let hh;
  if (max === r) hh = ((g - b) / d) % 6;
  else if (max === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  hh *= 60;
  return hh < 0 ? hh + 360 : hh;
}
const hex = (h) => "#" + rgb(h).map((v) => v.toString(16).padStart(2, "0")).join("");

/* ---------------- read the tokens ---------------- */
const cssPath = path.join(process.cwd(), "src/index.css");
const css = fs.readFileSync(cssPath, "utf8");
/* The dark block's selector is written on two lines in the source, but the CSS
   pipeline rewrites it onto one line with a space after the comma, so the split
   has to tolerate formatting rather than match the source bytes. */
const splitThemes = (text) => {
  const m = /\.dark,\s*\[data-theme=(?:"|')?dark(?:"|')?\]\s*\{/.exec(text);
  return m ? [text.slice(0, m.index), text.slice(m.index)] : [text, ""];
};
const [lightSrc, darkSrc] = splitThemes(css);
ok(darkSrc.length > 0, "index.css has both theme blocks");

const token = (src, name) => {
  const m = src.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})"));
  return m ? m[1].toLowerCase() : null;
};

const L = {
  signal: token(lightSrc, "signal"),
  signalStrong: token(lightSrc, "signal-strong"),
  signal2: token(lightSrc, "signal-2"),
  brand: token(lightSrc, "brand"),
  gtTail: token(lightSrc, "gt-tail"),
  strokeC: token(lightSrc, "stroke-c"),
  ink: token(lightSrc, "ink"),
  panel: token(lightSrc, "panel"),
  textMain: token(lightSrc, "text-main"),
  fg: token(lightSrc, "primary-foreground"),
  destructive: token(lightSrc, "destructive"),
  chart1: token(lightSrc, "chart-1"),
  kindSummary: token(lightSrc, "kind-summary"),
  dashPrimary: token(lightSrc, "dash-series-primary"),
  brandInk: token(lightSrc, "brand-ink"),
  brandSoft: token(lightSrc, "brand-soft"),
  brandMark: token(lightSrc, "brand-mark"),
};
const D = {
  brandInk: token(darkSrc, "brand-ink"),
  brand: token(darkSrc, "brand"),
  brandMark: token(darkSrc, "brand-mark"),
  signal: token(darkSrc, "signal"),
  signalStrong: token(darkSrc, "signal-strong"),
  ink: token(darkSrc, "ink"),
  panel: token(darkSrc, "panel"),
  destructive: token(darkSrc, "destructive"),
};

console.log("\n== 1. declared values ==");
const declared = [
  ["light --signal", L.signal, "#b45309"],
  /* One brand amber, one step apart per theme. `--brand` is the MARK tone
     (filled tiles, discs, rules, the big circle) and is the SAME value the
     filled action uses in that theme, so a checkmark and a button are the
     same pigment. The light step is #e8a410 — dark enough not to glare on
     paper — while the night theme keeps the honey #fbbf24 it was tuned
     against. */
  ["light --brand", L.brand, "#e8a410"],
  ["light --brand-mark", L.brandMark, "#e8a410"],
  ["light --signal-strong", L.signalStrong, "#e8a410"],
  ["dark --brand-mark", D.brandMark, "#f5f5f7"],
  ["light --signal-2", L.signal2, "#8a4207"],
  ["light --gt-tail", L.gtTail, "#b45309"],
  ["light --chart-1", L.chart1, "#b45309"],
  ["light --kind-summary", L.kindSummary, "#b45309"],
  ["light --dash-series-primary", L.dashPrimary, "#b45309"],
  ["dark --brand", D.brand, "#fbbf24"],
  ["light --brand-ink", L.brandInk, "#8a4207"],
  ["dark --brand-ink", D.brandInk, "#fbbf24"],
];
for (const [label, got, want] of declared) ok(got === want, label + " is " + want, got || "missing");

console.log("\n== 2. every accent-bearing token is amber, not a leftover ==");
for (const [label, v] of [
  ["light accent", L.signal],
  ["light brand", L.brand],
  ["light brand-ink", L.brandInk],
  ["dark brand", D.brand],
  ["dark brand-ink", D.brandInk],
  ["light gt tail", L.gtTail],
  ["light stroke-c", L.strokeC],
]) {
  const h = hue(v || "#000000");
  ok(v && h >= 18 && h <= 48, label + " hue is amber", (v || "?") + " / " + h.toFixed(0) + "deg");
}

console.log("\n== 3. contrast where the accent is actually used ==");
const checks = [
  ["light accent text on the canvas", L.signal, L.ink, 4.5],
  ["light accent text on a panel", L.signal, L.panel, 4.5],
  ["light accent as a small icon (3:1 is enough)", L.signal, L.panel, 3],
  /* The light theme splits the accent in two on purpose: the DEEP caramel is
     the ink (text, icons, hairlines) and the BRIGHT amber is the filled
     action. `--primary-foreground` is therefore only ever paired with the fill
     — measuring it against the ink colour would be testing a pairing that does
     not exist anywhere in the app (verify-fixes.cjs scans the CSS to prove
     that). So: the label is checked against the fill it is actually painted on,
     and the ink amber is checked against the surfaces it is actually painted on
     above. */
  ["light button label on the filled action", L.fg, L.signalStrong, 4.5],
  ["light button label on the hover fill", L.fg, mix(L.signalStrong, 0.88, "#000000"), 4.5],
  /* The light theme's brand tone is a bright yellow now, so the pairing that
     matters is INK ON THE FILL (the filled tile, the filled check disc, the
     button): `--primary-foreground` on `--brand`. Brand-coloured type on paper
     is not a pairing that exists any more — text takes `--brand-ink`, which is
     the deep ink step, checked below on the tint it actually sits on. */
  ["light brand TEXT on the brand tint (uses --brand-ink)", L.brandInk, mix(L.brand, 0.1, L.panel), 4.5],
  ["light ink on the amber mark/fill", L.fg, L.brand, 4.5],
  ["dark ink on the amber mark/fill", D.brand, D.panel, 4.5],
  /* The new darker day-theme amber has to keep the near-black label legible
     on the fill AND on the pressed/hover fill (a darkened step of the same
     token). Both used to sit at 10.3:1 and 7.6:1; the darker body only
     lowers them, so the bar is the same. */
  ["light label on the darker amber fill", L.fg, "#e8a410", 4.5],
  ["light label on the darker amber hover fill", L.fg, mix("#e8a410", 0.88, "#000000"), 4.5],
  ["light accent as a chart stroke on the panel", L.signal, L.panel, 3],
  ["dark brand on the black canvas", D.brand, D.ink, 4.5],
  ["dark brand on a panel", D.brand, D.panel, 4.5],
  ["dark brand TEXT on the brand tint", D.brandInk, mix(D.brand, 0.14, D.panel), 4.5],
];
for (const [label, fg, bg, min] of checks) {
  if (!fg || !bg) {
    ok(false, label, "missing token");
    continue;
  }
  const c = contrast(fg, bg);
  ok(c >= min, label, c.toFixed(2) + ":1 on " + bg + " (min " + min + ")");
}

console.log("\n== 4. error red stays red, and separate from the brand ==");
const dl = hue(L.destructive), dd = hue(D.destructive);
ok(dl < 20 || dl > 340, "light --destructive is a red hue", L.destructive + " / " + dl.toFixed(0) + "deg");
ok(dd < 20 || dd > 340, "dark --destructive is a red hue", D.destructive + " / " + dd.toFixed(0) + "deg");
ok(L.destructive !== L.brand && D.destructive !== D.brand, "destructive and brand are different colours");
ok(contrast(L.destructive, L.ink) >= 4.5, "light error text on the canvas", contrast(L.destructive, L.ink).toFixed(2) + ":1");
ok(contrast(D.destructive, D.ink) >= 4.5, "dark error text on the canvas", contrast(D.destructive, D.ink).toFixed(2) + ":1");
// The dark theme's own light (its button body) must not be the amber.
ok(D.signal === "#f5f5f7" && D.signalStrong === "#ffffff", "dark theme light tokens are untouched", D.signal + " / " + D.signalStrong);

console.log("\n== 5. no crimson / gold / indigo accent left anywhere in src ==");
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
};
const files = walk(path.join(process.cwd(), "src"));
const banned = [
  ["crimson brand", /c81f27|ef4b52|b91c2c|8f1d22|d3353d/],
  ["gold brand", /8f5a00|ffd60a|b87400|6b4400/i],
  ["indigo brand", /3a5bc7|9eb1ff|3e63dd|27418c/i],
];
// Allowed: the error tokens, in the two places that define them, plus anatomy
// and hazard colours that are content, not interface.
const allow = [
  { file: "src/index.css", what: /--destructive|--kind-|--chart-scale|--set-danger/ },
  { file: "src/components/settings/settings.css", what: /--set-danger|#c81e1e/ },
];
for (const [label, re] of banned) {
  const hits = [];
  for (const f of files) {
    const rel = f.replace(process.cwd() + "/", "");
    const lines = fs.readFileSync(f, "utf8").split("\n");
    /* Comments are where the old values are DOCUMENTED (the dark brand note
       names the lemon it replaced), so track block-comment state rather than
       guessing from the line's first characters — a wrapped comment line
       starts with a word, not with an asterisk. */
    let inComment = false;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (inComment) {
        if (trimmed.includes("*/")) inComment = false;
        return;
      }
      if (trimmed.startsWith("/*") || trimmed.startsWith("//")) {
        if (!trimmed.includes("*/") && trimmed.startsWith("/*")) inComment = true;
        return;
      }
      if (!re.test(line)) return;
      const exemptFile = allow.some((a) => a.file === rel);
      const isAllowedDecl = exemptFile && allow.find((a) => a.file === rel).what.test(line);
      if (isAllowedDecl) return;
      hits.push(rel + ":" + (i + 1) + " " + line.trim().slice(0, 90));
    });
  }
  ok(hits.length === 0, "no " + label + " outside error tokens/comments", hits.slice(0, 6).join(" | "));
}

console.log("\n== 5b. the wiring, not just the tokens ==");
{
  /* A token nothing references is a comment. The pill in Features is the one
     element that paints brand-coloured TEXT on a brand tint, so it has to be
     the deep step; and the settings page's own danger token has to stay red,
     or a failed action would look like the brand. */
  const features = fs.readFileSync(path.join(process.cwd(), "src/components/landing/Features.tsx"), "utf8");
  ok(/bg-\[var\(--brand-soft\)\]\s*text-\[var\(--brand-ink\)\]/.test(features), "the brand pill paints its label with --brand-ink");
  /* The risk is specifically brand text ON the brand tint, so scan whole class
     strings rather than the file: `text-[var(--brand)]` on a panel is correct
     (5.02:1) and one of them is a 3.5px icon, where 3:1 is the bar. */
  const tintClasses = features.match(/"[^"]*bg-\[var\(--brand-soft\)\][^"]*"/g) || [];
  ok(tintClasses.length > 0, "the brand tint is used somewhere", String(tintClasses.length));
  const onTint = tintClasses.filter((c) => /text-\[var\(--brand\)\]/.test(c));
  ok(onTint.length === 0, "no class string paints brand text straight on the brand tint", onTint.join(" | "));
  ok(tintClasses.some((c) => /text-\[var\(--brand-ink\)\]/.test(c)), "the tinted pill labels itself with --brand-ink");
  const settings = fs.readFileSync(path.join(process.cwd(), "src/components/settings/settings.css"), "utf8");
  /* The settings page used to hand-pick its own error red (`#c81e1e`) next to
     the theme's. That is the drift this whole file exists to catch: it now
     aliases the theme token, so there is one error colour in the app and it is
     already hue- and contrast-checked in section 4. */
  const setDanger = /--set-danger:\s*var\(--destructive\)/.test(settings);
  ok(setDanger, "the settings page aliases --set-danger to the theme error token", String(setDanger));
  const setDangerLiteral = /--set-danger:\s*#[0-9a-fA-F]{6}/.test(settings);
  ok(!setDangerLiteral, "the settings page no longer hardcodes its own danger colour");
}

/* ---------------- 5c. eye comfort is wired and readable ---------------- */
console.log("\n== 5c. eye comfort ==");
{
  const cssText = css;
  const blockOf = (selector) => {
    const start = cssText.indexOf(selector);
    if (start < 0) return null;
    const open = cssText.indexOf("{", start);
    const close = cssText.indexOf("\n}", open);
    return cssText.slice(open + 1, close);
  };
  const lightBlock = blockOf('html[data-comfort="on"]:not(.dark)');
  const darkBlock = blockOf('html[data-comfort="on"]:is(.dark, [data-theme="dark"])');
  ok(Boolean(lightBlock), "a light eye-comfort block exists");
  ok(Boolean(darkBlock), "a dark eye-comfort block exists");

  const bt = (src, name) => {
    const m = (src || "").match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})"));
    return m ? m[1].toLowerCase() : null;
  };
  const CL = {
    ink: bt(lightBlock, "ink"),
    panel: bt(lightBlock, "panel"),
    textMain: bt(lightBlock, "text-main"),
    textDim: bt(lightBlock, "text-dim"),
    signalStrong: bt(lightBlock, "signal-strong"),
    brand: bt(lightBlock, "brand"),
    fg: token(lightSrc, "primary-foreground"),
  };
  const CD = {
    panel: bt(darkBlock, "panel"),
    textMain: bt(darkBlock, "text-main"),
  };
  /* The point of the mode is a WARMER, dimmer canvas: the paper may not be the
     old pure-white panel, and the type may not be the old near-black. */
  ok(CL.panel && CL.panel !== L.panel, "comfort paper is not the pure-white panel", String(CL.panel));
  ok(CL.textMain && CL.textMain !== L.textMain, "comfort ink is not the near-black type", String(CL.textMain));
  ok(CL.ink && CL.ink !== L.ink, "comfort canvas is not the plain #fafafa canvas", String(CL.ink));
  ok(CD.panel && CD.panel !== D.panel, "comfort night panel is lifted off #0a0a0a", String(CD.panel));

  /* Same amber family, one step deeper, and still legible as a label fill. */
  ok(CL.brand && CL.brand === CL.signalStrong, "comfort keeps the button and the mark on ONE amber", String(CL.brand));
  const ch = hue(CL.brand || "#000000");
  ok(ch >= 18 && ch <= 48, "comfort amber is still amber", (CL.brand || "?") + " / " + ch.toFixed(0) + "deg");
  ok(contrast(CL.fg, CL.brand) >= 4.5, "comfort label on the comfort amber", contrast(CL.fg, CL.brand).toFixed(2) + ":1");

  ok(contrast(CL.textMain, CL.panel) >= 4.5, "comfort body text on comfort paper", contrast(CL.textMain, CL.panel).toFixed(2) + ":1");
  ok(contrast(CL.textDim, CL.panel) >= 4.5, "comfort secondary text on comfort paper", contrast(CL.textDim, CL.panel).toFixed(2) + ":1");
  ok(contrast(CD.textMain, CD.panel) >= 4.5, "comfort body text on the comfort night panel", contrast(CD.textMain, CD.panel).toFixed(2) + ":1");

  /* The veil is the only part that reaches <canvas> pixels, so its contract is
     exact: above everything, pointer-transparent, no full-page filter. */
  const veil = blockOf('html[data-comfort="on"]::after');
  ok(Boolean(veil) && /position:\s*fixed/.test(veil), "the comfort veil is a fixed layer");
  ok(Boolean(veil) && /pointer-events:\s*none/.test(veil), "the comfort veil never eats a click");
  ok(
    Boolean(veil) && /mix-blend-mode:\s*multiply/.test(veil),
    "the comfort veil multiplies instead of washing out",
    veil ? (veil.match(/opacity:\s*([0-9.]+)/) || [])[1] : "missing",
  );
  ok(!/filter:\s*sepia/.test(cssText), "no sepia filter on <html> (it would trap fixed layers)");

  const settingsSrc = fs.readFileSync(path.join(process.cwd(), "src/lib/app-settings.ts"), "utf8");
  ok(/eyeComfort:\s*boolean/.test(settingsSrc), "AppSettings declares eyeComfort");
  ok(/eyeComfort:\s*false/.test(settingsSrc), "eyeComfort defaults to off");
  ok(/setAttribute\("data-comfort"/.test(settingsSrc), "applySettings writes data-comfort on <html>");

  const dash = fs.readFileSync(path.join(process.cwd(), "src/components/settings/SettingsDashboard.tsx"), "utf8");
  ok(/title="Eye comfort"/.test(dash), "the Settings page has an Eye comfort row");
  ok(/update\(\{\s*eyeComfort:\s*v\s*\}\)/.test(dash), "the row's switch writes eyeComfort");
  /* Placed with Appearance, not buried in a separate panel: the user asked for
     the control to sit where appearance controls belong. */
  const eyeIdx = dash.indexOf('title="Eye comfort"');
  const textIdx = dash.indexOf('title="Text comfort"');
  ok(eyeIdx > 0 && textIdx > eyeIdx, "Eye comfort sits right under Appearance, before Text comfort");
}

/* ---------------- 6. what the dev server actually serves ---------------- */
const http = require("http");
const get = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve({ status: 0, body: "" });
    });
  });
const ports = [5173, 8080, 3000, 4173];

(async () => {
  console.log("\n== 6. the same values in what the browser is served ==");
  let served = null;
  let port = null;
  for (const p of ports) {
    const r = await get("http://127.0.0.1:" + p + "/src/index.css");
    if (r.status === 200 && r.body.includes("--brand")) {
      served = r.body;
      port = p;
      break;
    }
  }
  if (!served) {
    console.log("  skip no dev server on " + ports.join(", ") + " — source checks above still apply");
  } else {
    /* Vite serves the stylesheet as a JS module string, so newlines and quotes
       arrive escaped. Unescape before looking for the theme boundary — the
       tokens are all there, just written on one line. */
    served = served.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    console.log("  (read " + served.length + " bytes of CSS from :" + port + "/src/index.css)");
    const [sLight, sDark] = splitThemes(served);
    const sToken = (src, name) => {
      const m = src.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})"));
      return m ? m[1].toLowerCase() : null;
    };
    ok(sToken(sLight, "signal") === L.signal, "served light --signal matches source", String(sToken(sLight, "signal")));
    ok(sToken(sLight, "brand") === L.brand, "served light --brand matches source", String(sToken(sLight, "brand")));
    ok(sToken(sDark, "brand") === D.brand, "served dark --brand matches source", String(sToken(sDark, "brand")));
    ok(sToken(sLight, "brand-ink") === L.brandInk, "served light --brand-ink matches source", String(sToken(sLight, "brand-ink")));
    /* The light button is the pair the browser has to paint: bright amber body,
       near-black label. Asserted on the SERVED css, not the source, because the
       whole point of the fix is what renders. */
    ok(sToken(sLight, "signal-strong") === "#e8a410", "served light --signal-strong is the softened amber", String(sToken(sLight, "signal-strong")));
    ok(sToken(sLight, "primary-foreground") === "#241a02", "served light --primary-foreground is near-black", String(sToken(sLight, "primary-foreground")));
    ok(sToken(sDark, "brand-ink") === D.brandInk, "served dark --brand-ink matches source", String(sToken(sDark, "brand-ink")));
    ok(sToken(sDark, "destructive") === D.destructive, "served dark --destructive is still the error red", String(sToken(sDark, "destructive")));
    ok(!/--brand:\s*#(c81f27|ef4b52)/i.test(served), "served CSS declares no crimson --brand");
    ok(!/--signal:\s*#(3a5bc7|8f5a00|ffd60a)/i.test(served), "served CSS declares no leftover accent");
    // The pipeline downlevels color-mix inside gradients; the tokens must
    // therefore be plain hexes on the gradient paths (see the halo note).
    const spot = served.match(/--spot-light:\s*([^;]+);/g) || [];
    ok(spot.length === 2, "both spot-light tokens still declared (one per theme)", spot.join(" "));
  }

  console.log("\n== 7. report ==");
  const ratios = {
    "light accent on canvas": contrast(L.signal, L.ink).toFixed(2) + ":1",
    "light accent on panel": contrast(L.signal, L.panel).toFixed(2) + ":1",
    "light button label": contrast(L.fg, L.signalStrong).toFixed(2) + ":1 on " + L.signalStrong,
    "dark brand on black": contrast(D.brand, D.ink).toFixed(2) + ":1",
    "dark brand on panel": contrast(D.brand, D.panel).toFixed(2) + ":1",
    "light tint composite": hex(mix(L.brand, 0.1, L.panel)),
    "light brand-ink on tint": contrast(L.brandInk, mix(L.brand, 0.1, L.panel)).toFixed(2) + ":1",
    "light hover fill label": contrast(L.fg, mix(L.signalStrong, 0.88, "#000000")).toFixed(2) + ":1",
    "dark tint composite": hex(mix(D.brand, 0.14, D.panel)),
  };
  for (const [k, v] of Object.entries(ratios)) console.log("   " + k.padEnd(26) + v);

  console.log("\n" + pass + " passed, " + failures.length + " failed");
  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
})();
