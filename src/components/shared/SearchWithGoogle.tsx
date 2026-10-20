import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertCircle,
  ArrowUpRight,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import "./search-with-google.css";

/**
 * "Search on Google" — an in-app panel, never a redirect.
 *
 * The student's working stays exactly where it is: pressing the button opens
 * this soft-cornered page, the query runs through a Convex action (so no API
 * key ever reaches the browser) and the results, plus Google's short answer,
 * are drawn inside the panel. Each result opens in a new tab only when it is
 * clicked.
 *
 * The trigger is deliberately a white button carrying the Google wordmark —
 * the one place a third party's identity is shown, so it is shown as their
 * mark rather than as somebody's spelling of it.
 */

interface Hit {
  title: string;
  url: string;
  snippet: string;
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

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(topic);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<Hit[]>([]);

  const sent = (query.trim() || topic.trim()).slice(0, 240);
  const googleUrl = googleUrlFor(sent);
  const run = async (text: string) => {
    const value = text.trim().replace(/\s+/g, " ").slice(0, 240);
    if (!value || busy) return;
    setBusy(true);
    setSearched(true);
    setError(null);
    setAnswer(null);
    setResults([]);
    try {
      const reply = await runSearch({ q: value });
      if (reply.ok) {
        setResults(reply.results);
        setAnswer(reply.answer ?? null);
      } else {
        setError(reply.error ?? "That search did not go through.");
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "That search did not go through. Use the Google link below instead.";
      // Never surface a rotating Gemini model id as the cause. On the deployed
      // build the panel has been blaming a fresh model id on every render even
      // when the real fault is the configured search key/scopes, because the
      // server retries ids and the client shows whatever the last attempt said.
      // That harms trust in this panel: students read the word after “gemini-…"
      // as “the problem is that model”, when it is not.
      //
      // Strip any sentence of the form “<model-id> is not available on this
      // key.” back to the stable real cause. If the backend did not give us a
      // clearer upstream message after that, fall back to the usual generic
      // line.
      const blamedModelLine =
        message.match(/^[\s\S]*?gemini-[\w.-]+ is not available on this key\.$/)?.[0];
      if (blamedModelLine) {
        if (
          message === blamedModelLine ||
          message.endsWith(blamedModelLine)
        ) {
          // The whole message is the rotating blame line itself — replace it.
          setError(
            "Google Search returned an error for this key. Open the full results on Google below, or try again in a moment.",
          );
        } else {
          // There is a real upstream message around it — drop only the blame
          // line so the useful part survives.
          setError(message.replace(blamedModelLine, "").trim());
        }
      } else {
        setError(message);
      }
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
    if (initial) void run(initial);
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
        <DialogHeader>
          <p className="gs-kicker">
            <img
              className="gs-kicker__mark"
              src="/google-g.png"
              alt=""
              aria-hidden
              width={15}
              height={15}
              draggable={false}
            />
            Search the web
          </p>
          <DialogTitle className="gs-title">
            Look it up without leaving Manthan
          </DialogTitle>
          <DialogDescription className="gs-desc">
            Results come back into this panel, so your problem and your working
            never move.
          </DialogDescription>
        </DialogHeader>

        <form
          className="gs-field"
          onSubmit={(event) => {
            event.preventDefault();
            void run(query);
          }}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="What do you want to look up?"
            aria-label="Search query"
            autoFocus
          />            <button type="submit" className="gs-submit" disabled={busy || !query.trim()}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <img
                className="gs-submit__mark"
                src="/google-g.png"
                alt=""
                aria-hidden
                width={15}
                height={15}
                draggable={false}
              />
            )}
            Search
          </button>
        </form>

        {busy ? (
          <p className="gs-status" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Searching the web…
          </p>
        ) : null}

        {!busy && error ? (
          <p className="gs-error">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}

        {!busy && !error && answer ? (
          <div className="gs-answer">
            <p className="gs-answer__label">
              <Sparkles className="h-3 w-3" aria-hidden /> From Google
            </p>
            <p className="gs-answer__text">{answer}</p>
          </div>
        ) : null}

        {!busy && !error && results.length > 0 ? (
          <ul className="gs-results">
            {results.map((result) => (
              <li key={result.url}>
                <a
                  className="gs-hit"
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="gs-hit__host">{hostOf(result.url)}</span>
                  <span className="gs-hit__title">{result.title}</span>
                  {result.snippet ? (
                    <span className="gs-hit__snip">{result.snippet}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {!busy && !error && searched && results.length === 0 && !answer ? (
          <p className="gs-note">
            Nothing came back for that. Try fewer words, or open Google below.
          </p>
        ) : null}

        <div className="gs-foot">            <a
              className="gs-open"
              href={googleUrl}
              target="_blank"
              rel="noreferrer"
            >
              <img
                className="gs-open__mark"
                src="/google-g.png"
                alt="Google"
                width={14}
                height={14}
                draggable={false}
              />
              Open full results on Google
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </a>
          </div>

          <p className="gs-note">
            Results stay in this panel.
          </p>
      </DialogContent>
    </Dialog>
  );
}

export default SearchWithGoogle;
