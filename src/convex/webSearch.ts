"use node";

import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * In-app web search — the engine behind every "Search on Google" control.
 *
 * The panel opens soft-cornered inside Manthan rather than redirecting the
 * student to google.com, so the working they were looking at never goes away.
 * Nothing here exposes a key to the browser: the action reads the key from the
 * deployment, calls Google server-side and returns titles, links and snippets.
 *
 * Two back ends, tried in this order:
 *
 *   1. Serper (`SERPER_API_KEY`) — a Google search API that returns the
 *      organic results as JSON, with the answer box when there is one. This
 *      is the configured path for Manthan.
 *   2. The Custom Search JSON API, when a Programmable Search Engine id is
 *      configured (`GOOGLE_SEARCH_ENGINE_ID`).
 *   3. Gemini's Google Search grounding, which needs only a Gemini key, so a
 *      key the student already has for the tutor can still power the search.
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
const GEMINI_KEY_NAMES = [
  "GEMINI_API_KEY",
  "SEARCH_API_KEY",
  "GOOGLE_SEARCH_API_KEY",
  "NEW_GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
];
/** Tried in order; an older id without the search tool simply fails through. */
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const NO_KEY =
  "Web search is not configured yet. Add SERPER_API_KEY in the Keys tab, or use the Google link below.";
const TOOL_OFF =
  "This key does not have Google Search enabled for it. Turn on the Google Search tool for the API key (or add GOOGLE_SEARCH_ENGINE_ID for a Programmable Search Engine) in the Keys tab.";

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
    throw new Error(
      "Google search is rate-limited right now. Try again in a moment.",
    );
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

async function runGeminiGrounded(
  query: string,
  key: string,
): Promise<SearchReply> {
  const prompt =
    `Search the web for this and answer in at most 70 words, plain text, no markdown, no bullet points, no URLs:\n\n${query}`;

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const response = await fetch(
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

    if (response.status === 404) {
      // This model id does not exist on this key — try the next candidate.
      lastError = `${model} is not available on this key.`;
      continue;
    }

    const body = await response.text();

    if (!response.ok) {
      if (
        response.status === 400 &&
        /tool|google_search|not found|unsupported/i.test(body)
      ) {
        // Either the model has no search tool, or the search tool is off for
        // the key. One more model is worth trying before giving up.
        lastError = TOOL_OFF;
        continue;
      }
      if (response.status === 429) {
        throw new Error("Google search is rate-limited right now. Try again in a moment.");
      }
      throw new Error(`Google search failed (${response.status}).`);
    }

    let data: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string; snippet?: string };
            retrievedContext?: { uri?: string; title?: string; snippet?: string };
          }>;
        };
      }>;
      usageMetadata?: { totalTokenCount?: number };
    };
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("Google search returned something unreadable.");
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error("Google search came back empty. Try the query again.");
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

    const tokens =
      data.usageMetadata?.totalTokenCount ?? estimateTokens(prompt, answer);

    return { answer, results, provider: "gemini-grounded", tokens };
  }

  throw new Error(lastError || TOOL_OFF);
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
