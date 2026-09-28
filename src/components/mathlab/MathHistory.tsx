import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMemo, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Code,
  Copy,
  FileDown,
  History,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { MathTex } from "@/components/mathlab/latex";
import { PrintSheet } from "@/components/mathlab/PrintSheet";
import {
  solutionToLatex,
  solutionToText,
  type EngineProblem,
} from "@/components/mathlab/solution";

/**
 * History.
 *
 * Everything here comes out of the database and nothing else. A row exists
 * because a solve finished; the mistake list is a grouping of rows the checker
 * actually wrote; a count is a length, never an estimate. A brand-new account
 * sees an empty screen that says so, which is the truth.
 *
 * Each saved solution can be reopened in the notebook, filed into one of the
 * student's notebooks, copied as LaTeX or plain text, or exported as a PDF
 * through the browser's own print.
 */

type HistoryEntry = {
  id: Id<"mathSolutions">;
  question: string;
  headline: string;
  track: string;
  chapterName: string;
  method: string;
  createdAt: number;
  problemCount: number;
  finalAnswers: string[];
  savedNotebookId: string | null;
};

const stamp = (at: number) =>
  new Date(at).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function HistoryRow({
  entry,
  notebooks,
  onOpen,
}: {
  entry: HistoryEntry;
  notebooks: Array<{ id: string; name: string }>;
  onOpen: (solution: { headline: string; problems: EngineProblem[] }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [picked, setPicked] = useState<string>(entry.savedNotebookId ?? "");
  const [savedTo, setSavedTo] = useState<string>(entry.savedNotebookId ?? "");
  const [copied, setCopied] = useState<"plain" | "latex" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation(api.mathHistory.remove);
  const saveToNotebook = useMutation(api.mathHistory.saveToNotebook);
  const full = useQuery(api.mathHistory.get, expanded ? { solutionId: entry.id } : "skip");

  const solution = useMemo(() => {
    if (!full) return null;
    const problems = (Array.isArray(full.problems) ? full.problems : []) as EngineProblem[];
    return { headline: full.headline, problems };
  }, [full]);

  const copy = (kind: "plain" | "latex") => {
    if (!solution) return;
    const text = kind === "latex" ? solutionToLatex(solution) : solutionToText(solution);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600);
    });
  };

  const save = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await saveToNotebook({
        solutionId: entry.id,
        notebookId: picked as Id<"notebooks">,
      });
      setSavedTo(picked);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : "That could not be filed just now.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="mathlab-history__row" data-open={expanded}>
      <div className="mathlab-history__main">
        <button
          type="button"
          className="mathlab-history__summary"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="mathlab-history__question">{entry.question}</span>
          <span className="mathlab-history__headline">{entry.headline}</span>
          <span className="mathlab-history__meta">
            {entry.track} · {entry.chapterName} · {stamp(entry.createdAt)}
          </span>
        </button>
        {entry.finalAnswers.length ? (
          <div className="mathlab-history__answers">
            {entry.finalAnswers.map((answer, index) => (
              <span key={`${index}-${answer}`} className="mathlab-history__answer">
                <MathTex source={answer} fallback={answer} />
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="mathlab-history__body">
          {!full ? (
            <p className="mathlab-history__loading">
              <Loader2 className="spin-micro h-3.5 w-3.5" />
              Opening it…
            </p>
          ) : solution ? (
            <>
              {solution.problems.map((problem, index) => (
                <div key={`${index}-${problem.problem}`} className="mathlab-history__problem">
                  <p className="mathlab-history__problemtitle">
                    {solution.problems.length > 1 ? `Problem ${index + 1} · ` : ""}
                    {problem.title}
                  </p>
                  <MathTex source={problem.problem} fallback={problem.problem} display />
                  <p className="mathlab-history__steps">
                    {problem.steps.length} steps · final answer{" "}
                    <MathTex source={problem.finalAnswer} fallback={problem.finalAnswer} />
                  </p>
                </div>
              ))}

              <div className="mathlab-history__actions">
                <button
                  type="button"
                  className="mathlab-tab-action"
                  onClick={() => onOpen(solution)}
                >
                  <History className="h-3.5 w-3.5" />
                  Open in notebook
                </button>
                <button
                  type="button"
                  className={"mathlab-tab-action" + (copied === "plain" ? " is-active" : "")}
                  onClick={() => copy("plain")}
                >
                  {copied === "plain" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </button>
                <button
                  type="button"
                  className={"mathlab-tab-action" + (copied === "latex" ? " is-active" : "")}
                  onClick={() => copy("latex")}
                >
                  {copied === "latex" ? <Check className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                  Copy LaTeX
                </button>
                <button type="button" className="mathlab-tab-action" onClick={() => setPrinting(true)}>
                  <FileDown className="h-3.5 w-3.5" />
                  Export as PDF
                </button>
                <button
                  type="button"
                  className="mathlab-tab-action is-danger"
                  onClick={() => void remove({ solutionId: entry.id })}
                  aria-label="Delete this solved problem"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>

              <div className="mathlab-history__save">
                {notebooks.length === 0 ? (
                  <p className="mathlab-history__note">
                    You have no notebooks yet. Create one on the dashboard, then file a solution
                    into it from here.
                  </p>
                ) : (
                  <>
                    <select
                      value={picked}
                      onChange={(event) => setPicked(event.target.value)}
                      aria-label="Notebook to save this solution into"
                    >
                      <option value="">Choose a notebook…</option>
                      {notebooks.map((notebook) => (
                        <option key={notebook.id} value={notebook.id}>
                          {notebook.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="mathlab-tab-action"
                      onClick={() => void save()}
                      disabled={!picked || busy || savedTo === picked}
                    >
                      {busy ? (
                        <Loader2 className="spin-micro h-3.5 w-3.5" />
                      ) : (
                        <BookmarkPlus className="h-3.5 w-3.5" />
                      )}
                      {savedTo === picked && picked ? "Saved to notebook" : "Save to notebook"}
                    </button>
                  </>
                )}
              </div>
              {error ? <p className="mathlab-error">{error}</p> : null}
            </>
          ) : (
            <p className="mathlab-history__note">That entry is no longer in your history.</p>
          )}
        </div>
      ) : null}

      <PrintSheet
        solution={printing ? solution : null}
        meta={`${entry.track} · ${entry.chapterName} · solved ${stamp(entry.createdAt)}`}
        onDone={() => setPrinting(false)}
      />
    </li>
  );
}

export function MathHistory({
  onOpen,
}: {
  onOpen: (solution: { headline: string; problems: EngineProblem[] }) => void;
}) {
  const entries = useQuery(api.mathHistory.list);
  const summary = useQuery(api.mathHistory.mistakes);
  const notebooks = useQuery(api.notebooks.list);

  const notebookOptions = useMemo(
    () => (notebooks ?? []).map((notebook) => ({ id: notebook.id as string, name: notebook.name })),
    [notebooks],
  );

  return (
    <div className="mathlab-history">
      <header className="mathlab-history__head">
        <div>
          <p className="mathlab-card__kicker">History</p>
          <h2 className="mathlab-card__title">What you have worked through</h2>
          <p className="mathlab-history__blurb">
            Everything you solve while signed in is kept here. Nothing listed below is a sample:
            an empty history means you have not solved anything yet.
          </p>
        </div>
      </header>

      {entries === undefined ? (
        <p className="mathlab-history__loading">
          <Loader2 className="spin-micro h-3.5 w-3.5" />
          Loading your history…
        </p>
      ) : entries.length === 0 ? (
        <p className="mathlab-hint">
          No solved problems yet. Solve one in the notebook tab and it will appear here.
        </p>
      ) : (
        <ul className="mathlab-history__list">
          {entries.map((entry) => (
            <HistoryRow
              key={entry.id}
              entry={entry as HistoryEntry}
              notebooks={notebookOptions}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      <section className="mathlab-mistakes">
        <header className="mathlab-mistakes__head">
          <div>
            <p className="mathlab-card__kicker">Mistake summary</p>
            <h3 className="mathlab-card__title">The moves that keep catching you out</h3>
          </div>
          {summary && summary.total > 0 ? (
            <span className="mathlab-sheet__count">
              {summary.total} marked steps across {summary.attempts} problems
            </span>
          ) : null}
        </header>

        {summary === undefined ? (
          <p className="mathlab-history__loading">
            <Loader2 className="spin-micro h-3.5 w-3.5" />
            Checking your log…
          </p>
        ) : summary.entries.length === 0 ? (
          <p className="mathlab-history__note">
            Nothing here yet. Run Check my work on a solution and every step it marks wrong is
            logged here, grouped by the move that went wrong.
          </p>
        ) : (
          <ul className="mathlab-mistakes__list">
            {summary.entries.map((entry) => (
              <li key={`${entry.stepTitle}-${entry.rule}`} className="mathlab-mistakes__row">
                <span className="mathlab-mistakes__count">{entry.count}×</span>
                <div className="mathlab-mistakes__body">
                  <p className="mathlab-mistakes__title">
                    {entry.stepTitle}
                    {entry.rule ? (
                      <span className="mathlab-mistakes__rule"> · {entry.rule}</span>
                    ) : null}
                  </p>
                  {entry.note ? <p className="mathlab-mistakes__note">{entry.note}</p> : null}
                  <p className="mathlab-mistakes__meta">
                    <TriangleAlert className="h-3 w-3" />
                    Last seen {stamp(entry.lastAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default MathHistory;
