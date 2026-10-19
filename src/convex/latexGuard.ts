/**
 * What counts as mathematics, and what is just English in the wrong field.
 *
 * Two bugs shared one cause: a model that writes `\times` inside a JSON string
 * loses its backslash to JSON's `\t` escape, and a model that writes a sentence
 * into an "expression" field gets it set as italic letters by KaTeX. The first
 * is repaired before parsing (see `parseJsonLoose`); this module handles the
 * second by refusing to render anything that is not made of mathematics.
 */

/** LaTeX commands the engine may emit. Anything else is treated as text. */
export const LATEX_COMMANDS = new Set(
  `times div cdot frac dfrac tfrac sqrt pi theta alpha beta gamma delta Delta sum prod int infty
   pm mp le ge ne neq approx equiv to rightarrow leftarrow leftrightarrow Rightarrow Leftrightarrow
   left right text mathrm mathbf mathit mathsf mathtt mathbb mathcal mathfrak operatorname
   sin cos tan sec csc cot log ln exp lim vec hat bar overline underline begin end quad qquad
   ldots dots cdots bmod pmod angle triangle parallel perp circ degree Omega mu lambda sigma phi
   omega rho tau nu xi zeta eta psi chi kappa epsilon varepsilon subset supset in notin cup cap
   forall exists therefore because implies iff vdots ddots matrix pmatrix bmatrix cases aligned
   array boxed displaystyle textstyle scriptstyle stackrel overset underset xrightarrow xleftarrow
   prime partial nabla max min gcd lcm det mod`.split(/\s+/).filter(Boolean),
);

/** Function names that may appear upright without a backslash. */
const MATH_FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "log",
  "ln",
  "exp",
  "lim",
  "max",
  "min",
  "gcd",
  "lcm",
  "det",
  "mod",
]);

/**
 * The first reason a field cannot be typeset as mathematics, or null.
 *
 * A run of three or more letters outside `\text{…}` is never a variable; it is
 * a word that reached the wrong field. Unknown backslash commands are rejected
 * for the same reason — KaTeX would either error or invent a symbol.
 */
export function mathFieldError(value: string): string | null {
  if (!value.trim()) return null;
  const bad = new Set<string>();

  for (const match of value.matchAll(/\\([A-Za-z]+)/g)) {
    const command = match[1]!;
    if (!LATEX_COMMANDS.has(command)) bad.add(`\\${command}`);
  }

  const withoutText = value
    .replace(/\\text\{[^{}]*\}/g, " ")
    .replace(/\\operatorname\{[^{}]*\}/g, " ")
    .replace(/\\begin\{[^{}]*\}/g, " ")
    .replace(/\\end\{[^{}]*\}/g, " ")
    .replace(/\\[A-Za-z]+/g, " ");

  for (const match of withoutText.matchAll(/[A-Za-z]{3,}/g)) {
    const run = match[0];
    if (!MATH_FUNCTIONS.has(run)) bad.add(run);
  }

  return bad.size ? `not LaTeX: ${[...bad].join(", ")}` : null;
}
