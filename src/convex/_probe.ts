"use node";

import { internalAction } from "./_generated/server";
import { callModel, resolveCandidates } from "./providers";

const SYSTEM =
  'Reply with one JSON object only: {"answer":string}. Answer in one sentence.';
const PROMPT = "In one sentence, what is photosynthesis?";

/** TEMPORARY verification probe — deleted after the check. */
export const keys = internalAction({
  args: {},
  handler: async () => {
    const all = await resolveCandidates();
    const preview = all.filter((c) => c.model === "gemini-3-flash-preview");
    const results = [];
    for (const candidate of preview) {
      const started = Date.now();
      try {
        const reply = await callModel([candidate], SYSTEM, PROMPT, undefined, 0, 8_000);
        results.push({ id: candidate.id, ms: Date.now() - started, ok: true, text: reply.text.slice(0, 30) });
      } catch (error) {
        results.push({
          id: candidate.id,
          ms: Date.now() - started,
          ok: false,
          error: error instanceof Error ? error.message.slice(0, 100) : String(error),
        });
      }
    }
    return { count: preview.length, results };
  },
});
