/** Throwaway verification for the exact rational engine. */
import { Rational, solveExactly } from "./src/convex/exactMath.ts";

let failures = 0;
function check(name: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}\n         expected ${expected}\n         actual   ${actual}`);
  }
}

console.log("\nRational arithmetic stays exact");
check("1/3 + 1/6", Rational.parse("1/3").add(Rational.parse("1/6")).toString(), "1/2");
check("0.125 is 1/8", Rational.parseDecimal("0.125").toString(), "1/8");
check("2/3 - 5/6", Rational.parse("2/3").sub(Rational.parse("5/6")).toString(), "-1/6");
check("(-1/2)^2", Rational.parse("-1/2").pow(2).toString(), "1/4");
check(
  "negative powers are refused",
  (() => {
    try {
      Rational.of(1n, 2n).pow(-1);
      return "no throw";
    } catch {
      return "throws";
    }
  })(),
  "throws",
);
check("sqrt(9/16)", Rational.parse("9/16").sqrt()?.toString() ?? "null", "3/4");
check("sqrt(2) is irrational", Rational.of(2n).sqrt() === null ? "null" : "wrong", "null");
check("the denominator is normalised", Rational.of(1n, -2n).toString(), "-1/2");

console.log("\nLinear equations");
check("3x = 9", solveExactly("3x = 9").answerText, "x = 3");
check("0.5x = 2", solveExactly("0.5x = 2").answerText, "x = 4");
check("x/2 = 3", solveExactly("x/2 = 3").answerText, "x = 6");
check("2/3 x = 4", solveExactly("2/3 x = 4").answerText, "x = 6");
check("0.1x + 0.2 = 0.3", solveExactly("0.1x + 0.2 = 0.3").answerText, "x = 1");
check("x + x = 4", solveExactly("x + x = 4").answerText, "x = 2");
check("5x - 7 = 18", solveExactly("5x - 7 = 18").answerText, "x = 5");
check("2x + 3 = 0", solveExactly("2x + 3 = 0").answerText, "x = -3/2");

console.log("\nQuadratic equations");
check("3x^2 - 5x + 2 = 0", solveExactly("3x^2 - 5x + 2 = 0").answerText, "x₁ = 2/3, x₂ = 1");
check("x^2 - 5x + 6 = 0", solveExactly("x^2 - 5x + 6 = 0").answerText, "x₁ = 2, x₂ = 3");
check("x^2 + 2x + 1 = 0", solveExactly("x^2 + 2x + 1 = 0").answerText, "x = -1");
check("2x^2 = 8", solveExactly("2x^2 = 8").answerText, "x₁ = -2, x₂ = 2");
check("x^2 = 4", solveExactly("x^2 = 4").answerText, "x₁ = -2, x₂ = 2");
check(
  "x^2 = 2/9 stays irrational",
  solveExactly("x^2 = 2/9").answerText.includes("irrational") ? "irrational" : solveExactly("x^2 = 2/9").answerText,
  "irrational",
);
check("x^2 = 9/16", solveExactly("x^2 = 9/16").answerText, "x₁ = -3/4, x₂ = 3/4");

console.log("\nNo real roots stay honest");
const complex = solveExactly("x^2 + 1 = 0");
check("x^2 + 1 = 0 gets no fake real root", complex.answerText, "x = 0 ± 1i (no real roots)");
check("and says so in the LaTeX", String(complex.answerLatex.includes("i")), "true");

console.log("\nDegenerate and unsupported input");
check("x = x", solveExactly("x = x").kind, "identity");
check("x = x + 1", solveExactly("x = x + 1").kind, "contradiction");
check("sin x = 1", solveExactly("sin x = 1").kind, "unsupported");
check(
  "a chapter question is not forced through the checker",
  solveExactly("Find the eccentricity of x^2/25 + y^2/9 = 1").kind,
  "unsupported",
);

console.log("\nVerification is computed, not asserted");
check("3x^2 - 5x + 2 = 0 checks out", String(solveExactly("3x^2 - 5x + 2 = 0").verification.includes("exactly 0")), "true");
check(
  "and names each root",
  solveExactly("3x^2 - 5x + 2 = 0").verification,
  "Substituting x = \\frac{2}{3} gives exactly 0, so the root is correct. Substituting x = 1 gives exactly 0, so the root is correct.",
);

console.log("\nEvery emitted LaTeX line has balanced braces");
for (const input of ["3x^2 - 5x + 2 = 0", "5x - 7 = 18", "x^2 + 1 = 0", "x^2 - 2 = 0", "0.1x + 0.2 = 0.3"]) {
  const result = solveExactly(input);
  const all = [result.answerLatex, ...result.steps.map((s) => s.latex)];
  const balanced = all.every(
    (line) => (line.match(/\{/g) ?? []).length === (line.match(/\}/g) ?? []).length,
  );
  check(`balanced braces: ${input}`, String(balanced), "true");
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
