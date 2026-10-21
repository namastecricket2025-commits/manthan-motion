"use node";

import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";
// One model list for the whole app: the tutor and grounded search must agree on
// which ids Google still serves, so a retirement is fixed in one place.
import { GEMINI_MODELS } from "./providers";

/**
 * In-app web search — the engine behind every "Search on Google" control.
 *
 * The panel opens soft-cornered inside Manthan rather than redirecting the
 * student to google.com, so the working they were looking at never goes away.
 * Nothing here exposes a key to the browser: the action reads the key from the
 * deployment, calls Google server-side and returns titles, links and snippets.
 *
 * Three back ends, tried in this order:
 *
 *   1. Serper (`SERPER_API_KEY`) — a Google search API that returns the
 *      organic results as JSON, with the answer box when there is one. This
 *      is the configured path for Manthan.
 *   2. The Custom Search JSON API, when a Programmable Search Engine id is
 *      configured (`GOOGLE_SEARCH_ENGINE_ID`).
 *   3. Gemini's Google Search grounding through `GEMINI_API_KEY_2`, whose whole
 *      job is this path. It walks the same model list the tutor uses and only
 *      gives up once every id has answered no.
 *
 * Whatever runs is metered against the same plan allowance as generation, so
 * the dashboard meter, the plan card and the server keep agreeing. A missing
 * key, a disabled tool or a dead network never throws at the client: the panel
 * gets `ok: false` with a plain sentence and falls back to a Google link.
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

/** First non-empty value among the names a key may have been saved under. */
function envKey(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

const SERPER_KEY_NAMES = ["SERPER_API_KEY", "SERPER_KEY", "SERPER"];
const CSE_KEY_NAMES = ["GOOGLE_SEARCH_API_KEY", "SEARCH_API_KEY"];
const CSE_ID_NAMES = [
  "GOOGLE_SEARCH_ENGINE_ID",
  "GOOGLE_CSE_ID",
  "SEARCH_ENGINE_ID",
];
/**
 * The second Gemini key is listed first: it was created for search, so the
 * grounded fallback spends it instead of the tutor's own key. The Custom Search
 * key (`SEARCH_API_KEY`) is deliberately absent — it is a Google Cloud key and
 * cannot authenticate a Gemini call, so trying it would only add a 403.
 */
const GEMINI_KEY_NAMES = [
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY",
  "NEW_GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
];

/**
 * Student-facing sentences. Model ids, key names and upstream paths belong in
 * the server log, never in the panel: a student cannot act on any of them.
 */
const NO_KEY =
  "Web search is not configured yet. Use the Google link below.";
const SEARCH_UNAVAILABLE =
  "Search is unavailable right now. Use the Google link below.";
const SEARCH_BUSY =
  "Google search is rate-limited right now. Try again in a moment.";

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

function estimateTokens(prompt: string, reply: string) {
  return Math.max(1, Math.round((prompt.length + reply.length) / CHARS_PER_TOKEN));
}

/* ----------------------------- back ends ----------------------------- */

interface SearchReply {
  answer?: string;
  results: Hit[];
  provider: "serper" | "custom-search" | "gemini-grounded";
  tokens: number;
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

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "The search key was rejected. Check SERPER_API_KEY in the Keys tab.",
    );
  }
  if (response.status === 429) {
    throw new Error(SEARCH_BUSY);
  }
  if (!response.ok) {
    throw new Error(`Google search failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    answerBox?: { title?: string; snippet?: string; answer?: string };
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const box = data.answerBox;
  const answer = [box?.answer, box?.snippet]
    .map((part) => (typeof part === "string" ? part.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .join(" — ")
    .trim();

  const results = dedupe(
    (data.organic ?? []).map((item) => ({
      title: stripTags(item.title),
      url: typeof item.link === "string" ? item.link : "",
      snippet: stripTags(item.snippet),
    })),
  );

  return {
    answer: answer || undefined,
    results,
    provider: "serper",
    tokens: estimateTokens(query, JSON.stringify({ answer, results })),
  };
}

async function runCustomSearch(
  query: string,
  key: string,
  cx: string,
): Promise<SearchReply> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(MAX_RESULTS));

  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Custom Search returned ${response.status}.`);
  }
  const data = (await response.json()) as {
    items?: Array<{
      title?: string;
      htmlTitle?: string;
      link?: string;
      snippet?: string;
      htmlSnippet?: string;
    }>;
  };

  const results = dedupe(
    (data.items ?? []).map((item) => ({
      title: stripTags(item.htmlTitle) || stripTags(item.title),
      url: item.link ?? "",
      snippet: stripTags(item.htmlSnippet) || stripTags(item.snippet),
    })),
  );

  return {
    results,
    provider: "custom-search",
    tokens: estimateTokens(query, JSON.stringify(results)),
  };
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: { uri?: string; title?: string; snippet?: string };
      retrievedContext?: { uri?: string; title?: string; snippet?: string };
    }>;
  };
}

/**
 * Gemini's Google Search grounding: the last resort when neither a Serper key nor
 * a Programmable Search Engine is configured.
 *
 * Model ids come from `providers.ts`, best first, because Google retires ids for
 * new keys without saying so. A 404 (id gone), a 400 naming the tool (grounding
 * off for this key) and a 429 (this model's daily free quota spent) are all
 * *per-model* facts, so each one records the failure and the loop moves on. The
 * panel only hears about it after every id has failed, which is the one moment
 * the failure is actually about the request.
 *
 * The rejection set is local to this call. Nothing is cached at module level: a
 * verdict from one search must not follow the next student around.
 */
async function runGeminiGrounded(
  query: string,
  key: string,
): Promise<SearchReply> {
  const prompt =
    `Search the web for this and answer in at most 70 words, plain text, no markdown, no bullet points, no URLs:\n\n${query}`;

  // `SEARCH_MODEL` pins exactly one id, for when the owner wants to spend a
  // specific model's quota on search.
  const pinned = process.env.SEARCH_MODEL?.trim();
  const models = pinned ? [pinned] : GEMINI_MODELS;

  const rejected = new Set<string>();
  let lastStatus: number | undefined;
  let lastReason = "no model was tried";

  for (const model of models) {
    if (rejected.has(model)) continue;

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (error) {
      // A timeout on one id says nothing about the next one.
      lastStatus = undefined;
      lastReason = `${model}: network ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[webSearch] ${lastReason}`);
      continue;
    }

    const body = await response.text();

    if (!response.ok) {
      const snippet = body.replace(/\s+/g, " ").slice(0, 300);
      lastStatus = response.status;
      lastReason = `${model}: ${response.status} ${snippet}`;
      console.error(`[webSearch] ${lastReason}`);

      if (
        response.status === 404 ||
        (response.status === 400 &&
          /tool|google_search|not found|unsupported|model/i.test(body))
      ) {
        // Either this id is retired on this key or the search tool is not
        // available to it. Both are settled facts for this id: skip it.
        rejected.add(model);
      }
      continue;
    }

    let data: {
      candidates?: GeminiCandidate[];
      usageMetadata?: { totalTokenCount?: number };
    };
    try {
      data = JSON.parse(body);
    } catch {
      lastStatus = undefined;
      lastReason = `${model}: unreadable response body`;
      console.error(`[webSearch] ${lastReason}`);
      continue;
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      lastStatus = undefined;
      lastReason = `${model}: no candidate returned`;
      console.error(`[webSearch] ${lastReason}`);
      continue;
    }

    const answer = (candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
    const results = dedupe(
      chunks.map((chunk) => {
        const web = chunk.web ?? chunk.retrievedContext ?? {};
        return {
          title: stripTags(web.title),
          url: typeof web.uri === "string" ? web.uri : "",
          snippet: stripTags(web.snippet),
        };
      }),
    );

    // Neither prose nor sources means this id did nothing useful; the next one
    // may still ground the query properly.
    if (!answer && results.length === 0) {
      lastStatus = undefined;
      lastReason = `${model}: empty answer and no sources`;
      console.error(`[webSearch] ${lastReason}`);
      continue;
    }

    const tokens =
      data.usageMetadata?.totalTokenCount ?? estimateTokens(prompt, answer);

    return { answer, results, provider: "gemini-grounded", tokens };
  }

  console.error(
    `[webSearch] every Gemini model failed (last: ${lastReason}). ` +
      "Check GEMINI_API_KEY_2 has the Google Search tool enabled for the deployment.",
  );
  // The real reason is in the log above; the panel gets the one sentence a
  // student can act on.
  throw new Error(lastStatus === 429 ? SEARCH_BUSY : SEARCH_UNAVAILABLE);
}

/* ------------------------------- action ------------------------------- */

export const search = action({
  args: { q: v.string() },
  handler: async (
    ctx,
    { q },
  ): Promise<{
    ok: boolean;
    error?: string;
    answer?: string;
    provider?: string;
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

    try {
      const serperKey = envKey(...SERPER_KEY_NAMES);
      const cx = envKey(...CSE_ID_NAMES);
      const cseKey = cx ? envKey(...CSE_KEY_NAMES) : undefined;
      const geminiKey = envKey(...GEMINI_KEY_NAMES);

      let reply: SearchReply;
      if (serperKey) {
        reply = await runSerper(query, serperKey);
      } else if (cx && cseKey) {
        reply = await runCustomSearch(query, cseKey, cx);
      } else if (geminiKey) {
        reply = await runGeminiGrounded(query, geminiKey);
      } else {
        return { ...empty, ok: false, error: NO_KEY };
      }

      if (meter) {
        await ctx.runMutation(internal.usage.record, {
          userId: userId as Id<"users">,
          tokens: reply.tokens,
          requests: 1,
        });
      }

      return {
        ok: true,
        answer: reply.answer || undefined,
        provider: reply.provider,
        results: reply.results,
      };
    } catch (error) {
      return {
        ...empty,
        ok: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "The search did not go through. Use the Google link below instead.",
      };
    }
  },
});
