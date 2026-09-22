/**
 * The model layer: which AI providers Manthan can run on, and what it does when
 * one of them says no.
 *
 * No single free tier carries a study session. Google meters free requests
 * *per model, per day*, so a few notebooks exhaust one model while the app's own
 * allowance meter still reads "56,000 left" — and the student is told the limit
 * is reached, which is true of the provider and false of Manthan. So every key
 * set in the deployment environment becomes a candidate and the run walks them
 * in order.
 *
 * The interesting case is a 429, because it means two opposite things:
 *
 *   per-minute → briefly busy. Step to the next candidate, and only if the whole
 *                chain is busy tell the student to come back in a minute.
 *   per-day    → *that key* is finished until the provider resets. Park it and
 *                let another key, or another provider, take over. Generation
 *                only fails when every candidate is parked.
 *
 * The window is read from the provider's structured metadata — Google publishes
 * `quotaId: "…PerDayPerProjectPerModel…"` — never inferred from the wording,
 * because "You exceeded your current quota, please check your plan and billing
 * details" is a per-day message that reads exactly like a per-minute one. That
 * misreading is what made generation look permanently broken.
 *
 * Keys never leave the server: this runs under `"use node"` (imported by
 * `ai.ts`) and reads `process.env` only.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ProviderName = "gemini" | "cerebras" | "openrouter" | "openai";

export type Candidate = {
  /** Stable id used to remember what is out — never contains key material. */
  id: string;
  provider: ProviderName;
  apiKey: string;
  model: string;
  /** Provider root; each flavour appends its own path. */
  endpoint: string;
};

/** Nothing is configured. Addressed to whoever holds the Keys tab. */
export const NO_KEY_MESSAGE =
  "No AI key is configured yet. Add a free key — GEMINI_API_KEY " +
  "(aistudio.google.com/apikey), CEREBRAS_API_KEY, OPENROUTER_API_KEY or " +
  "OPENAI_API_KEY — in the project's Keys tab, then generate again.";

/**
 * Google's free-tier models, best first.
 *
 * Google retires models for new accounts without removing them from
 * `/v1beta/models` (a listing entry is not proof a model will run), so a single
 * hard-coded model is not a working configuration. A 404 parks the candidate for
 * the life of the process and the next one is tried. `AI_MODEL` pins exactly one.
 */
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  // An alias Google keeps pointed at a current flash model, so it survives the
  // retirement of everything named above.
  "gemini-flash-latest",
];

/** OpenAI-compatible providers: one shape for Cerebras, OpenRouter and OpenAI. */
type OpenAiCompatibleProvider = {
  provider: Exclude<ProviderName, "gemini">;
  endpoint: string;
  /** Env vars holding keys, in preference order. */
  keyNames: string[];
  /** Env var that overrides the model list. */
  modelEnv: string;
  /** Curated models, best first. */
  models: string[];
  /** Which advertised ids are chat models worth adding, when discovering. */
  chatLike: RegExp;
};

const OPENAI_COMPATIBLE: OpenAiCompatibleProvider[] = [
  {
    provider: "cerebras",
    endpoint: "https://api.cerebras.ai/v1",
    keyNames: ["CEREBRAS_API_KEY"],
    modelEnv: "CEREBRAS_MODEL",
    // Cerebras serves a deliberately short catalogue.
    models: ["gpt-oss-120b", "qwen-3.8-27b"],
    chatLike: /llama|qwen|gpt-oss|deepseek|mistral|zai/i,
  },
  {
    provider: "openrouter",
    endpoint: "https://openrouter.ai/api/v1",
    keyNames: ["OPENROUTER_API_KEY"],
    modelEnv: "OPENROUTER_MODEL",
    // Free slugs only: the student may have no credit on the account, and
    // OpenRouter also serves paid models that would fail without one.
    models: [
      "z-ai/glm-5.2:free",
      "qwen/qwen3.8-27b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
    ],
    chatLike: /:free$/,
  },
  {
    provider: "openai",
    endpoint: "https://api.openai.com/v1",
    keyNames: ["OPENAI_API_KEY"],
    modelEnv: "OPENAI_MODEL",
    models: ["gpt-4o-mini"],
    chatLike: /^(gpt-[45]|o[1-9])/i,
  },
];

/** Same key pasted under two names must not run twice. */
function keysFor(names: string[]): string[] {
  const found = names
    .map((name) => process.env[name]?.trim())
    .filter((key): key is string => Boolean(key));
  return [...new Set(found)];
}

/** Model lists fetched from a provider, cached for the life of the process. */
const discovered = new Map<ProviderName, string[]>();

/**
 * Listing entries that are not general text-chat models.
 *
 * A provider's catalogue is mostly things Manthan cannot use — speech, images,
 * embeddings, code completers — and a discovered candidate that answers in the
 * wrong shape burns a request only to fail zod validation downstream.
 */
const NOT_CHAT =
  /instruct|transcribe|tts|whisper|audio|realtime|embedding|moderation|image|vision|-vl\b|\/vl|safety|code|coder|note-preview/i;

/**
 * Ask an OpenAI-compatible provider what it serves.
 *
 * The curated lists above go stale, and a key holder has no way to tell us which
 * model to name. A failed lookup is not an error — the curated list is still
 * tried — and the result is cached so this costs one request per process.
 */
async function discoverModels(
  cfg: OpenAiCompatibleProvider,
  apiKey: string,
): Promise<string[]> {
  const cached = discovered.get(cfg.provider);
  if (cached) return cached;

  try {
    const response = await fetch(`${cfg.endpoint}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: { id?: string }[] };
    const ids = (payload.data ?? [])
      .map((entry) => entry.id)
      .filter(
        (id): id is string =>
          typeof id === "string" &&
          cfg.chatLike.test(id) &&
          !NOT_CHAT.test(id),
      );

    // Deliberately short: every extra candidate is another request once the
    // earlier ones are out for the day.
    const picked = ids.slice(0, 3);
    discovered.set(cfg.provider, picked);
    return picked;
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* What the providers said                                            */
/* ------------------------------------------------------------------ */

type FailureKind = "day" | "minute" | "auth" | "model" | "other";

type AttemptResult =
  | { ok: true; text: string; tokens?: number }
  | {
      ok: false;
      kind: FailureKind;
      message: string;
      status: number;
      retryAfterMs?: number;
    };

export class ProviderUnavailable extends Error {
  /** Every candidate is out for the day — the providers, not the student. */
  readonly dayExhausted: boolean;
  /** At least one candidate asked us to slow down. */
  readonly rateLimited: boolean;
  readonly retryAfterMs?: number;

  constructor(opts: {
    failures: string[];
    dayExhausted: boolean;
    rateLimited: boolean;
    retryAfterMs?: number;
  }) {
    const detail = opts.failures.slice(-2).join(" · ");
    super(`No AI model answered. ${detail}`);
    this.name = "ProviderUnavailable";
    this.dayExhausted = opts.dayExhausted;
    this.rateLimited = opts.rateLimited;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

/** Account-level failures: every other candidate fails the same way. */
const FATAL =
  /api key not valid|api_key_invalid|invalid api key|permission denied|permission_denied|has not been used in project|is not enabled|has been disabled/i;

/** Overload, not exhaustion: worth exactly one more go. */
const OVERLOADED = /high demand|overloaded|try again|temporarily|unavailable/i;

type GoogleFailure = {
  error?: {
    message?: string;
    details?: {
      retryDelay?: string;
      violations?: {
        quotaId?: string;
        quotaMetric?: string;
        quotaValue?: string;
      }[];
    }[];
  };
};

/**
 * Which window Google's quota refusal was about.
 *
 * `quotaId` names it — `GenerateRequestsPerDayPerProjectPerModel-FreeTier` vs
 * `GenerateRequestsPerMinutePerProjectPerModel-FreeTier` — and that is the only
 * reliable signal. The human message names neither.
 */
function googleQuotaWindow(payload: GoogleFailure): "day" | "minute" | undefined {
  for (const detail of payload.error?.details ?? []) {
    for (const violation of detail.violations ?? []) {
      const id = `${violation.quotaId ?? ""} ${violation.quotaMetric ?? ""}`;
      if (/perday|per[_\s-]?day/i.test(id)) return "day";
      if (/perminute|per[_\s-]?minute|perhour|per[_\s-]?hour/i.test(id)) {
        return "minute";
      }
    }
  }
  return undefined;
}

/** Google publishes the wait as `retryDelay: "56s"`. */
function googleRetryDelay(payload: GoogleFailure): number | undefined {
  for (const detail of payload.error?.details ?? []) {
    const match = /^([\d.]+)s$/.exec(detail.retryDelay ?? "");
    if (match) return Math.ceil(Number(match[1]) * 1000);
  }
  return undefined;
}

function classifyGoogle(
  status: number,
  message: string,
  payload: GoogleFailure,
): { kind: FailureKind; retryAfterMs?: number } {
  if (status === 401 || status === 403 || FATAL.test(message)) {
    return { kind: "auth" };
  }
  if (status === 429) {
    // No window published means "slow down". Reading that as per-minute is the
    // safe mistake: parking a healthy key for the day would be far worse.
    return {
      kind: googleQuotaWindow(payload) ?? "minute",
      retryAfterMs: googleRetryDelay(payload),
    };
  }
  if (
    status === 404 ||
    /not found|no longer available|does not exist|is not supported/i.test(message)
  ) {
    return { kind: "model" };
  }
  return { kind: "other" };
}

function classifyOpenAiCompatible(
  status: number,
  message: string,
  code?: string,
): FailureKind {
  if (status === 401 || status === 403 || FATAL.test(message)) return "auth";
  if (status === 429) {
    // `insufficient_quota` is OpenAI's billing/allowance refusal; a plain 429 is
    // a rate limit.
    if (
      code === "insufficient_quota" ||
      /insufficient|credits|billing|quota exceeded|per day|daily/i.test(message)
    ) {
      return "day";
    }
    return "minute";
  }
  // OpenRouter answers 402 when the account has no credit left.
  if (status === 402) return "day";
  if (
    status === 404 ||
    /not a valid model|no endpoints|does not exist|not found/i.test(message)
  ) {
    return "model";
  }
  return "other";
}

/* ------------------------------------------------------------------ */
/* One request                                                        */
/* ------------------------------------------------------------------ */

async function geminiAttempt(
  candidate: Candidate,
  system: string,
  prompt: string,
): Promise<AttemptResult> {
  try {
    const response = await fetch(
      `${candidate.endpoint}/models/${candidate.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": candidate.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const payload = (await response.json()) as GoogleFailure & {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };

    if (!response.ok) {
      const message =
        payload.error?.message ?? `The model request failed (${response.status}).`;
      const { kind, retryAfterMs } = classifyGoogle(response.status, message, payload);
      return { ok: false, status: response.status, message, kind, retryAfterMs };
    }

    return {
      ok: true,
      text:
        payload.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("") ?? "",
      tokens: payload.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      kind: "other",
      message: error instanceof Error ? error.message : "network error",
    };
  }
}

/**
 * Cerebras, OpenRouter and OpenAI all speak the same chat-completions shape.
 *
 * `response_format` is deliberately left off: the system prompt already demands
 * a bare JSON object, the parser tolerates fences, and support for the flag
 * varies by model — a 400 here would take a whole provider out of the chain.
 */
async function openAiCompatibleAttempt(
  candidate: Candidate,
  system: string,
  prompt: string,
): Promise<AttemptResult> {
  try {
    const response = await fetch(`${candidate.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${candidate.apiKey}`,
      },
      body: JSON.stringify({
        model: candidate.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    const payload = (await response.json()) as {
      error?: { message?: string; code?: string };
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };

    if (!response.ok) {
      const message =
        payload.error?.message ?? `The model request failed (${response.status}).`;
      return {
        ok: false,
        status: response.status,
        message,
        kind: classifyOpenAiCompatible(response.status, message, payload.error?.code),
      };
    }

    return {
      ok: true,
      text: payload.choices?.[0]?.message?.content ?? "",
      tokens: payload.usage?.total_tokens,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      kind: "other",
      message: error instanceof Error ? error.message : "network error",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Remembered state (process-local, so it can only ever save requests) */
/* ------------------------------------------------------------------ */

/** Candidate ids that answered with a daily-quota refusal, and until when. */
const parkedUntil = new Map<string, number>();

/** Candidate ids the provider no longer serves (404). */
const retired = new Set<string>();

/** The candidate that answered last time, tried first next time. */
let lastGood: string | undefined;

/** Next UTC midnight — every provider's day quota is at least this far away. */
function dayResetsAt(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/**
 * Candidates worth trying, with the one that worked last time moved to the
 * front. `generate` runs one request per artefact, so without this memo every
 * extra summary, flashcard set and quiz would rediscover a dead candidate.
 */
function usable(candidates: Candidate[]): Candidate[] {
  const now = Date.now();
  const fresh = candidates.filter(
    (candidate) =>
      !retired.has(candidate.id) && (parkedUntil.get(candidate.id) ?? 0) <= now,
  );
  if (!lastGood) return fresh;

  const first = fresh.find((candidate) => candidate.id === lastGood);
  return first
    ? [first, ...fresh.filter((candidate) => candidate.id !== lastGood)]
    : fresh;
}

const firstLine = (text: string) => text.split("\n")[0].slice(0, 160);

/* ------------------------------------------------------------------ */
/* Public surface                                                     */
/* ------------------------------------------------------------------ */

/**
 * Everything configured, in the order it should be tried.
 *
 * Google first because it is the key most likely to be a free one, then the
 * OpenAI-compatible providers; curated models first, with anything the provider
 * itself advertises appended so a retired id cannot take a provider out.
 */
export async function resolveCandidates(): Promise<Candidate[]> {
  const candidates: Candidate[] = [];

  const geminiKeys = keysFor([
    "GEMINI_API_KEY",
    "NEW_GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
  ]);
  if (geminiKeys.length > 0) {
    const pinned = process.env.AI_MODEL?.trim();
    const models = pinned ? [pinned] : GEMINI_MODELS;
    geminiKeys.forEach((apiKey, keyIndex) => {
      for (const model of models) {
        candidates.push({
          id: `gemini:${model}#${keyIndex}`,
          provider: "gemini",
          apiKey,
          model,
          endpoint: "https://generativelanguage.googleapis.com/v1beta",
        });
      }
    });
  }

  for (const cfg of OPENAI_COMPATIBLE) {
    const apiKeys = keysFor(cfg.keyNames);
    if (apiKeys.length === 0) continue;

    for (const [keyIndex, apiKey] of apiKeys.entries()) {
      const override = process.env[cfg.modelEnv]?.trim();
      const models = override
        ? [override]
        : [...cfg.models, ...(await discoverModels(cfg, apiKey))];

      for (const model of [...new Set(models)]) {
        candidates.push({
          id: `${cfg.provider}:${model}#${keyIndex}`,
          provider: cfg.provider,
          apiKey,
          model,
          endpoint: cfg.endpoint,
        });
      }
    }
  }

  if (candidates.length === 0) throw new Error(NO_KEY_MESSAGE);
  return candidates;
}

/**
 * Walk the candidates until one answers.
 *
 * Failures are collected rather than thrown so the caller can tell the student
 * the right thing: "every provider is busy for a minute" and "every provider is
 * out for the day" need different words, and neither of them is the student's
 * own allowance running out.
 */
export async function callModel(
  candidates: Candidate[],
  system: string,
  prompt: string,
): Promise<{
  text: string;
  model: string;
  provider: ProviderName;
  tokens?: number;
}> {
  const failures: string[] = [];
  let dayExhausted = false;
  let rateLimited = false;
  let retryAfterMs: number | undefined;

  for (const candidate of usable(candidates)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result =
        candidate.provider === "gemini"
          ? await geminiAttempt(candidate, system, prompt)
          : await openAiCompatibleAttempt(candidate, system, prompt);

      if (result.ok) {
        if (result.text.trim()) {
          lastGood = candidate.id;
          return {
            text: result.text,
            model: candidate.model,
            provider: candidate.provider,
            tokens: result.tokens,
          };
        }
        failures.push(`${candidate.provider}/${candidate.model}: replied with nothing`);
        break;
      }

      if (result.kind !== "minute") {
        failures.push(
          `${candidate.provider}/${candidate.model}: ${firstLine(result.message)}`,
        );
      }

      // A rejected key disqualifies every model on it — stop walking.
      if (result.kind === "auth") throw new Error(result.message);

      if (result.kind === "day") {
        parkedUntil.set(candidate.id, dayResetsAt());
        dayExhausted = true;
        break;
      }
      if (result.kind === "model") {
        retired.add(candidate.id);
        break;
      }
      if (result.kind === "minute") {
        rateLimited = true;
        if (result.retryAfterMs) {
          retryAfterMs = Math.max(retryAfterMs ?? 0, result.retryAfterMs);
        }
        failures.push(
          `${candidate.provider}/${candidate.model}: ${firstLine(result.message)}`,
        );
      }

      // Busy or briefly broken: one more go on this candidate, then move on.
      const worthRetrying =
        result.kind === "minute" ||
        result.status >= 500 ||
        result.status === 0 ||
        OVERLOADED.test(result.message);
      if (attempt === 0 && worthRetrying) {
        await sleep(600);
        continue;
      }
      break;
    }
  }

  throw new ProviderUnavailable({
    failures,
    dayExhausted,
    rateLimited,
    retryAfterMs,
  });
}
