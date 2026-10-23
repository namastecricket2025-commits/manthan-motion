import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MindmapView } from "@/components/dashboard/MindmapView";
import type {
  FlashcardsPayload,
  MindmapPayload,
  QuizPayload,
  SlidesPayload,
  SummaryPayload,
} from "@/components/dashboard/MaterialViews";

/**
 * The paper version of a generated sheet.
 *
 * Printing the dashboard itself never worked: the app around the sheet is a
 * dark, scrollable, fixed-height layout, and `visibility: hidden` kept all of
 * that layout in the document, so the printer produced three or four blank
 * pages before the sheet and split diagrams across page frames. This component
 * renders a separate, white document outside the app root — the app is
 * `display: none` while the dialog is open — with normal block flow, real page
 * breaks between slides, and cards that are never cut in half.
 *
 * It is mounted only when the student clicks Print, and unmounted when the
 * dialog closes. On screen it is hidden by CSS; in print it is the only thing
 * on the page.
 */

export type PrintKind = "summary" | "flashcards" | "quiz" | "mindmap" | "slides";

const KIND_LABEL: Record<PrintKind, string> = {
  summary: "Summary",
  flashcards: "Flashcards",
  quiz: "Quiz",
  mindmap: "Mind map",
  slides: "Slides",
};

function isPrintKind(value: string): value is PrintKind {
  return value in KIND_LABEL;
}

export function MaterialPrint({
  kind,
  payload,
  title,
  notebookName,
  sourceCount,
  createdAt,
  topicLine,
  onDone,
}: {
  kind: string;
  payload: unknown;
  title: string;
  notebookName?: string;
  sourceCount?: number;
  createdAt?: number;
  /** The chapter or subject the sheet was made from, if known. */
  topicLine?: string;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let cancelled = false;
    let finished = false;
    const cleanup = () => {
      if (finished || cancelled) return;
      finished = true;
      document.body.classList.remove("material-printing");
      doneRef.current();
    };

    const run = async () => {
      // Let the browser lay out the document and load the display font before
      // opening the dialog; a print taken mid-layout is how a page ends up
      // blank.
      try {
        await document.fonts?.ready;
      } catch {
        /* Font loading is a nicety here, not a requirement. */
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (cancelled) return;
      document.body.classList.add("material-printing");
      window.addEventListener("afterprint", cleanup, { once: true });
      // One frame with the sheet in layout before the snapshot: the sheet was
      // `display: none` until the class landed, and printing a document whose
      // first layout pass has not happened is how a page prints empty.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (cancelled || !document.body.classList.contains("material-printing")) return;
      window.print();
      // Safari does not always fire `afterprint`; never leave the app hidden.
      window.setTimeout(cleanup, 1500);
    };

    void run();
    return () => {
      cancelled = true;
      document.body.classList.remove("material-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    // Mounted once per print request; `onDone` is read through the ref so a
    // live-query re-render cannot open the dialog a second time. StrictMode's
    // first pass is cancelled by its own cleanup before the dialog opens, so
    // the second pass is the one that prints.
  }, []);

  const date = createdAt
    ? new Date(createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return createPortal(
    <div className="material-print-root" data-print-kind={kind}>
      <header className="print-sheet-head">
        <p className="print-brand">Manthan</p>
        <h1 className="print-sheet-title">{title}</h1>
        <p className="print-meta">
          {[
            isPrintKind(kind) ? KIND_LABEL[kind] : "Study sheet",
            notebookName,
            sourceCount && sourceCount > 0
              ? `${sourceCount} source${sourceCount === 1 ? "" : "s"}`
              : null,
            topicLine,
            date,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {kind === "summary" ? (
        <SummaryPrint payload={payload as SummaryPayload} />
      ) : null}
      {kind === "flashcards" ? (
        <FlashcardsPrint payload={payload as FlashcardsPayload} />
      ) : null}
      {kind === "quiz" ? <QuizPrint payload={payload as QuizPayload} /> : null}
      {kind === "mindmap" ? <MindmapPrint payload={payload as MindmapPayload} /> : null}
      {kind === "slides" ? (
        <SlidesPrint payload={payload as SlidesPayload} />
      ) : null}

      <footer className="print-footer">
        Made with Manthan — study material generated from your own sources.
      </footer>
    </div>,
    document.body,
  );
}

function SummaryPrint({ payload }: { payload: SummaryPayload }) {
  return (
    <div>
      <p className="print-lead">{payload.overview}</p>
      {payload.sections.map((section, index) => (
        <section className="print-block" key={`${section.heading}-${index}`}>
          <h2 className="print-heading">
            <span className="print-ordinal">
              {String(index + 1).padStart(2, "0")}
            </span>
            {section.heading}
          </h2>
          <ul className="print-list">
            {section.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          {section.source ? (
            <p className="print-source">Source: {section.source}</p>
          ) : null}
        </section>
      ))}
      {payload.keyTerms && payload.keyTerms.length > 0 ? (
        <section className="print-block">
          <h2 className="print-heading">Key terms</h2>
          <dl className="print-terms">
            {payload.keyTerms.map((entry) => (
              <div className="print-term" key={entry.term}>
                <dt>{entry.term}</dt>
                <dd>{entry.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function FlashcardsPrint({ payload }: { payload: FlashcardsPayload }) {
  return (
    <div className="print-card-grid">
      {payload.cards.map((card, index) => (
        <article className="print-card" key={`${card.front}-${index}`}>
          <p className="print-card-index">Card {index + 1}</p>
          <p className="print-card-front">{card.front}</p>
          <p className="print-card-back">{card.back}</p>
          {card.source ? (
            <p className="print-source">Source: {card.source}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function QuizPrint({ payload }: { payload: QuizPayload }) {
  return (
    <div>
      <ol className="print-questions">
        {payload.questions.map((question, index) => (
          <li className="print-question" key={`${question.question}-${index}`}>
            <p className="print-question-text">{question.question}</p>
            <ol className="print-options" type="A">
              {question.options.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      <div className="print-page-break" />
      <h2 className="print-heading">Answer key</h2>
      <div className="print-answer-key">
        {payload.questions.map((question, index) => (
          <p key={`answer-${index}`}>
            <strong>{index + 1}.</strong>{" "}
            {question.options[question.answer] ?? "—"}
            {question.explanation ? ` — ${question.explanation}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}

function MindmapPrint({ payload }: { payload: MindmapPayload }) {
  return (
    <div className="print-mindmap">
      <MindmapView payload={payload} />
    </div>
  );
}

function SlidesPrint({ payload }: { payload: SlidesPayload }) {
  return (
    <div>
      {payload.subtitle ? (
        <p className="print-lead">{payload.subtitle}</p>
      ) : null}
      {payload.slides.map((slide, index) => (
        <section className="print-slide" key={`${slide.title}-${index}`}>
          <p className="print-slide-number">
            Slide {index + 1} of {payload.slides.length}
          </p>
          <h2 className="print-heading">{slide.title}</h2>
          <ul className="print-list">
            {slide.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          {slide.notes ? (
            <p className="print-notes">Speaker note — {slide.notes}</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export default MaterialPrint;
