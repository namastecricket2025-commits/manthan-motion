import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ImageUp,
  Loader2,
  PenLine,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { InlineMath } from "@/components/mathlab/parts";
import { enhancePhotoToFile } from "@/lib/enhance-photo";

/**
 * Step marking.
 *
 * The student writes a solution the way they would on paper, one line per
 * step, and an examiner marks each line against a scheme with the marks
 * printed beside it. The total is recomputed from the parts on the server, so
 * the score on the page always agrees with the rows underneath it.
 */

type MarkedStep = {
  title: string;
  marks: number;
  awarded: number;
  note: string;
};

type MarkResult = {
  steps: MarkedStep[];
  total: number;
  awarded: number;
  summary: string;
  correctedWorking: string;
};

export function MarkSteps({
  gradeId,
  track,
  chapterName,
  defaultQuestion,
}: {
  gradeId: string;
  track: string;
  chapterName: string;
  defaultQuestion: string;
}) {
  const mark = useAction(api.mathTutor.markSteps);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);

  const [question, setQuestion] = useState(defaultQuestion);
  const [working, setWorking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarkResult | null>(null);
  const [photo, setPhoto] = useState<{
    storageId: Id<"_storage">;
    name: string;
    mime: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [touchCamera, setTouchCamera] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* `capture` on a file input is how a phone opens the rear camera. On a
     desktop the attribute is ignored and the same input becomes a second,
     identical file picker — a button that promises a camera and opens a
     folder. So the camera button is only rendered on a coarse pointer; the
     upload button is always there, because a tablet with a camera still needs
     the photo library. */
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const sync = () => setTouchCamera(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  /** Two inputs, on purpose: `capture` opens the camera on a phone but can
   *  hide the photo library, so the gallery/file route is a separate control. */
  const attach = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const upload = await enhancePhotoToFile(file);
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": upload.type || "application/octet-stream" },
          body: upload,
        });
        if (!response.ok) throw new Error(`The upload was refused (${response.status}).`);
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        setPhoto({ storageId, name: upload.name, mime: upload.type });
      } catch {
        setError("That page did not upload. Try a smaller photo, or type the working below.");
      } finally {
        setUploading(false);
      }
    },
    [generateUploadUrl],
  );

  const submit = async () => {
    if (busy || uploading) return;
    if (working.trim().length < 3 && !photo) {
      setError("Write or photograph your working first — one step per line is easiest to mark.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const reply = await mark({
        problem: question.trim(),
        working,
        gradeLabel: gradeId,
        track,
        chapterName,
        storageId: photo?.storageId,
        name: photo?.name,
        mime: photo?.mime,
      });
      setResult(reply);
      setPhoto(null);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The marker could not reach a model just now. Try again in a minute.",
      );
    } finally {
      setBusy(false);
    }
  };

  const percentage = result && result.total > 0 ? (result.awarded / result.total) * 100 : 0;

  return (
    <div className="marks">
      <header className="marks__head">
        <div>
          <p className="mathlab-card__kicker">Step marking</p>
          <h3 className="marks__title">Write it out, get it marked like a paper</h3>
          <p className="marks__sub">
            An examiner builds the marking scheme for the question, then awards
            each line you wrote against it — including where the method is right
            and the arithmetic is not.
          </p>
        </div>
        <span className="marks__context">
          Class {gradeId} · {chapterName}
        </span>
      </header>

      <div className="marks__grid">
        <label className="marks__field">
          <span>Question</span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="The question you are answering"
            aria-label="Question being marked"
          />
        </label>

        <div className="marks__field marks__field--working">
          <span>Your working</span>
          <textarea
            value={working}
            onChange={(event) => setWorking(event.target.value)}
            placeholder={"Write one step per line, as you would on paper.\nFor example:\na = 1, b = −5, c = 6\nD = b² − 4ac = 25 − 24 = 1"}
            rows={7}
            aria-label="Your written working"
          />
          <div className="marks__attach">
            {touchCamera ? (
              <button
                type="button"
                className="marks__attachbtn"
                onClick={() => cameraRef.current?.click()}
                disabled={uploading || busy}
              >
                <Camera className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : "Take a photo"}
              </button>
            ) : null}
            <button
              type="button"
              className="marks__attachbtn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || busy}
            >
              <ImageUp className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : touchCamera ? "Upload a page" : "Upload a photo or scan"}
            </button>
            <span className="marks__attachhint">
              {photo
                ? "One page attached — the examiner will mark what is written on it."
                : touchCamera
                  ? "The first button opens the camera; either accepts JPG, PNG or HEIC."
                  : "A photo, scan or screenshot works — JPG, PNG or HEIC."}
            </span>
            {photo ? (
              <button
                type="button"
                className="marks__removephoto"
                onClick={() => setPhoto(null)}
                aria-label={`Remove ${photo.name}`}
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void attach(event.target.files?.[0] ?? undefined);
              event.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={(event) => {
              void attach(event.target.files?.[0] ?? undefined);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="mathlab-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="marks__actions">
        <button
          type="button"
          className="mathlab-solve marks__submit"
          onClick={() => void submit()}
          disabled={busy || uploading || (working.trim().length < 3 && !photo)}
        >
          {busy ? <Loader2 className="spin-micro h-4 w-4" /> : <PenLine className="h-4 w-4" />}
          {busy ? "Marking…" : "Mark my working"}
        </button>
        <span className="marks__hint">
          Equations can be typed plainly — x², √, fractions like 2/3 all read fine.
        </span>
      </div>

      {result ? (
        <section className="marks__result" aria-live="polite">
          <header className="marks__scorehead">
            <div className="marks__score">
              <span className="marks__scorenum">{result.awarded}</span>
              <span className="marks__scoreof">/ {result.total}</span>
            </div>
            <div className="marks__scoremeta">
              <p className="marks__summary">{result.summary}</p>
              <div
                className="marks__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={result.total}
                aria-valuenow={result.awarded}
                aria-label="Marks awarded"
              >
                <span style={{ width: `${percentage}%` }} />
              </div>
            </div>
          </header>

          <ol className="marks__steps">
            {result.steps.map((step, index) => (
              <li
                key={`${index}-${step.title}`}
                className={
                  "marks__step" +
                  (step.awarded === step.marks
                    ? " is-full"
                    : step.awarded > 0
                      ? " is-part"
                      : " is-none")
                }
              >
                <span className="marks__stepnum" aria-hidden>
                  {index + 1}
                </span>
                <div className="marks__stepbody">
                  <div className="marks__steptop">
                    <span className="marks__steptitle">{step.title}</span>
                    <span className="marks__stepmarks">
                      {step.awarded}
                      <span aria-hidden> / </span>
                      {step.marks}
                    </span>
                  </div>
                  {step.note ? (
                    <p className="marks__stepnote">
                      <InlineMath text={step.note} />
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {result.correctedWorking ? (
            <details className="marks__corrected">
              <summary>The full correct solution</summary>
              <pre>{result.correctedWorking}</pre>
            </details>
          ) : null}

          <div className="marks__resultactions">
            <button
              type="button"
              className="mathlab-chip"
              onClick={() => {
                setWorking("");
                setPhoto(null);
                setResult(null);
                setError(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try the same question again
            </button>
            <button
              type="button"
              className="hunt__quiet"
              onClick={() => {
                setResult(null);
                setWorking("");
                setPhoto(null);
                setQuestion("");
                setError(null);
              }}
            >
              <Check className="h-3.5 w-3.5" />
              New question
            </button>
          </div>
        </section>
      ) : (
        !busy && (
          <p className="marks__empty">
            <TriangleAlert className="h-3.5 w-3.5" />
            Marks are awarded for the lines you actually write, so a blank step
            earns nothing — that is the point.
          </p>
        )
      )}
    </div>
  );
}

export default MarkSteps;
