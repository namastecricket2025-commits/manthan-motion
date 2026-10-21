"use node";

import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
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

function estimateTokens(prompt: string, reply: string) {
  return Math.max(1, Math.round((prompt.length + reply.length) / CHARS_PER_TOKEN));
}

interface SearchReply {
  results: Hit[];
  provider: "serper";
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
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const results = dedupe(
    (data.organic ?? []).map((item) => ({
      title: stripTags(item.title),
      url: typeof item.link === "string" ? item.link : "",
      snippet: stripTags(item.snippet),
    })),
  );

  return {
    results,
    provider: "serper",
    tokens: estimateTokens(query, JSON.stringify(results)),
  };
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
