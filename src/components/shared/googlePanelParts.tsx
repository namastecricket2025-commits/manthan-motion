import { AlertCircle, ArrowUp, Loader2 } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import "./search-with-google.css";

/**
 * The pieces of the "Search Google" panel, as pure props-to-markup.
 *
 * The panel is drawn in two places: the in-app dialog (`SearchWithGoogle`) and
 * the working preview on the landing page. Both must look identical — that is
 * the whole point of the preview, it is showing the real thing — so the markup
 * lives here once and both callers arrange it. State stays with the caller,
 * because the two surfaces differ in everything except appearance: one meters
 * against a plan and requires an account, the other answers from a cache with
 * a daily ceiling.
 */

export interface Hit {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchAnswer {
  text: string;
  title?: string;
  url?: string;
}

export interface FollowUpTurn {
  question: string;
  answer: string;
}

export const GOOGLE_MARK = "/google-g.png";

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The wait: Google's mark, centred, breathing. No spinner text. */
export function SearchLoading() {
  return (
    <div className="gs-loading" role="status" aria-label="Searching Google">
      <img src={GOOGLE_MARK} alt="" width={34} height={34} draggable={false} aria-hidden />
    </div>
  );
}

export function SearchError({ message }: { message: string }) {
  return (
    <p className="gs-error" role="status">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/**
 * The short answer Google itself puts above the results.
 *
 * Labelled with Google's mark and linked to the page it came from, so nothing
 * in it reads as wording Manthan wrote.
 */
export function SearchAnswerBlock({ answer }: { answer: SearchAnswer }) {
  return (
    <div className="gs-answer">
      <p className="gs-answer__label">
        <img
          src={GOOGLE_MARK}
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
  );
}

/**
 * The conversation that grows under an answer. It is cleared with every new
 * search: "and why is that?" belongs to the query that produced it.
 */
export function SearchThread({
  thread,
  pending,
  error,
  endRef,
}: {
  thread: FollowUpTurn[];
  pending: string | null;
  error: string | null;
  endRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
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
      {!pending && error ? (
        <p className="gs-turn__error" role="status">
          {error}
        </p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

/** The pages the answer sits above. */
export function SearchSources({ hits }: { hits: Hit[] }) {
  return (
    <>
      <p className="gs-results__label">Sources</p>
      <ul className="gs-results">
        {hits.map((result, index) => (
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
                <span className="gs-hit__host">{hostOf(result.url)}</span>
                <span className="gs-hit__title">{result.title}</span>
                {result.snippet ? (
                  <span className="gs-hit__snip">{result.snippet.slice(0, 140)}</span>
                ) : null}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The follow-up field, pinned below the scroll area on both surfaces. */
export function FollowUpField({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = "Ask a follow-up…",
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder?: string;
}) {
  return (
    <form
      className="gs-follow"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Ask a follow-up question"
        disabled={busy}
      />
      <button type="submit" aria-label="Send follow-up" disabled={busy || !value.trim()}>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </form>
  );
}
