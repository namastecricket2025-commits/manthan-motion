import {
  FollowUpField,
  GOOGLE_MARK,
  SearchAnswerBlock,
  SearchError,
  SearchLoading,
  SearchSources,
  SearchThread,
  type FollowUpTurn,
  type Hit,
  type SearchAnswer,
} from "@/components/shared/googlePanelParts";
import { api } from "@/convex/_generated/api";
import { useStillMotion } from "@/lib/motion";
import { useAction } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

/**
 * The working search preview on the landing page.
 *
 * This is the real panel — the same stylesheet, the same markup (both come from
 * `googlePanelParts`) — standing on the home page before anyone has an account.
 * A visitor can type a question, get Google's own answer and the pages it came
 * from, and keep asking; the follow-up field is a message box, and it works.
 *
 * What is different from the in-app panel is only what is behind it. The real
 * action meters against a plan and needs an account, so this one runs on
 * `webSearch.demoSearch`: cached per question, and gated by a small daily
 * ceiling. Two consequences worth naming, because they are the design:
 *
 *   the suggestions are the idle state   four real school questions, each one
 *     a click away from a real answer. They are also what the field's
 *     placeholder cycles through, so the panel recommends something else every
 *     few seconds without anything moving that the eye has to chase.
 *   the ceiling is visible               when the day's lookups are used up the
 *     panel says so and offers the sign-in. It never fails silently and it
 *     never pretends to be unlimited.
 *
 * Typing and sending are the point, so nothing here is a mock: every answer on
 * screen came from a search that actually ran.
 */

const SUGGESTIONS = [
  "Why is the sky blue?",
  "Difference between mitosis and meiosis",
  "What is the Doppler effect?",
  "How does a transformer work?",
];

/** Long enough to read a suggestion, short enough that the field feels alive. */
const ROTATE_MS = 3600;

export default function SearchPreview() {
  const runSearch = useAction(api.webSearch.demoSearch);
  const askFollowUp = useAction(api.webSearch.demoFollowUp);
  const still = useStillMotion();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [results, setResults] = useState<Hit[]>([]);
  const [asked, setAsked] = useState("");
  /* The conversation under the answer. Cleared with every new search: "and
     why?" belongs to the question that produced it. */
  const [thread, setThread] = useState<FollowUpTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement | null>(null);

  /* The changing word in the field. Two timers, not an interval: one fades the
     suggestion out, the next swaps it and fades back in, so the change is a
     dissolve rather than a flicker. It holds still while the visitor is typing
     or has the field focused — a suggestion that moves under the cursor is
     noise — and it does not run at all under reduced motion. */
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (still || query || focused) return;
    const fadeOut = window.setTimeout(() => setFading(true), ROTATE_MS - 320);
    const advance = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SUGGESTIONS.length);
      setFading(false);
    }, ROTATE_MS);
    return () => {
      window.clearTimeout(fadeOut);
      window.clearTimeout(advance);
    };
  }, [still, query, focused, index]);

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
    (asked || query || SUGGESTIONS[index]).slice(0, 240),
  )}`;

  const resetConversation = () => {
    setThread([]);
    setQuestion("");
    setFollowError(null);
    setPending(null);
  };

  const run = async (text: string) => {
    const value = text.trim().replace(/\s+/g, " ").slice(0, 240);
    if (!value || busy) return;
    setBusy(true);
    setStarted(true);
    setError(null);
    setAnswer(null);
    setResults([]);
    resetConversation();
    setAsked(value);
    setQuery(value);
    try {
      const reply = await runSearch({ q: value });
      if (reply.ok) {
        setAnswer(reply.answer ?? null);
        setResults(reply.results);
      } else {
        setError(reply.error ?? "That search did not go through. Try again.");
      }
    } catch {
      setError("That search did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const ask = async (text: string) => {
    const value = text.trim().replace(/\s+/g, " ").slice(0, 400);
    if (!value || followBusy) return;
    setFollowBusy(true);
    setFollowError(null);
    setPending(value);
    try {
      const reply = await askFollowUp({
        query: asked,
        answer: answer?.text,
        sources: results.slice(0, 4).map((hit) => ({
          title: hit.title,
          url: hit.url,
          snippet: hit.snippet,
        })),
        history: thread.slice(-2),
        question: value,
      });
      if (reply.ok && reply.text) {
        setThread((turns) => [...turns, { question: value, answer: reply.text! }]);
        setQuestion("");
        requestAnimationFrame(() =>
          threadEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        );
      } else {
        setFollowError(reply.error ?? "That question did not go through. Try again.");
      }
    } catch {
      setFollowError("That question did not go through. Try again.");
    } finally {
      setFollowBusy(false);
      setPending(null);
    }
  };

  const showIdle = !busy && !error && !started;

  return (
    <section id="ask" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px]">
          Ask it anything, <span className="gradient-text">live</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-dim">
          The search panel from inside Manthan, working on this page — answers
          and sources come straight from Google.
        </p>
      </div>

      <div className="mx-auto mt-10 flex max-w-[680px] justify-center">
        {/* The panel. `gs-panel` is the dialog's own frame; the modifier only
            changes its footing, so the two cannot drift apart. */}
        <div className="gs-panel gs-panel--inline">
          <form
            className="gs-field"
            onSubmit={(event) => {
              event.preventDefault();
              void run(query);
            }}
          >
            <a
              className="gs-field__mark"
              href={googleUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open this search on Google"
              title="Open on Google"
            >
              <img src={GOOGLE_MARK} alt="Google" width={16} height={16} draggable={false} />
            </a>
            <span className="gs-field__wrap">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder=""
                aria-label="Ask a question"
              />
              {/* The changing recommendation. Decorative for a screen reader —
                  the same questions are real buttons in the body below. */}
              {!query && !focused ? (
                <span
                  className="gs-field__ghost"
                  data-out={fading ? "true" : "false"}
                  aria-hidden="true"
                >
                  {SUGGESTIONS[index]}
                </span>
              ) : null}
            </span>
            <button type="submit" className="gs-submit" disabled={busy || !query.trim()}>
              Search
            </button>
          </form>

          <div className="gs-body">
            {showIdle ? (
              <div className="gs-idle">
                <p className="gs-idle__label">Try one of these</p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="gs-ask"
                    onClick={() => void run(suggestion)}
                  >
                    {suggestion}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ))}
              </div>
            ) : null}

            {busy ? <SearchLoading /> : null}

            {!busy && error ? <SearchError message={error} /> : null}

            {!busy && !error && answer ? <SearchAnswerBlock answer={answer} /> : null}

            {!busy && !error && (thread.length > 0 || pending || followError) ? (
              <SearchThread
                thread={thread}
                pending={pending}
                error={followBusy ? null : followError}
                endRef={threadEnd}
              />
            ) : null}

            {!busy && !error && results.length > 0 ? (
              <SearchSources hits={results} />
            ) : null}

            {!busy && !error && started && results.length === 0 && !answer ? (
              <p className="gs-note">Nothing came back. Try fewer words.</p>
            ) : null}
          </div>

          {started ? (
            <FollowUpField
              value={question}
              onChange={setQuestion}
              onSubmit={() => void ask(question)}
              busy={followBusy}
            />
          ) : null}

          <div className="gs-foot">
            <span className="gs-foot__brand">
              <img src={GOOGLE_MARK} alt="" aria-hidden width={12} height={12} draggable={false} />
              Live demo · Google results
            </span>
            <Link className="gs-foot__link" to="/auth?returnTo=%2Flab">
              Sign in for the full panel
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
