"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { z } from "zod";
import { callModel, resolveCandidates } from "./providers";
import { verifyAnswer } from "./mathVerify";
import {
  MAX_CORPUS,
  UploadUnreadable,
  detectLanguage,
  languageDirective,
  languageLock,
  parseJsonLoose,
  readUpload,
  tidy,
} from "./ai";
import {
  MAX_MATH_IMAGE,
  cleanProse,
  mathProblemSchema,
  type SolvedProblem,
} from "./mathPrompts";
import { finalizeProblem } from "./mathLab";
import { boardBank, boardLabel, type BankQuestion } from "../lib/boardBank";

/**
 * The Math Lab's three follow-up tutors: explaining a single step, marking a
 * student's own working, and writing a fresh practice problem.
 *
 * All three reuse the solve action's contract rather than inventing their own.
 * `finalizeProblem` folds an independent arithmetic check into whatever comes
 * back, so a practice problem is verified exactly like a solved one, and a
 * "why does this step work" reply never travels through the maths renderer
 * without being split into prose and LaTeX first.
 *
 * Unauthenticated on purpose, matching the solver and the Canvas Solver: these
 * are conversations about a solution the student already has, and they do not
 * touch the daily generation allowance.
 */

/* ------------------------------------------------------------------ */
/* Explain one step                                                    */
/* ------------------------------------------------------------------ */

const STEP_SYSTEM = [
  "You are the patient tutor inside Manthan's Math Lab. A student is looking at ONE step of a solution they have already been given and has pressed a button asking why it works.",
  "Explain that single move, and nothing else. Do not re-solve the problem, do not restate the whole method, and do not jump ahead to later steps.",
  "Open with the plainest possible version of the idea — the thing a friend would say — then name the rule or identity being used and why it applies here.",
  "Keep it to three or four short sentences. Use a concrete tiny example of the same move only if it genuinely makes the rule clearer.",
  "Any mathematics inside the explanation must be wrapped in dollars, like $\\\\frac{2}{3}$. Everything outside the dollars is rendered as ordinary text, so it has to read as ordinary text.",
  "Never invent facts about the problem. If the step as given is wrong or unclear, say so plainly and explain what is actually true.",
  "No emoji, no markdown, no asterisks, no bullet symbols.",
  'Reply with a single JSON object and nothing else: {"simple":string}.',
].join(" ");

const stepReplySchema = z.object({
  simple: z.string().min(1),
});

export const explainStep = action({
  args: {
    problem: v.string(),
    stepTitle: v.string(),
    stepExpression: v.string(),
    stepExplanation: v.string(),
    rule: v.string(),
    /** A student's own follow-up about this step, when they typed one. */
    question: v.optional(v.string()),
    track: v.optional(v.string()),
    chapterName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { problem, stepTitle, stepExpression, stepExplanation, rule, question, track, chapterName },
  ): Promise<{ simple: string; model: string }> => {
    const language = detectLanguage([question ?? "", stepExplanation, problem]);
    const prompt = [
      `THE PROBLEM: ${problem}`,
      `THE STEP THE STUDENT IS STUCK ON${
        stepTitle ? ` — titled "${stepTitle}"` : ""
      }${rule ? ` (rule: ${rule})` : ""}:`,
      stepExpression ? `The working in this step: ${stepExpression}` : "",
      stepExplanation ? `The explanation they were given: ${stepExplanation}` : "",
      track ? `Syllabus context: ${track}${chapterName ? `, chapter ${chapterName}` : ""}.` : "",
      question
        ? `The student has also asked this about the step, so answer it directly as part of your reply: "${question}"`
        : "Explain why this step is allowed and what it achieves.",
      ...languageDirective(language),
      "Reply with the JSON object only.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, STEP_SYSTEM, prompt, undefined, 0.3);
    const parsed = stepReplySchema.parse(parseJsonLoose(reply.text));

    return { simple: cleanProse(parsed.simple), model: reply.model };
  },
});

/* ------------------------------------------------------------------ */
/* Check a student's own working                                       */
/* ------------------------------------------------------------------ */

const CHECK_SYSTEM = [
  "You are marking a student's own working inside Manthan's Math Lab, against a worked solution the app already gave them.",
  "You are given the official steps, numbered from 0, and the student's working — typed, pasted, or photographed. Read the student's working as written, including anything they crossed out or wrote in the margin.",
  "For EACH official step, say whether the student's corresponding move is right: 'correct' when their move is equivalent and valid, 'wrong' when their move changes the value or misapplies the rule, 'unclear' when the student's writing does not cover that step or cannot be read.",
  "Then identify the FIRST step the student got wrong — the earliest index whose verdict is 'wrong'. That is the one that matters; everything after it is usually a consequence, so do not pile on.",
  "mistake explains, in two or three plain sentences, exactly what went wrong at that first wrong step and what the correct move was. summary is one short line a teacher would write at the top of the page: how many steps were right, and where it first went wrong.",
  "Be encouraging and specific. Never claim a step is correct when it is not, and never invent working the student did not write — if the page is blank or unreadable, return 'unclear' verdicts and say so.",
  "Any mathematics inside a comment or explanation must be wrapped in dollars, like $\\\\frac{2}{3}$. Everything outside the dollars is ordinary text.",
  "No emoji, no markdown, no asterisks, no bullet symbols.",
  'Reply with a single JSON object and nothing else: {"steps":[{"index":number,"verdict":"correct"|"wrong"|"unclear","comment":string}],"firstWrongIndex":number|null,"mistake":string,"summary":string}.',
].join(" ");

const checkReplySchema = z.object({
  steps: z
    .array(
      z.object({
        index: z.number().int().nonnegative().catch(0),
        verdict: z.enum(["correct", "wrong", "unclear"]).catch("unclear"),
        comment: z.string().catch(""),
      }),
    )
    .catch([]),
  firstWrongIndex: z.number().int().nonnegative().nullable().catch(null),
  mistake: z.string().catch(""),
  summary: z.string().catch(""),
});

export type StepVerdict = {
  index: number;
  verdict: "correct" | "wrong" | "unclear";
  comment: string;
};

export const checkWork = action({
  args: {
    problem: v.string(),
    steps: v.array(
      v.object({
        title: v.string(),
        expression: v.string(),
        rule: v.string(),
      }),
    ),
    finalAnswer: v.string(),
    /** The student's working, typed or pasted. */
    work: v.optional(v.string()),
    /** Or a photograph of it. */
    imageBase64: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    name: v.optional(v.string()),
    mime: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { problem, steps, finalAnswer, work, imageBase64, mimeType, storageId, name, mime },
  ): Promise<{
    steps: StepVerdict[];
    firstWrongIndex: number | null;
    mistake: string;
    summary: string;
    model: string;
  }> => {
    const typed = work?.trim() ?? "";
    if (!typed && !imageBase64 && !storageId) {
      throw new Error(
        "Write or photograph your working first, then ask the tutor to check it.",
      );
    }
    if (imageBase64 && imageBase64.length > MAX_MATH_IMAGE) {
      throw new Error("That image is too large to read. Crop it to your working and try again.");
    }

    let pageText = "";
    if (storageId) {
      const blob = await ctx.storage.get(storageId);
      if (!blob) throw new Error("The upload did not reach storage. Try again.");
      const buffer = Buffer.from(await blob.arrayBuffer());
      await ctx.storage.delete(storageId);
      try {
        pageText = (await readUpload(buffer, name ?? "", mime)).text;
      } catch (err) {
        if (err instanceof UploadUnreadable) throw err;
        throw new Error("That file could not be read — type your working instead.");
      }
      pageText = tidy(pageText).slice(0, MAX_CORPUS);
    }

    const language = detectLanguage([typed, pageText, problem]);
    const officialSteps = steps.length
      ? steps
          .map(
            (step, index) =>
              `${index}. ${step.rule ? `[${step.rule}] ` : ""}${step.expression || step.title}`,
          )
          .join("\n")
      : "(the app holds no numbered steps for this problem — mark the working against the problem itself)";

    const prompt = [
      `THE PROBLEM: ${problem}`,
      `THE OFFICIAL STEPS:\n${officialSteps}`,
      `THE OFFICIAL FINAL ANSWER: ${finalAnswer}`,
      pageText ? `THE STUDENT'S WORKING (from an attached page):\n${pageText}` : "",
      typed ? `THE STUDENT'S WORKING (as they wrote it):\n${typed}` : "",
      imageBase64 ? "The photograph attached is the student's own working. Mark what is actually written on it." : "",
      ...languageDirective(language),
      "Reply with the JSON object only.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const image =
      imageBase64 && mimeType ? { mimeType, data: imageBase64 } : undefined;

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, CHECK_SYSTEM, prompt, image, 0.2);
    const parsed = checkReplySchema.parse(parseJsonLoose(reply.text));

    // Fold the model's verdicts onto the real step list, so an index it
    // invented, repeated or skipped can never reach the student as a step that
    // does not exist.
    const byIndex = new Map<number, StepVerdict>();
    for (const entry of parsed.steps) {
      if (entry.index >= steps.length) continue;
      const clean: StepVerdict = {
        index: entry.index,
        verdict: entry.verdict,
        comment: cleanProse(entry.comment),
      };
      // The first verdict for an index wins; a later duplicate is ignored
      // rather than overwriting a judgement already made.
      if (!byIndex.has(entry.index)) byIndex.set(entry.index, clean);
    }
    const verdicts: StepVerdict[] = steps.map(
      (_, index) =>
        byIndex.get(index) ?? {
          index,
          verdict: "unclear" as const,
          comment: "Your working for this step was not visible in what you shared.",
        },
    );

    // The first wrong step is read off the verdicts themselves. The model's own
    // `firstWrongIndex` is only used when it agrees; a mismatch means the
    // verdicts and the summary contradict each other, and the verdicts win.
    const derived = verdicts.find((entry) => entry.verdict === "wrong")?.index ?? null;
    const firstWrongIndex = derived;

    return {
      steps: verdicts,
      firstWrongIndex,
      mistake: cleanProse(parsed.mistake) || (derived === null ? "" : "Have another look at the step above."),
      summary:
        cleanProse(parsed.summary) ||
        `${verdicts.filter((entry) => entry.verdict === "correct").length} of ${verdicts.length} steps marked correct.`,
      model: reply.model,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Practice                                                            */
/* ------------------------------------------------------------------ */

const PRACTICE_SYSTEM = [
  "You are the practice generator inside Manthan's Math Lab.",
  "You are given a problem the student has just studied, with the full method. Write ONE brand-new problem of the same kind and the same difficulty — the same skill, the same number of steps, the same notation — with different numbers and a different setting.",
  "Never reuse the original problem's numbers, and never simply rename its variables. If the original asked about a tank filling at a rate, the new one must still be that skill but with its own numbers and its own story.",
  "Solve your new problem completely and correctly, in the same structured form a teacher would write: each step is ONE move carrying four fields.",
  "problem is the question as plain text with only the mathematics inside dollars — 'Evaluate 23 × 4 using the distributive property.' — never a LaTeX-only field.",
  "expression is LaTeX ONLY: numbers, symbols and commands, never an English word. Never write 'plus', 'times', 'divided by' or 'equals' inside an expression — the only word allowed is inside \\\\text{...} for a unit.",
  "explanation is plain English, one or two short sentences, with any maths wrapped in dollars.",
  "finalAnswer is LaTeX ONLY — the value or expression the student must write, with no sentence around it. Write x = 40 or 616\\text{ cm}^2, never 'The area is 616 cm²'.",
  "rule is the two-to-four word rule name a teacher writes in the margin. title is a two-to-five word label for the move.",
  "Every expression must be exactly equivalent to the line above it, and verification must genuinely substitute the answer back into the original relation and say whether both sides match.",
  "Keep the numbers exact. Never round a fraction into a decimal.",
  "No emoji, no markdown, no asterisks, no bullet symbols.",
  'Reply with a single JSON object and nothing else: {"problem":{"problem":string,"title":string,"given":string[],"formulas":string[],"steps":[{"title":string,"explanation":string,"expression":string,"rule":string}],"finalAnswer":string,"verification":string}}.',
].join(" ");

const practiceReplySchema = z.object({ problem: mathProblemSchema });

export const practiceProblem = action({
  args: {
    problem: v.string(),
    steps: v.optional(
      v.array(
        v.object({
          title: v.string(),
          expression: v.string(),
          rule: v.string(),
        }),
      ),
    ),
    finalAnswer: v.optional(v.string()),
    track: v.optional(v.string()),
    chapterName: v.optional(v.string()),
    chapterFormulas: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { problem, steps, finalAnswer, track, chapterName, chapterFormulas },
  ): Promise<{ problem: SolvedProblem; model: string }> => {
    const language = detectLanguage([problem]);
    const method = (steps ?? [])
      .map((step, index) => `${index + 1}. ${step.rule ? `[${step.rule}] ` : ""}${step.expression || step.title}`)
      .join("\n");

    const prompt = [
      `THE PROBLEM THE STUDENT JUST STUDIED: ${problem}`,
      method ? `THE METHOD THEY WERE SHOWN:\n${method}` : "",
      finalAnswer ? `ITS ANSWER (do not reuse this value): ${finalAnswer}` : "",
      track ? `Syllabus context: ${track}${chapterName ? `, chapter ${chapterName}` : ""}.` : "",
      chapterFormulas && chapterFormulas.length
        ? `Formulas this chapter is examined on:\n- ${chapterFormulas.join("\n- ")}`
        : "",
      "Write one new practice problem of the same type and difficulty, and solve it in full.",
      ...languageDirective(language),
      "Reply with the JSON object only.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const reply = await callModel(candidates, PRACTICE_SYSTEM, prompt, undefined, 0.4);
    let parsed: z.infer<typeof practiceReplySchema>;
    try {
      parsed = practiceReplySchema.parse(parseJsonLoose(reply.text));
    } catch {
      const retry = await callModel(
        candidates,
        PRACTICE_SYSTEM,
        [prompt, "CORRECTION: the last reply was not a valid JSON object. Reply with the JSON object only — no prose, no Markdown fence."].join("\n\n"),
        undefined,
        0.2,
      );
      parsed = practiceReplySchema.parse(parseJsonLoose(retry.text));
    }

    // The practice problem is checked by the same independent engine as a real
    // solve, so the answer behind the check field is one the app can defend.
    const check = verifyAnswer(parsed.problem.problem, parsed.problem.finalAnswer);
    return { problem: finalizeProblem(parsed.problem, check), model: reply.model };
  },
});

/* ------------------------------------------------------------------ */
/* A set of practice questions                                         */
/* ------------------------------------------------------------------ */

/**
 * The four rungs a student can ask for.
 *
 * `board` is not just "harder": it asks for the shape of a CBSE board paper —
 * a multi-part question, a stated mark value and a real previous-year tag when
 * the model can reproduce one honestly.
 */
const PRACTICE_LEVELS = {
  easy: [
    "FOUNDATION level: one concept, one or two moves, friendly numbers.",
    "A student who has just met the idea should be able to finish it.",
  ].join(" "),
  medium: [
    "STANDARD level: two or three linked moves, the kind of question set in a class test.",
    "Numbers should need a little care but no trick.",
  ].join(" "),
  hard: [
    "CHALLENGING level: a HOTS question that combines two ideas from the chapter, with a non-obvious first move.",
    "The numbers should be awkward enough that a student has to plan before calculating. Still solvable exactly.",
  ].join(" "),
  board: [
    "BOARD-PAPER level: write it the way CBSE sets it — a complete question stem, any sub-parts, and a mark value.",
    "Use the language of an Indian board paper (prove that, find, construct, case-study based) and keep the working to what earns full marks.",
    "If this is a question you can reproduce faithfully from a CBSE previous-year paper, set source to the exact paper and year (for example \"CBSE 2024 · 3 marks\").",
    "If you cannot reproduce a real one verbatim, write an original question in that pattern and set source to the year plus the word pattern, for example \"CBSE 2026 pattern · 3 marks\". Never invent a citation you are not sure of.",
  ].join(" "),
} as const;

const practiceLevelValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
  v.literal("board"),
);

/**
 * One real board question for a Class 10 maths set.
 *
 * The set still contains fresh questions — a board set should feel like a
 * paper, not like a museum of four old questions — but the first seat is a
 * question a student would actually meet in a board paper. Only the current
 * chapter is eligible: putting a Statistics question in a Trigonometry set
 * would make the tag misleading.
 */
function pickMathsBoardQuestion(
  chapterName?: string,
  paperYear?: string,
): BankQuestion | null {
  const chapter = (chapterName ?? "").trim();
  if (!chapter) return null;
  const pool = boardBank("10", "maths").filter(
    (item) => item.type !== "mcq" && item.chapter === chapter,
  );
  if (pool.length === 0) return null;
  /* When the student picked a year, the paper tag has to agree with it — a
     set labelled "CBSE 2024" must not open with a 2020 question. If that year
     has no question for this chapter, any year is better than a false label. */
  const year = (paperYear ?? "").match(/\b(20\d{2})\b/)?.[1];
  const matching = year
    ? pool.filter((item) => item.origin.includes(year))
    : [];
  const from = matching.length ? matching : pool;
  return from[Math.floor(Math.random() * from.length)] ?? null;
}

/** A whole practice set: several questions from one topic, one level. */
export const practiceSet = action({
  args: {
    problem: v.string(),
    steps: v.optional(
      v.array(
        v.object({
          title: v.string(),
          expression: v.string(),
          rule: v.string(),
        }),
      ),
    ),
    finalAnswer: v.optional(v.string()),
    track: v.optional(v.string()),
    chapterName: v.optional(v.string()),
    chapterFormulas: v.optional(v.array(v.string())),
    /** Which class the student is in; only Class 10 has a board paper. */
    className: v.optional(v.string()),
    /** 1 to 6 questions; the UI caps it and so does this handler. */
    count: v.number(),
    level: practiceLevelValidator,
    /** "CBSE 2024", "CBSE 2025" or empty for whichever fits. */
    boardYear: v.optional(v.string()),
    /** Put the question in a real situation the student recognises. */
    realWorld: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { problem, steps, finalAnswer, track, chapterName, chapterFormulas, className, count, level, boardYear, realWorld },
  ): Promise<{ problems: SolvedProblem[]; model: string }> => {
    const total = Math.max(1, Math.min(6, Math.round(count)));
    const realBoard =
      level === "board" && className === "10"
        ? pickMathsBoardQuestion(chapterName, boardYear)
        : null;
    const language = detectLanguage([problem]);
    const method = (steps ?? [])
      .map((step, index) => `${index + 1}. ${step.rule ? `[${step.rule}] ` : ""}${step.expression || step.title}`)
      .join("\n");
    const requestedBoard = (boardYear ?? "CBSE").trim() || "CBSE";
    // "CBSE (mixed)" is the student asking for either year, not a paper name.
    const board = /mixed/i.test(requestedBoard) ? "CBSE" : requestedBoard;
    const boardBrief = /mixed/i.test(requestedBoard)
      ? "CBSE — pick EITHER the 2025 or the 2026 paper and put that year in the source tag (for example \"CBSE 2026 pattern · 3 marks\")"
      : requestedBoard;

    const problems: SolvedProblem[] = [];
    let lastModel = "";

    for (let index = 0; index < total; index += 1) {
      const already = problems.map((entry) => `- ${entry.problem}`).join("\n");
      const boardQuestion = index === 0 ? realBoard : null;
      const prompt = [
        `THE PROBLEM THE STUDENT JUST STUDIED: ${problem}`,
        method ? `THE METHOD THEY WERE SHOWN:\n${method}` : "",
        finalAnswer ? `ITS ANSWER (do not reuse this value): ${finalAnswer}` : "",
        track ? `Syllabus context: ${track}${chapterName ? `, chapter ${chapterName}` : ""}.` : "",
        chapterFormulas && chapterFormulas.length
          ? `Formulas this chapter is examined on:\n- ${chapterFormulas.join("\n- ")}`
          : "",
        `This is question ${index + 1} of ${total} in one set.`,
        boardQuestion
          ? [
              `THIS IS A REAL CBSE BOARD QUESTION (${boardQuestion.origin}). Reproduce its wording exactly in the \`problem\` field — do not rephrase it, add sub-parts or change its numbers — then solve it in full.`,
              `REAL BOARD QUESTION: ${boardQuestion.prompt}`,
            ].join("\n")
          : "",
        already ? `Do NOT repeat or lightly reword any of these already-written questions:\n${already}` : "",
        PRACTICE_LEVELS[level],
        level === "board" ? `Board paper to aim at: ${boardBrief}.` : "",
        realWorld && !boardQuestion
          ? "Real-world framing is ON: build the question around a situation a student has actually met — a market bill, a water tank, a cricket score, a mobile plan, a school trip — and keep the mathematics exactly the same skill. Do not name a real person or company."
          : "",
        boardQuestion
          ? "Answer the real board question above; do not write a different one."
          : "Write the new problem and solve it in full, in the same structured form.",
        "Set `source` to a short tag for the question card: the board/year tag for a board question, or the level and topic otherwise. Leave it empty only when there is nothing honest to say.",
        ...languageDirective(language),
        "Reply with the JSON object only.",
        languageLock(language),
      ]
        .filter(Boolean)
        .join("\n\n");

      const candidates = await resolveCandidates();
      const first = await callModel(candidates, PRACTICE_SYSTEM, prompt, undefined, level === "hard" || level === "board" ? 0.55 : 0.35);
      let parsed: z.infer<typeof practiceReplySchema>;
      let model = first.model;
      try {
        parsed = practiceReplySchema.parse(parseJsonLoose(first.text));
      } catch {
        // One stricter pass. The error message a student sees must never be
        // "the model wrote prose" — a retry usually lands a clean object.
        const retry = await callModel(
          candidates,
          PRACTICE_SYSTEM,
          [prompt, "CORRECTION: the last reply was not a valid JSON object. Reply with the JSON object only — no prose before or after it, no Markdown fence."].join("\n\n"),
          undefined,
          0.2,
        );
        parsed = practiceReplySchema.parse(parseJsonLoose(retry.text));
        model = retry.model;
      }
      /* The real paper's wording is the canonical one. The model has just
         solved it; if it silently reworded a phrase, the student still sees
         the question as it was printed, not the model's paraphrase. */
      if (boardQuestion) {
        parsed.problem.problem = boardQuestion.prompt;
        parsed.problem.source = boardLabel(boardQuestion.origin);
      }

      const check = verifyAnswer(parsed.problem.problem, parsed.problem.finalAnswer);
      const finalized = finalizeProblem(parsed.problem, check);

      // A board question always carries its paper tag, even if the model left
      // `source` blank. `pattern` is the honest default: it says the question
      // follows that paper without claiming it appeared in it.
      if (level === "board" && !finalized.source) {
        finalized.source = /mixed/i.test(requestedBoard)
          ? "CBSE 2025/2026 pattern · 3 marks"
          : `${board} pattern · 3 marks`;
      } else if (!finalized.source) {
        finalized.source = `${level === "easy" ? "Foundation" : level === "medium" ? "Standard" : "Challenge"} · ${chapterName ?? "practice"}`;
      }

      problems.push(finalized);
      lastModel = model;
    }

    return { problems, model: lastModel };
  },
});

/* ------------------------------------------------------------------ */
/* Marking a practice answer                                           */
/* ------------------------------------------------------------------ */

/** Loose comparison for answers the exact engine cannot speak to at all. */
function normalizeAnswer(source: string) {
  return source
    .replace(/\$+/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,;:!]/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\s+/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .toLowerCase();
}

/**
 * Mark the student's answer to a practice problem.
 *
 * The verdict comes from the exact-arithmetic checker wherever it can read the
 * problem, so a correct answer is confirmed by recomputation rather than by
 * string matching. Only when the engine is silent does this fall back to a
 * normalised comparison, and it says plainly which of the two happened.
 */
export const gradeAnswer = action({
  args: {
    problem: v.string(),
    expectedAnswer: v.string(),
    given: v.string(),
  },
  handler: async (
    ctx,
    { problem, expectedAnswer, given },
  ): Promise<{ correct: boolean; note: string; expectedText: string }> => {
    const trimmed = given.trim();
    if (!trimmed) {
      return {
        correct: false,
        note: "Write an answer first.",
        expectedText: expectedAnswer,
      };
    }

    const check = verifyAnswer(problem, trimmed);
    if (check.status === "match") {
      return {
        correct: true,
        note: `Correct. ${check.note}`,
        expectedText: expectedAnswer,
      };
    }
    if (check.status === "mismatch") {
      return {
        correct: false,
        note: `Not yet. ${check.note}`,
        expectedText: expectedAnswer,
      };
    }

    // The engine could not rework this one, so the comparison is textual and
    // says so instead of pretending to have checked the arithmetic.
    const correct = normalizeAnswer(trimmed) === normalizeAnswer(expectedAnswer);
    return {
      correct,
      note: correct
        ? "That matches the worked answer. This one could not be recomputed independently, so it was compared by reading both answers."
        : "That is not the worked answer yet. This one could not be recomputed independently, so compare your line with the worked answer below.",
      expectedText: expectedAnswer,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Mark a written solution, step by step                               */
/* ------------------------------------------------------------------ */

/**
 * Step marking.
 *
 * Unlike `checkWork`, which compares the student's working with a solution the
 * app already has, this marks a solution written from scratch: the model first
 * fixes a marking scheme, then awards each line against it. The marks a
 * student sees always add up to the marks the scheme allocates — the totals are
 * recomputed here rather than trusted from the reply — so a page can never
 * show "7 of 5".
 */
const MARK_STEPS_SYSTEM = [
  "You are an examiner marking a student's written solution in Manthan's Math Lab.",
  "First decide the marking scheme a board examiner would use for THIS question: each step that earns credit, and the marks it carries. Then mark the student's own lines against that scheme.",
  "Award marks only for work the student actually wrote. Never give credit for a step they omitted or only implied, and never mark what they probably meant rather than what the page says.",
  "Every scheme step must carry a whole-number mark value, and the awarded value must be between zero and that value. Partial credit is allowed where the method is right but the arithmetic is not.",
  "The sum of the scheme marks is the question's total. Keep the scheme to at most ten steps and the total to at most twenty marks unless the prompt states a total.",
  "Note is one or two plain sentences on that step: what earned the marks, or exactly what was missing. Mathematics inside a note must be wrapped in dollars, like $\\\\frac{2}{3}$. Everything outside the dollars is ordinary text.",
  "summary is one short line a teacher writes at the top: the score and the single most important thing to fix.",
  "correctedWorking is the full correct solution in plain text, one step per line, with mathematics in dollars. Keep it to the same steps as the scheme.",
  "No emoji, no markdown, no asterisks, no bullet symbols.",
  'Reply with a single JSON object and nothing else: {"steps":[{"title":string,"marks":number,"awarded":number,"note":string}],"summary":string,"correctedWorking":string}.',
].join(" ");

const markStepsSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().catch(""),
        marks: z.number().catch(0),
        awarded: z.number().catch(0),
        note: z.string().catch(""),
      }),
    )
    .catch([]),
  summary: z.string().catch(""),
  correctedWorking: z.string().catch(""),
});

export type MarkedStep = {
  title: string;
  marks: number;
  awarded: number;
  note: string;
};

const clampMarks = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, Math.round(Number.isFinite(value) ? value : low)));

export const markSteps = action({
  args: {
    problem: v.string(),
    working: v.string(),
    gradeLabel: v.optional(v.string()),
    track: v.optional(v.string()),
    chapterName: v.optional(v.string()),
    /** A paper's stated total, when the student is practising one. */
    totalMarks: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { problem, working, gradeLabel, track, chapterName, totalMarks },
  ): Promise<{
    steps: MarkedStep[];
    total: number;
    awarded: number;
    summary: string;
    correctedWorking: string;
    model: string;
  }> => {
    const typed = working.trim();
    if (!problem.trim()) throw new Error("Write the question you are answering first.");
    if (typed.length < 3) throw new Error("Write your working first, then ask for marks.");

    const language = detectLanguage([typed, problem]);
    const prompt = [
      `THE QUESTION: ${problem}`,
      gradeLabel ? `The student is in Class ${gradeLabel}.` : "",
      track ? `Syllabus: ${track}${chapterName ? `, chapter ${chapterName}` : ""}.` : "",
      typeof totalMarks === "number" && totalMarks > 0
        ? `This question is worth exactly ${Math.round(totalMarks)} marks — build the scheme so the marks add to that total.`
        : "Choose the total the question is worth in a school paper.",
      `THE STUDENT'S WORKING, exactly as they wrote it:\n${typed}`,
      "Mark the working line by line against your scheme. If the student wrote only an answer, say so in the step notes instead of inventing the method.",
      ...languageDirective(language),
      "Reply with the JSON object only.",
      languageLock(language),
    ]
      .filter(Boolean)
      .join("\n\n");

    const candidates = await resolveCandidates();
    const first = await callModel(candidates, MARK_STEPS_SYSTEM, prompt, undefined, 0.15);
    let parsed: z.infer<typeof markStepsSchema>;
    let model = first.model;
    try {
      parsed = markStepsSchema.parse(parseJsonLoose(first.text));
    } catch {
      const retry = await callModel(
        candidates,
        MARK_STEPS_SYSTEM,
        [prompt, "CORRECTION: the last reply was not a valid JSON object. Reply with the JSON object only — no prose, no Markdown fence."].join("\n\n"),
        undefined,
        0.1,
      );
      parsed = markStepsSchema.parse(parseJsonLoose(retry.text));
      model = retry.model;
    }

    /* The scheme owns the total, and the awarded total is the sum of the parts.
       A model that rounds its own totals differently cannot make the page
       disagree with itself. */
    const steps: MarkedStep[] = parsed.steps
      .slice(0, 12)
      .map((step) => {
        const marks = clampMarks(step.marks, 1, 20);
        return {
          title: cleanProse(step.title) || "Working",
          marks,
          awarded: clampMarks(step.awarded, 0, marks),
          note: cleanProse(step.note),
        };
      });

    if (!steps.length) {
      throw new Error("The marker could not build a scheme for this question. Try rephrasing it.");
    }

    const total = steps.reduce((sum, step) => sum + step.marks, 0);
    const awarded = steps.reduce((sum, step) => sum + step.awarded, 0);

    return {
      steps,
      total,
      awarded,
      summary:
        cleanProse(parsed.summary) ||
        `${awarded} out of ${total}. Check the notes against each line.`,
      correctedWorking: cleanProse(parsed.correctedWorking),
      model,
    };
  },
});
