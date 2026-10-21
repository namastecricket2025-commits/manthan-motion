"use node";

import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { callModel, ProviderUnavailable, resolveCandidates } from "./providers";
import { v } from "convex/values";

/**
 * In-app web search — the engine behind every "Search Google" control.
 *
 * One back end only: Serper (https://serper.dev), which returns Google's
 * organic results as JSON. No model fallback, no second provider: if Serper
 * cannot answer, the panel says so in one sentence.
 *
 * The key is the project's own Serper key, held here because this file runs
 * only on the Convex server (`"use node"`): it is never bundled into the
 * client and never sent to a browser. Rotating it means changing this one
 * constant. There is deliberately no env fallback — a stale key left on one
 * deployment silently taking priority is what made search fail in production
 * while working in dev.
 *
 * A search is metered against the same plan allowance as generation, so the
 * dashboard meter, the plan card and the server keep agreeing.
 */

interface Hit {
  title: string;
  url: string;
  snippet: string;
}

const CHARS_PER_TOKEN = 4;
const MAX_QUERY = 240;
const TIMEOUT_MS = 16_000;
const MAX_RESULTS = 8;

/** The project's Serper key. Server-only; see the note at the top of the file. */
const SERPER_KEY = "f73ff1627becf92a67860894a4ef65cdadeeba42";

/* Student-facing sentences. Key names and upstream status codes belong in the
   server log, never in the panel: a student cannot act on either. */
const NO_KEY = "Search is not set up yet.";
const SEARCH_BUSY = "Google needs a minute. Try again shortly.";
const SEARCH_FAILED = "That search did not go through. Try again.";

/** htmlTitle/htmlSnippet arrive with markup; the panel renders plain text. */
function stripTags(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(hits: Hit[]): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const hit of hits) {
    if (!hit.url || !hit.title || seen.has(hit.url)) continue;
    seen.add(hit.url);
    out.push(hit);
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

/** Words too common to say anything about which result answers the query. */
const STOP_WORDS = new Set([
  "what", "why", "how", "when", "where", "which", "does", "did", "with",
  "from", "that", "this", "your", "have", "into", "about", "explain",
  "class", "cbse", "ncert", "chapter", "notes", "example", "between",
  "difference", "define", "definition", "short", "long", "answer",
]);

/**
 * Google does not always put an answer box above the results, and the first
 * organic result is not always the one that answers the question — searching
 * "why is the sky blue" can rank a chapter index above the explanation. When
 * there is no box, pick the snippet that shares the most meaningful words with
 * the query instead of blindly taking result one.
 */
function bestAnswerSource(query: string, results: Hit[]): Hit | undefined {
  const words = new Set(
    (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (word) => word.length > 3 && !STOP_WORDS.has(word),
    ),
  );
  if (words.size === 0) return results[0];

  let best: Hit | undefined;
  let bestScore = 0;
  for (const hit of results) {
    const body = `${hit.title} ${hit.snippet}`.toLowerCase();
    let score = 0;
    for (const word of words) if (body.includes(word)) score += 1;
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  // No overlap at all is still better answered by result one than by nothing.
  return best ?? results[0];
}

function estimateTokens(prompt: string, reply: string) {
  return Math.max(1, Math.round((prompt.length + reply.length) / CHARS_PER_TOKEN));
}

/**
 * The short answer Google itself puts above the results.
 *
 * Serper exposes this as `answerBox` (a sentence or a definition) and, for
 * entities, as `knowledgeGraph` (a paragraph). Both are Google's own summary,
 * not something this app wrote: the panel labels it and links the page it came
 * from, so a student can check it. This is the piece that makes the panel read
 * as an answer rather than as a list of links.
 */
interface SearchAnswer {
  text: string;
  title?: string;
  url?: string;
}

interface SearchReply {
  answer?: SearchAnswer;
  results: Hit[];
  provider: "serper";
  tokens: number;
}

/** Trim a candidate paragraph and drop it if it only repeats what we have. */
function addAnswerPart(parts: string[], value: unknown) {
  const text = stripTags(value).slice(0, 700);
  if (!text) return;
  const normal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (parts.some((part) => normal(part).includes(normal(text)))) return;
  if (parts.some((part) => normal(text).includes(normal(part)))) {
    parts[parts.findIndex((part) => normal(text).includes(normal(part)))] = text;
    return;
  }
  parts.push(text);
}

/**
 * Serper: Google's results as JSON.
 *
 * `gl: "in"` pins the country to India, so a search from the Math Lab or the
 * STEM Lab returns the Indian web — the NCERT notes, the CBSE marking
 * schemes, the Hindi channels — rather than whatever the nearest data centre
 * thinks is generic.
 */
async function runSerper(query: string, key: string): Promise<SearchReply> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ q: query, num: MAX_RESULTS, gl: "in", hl: "en" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    // The status is for the log; the panel gets a sentence.
    console.error(
      `[webSearch] serper ${response.status}: ${(await response.text())
        .replace(/\s+/g, " ")
        .slice(0, 300)}`,
    );
    throw new Error(response.status === 429 ? SEARCH_BUSY : SEARCH_FAILED);
  }

  const data = (await response.json()) as {
    answerBox?: {
      title?: string;
      answer?: string;
      snippet?: string;
      link?: string;
    };
    knowledgeGraph?: {
      title?: string;
      description?: string;
      descriptionLink?: string;
    };
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const results = dedupe(
    (data.organic ?? []).map((item) => ({
      title: stripTags(item.title),
      url: typeof item.link === "string" ? item.link : "",
      snippet: stripTags(item.snippet),
    })),
  );

  // One answer, assembled from whichever of Google's own summaries exists.
  // The answer box is the tight one; the knowledge panel adds the context a
  // student needs when the query names a concept rather than a product. A
  // matching organic snippet is the last resort, so the panel still opens on
  // an answer for queries Google gives no box for.
  const parts: string[] = [];
  addAnswerPart(parts, data.answerBox?.answer);
  addAnswerPart(parts, data.answerBox?.snippet);
  addAnswerPart(parts, data.knowledgeGraph?.description);
  let fallback: Hit | undefined;
  if (parts.length === 0) {
    fallback = bestAnswerSource(query, results);
    addAnswerPart(parts, fallback?.snippet);
  }

  const answer: SearchAnswer | undefined =
    parts.length > 0
      ? {
          text: parts.join(" "),
          title:
            stripTags(data.answerBox?.title) ||
            stripTags(data.knowledgeGraph?.title) ||
            fallback?.title,
          url:
            (typeof data.answerBox?.link === "string" && data.answerBox.link) ||
            (typeof data.knowledgeGraph?.descriptionLink === "string" &&
              data.knowledgeGraph.descriptionLink) ||
            fallback?.url ||
            results[0]?.url,
        }
      : undefined;

  return {
    answer,
    results,
    provider: "serper",
    tokens: estimateTokens(query, JSON.stringify({ answer, results })),
  };
}

/* ---------------------------- follow-up chat ---------------------------- */

/**
 * "Ask a follow-up" — the panel is not a dead end after the answer.
 *
 * Google gives the definition; the follow-up is where a student asks the
 * thing they actually came for ("but why does it scatter more?", "show me an
 * example", "how is this asked in the board paper?"). The model is given the
 * search context so it answers about the same page, and it is told to admit
 * when the context does not cover the question rather than inventing a fact.
 */
const FOLLOW_UP_SYSTEM = [
  "You are Manthan's study assistant, inside a study app for Indian school students in Classes 8 to 12.",
  "A student searched Google in the app and is now asking a follow-up on the same topic.",
  "Answer from the search context first. If the context does not contain the answer, say so in one short line, then give the explanation you are confident about — never invent a source, a number, a date or a quotation.",
  "Prefer CBSE/NCERT wording where it fits. Answer in the language the question is asked in; if it is Hindi, answer in Hindi.",
  "Length: match the question. A definition gets two or three sentences; 'explain' or 'how' gets the key idea plus one worked example. Never pad.",
  "No preamble, no 'great question', no restating the question back.",
  'Reply with a single JSON object and nothing else: {"answer":string}.',
].join(" ");

interface FollowUpTurn {
  question: string;
  answer: string;
}

function readFollowUp(raw: string): string | null {
  const body = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
    const answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
    return answer || null;
  } catch {
    // A reply that forgot the JSON wrapper still answered the question.
    return body && !body.startsWith("{") ? body.slice(0, 1200) : null;
  }
}

export const followUp = action({
  args: {
    /** The search the student is asking about. */
    query: v.string(),
    /** Google's own answer, when the query produced one. */
    answer: v.optional(v.string()),
    /** The page results the answer sits above. */
    sources: v.array(
      v.object({ title: v.string(), url: v.string(), snippet: v.string() }),
    ),
    /** Earlier turns, oldest first, so "and that one?" still makes sense. */
    history: v.optional(
      v.array(v.object({ question: v.string(), answer: v.string() })),
    ),
    question: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; text?: string; error?: string }> => {
    const question = args.question.trim().replace(/\s+/g, " ").slice(0, 400);
    if (question.length < 2) {
      return { ok: false, error: "Type a question first." };
    }

    const { signedIn, userId } = await ctx.runQuery(
      internal.searchContext.whoAmI,
      {},
    );
    if (!signedIn) {
      return { ok: false, error: "Sign in to keep asking from inside Manthan." };
    }

    let meter = false;
    if (userId) {
      const usage = await ctx.runQuery(internal.usage.ensureWithinQuota, {
        userId,
      });
      if (usage.used >= usage.limit) {
        return {
          ok: false,
          error:
            usage.window === "month"
              ? "Your monthly AI allowance is used up — it resets on the 1st."
              : "Your daily AI allowance is used up — it resets at midnight.",
        };
      }
      meter = true;
    }

    const context = [
      `Search: ${args.query.slice(0, MAX_QUERY)}`,
      args.answer ? `Google's answer above the results: ${args.answer.slice(0, 900)}` : "",
      ...args.sources.slice(0, 6).map(
        (source) =>
          `- ${source.title} (${source.url}): ${source.snippet.slice(0, 320)}`,
      ),
      ...(args.history ?? [])
        .slice(-3)
        .map((turn) => `Earlier — student: ${turn.question.slice(0, 300)}\nYou: ${turn.answer.slice(0, 700)}`),
      `Student's follow-up: ${question}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const reply = await callModel(
        await resolveCandidates(),
        FOLLOW_UP_SYSTEM,
        context,
        undefined,
        0.4,
      );
      const text = readFollowUp(reply.text);
      if (!text) {
        return { ok: false, error: "That answer came back empty. Try asking again." };
      }

      if (meter) {
        await ctx.runMutation(internal.usage.record, {
          userId: userId as Id<"users">,
          tokens: reply.tokens ?? estimateTokens(context, text),
          requests: 1,
        });
      }
      return { ok: true, text };
    } catch (error) {
      if (!(error instanceof ProviderUnavailable)) {
        console.error(
          `[webSearch] follow-up: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { ok: false, error: SEARCH_FAILED };
      }
      return {
        ok: false,
        error: error.dayExhausted
          ? "Every study model has hit its limit for today. Try again tomorrow."
          : error.rateLimited
            ? "The study models are busy right now. Try again in a minute."
            : "No study model could answer that just now. Try again in a minute.",
      };
    }
  },
});

/* ------------------------------- action ------------------------------- */

export const search = action({
  args: { q: v.string() },
  handler: async (
    ctx,
    { q },
  ): Promise<{
    ok: boolean;
    error?: string;
    provider?: string;
    answer?: SearchAnswer;
    results: Hit[];
  }> => {
    const empty = { results: [] as Hit[] };
    const query = q.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY);
    if (query.length < 2) {
      return { ...empty, ok: false, error: "Type something to look up first." };
    }

    const { signedIn, userId } = await ctx.runQuery(
      internal.searchContext.whoAmI,
      {},
    );
    if (!signedIn) {
      return {
        ...empty,
        ok: false,
        error: "Sign in to search from inside Manthan.",
      };
    }

    // The search spends from the same ledger as generation, so it checks the
    // allowance before it runs and writes back what it actually cost after.
    let meter = false;
    if (userId) {
      const usage = await ctx.runQuery(internal.usage.ensureWithinQuota, {
        userId,
      });
      if (usage.used >= usage.limit) {
        return {
          ...empty,
          ok: false,
          error:
            usage.window === "month"
              ? "Your monthly AI allowance is used up — it resets on the 1st."
              : "Your daily AI allowance is used up — it resets at midnight.",
        };
      }
      meter = true;
    }

    if (!SERPER_KEY) {
      console.error("[webSearch] SERPER_KEY is empty in convex/webSearch.ts");
      return { ...empty, ok: false, error: NO_KEY };
    }

    try {
      const reply = await runSerper(query, SERPER_KEY);

      if (meter) {
        await ctx.runMutation(internal.usage.record, {
          userId: userId as Id<"users">,
          tokens: reply.tokens,
          requests: 1,
        });
      }

      return {
        ok: true,
        provider: reply.provider,
        answer: reply.answer,
        results: reply.results,
      };
    } catch (error) {
      console.error(
        `[webSearch] ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ...empty,
        ok: false,
        error:
          error instanceof Error && (error.message === SEARCH_BUSY || error.message === SEARCH_FAILED)
            ? error.message
            : SEARCH_FAILED,
      };
    }
  },
});
