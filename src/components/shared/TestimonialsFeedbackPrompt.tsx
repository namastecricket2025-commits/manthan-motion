import * as React from "react";
import { Star } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";


const STORAGE_KEY = "manthan-recent-kind";
const HIDDEN_KEY = "manthan-feedback-hidden";

/** Which in-app action most recently completed, if any. Used so the prompt can
 *  say "your summary / quiz / solved problem" once, then never again. */
function recentKind(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function setRecentKind(kind: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    /* ignore */
  }
  // A prompt already on the page reads the new value immediately rather than
  // waiting for the next dashboard mount.
  window.dispatchEvent(
    new CustomEvent("manthan:recent-kind", { detail: { kind } }),
  );
}

/**
 * When the prompt may appear. The prompt is tied to a real event, not a timer:
 * `setRecentKind` records what the student just generated, and it is shown at
 * most once a session, only to a signed-in account (a review is stored against
 * one), and never again after the form is sent or dismissed.
 */
function useFeedbackPrompt() {
  const { isAuthenticated } = useAuth();
  const [kind, setKind] = React.useState<string | null>(recentKind);
  const [hidden, setHidden] = React.useState(() => {
    try {
      return window.sessionStorage.getItem(HIDDEN_KEY) !== null;
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    const onKind = (event: Event) => {
      const next = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (!next) return;
      setKind(next);
      try {
        if (window.sessionStorage.getItem(HIDDEN_KEY) === null) setHidden(false);
      } catch {
        setHidden(false);
      }
    };
    window.addEventListener("manthan:recent-kind", onKind);
    return () => window.removeEventListener("manthan:recent-kind", onKind);
  }, []);

  const dismiss = React.useCallback(() => {
    setHidden(true);
    try {
      window.sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* private mode — hidden for this render only */
    }
  }, []);

  const markSubmitted = React.useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  return {
    kind,
    shouldShow: isAuthenticated && !hidden && !!kind,
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
}

export function FeedbackPrompt({ className }: FeedbackPromptProps) {
  const prompt = useFeedbackPrompt();

  const [rating, setRating] = React.useState(0);
  const [text, setText] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [classLabel, setClassLabel] = React.useState("");
  const [consent, setConsent] = React.useState(false);
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
            ? "If you consented, it may appear on the site once approved."
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
      {/* Dismissible once per visit. */}
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
            I&apos;m happy for Manthan to show this on the website
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
              placeholder="Aarav"
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
        <button
          type="button"
          onClick={prompt.dismissed}
          className="rounded-lg border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-text-dim transition-colors hover:text-foreground"
        >
          Skip
        </button>
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
