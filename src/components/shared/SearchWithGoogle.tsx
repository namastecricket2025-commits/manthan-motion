import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertCircle, Loader2, Search } from "lucide-react";
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
 * The panel is deliberately bare: the Google mark in the corner, a search
 * field, and the results. No marketing copy, no explanation of where the
 * results live — a student opened this to look something up, so that is all it
 * does. The query runs through a Convex action, so no API key reaches the
 * browser, and each result opens in a new tab only when it is clicked.
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
  const [results, setResults] = useState<Hit[]>([]);

  const sent = (query.trim() || topic.trim()).slice(0, 240);
  const googleUrl = googleUrlFor(sent);

  const run = async (text: string) => {
    const value = text.trim().replace(/\s+/g, " ").slice(0, 240);
    if (!value || busy) return;
    setBusy(true);
    setSearched(true);
    setError(null);
    setResults([]);
    try {
      const reply = await runSearch({ q: value });
      if (reply.ok) {
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
        {/* Named for screen readers only: the panel itself carries no visible
            heading, so nothing is read out that a sighted student cannot see. */}
        <DialogTitle className="sr-only">Search Google</DialogTitle>
        <DialogDescription className="sr-only">
          Type a question and press Search. Results open in a new tab.
        </DialogDescription>

        {/* The Google mark in the panel's top-left corner, and nothing else:
            it is a link out, so the panel needs no copy explaining itself. */}
        <a
          className="gs-corner"
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open these results on Google"
          title="Open on Google"
        >
          <img
            src="/google-g.png"
            alt="Google"
            width={20}
            height={20}
            draggable={false}
          />
        </a>

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
            placeholder="Search Google"
            aria-label="Search query"
            autoFocus
          />
          <button
            type="submit"
            className="gs-submit"
            disabled={busy || !query.trim()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            Search
          </button>
        </form>

        {!busy && error ? (
          <p className="gs-error" role="status">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
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

        {!busy && !error && searched && results.length === 0 ? (
          <p className="gs-note">Nothing came back. Try fewer words.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default SearchWithGoogle;
