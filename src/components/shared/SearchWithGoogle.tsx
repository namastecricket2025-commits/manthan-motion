import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertCircle, ArrowUp, ArrowUpRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import "./search-with-google.css";

/**
 * "Search Google" — an in-app panel, never a redirect.
 *
 * Three bands, top to bottom, and nothing else:
 *
 *   1. the Google mark and the query — retype it and the panel searches again;
 *   2. the answer, the conversation, then the sources, in one scrolling body;
 *   3. the follow-up field and the "open on Google" footer, pinned so they are
 *      reachable without scrolling back down a long result list.
 *
 * The query runs through a Convex action, so no API key reaches the browser.
 * A result opens in a new tab only when it is clicked.
 */

interface Hit {
  title: string;
  url: string;
  snippet: string;
}

interface SearchAnswer {
  text: string;
  title?: string;
  url?: string;
}

interface FollowUpTurn {
  question: string;
  answer: string;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function googleUrlFor(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function SearchWithGoogle({
  topic,
  label = "Search on Google",
  compact = false,
  className,
}: {
  /** What to search for — usually the question, chapter or bench name. */
  topic: string;
  /** Accessible name for the trigger; the visible label is always the same. */
  label?: string;
  /** Compact styling for toolbars; otherwise it is a lab-chrome button. */
  compact?: boolean;
  className?: string;
}) {
  const runSearch = useAction(api.webSearch.search);
  const askFollowUp = useAction(api.webSearch.followUp);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(topic);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [results, setResults] = useState<Hit[]>([]);
  /* The conversation that grows under an answer. It is cleared with every new
     search: "and why is that?" belongs to the query that produced it. */
  const [thread, setThread] = useState<FollowUpTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  /* The question is rendered the instant Send is pressed, so the panel never
     looks stuck while the model is thinking. */
  const [pending, setPending] = useState<string | null>(null);
  const threadEnd = useRef<HTMLDivElement | null>(null);

  const sent = (query.trim() || topic.trim()).slice(0, 240);
  const googleUrl = googleUrlFor(sent);

  const clearConversation = () => {
    setThread([]);
    setQuestion("");
    setFollowError(null);
    setPending(null);
  };

  const run = async (text: string) => {
    const value = text.trim().replace(/\s+/g, " ").slice(0, 240);
    if (!value || busy) return;
    setBusy(true);
    setSearched(true);
    setError(null);
    setAnswer(null);
    setResults([]);
    clearConversation();
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

  /* Opening the panel starts the search for the topic in front of the
     student — a click on the button already said what they wanted. */
  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const initial = topic.trim().replace(/\s+/g, " ").slice(0, 240);
    setQuery(initial);
    setSearched(false);
    setError(null);
    setAnswer(null);
    setResults([]);
    clearConversation();
    if (initial) void run(initial);
  };

  const ask = async (text: string) => {
    const value = text.trim().replace(/\s+/g, " ").slice(0, 400);
    if (!value || followBusy) return;
    setFollowBusy(true);
    setFollowError(null);
    setPending(value);
    try {
      const reply = await askFollowUp({
        query: sent,
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            (compact ? "mathlab-tab-action " : "apple-lab-btn ") +
            "gs-trigger " +
            (className ?? "")
          }
          aria-label={`${label} — ${topic}`}
        >
          <span className="gs-trigger__text">Search</span>
          <img
            className="gs-trigger__logo"
            src="/google-g.png"
            alt="Google"
            width={18}
            height={18}
            draggable={false}
          />
        </button>
      </DialogTrigger>

      <DialogContent className="gs-panel rounded-[22px]">
        {/* Named for screen readers only: the panel itself carries no visible
            heading, so nothing is read out that a sighted student cannot see. */}
        <DialogTitle className="sr-only">Search Google</DialogTitle>
        <DialogDescription className="sr-only">
          Type a question and press Search. Results open in a new tab.
        </DialogDescription>

        <form
          className="gs-field"
          onSubmit={(event) => {
            event.preventDefault();
            void run(query);
          }}
        >
          {/* The mark leads the field and doubles as the way out to Google.
              One row instead of a floating badge above the search, so the
              first thing on the panel is the thing you can type into. */}
          <a
            className="gs-field__mark"
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open this search on Google"
            title="Open on Google"
          >
            <img
              src="/google-g.png"
              alt="Google"
              width={16}
              height={16}
              draggable={false}
            />
          </a>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Google"
            aria-label="Search query"
            autoFocus
          />
          <button
            type="submit"
            className="gs-submit"
            disabled={busy || !query.trim()}
          >
            Search
          </button>
        </form>

        <div className="gs-body">
          {/* While the request is out, the panel is the mark and nothing else —
              a spinner plus a sentence is busier than the wait itself. */}
          {busy ? (
            <div className="gs-loading" role="status" aria-label="Searching Google">
              <img
                src="/google-g.png"
                alt=""
                width={34}
                height={34}
                draggable={false}
                aria-hidden
              />
            </div>
          ) : null}

          {!busy && error ? (
            <p className="gs-error" role="status">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}

          {!busy && !error && answer ? (
            <div className="gs-answer">
              <p className="gs-answer__label">
                <img
                  src="/google-g.png"
                  alt=""
                  aria-hidden
                  width={13}
                  height={13}
                  draggable={false}
                />
                Answer
              </p>
              <p className="gs-answer__text">{answer.text}</p>
              {answer.url ? (
                <a
                  className="gs-answer__source"
                  href={answer.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {answer.title || hostOf(answer.url)}
                </a>
              ) : null}
            </div>
          ) : null}

          {/* The conversation continues in place. An answer that ends the panel
              is a dictionary lookup; a student usually has one more question. */}
          {!busy && !error && (thread.length > 0 || pending || followError) ? (
            <div className="gs-thread">
              {thread.map((turn, index) => (
                <div className="gs-turn" key={`${turn.question}-${index}`}>
                  <p className="gs-turn__q">{turn.question}</p>
                  <p className="gs-turn__a">{turn.answer}</p>
                </div>
              ))}
              {pending ? (
                <div className="gs-turn">
                  <p className="gs-turn__q">{pending}</p>
                  <p className="gs-turn__pending">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Thinking it through…
                  </p>
                </div>
              ) : null}
              {!followBusy && followError ? (
                <p className="gs-turn__error" role="status">
                  {followError}
                </p>
              ) : null}
              <div ref={threadEnd} />
            </div>
          ) : null}

          {!busy && !error && results.length > 0 ? (
            <>
              <p className="gs-results__label">Sources</p>
              <ul className="gs-results">
                {results.map((result, index) => (
                  <li key={result.url}>
                    <a
                      className="gs-hit"
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                      title={result.snippet || undefined}
                    >
                      <span className="gs-hit__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="gs-hit__body">
                        <span className="gs-hit__host">
                          {hostOf(result.url)}
                        </span>
                        <span className="gs-hit__title">{result.title}</span>
                        {result.snippet ? (
                          <span className="gs-hit__snip">
                            {result.snippet.slice(0, 140)}
                          </span>
                        ) : null}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {!busy && !error && searched && results.length === 0 && !answer ? (
            <p className="gs-note">Nothing came back. Try fewer words.</p>
          ) : null}
        </div>

        {/* The follow-up sits below the scroll area, so it is always one click
            away — on the first screen and under ten sources alike. */}
        {searched ? (
          <form
            className="gs-follow"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a follow-up…"
              aria-label="Ask a follow-up question"
              disabled={followBusy}
            />
            <button
              type="submit"
              aria-label="Send follow-up"
              disabled={followBusy || !question.trim()}
            >
              {followBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </form>
        ) : null}

        <div className="gs-foot">
          <span className="gs-foot__brand">
            Results from Google · open a source in a new tab
          </span>
          <a className="gs-foot__link" href={googleUrl} target="_blank" rel="noreferrer">
            Open
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SearchWithGoogle;
