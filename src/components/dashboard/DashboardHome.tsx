import { api } from "@/convex/_generated/api";
import { useSettings } from "@/components/settings/SettingsProvider";
import type {
  DashboardNotebook,
  DashboardSummary,
  WorkspaceTarget,
} from "@/components/dashboard/DashboardOverview";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Layers,
  Mic,
  NotebookPen,
  Plus,
  Repeat,
  Sigma,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link } from "react-router";
import "./mobile-home.css";

/**
 * The signed-in home for a phone.
 *
 * The dashboard is excellent as an instrument panel, but on a phone it read
 * as a long report. This surface leads with the one notebook worth returning
 * to, then the four things a student might actually do next, then the small
 * retrieval tools. Analytics only appear when the student chose them during
 * onboarding or in Settings, and even then they are a quiet readout rather
 * than the page's subject.
 */
export function DashboardHome({
  summary,
  notebooks,
  onOpenNotebook,
  onOpenNotebooks,
  onCreateNotebook,
  onOpenMathLab,
  onOpenStemLab,
}: {
  summary: DashboardSummary | undefined;
  notebooks: DashboardNotebook[];
  onOpenNotebook: (notebookId: string, target?: WorkspaceTarget) => void;
  onOpenNotebooks: () => void;
  onCreateNotebook: () => void;
  onOpenMathLab: () => void;
  onOpenStemLab: () => void;
}) {
  const { settings } = useSettings();
  const review = useQuery(api.review.summary);
  const focus = settings.homeFocus;

  const resume = [...notebooks].sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt,
  )[0];

  const week = summary?.materialsByDay ?? [];
  const weekMax = Math.max(
    1,
    ...week.map((day, index) => {
      const materials =
        day.summary + day.flashcards + day.quiz + day.mindmap + day.slides;
      return Math.max(materials, summary?.byDay?.[index]?.count ?? 0);
    }),
  );

  const openResume = () => {
    if (resume) onOpenNotebook(resume.id);
    else onCreateNotebook();
  };

  return (
    <div className="mhome">
      <section className="mhome-hero" aria-label="Continue studying">
        <span className="mhome-hero__wash" aria-hidden="true" />
        <p className="mhome-eyebrow">
          <Sparkles className="h-3.5 w-3.5" />
          {resume ? "Pick up where you left off" : "Start your workspace"}
        </p>
        <h2 className="mhome-hero__title">
          {resume ? resume.name : "One notebook for what you're revising."}
        </h2>
        <p className="mhome-hero__copy">
          {resume
            ? `${resume.sourceCount} source${resume.sourceCount === 1 ? "" : "s"} · ${resume.materialCount} study item${resume.materialCount === 1 ? "" : "s"} ready.`
            : "Name it after a chapter. Add a PDF, a photo or a link. Manthan turns it into notes, cards and questions you can use."}
        </p>
        <button
          type="button"
          className="mhome-hero__button"
          onClick={openResume}
        >
          {resume ? (
            <>
              <BookOpen className="h-4 w-4" />
              Open notebook
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Make a notebook
            </>
          )}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <section className="mhome-actions" aria-label="Start something">
        <button type="button" onClick={onCreateNotebook} className="mhome-action">
          <span className="mhome-action__icon" data-tone="coral" aria-hidden="true">
            <Plus className="h-[18px] w-[18px]" />
          </span>
          <span className="mhome-action__text">
            <span className="mhome-action__title">New notebook</span>
            <span className="mhome-action__hint">From a chapter</span>
          </span>
        </button>
        <button type="button" onClick={onOpenMathLab} className="mhome-action">
          <span className="mhome-action__icon" data-tone="teal" aria-hidden="true">
            <Sigma className="h-[18px] w-[18px]" />
          </span>
          <span className="mhome-action__text">
            <span className="mhome-action__title">Math Lab</span>
            <span className="mhome-action__hint">Solve a problem</span>
          </span>
        </button>
        <button type="button" onClick={onOpenStemLab} className="mhome-action">
          <span className="mhome-action__icon" data-tone="plum" aria-hidden="true">
            <FlaskConical className="h-[18px] w-[18px]" />
          </span>
          <span className="mhome-action__text">
            <span className="mhome-action__title">STEM Lab</span>
            <span className="mhome-action__hint">Run an experiment</span>
          </span>
        </button>
        <button type="button" onClick={openResume} className="mhome-action">
          <span className="mhome-action__icon" data-tone="olive" aria-hidden="true">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <span className="mhome-action__text">
            <span className="mhome-action__title">Ask a notebook</span>
            <span className="mhome-action__hint">Get a straight answer</span>
          </span>
        </button>
      </section>

      <section className="mhome-section" aria-label="Study next">
        <div className="mhome-section__head">
          <div>
            <p className="mhome-kicker">Study next</p>
            <h3 className="mhome-section__title">Small loops that make it stick.</h3>
          </div>
        </div>
        <div className="mhome-tools">
          <Link to="/review" className="mhome-tool">
            <span className="mhome-tool__icon" data-tone="teal">
              <Repeat className="h-4 w-4" />
            </span>
            <span className="mhome-tool__text">
              <span className="mhome-tool__title">Daily review</span>
              <span className="mhome-tool__hint">
                {review && review.due > 0
                  ? `${review.due} card${review.due === 1 ? "" : "s"} due now`
                  : "A short retrieval queue"}
              </span>
            </span>
            <ChevronRight className="mhome-chevron h-4 w-4" />
          </Link>
          <Link to="/exam" className="mhome-tool">
            <span className="mhome-tool__icon" data-tone="coral">
              <ClipboardCheck className="h-4 w-4" />
            </span>
            <span className="mhome-tool__text">
              <span className="mhome-tool__title">Mock exam</span>
              <span className="mhome-tool__hint">A timed paper, marked</span>
            </span>
            <ChevronRight className="mhome-chevron h-4 w-4" />
          </Link>
          <Link to="/viva" className="mhome-tool">
            <span className="mhome-tool__icon" data-tone="plum">
              <Mic className="h-4 w-4" />
            </span>
            <span className="mhome-tool__text">
              <span className="mhome-tool__title">Voice viva</span>
              <span className="mhome-tool__hint">Explain it out loud</span>
            </span>
            <ChevronRight className="mhome-chevron h-4 w-4" />
          </Link>
        </div>
      </section>

      {focus !== "minimal" && notebooks.length > 0 ? (
        <section className="mhome-section" aria-label="Your notebooks">
          <div className="mhome-section__head">
            <div>
              <p className="mhome-kicker">Your notebooks</p>
              <h3 className="mhome-section__title">
                {notebooks.length === 1
                  ? "One place to keep the thread."
                  : `${notebooks.length} places to keep the thread.`}
              </h3>
            </div>
            <button
              type="button"
              onClick={onOpenNotebooks}
              className="mhome-text-action"
            >
              See all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mhome-shelf">
            {notebooks.slice(0, 6).map((notebook, index) => (
              <button
                key={notebook.id}
                type="button"
                className="mhome-notebook"
                data-tone={["coral", "teal", "plum", "olive"][index % 4]}
                onClick={() => onOpenNotebook(notebook.id)}
              >
                <span className="mhome-notebook__topline">
                  <NotebookPen className="h-4 w-4" />
                  <span>{notebookStatusLabel(notebook)}</span>
                </span>
                <span className="mhome-notebook__name">{notebook.name}</span>
                <span className="mhome-notebook__meta">
                  <Layers className="h-3 w-3" />
                  {notebook.sourceCount} source{notebook.sourceCount === 1 ? "" : "s"}
                  <span aria-hidden="true">·</span>
                  {notebook.materialCount} item{notebook.materialCount === 1 ? "" : "s"}
                </span>
                <span className="mhome-notebook__open">
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {focus !== "minimal" && summary ? (
        <section className="mhome-week" aria-label="This week">
          <div className="mhome-week__head">
            <div>
              <p className="mhome-kicker">This week</p>
              <h3 className="mhome-section__title">A quiet look at the work.</h3>
            </div>
            <span className="mhome-week__badge">
              {summary.materialsThisWeek + summary.addedThisWeek} actions
            </span>
          </div>
          <div className="mhome-week__bars" aria-hidden="true">
            {week.map((day, index) => {
              const materials =
                day.summary +
                day.flashcards +
                day.quiz +
                day.mindmap +
                day.slides;
              const sources = summary.byDay?.[index]?.count ?? 0;
              return (
                <span key={day.day} className="mhome-week__day">
                  <span className="mhome-week__pair">
                    <span
                      className="mhome-week__bar"
                      data-tone="coral"
                      style={{
                        height: `${Math.max(4, (materials / weekMax) * 100)}%`,
                      }}
                    />
                    <span
                      className="mhome-week__bar"
                      data-tone="teal"
                      style={{
                        height: `${Math.max(4, (sources / weekMax) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="mhome-week__label">{day.label}</span>
                </span>
              );
            })}
          </div>
          <div className="mhome-week__stats">
            <span>
              <strong>{summary.materialsThisWeek}</strong> study items
            </span>
            <span>
              <strong>{summary.addedThisWeek}</strong> sources
            </span>
            <span>
              <strong>{summary.notebookCount}</strong> notebooks
            </span>
          </div>
        </section>
      ) : null}

      {focus === "everything" && summary?.recent.length ? (
        <section className="mhome-section" aria-label="Recent activity">
          <div className="mhome-section__head">
            <div>
              <p className="mhome-kicker">Recently</p>
              <h3 className="mhome-section__title">The last few moves.</h3>
            </div>
          </div>
          <div className="mhome-recent">
            {summary.recent.slice(0, 3).map((event) => (
              <button
                key={event.id}
                type="button"
                className="mhome-recent__row"
                onClick={() => onOpenNotebook(event.notebookId)}
              >
                <span className="mhome-recent__dot" aria-hidden="true" />
                <span className="mhome-recent__text">
                  <span>{event.label}</span>
                  <span>{event.notebook}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!resume && notebooks.length === 0 ? (
        <p className="mhome-footnote">
          <Upload className="h-3.5 w-3.5" />
          You can add PDFs, photos, links or typed notes once a notebook exists.
        </p>
      ) : null}
    </div>
  );
}

function notebookStatusLabel(notebook: DashboardNotebook) {
  if (notebook.materialCount > 0) return "Study kit ready";
  if (notebook.sourceCount > 0) return "Sources in";
  return "Empty · ready for a first source";
}

export default DashboardHome;
