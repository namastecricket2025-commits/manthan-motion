/**
 * Throwaway verification for the maths text pipeline.
 * Run with: bun tmp-mathformat-check.ts
 */
import katex from "katex";
import { GRADES } from "./src/components/mathlab/mathlab.ts";
import {
  isMathLine,
  toLatex,
  toWorkedStep,
} from "./src/components/mathlab/mathformat.ts";

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function parses(source: string): boolean {
  try {
    katex.renderToString(source, { throwOnError: true, strict: false });
    return true;
  } catch (err) {
    return false;
  }
}

console.log("\n1. Cheat-sheet LaTeX compiles under KaTeX");
for (const grade of GRADES) {
  for (const chapter of grade.chapters) {
    for (const entry of chapter.cheat) {
      check(
        `${grade.label} / ${chapter.name}: ${entry.title}`,
        parses(entry.latex),
        entry.latex,
      );
    }
  }
}

console.log("\n2. Conversion of the engine's real strings");
const cases: [string, string][] = [
  ["D = (−5)² − 4(3)(2) = 1", String.raw`D = (-5)^{2} - 4(3)(2) = 1`],
  ["x = (−b ± √(b² − 4ac)) / 2a", String.raw`x = \frac{(-b \pm \sqrt{b^{2} - 4\,ac})}{2\,a}`],
  ["a/b + c/d = (a·d + b·c) / (b·d)", String.raw`\frac{a}{b} + \frac{c}{d} = \frac{(a \cdot d + b \cdot c)}{(b \cdot d)}`],
  ["f′(x) = 2(3)x + (−5) = 6x − 5", String.raw`f^{\prime}(x) = 2(3)x + (-5) = 6\,x - 5`],
  ["√(a·b) = √a · √b", String.raw`\sqrt{a\cdot b} = \sqrt{a} \cdot \sqrt{b}`],
  ["D = b² − 4ac", String.raw`D = b^{2} - 4\,ac`],
];
for (const [input, expected] of cases) {
  const got = toLatex(input);
  check(`toLatex(${JSON.stringify(input)})`, got === expected, `got ${JSON.stringify(got)}`);
  check(`  …compiles`, parses(got), got);
}

console.log("\n3. Prose is never typeset into nonsense");
check("'Standard form a x² + b x + c = 0' is prose", !isMathLine("Standard form a x² + b x + c = 0"));
check("'1 radian = 180°/π' is prose", !isMathLine("1 radian = 180°/π"));
check("'D = b² − 4ac' is maths", isMathLine("D = b² − 4ac"));
check(
  "'sin²θ + cos²θ = 1' is maths",
  isMathLine("sin²θ + cos²θ = 1"),
);
check(
  "toLatex leaves prose words intact",
  toLatex("Standard form") === "Standard form",
  toLatex("Standard form"),
);

console.log("\n4. Step decomposition");
const steps: [string, string][] = [
  // [step text, expected rule]
  ["[Discriminant Rule] - D = b² − 4ac = 25 − 24 = 1", "Discriminant Rule"],
  ["[Power Rule] - f′(x) = 2(3)x + (−5) = 6x − 5", "Power Rule"],
  ["Compute the discriminant: D = 25 − 24 = 1.", "Discriminant Rule"],
  ["Transpose the constant: 5x = 25.", "Transpose Rule"],
  ["Differentiate term by term with the power rule.", "Power Rule"],
  ["Bring both terms to a common denominator before adding.", "LCM of Denominators"],
  ["D = 25 − 24 = 1", "nth-Term Formula"],
];
for (const [raw, rule] of steps) {
  const got = toWorkedStep(raw, "nth-Term Formula");
  check(`rule for ${JSON.stringify(raw.slice(0, 44))}`, got.rule === rule, `got ${got.rule}`);
  if (got.math) {
    check(`  maths compiles: ${JSON.stringify(got.math)}`, parses(got.math), got.math);
  } else {
    console.log(`  ..   prose step, no maths: ${JSON.stringify(got.note.slice(0, 40))}`);
  }
}

const split = toWorkedStep(
  "[Quadratic Formula] - Rewrite in standard form and read off a = 3, b = −5, c = 2. Then x = (−b ± √(b² − 4ac)) / 2a.",
  "Quadratic Formula",
);
check("split keeps the equation out of the prose", split.math.startsWith("a = 3"), split.math);
check("split keeps the prose out of the equation", split.note.includes("standard form"), split.note);
check("split maths compiles", parses(split.math), split.math);

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
