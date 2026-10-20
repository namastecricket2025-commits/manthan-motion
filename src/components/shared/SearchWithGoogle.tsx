import { useMemo, useState } from "react";
import { ArrowUpRight, Search, Sparkles } from "lucide-react";
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
 * "Search with Google" — a small in-app panel, not a redirect.
 *
 * Google refuses to be framed, so the search opens in a sized pop-up window
 * while the lab stays exactly where it is. The query is prefilled from whatever
 * the student is looking at (a step, a chapter, a bench) and is editable before
 * it is sent, so a bad auto-query costs a keystroke rather than a lost page.
 */
export function SearchWithGoogle({
  topic,
  label = "Search on Google",
  compact = false,
  className,
}: {
  /** What to search for — usually the question, chapter or bench name. */
  topic: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(topic);
  const [blocked, setBlocked] = useState(false);

  const sent = query.trim() || topic.trim();
  const url = useMemo(
    () => `https://www.google.com/search?q=${encodeURIComponent(sent)}`,
    [sent],
  );
  const aiUrl = useMemo(
    () => `https://www.google.com/search?q=${encodeURIComponent(sent)}&udm=50`,
    [sent],
  );

  const popup = (target: string) => {
    const width = 560;
    const height = 740;
    const left = Math.max(0, window.outerWidth / 2 - width / 2 + window.screenX);
    const top = Math.max(0, window.outerHeight / 2 - height / 2 + window.screenY);
    const win = window.open(
      target,
      "manthan-google",
      `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
    );
    if (!win) {
      setBlocked(true);
      return false;
    }
    // `noopener` in the feature string makes window.open return null in some
    // browsers, which would look like a blocked pop-up. Sever the opener on the
    // returned handle instead.
    try {
      win.opener = null;
    } catch {
      /* cross-origin window — it is already detached enough */
    }
    win.focus?.();
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            (compact ? "mathlab-tab-action " : "apple-lab-btn ") +
            "gs-trigger " +
            (className ?? "")
          }
          aria-label={`${label} — ${topic}`}
          // A new question means a new query: reset on open instead of in an
          // effect, so reopening never searches the previous topic.
          onClick={() => setQuery(topic)}
        >
          <Search className="h-3.5 w-3.5" />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="gs-panel">
        <DialogHeader>
          <p className="gs-kicker">
            <Search className="h-3 w-3" /> Search the web
          </p>
          <DialogTitle className="gs-title">Look this up on Google</DialogTitle>
          <DialogDescription className="gs-desc">
            Edit the query, then send it to Google. It opens in a small window so
            this page — and your working — stays exactly where it is.
          </DialogDescription>
        </DialogHeader>

        <label className="gs-field">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (popup(url)) setOpen(false);
            }}
            placeholder="What do you want to look up?"
            aria-label="Google search query"
            autoFocus
          />
        </label>

        <div className="gs-actions">
          <a
            className="gs-go"
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (popup(url)) event.preventDefault();
              setOpen(false);
            }}
          >
            <Search className="h-4 w-4" />
            Search on Google
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            className="gs-ai"
            href={aiUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (popup(aiUrl)) event.preventDefault();
              setOpen(false);
            }}
          >
            <Sparkles className="h-4 w-4" />
            Ask Google AI
          </a>
        </div>

        {blocked ? (
          <p className="gs-note">
            The browser blocked the small window. Allow pop-ups for this site, or
            use the link above — it opens in a new tab instead.
          </p>
        ) : (
          <p className="gs-note">
            Nothing on this page changes. Google opens beside it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SearchWithGoogle;
