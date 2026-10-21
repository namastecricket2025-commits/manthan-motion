import { useAction } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  ArrowUp,
  BookOpenCheck,
  Compass,
  Loader2,
  Play,
  Sparkles,
  Turtle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Ask this notebook.
 *
 * The conversation is grounded in the sources actually in the notebook: the
 * action receives their extracted text, answers from it, and names the source a
 * claim came from. Three modes are three lengths of the same grounded answer —
 * quick, a deep pass, and a simpler explanation — not three different brains.
 *
 * The panel is deliberately the first thing in the workspace: the generated
 * artefacts are the side products, the conversation is the work.
 */

type Mode = "quick" | "deep" | "explain";

const MODES: Array<{ id: Mode; label: string; icon: typeof Sparkles; hint: string }> = [
  { id: "quick", label: "Light research", icon: Sparkles, hint: "A few sentences" },
  { id: "deep", label: "Deep research", icon: Compass, hint: "Sections, with a next step" },
  { id: "explain", label: "Explain simply", icon: Turtle, hint: "Plain words, one comparison" },
];

interface Turn {
  role: "student" | "lab";
  text: string;
  sources?: string[];
}

export function NotebookChat({
  notebookId,
  notebookName,
  readyCount,
}: {
  notebookId: Id<"notebooks">;
  notebookName: string;
  readyCount: number;
}) {
  const ask = useAction(api.notebookStudio.notebookChat);
  const [mode, setMode] = useState<Mode>("quick");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    if (readyCount === 0) {
      setError("Add a readable source first — the answer has to come from somewhere.");
      return;
    }
    setQuestion("");
    setError(null);
    setBusy(true);
    const history = turns.map((turn) => ({ role: turn.role, text: turn.text }));
    setTurns((current) => [...current, { role: "student", text: value }]);
    try {
      const reply = await ask({ notebookId, question: value, mode, history });
      setTurns((current) => [
        ...current,
        { role: "lab", text: reply.answer, sources: reply.sources },
      ]);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The notebook could not answer just now. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const starters = [
    `Give me the five-minute version of ${notebookName}.`,
    "What am I most likely to be asked from this in the exam?",
    "Explain the hardest idea in this notebook simply.",
  ];

  return (
    <div className="flex min-w-0 flex-col">
      <div>
        <p className="dashboard-kicker">
          <BookOpenCheck className="h-3.5 w-3.5" />
          Ask this notebook
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-text-dim">
          Answers come only from the {readyCount} readable source
          {readyCount === 1 ? "" : "s"} here, and name the source they used.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Answer depth">
        {MODES.map((entry) => {
          const Icon = entry.icon;
          const active = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={active}
              title={entry.hint}
              onClick={() => setMode(entry.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors " +
                (active
                  ? "border-[var(--signal)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-foreground"
                  : "border-[var(--card-border)] text-text-dim hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        ref={scroller}
        className="thin-scroll mt-3 flex max-h-[360px] min-h-[190px] flex-col gap-3 overflow-y-auto rounded-2xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--card)_45%,transparent)] p-3.5"
        aria-live="polite"
      >
        {turns.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-2">
            <p className="text-[12.5px] leading-relaxed text-text-dim">
              Ask anything about this notebook. Nothing outside your sources is
              treated as true here.
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void send(starter)}
                  disabled={busy}
                  className="rounded-xl border border-dashed border-[var(--card-border)] px-3 py-2 text-left text-[12px] leading-relaxed text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground disabled:opacity-50"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, index) =>
            turn.role === "student" ? (
              <div key={index} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] px-3.5 py-2 text-[13px] leading-relaxed text-foreground">
                  {turn.text}
                </p>
              </div>
            ) : (
              <div key={index} className="flex flex-col gap-1.5">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                  {turn.text}
                </p>
                {turn.sources && turn.sources.length > 0 ? (
                  <p className="text-[10px] leading-relaxed text-text-dim">
                    From {turn.sources.join(" · ")}
                  </p>
                ) : null}
                {/* The video suggestion belongs to the answer, not to a panel in
                    the sidebar: it is offered at the moment a student is reading
                    an explanation that may not have landed, which is the only
                    point at which "watch this too" means anything. It opens a
                    YouTube search, so nothing is fetched or stored. */}
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    [notebookName, turns[index - 1]?.role === "student" ? turns[index - 1].text : ""]
                      .filter(Boolean)
                      .join(" "),
                  )}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Opens a YouTube search — nothing is added to your notebook"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground"
                >
                  <Play className="h-3 w-3" />
                  Still fuzzy? Watch a video on this
                </a>
              </div>
            ),
          )
        )}
        {busy ? (
          <p className="flex items-center gap-2 text-[12px] text-text-dim">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading your sources…
          </p>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--signal)]">{error}</p> : null}

      <form
        className="mt-2.5 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(question);
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(question);
            }
          }}
          rows={1}
          placeholder={`Ask about ${notebookName}…`}
          aria-label="Ask this notebook"
          className="max-h-28 min-h-[42px] min-w-0 flex-1 resize-none rounded-2xl border border-[var(--card-border)] bg-transparent px-3.5 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-text-dim/70 focus:border-[var(--signal)]"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          aria-label="Send question"
          className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[var(--signal-strong)] text-[var(--primary-foreground)] transition-opacity disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

export default NotebookChat;
