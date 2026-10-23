import * as React from "react";
import { Star } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";


const STORAGE_KEY = "manthan-recent-kind";
const HIDDEN_KEY = "manthan-feedback-hidden";
const ASKED_KEY = "manthan-feedback-asked-at";
/** One prompt a month, at most. A review asked for after every flashcard is
 *  not a review, it is a toll booth. */
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type Recent = { kind: string; at: number };

/** Which in-app action most recently completed, if any. The timestamp is what
 *  keeps an old generation from resurfacing the prompt on a later visit. */
function recentKind(): Recent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Recent>;
    if (typeof parsed?.kind !== "string" || !parsed.kind) return null;
    return { kind: parsed.kind, at: typeof parsed.at === "number" ? parsed.at : 0 };
  } catch {
    return null;
  }
}

export function setRecentKind(kind: string) {
  const entry: Recent = { kind, at: Date.now() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
  // A prompt already on the page reads the new value immediately rather than
  // waiting for the next dashboard mount.
  window.dispatchEvent(
    new CustomEvent("manthan:recent-kind", { detail: entry }),
  );
}

/**
 * When the prompt may appear.
 *
 * Tied to a real generation, never to a timer, and deliberately scarce:
 * at most once every 30 days, only to a signed-in account, and never again
 * after it has been dismissed or answered. The last occurrence is stored in
 * localStorage, not sessionStorage — the session version reset with the tab,
 * which is why reopening the site re-asked about a flashcard from last visit.
 */
function readAsked(): number {
  try {
    return Number(window.localStorage.getItem(ASKED_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function useFeedbackPrompt(forceVisible = false) {
  const { isAuthenticated } = useAuth();
  // The kind is only the *label* for a prompt raised in this visit; on its own
  // it never opens one. A stored kind from last week must not resurface.
  const [recent, setRecent] = React.useState<Recent | null>(recentKind);
  const [visible, setVisible] = React.useState(false);
  const [hidden, setHidden] = React.useState(() => {
    try {
      return window.localStorage.getItem(HIDDEN_KEY) !== null;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    const onKind = (event: Event) => {
      const next = (event as CustomEvent<Partial<Recent>>).detail;
      if (!next?.kind) return;
      setRecent({ kind: next.kind, at: typeof next.at === "number" ? next.at : Date.now() });
      // Decide on the event itself. The occurrence is stamped the moment the
      // prompt is raised, so closing the tab unanswered ends the ask too.
      if (hidden || !isAuthenticated) return;
      if (Date.now() - readAsked() < COOLDOWN_MS) return;
      try {
        window.localStorage.setItem(ASKED_KEY, String(Date.now()));
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* private mode: this visit still owns the prompt */
      }
      setVisible(true);
    };
    window.addEventListener("manthan:recent-kind", onKind);
    return () => window.removeEventListener("manthan:recent-kind", onKind);
  }, [hidden, isAuthenticated]);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    setHidden(true);
    try {
      window.localStorage.setItem(HIDDEN_KEY, "1");
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode — hidden for this render only */
    }
  }, []);

  const markSubmitted = React.useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  return {
    kind: recent?.kind ?? null,
    shouldShow: forceVisible || (isAuthenticated && !hidden && visible && !!recent),
    dismissed: dismiss,
    submitted: markSubmitted,
  };
}

function StarField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset
      className="flex gap-1.5"
      aria-label="Rating from 1 to 5 stars"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm transition-colors",
            value >= n
              ? "bg-[var(--signal)] border-[var(--signal)] text-[var(--panel)]"
              : "border-[var(--card-border)] text-text-dim hover:text-[var(--signal)]",
          )}
        >
          <Star
            className="h-4 w-4"
            fill={value >= n ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
          />
        </button>
      ))}
    </fieldset>
  );
}

export interface FeedbackPromptProps {
  className?: string;
  /** The /feedback page asks directly; the in-app prompt earns its moment. */
  forceVisible?: boolean;
}

export function FeedbackPrompt({ className, forceVisible = false }: FeedbackPromptProps) {
  const prompt = useFeedbackPrompt(forceVisible);

  const [rating, setRating] = React.useState(0);
  const [text, setText] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [classLabel, setClassLabel] = React.useState("");
  // Reviews are published by default — the product asks for feedback so it can
  // show it. The box stays visible so anyone can opt out before sending.
  const [consent, setConsent] = React.useState(true);
  const [submitted, setSubmitted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = useMutation(api.testimonials.submitFeedback);

  const { kind } = prompt;

  async function handleSubmit() {
    if (rating < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit({
        rating,
        text: text.trim(),
        displayName: displayName.trim() || undefined,
        classLabel: classLabel.trim() || undefined,
        consentToPublish: consent,
      });
      setSubmitted(true);
      prompt.submitted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your feedback.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!prompt.shouldShow && !submitted) {
    return null;
  }

  if (submitted) {
    return (
      <div
        className={cn(
          "pointer-events-auto relative z-50 mx-auto max-w-sm overflow-hidden rounded-2xl border bg-[var(--popover)] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl text-foreground",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-[var(--card-border)]">
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 rotate-45 text-[var(--signal)]"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">
          Thanks — we saved your feedback.
        </p>
        <p className="mt-1 text-xs text-text-dim">
          {consent
            ? "It is on the site now — in the reviews section of the homepage."
            : "Since publishing was not consented to, this stays between you and us."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto relative z-50 mx-auto max-w-sm overflow-hidden rounded-2xl border bg-[var(--popover)] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl text-foreground",
        className,
      )}
      role="dialog"
      aria-label="Was this helpful?"
    >
      {/* Dismissible once per visit — but on /feedback the form is the page,
          so there is nothing to dismiss it back to. */}
      {forceVisible ? null : (
      <button
        type="button"
        onClick={prompt.dismissed}
        className="absolute right-3 top-3 rounded-full p-1 text-text-dim transition-colors hover:text-foreground"
        aria-label="Dismiss"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      )}

      <p className="text-sm font-semibold">Was this helpful?</p>
      {kind ? (
        <p className="mt-1 text-xs text-text-dim">About your {kind}.</p>
      ) : null}

      <div className="mt-4">
        <label className="block text-xs text-text-dim">Your rating</label>
        <StarField value={rating} onChange={setRating} />
      </div>

      <div className="mt-3">
        <label htmlFor="fb-text" className="block text-xs text-text-dim">
          Optional — one line about what you liked or what to improve
        </label>
        <input
          id="fb-text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 200))}
          placeholder="e.g. the quiz helped me revise quickly"
          className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <label className="flex flex-wrap items-start gap-2.5">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--card-border)] text-[var(--signal)] focus:ring-[var(--signal)]"
          />
          <span className="text-xs leading-relaxed text-text-dim">
            Show this on the website — it appears in the homepage reviews
            straight away. Untick to keep it private.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="fb-name" className="block text-xs text-text-dim">
              First name (optional)
            </label>
            <input
              id="fb-name"
              type="text"
              value={displayName}
              onChange={(e) =>
                setDisplayName(e.target.value.slice(0, 40))
              }
              placeholder="Luv"
              className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
            />
          </div>
          <div>
            <label htmlFor="fb-class" className="block text-xs text-text-dim">
              Class or exam (optional)
            </label>
            <input
              id="fb-class"
              type="text"
              value={classLabel}
              onChange={(e) =>
                setClassLabel(e.target.value.slice(0, 40))
              }
              placeholder="Class 12 or JEE aspirant"
              className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
            />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-[var(--destructive)]">{error}</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {forceVisible ? null : (
          <button
            type="button"
            onClick={prompt.dismissed}
            className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:text-foreground"
          >
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating < 1 || busy}
          className="rounded-lg bg-[var(--signal)] px-4 py-2 text-sm font-medium text-[var(--panel)] shadow-sm transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--signal)] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Send feedback"}
        </button>
      </div>
    </div>
  );
}

export default FeedbackPrompt;
