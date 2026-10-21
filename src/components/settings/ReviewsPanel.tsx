import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, EyeOff, MessageSquareQuote, Star, Trash2 } from "lucide-react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * The review queue — what students actually sent, and what the site is showing.
 *
 * A review used to disappear twice over: it was stored as `pending` behind a
 * moderation screen nobody opened, and the public query only read `approved`
 * rows. Consented reviews now go live on submit, which makes this panel the
 * place to *see* them rather than the only way to publish them: every row is
 * here with its real status, so a bad one can be hidden or deleted, and a
 * private one stays private.
 *
 * Only the owner/moderator sees this. `ownerOverview` answers
 * `{ moderator: false }` for everyone else, and the whole panel is then not
 * rendered — no empty shell, no hint that a queue exists.
 */
export function ReviewsPanel() {
  const overview = useQuery(api.testimonials.ownerOverview);
  const approve = useMutation(api.testimonials.approve);
  const reject = useMutation(api.testimonials.reject);
  const remove = useMutation(api.testimonials.removeReview);

  if (!overview?.moderator) return null;

  const { counts, reviews, averageRating } = overview;

  const act = async (
    run: () => Promise<unknown>,
    message: string,
    description: string,
  ) => {
    try {
      await run();
      toast.success(message, { description });
    } catch (error) {
      toast.error("Could not update the review", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <AccordionItem id="set-panel-reviews" value="reviews" className="set-item">
      <AccordionTrigger className="set-trigger">
        <span className="set-panel-title">
          <span className="set-panel-title__icon">
            <MessageSquareQuote className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="set-panel-title__text">Reviews</span>
            <span className="set-panel-title__blurb">
              What students sent, and what the homepage is showing
            </span>
          </span>
        </span>
      </AccordionTrigger>

      <AccordionContent className="set-content">
        <div className="set-group">
          <div className="set-card">
            <div className="set-card__head">
              <Star className="h-3.5 w-3.5" />
              Review queue
            </div>

            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-xs text-text-dim">
              <span>
                <span className="font-semibold text-foreground">
                  {counts.approved}
                </span>{" "}
                live
              </span>
              <span>
                <span className="font-semibold text-foreground">
                  {counts.pending}
                </span>{" "}
                private
              </span>
              <span>
                <span className="font-semibold text-foreground">
                  {counts.rejected}
                </span>{" "}
                hidden
              </span>
              <span className="tabular-nums">
                {averageRating > 0 ? `${averageRating} average` : "No rating yet"}
              </span>
            </div>

            <p className="mt-2 text-[11.5px] leading-relaxed text-text-dim">
              A review with consent goes live the moment it is posted and appears
              in the homepage carousel. Hidden reviews stay in the database but
              are never shown. Deleting removes the row and the count moves with
              it.
            </p>

            {reviews.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--card-border)] px-4 py-6 text-center text-xs text-text-dim">
                Nothing has come in yet. The /feedback page and the in-app prompt
                both land here.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {reviews.map((review) => {
                  const live =
                    review.status === "approved" && review.consentToPublish;
                  const label = live
                    ? "Live"
                    : review.status === "rejected"
                      ? "Hidden"
                      : review.consentToPublish
                        ? "Approved"
                        : "Private";
                  return (
                    <li
                      key={review.id}
                      className="rounded-xl border border-[var(--card-border)] px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13px] font-semibold text-foreground">
                          {review.displayName || "Anonymous"}
                        </span>
                        {review.classLabel ? (
                          <span className="text-[11px] text-text-dim">
                            {review.classLabel}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-0.5 text-[var(--signal)]">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className="h-3 w-3"
                              fill={n <= review.rating ? "currentColor" : "none"}
                              strokeWidth={1.5}
                            />
                          ))}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em]",
                            live
                              ? "border-[color-mix(in_srgb,var(--signal)_45%,transparent)] text-[var(--signal)]"
                              : "border-[var(--card-border)] text-text-dim",
                          )}
                        >
                          {label}
                        </span>
                        <span className="text-[10px] text-text-dim">
                          {review.source === "early_tester"
                            ? "Early tester"
                            : "Student"}
                        </span>
                        <span className="ml-auto text-[10px] tabular-nums text-text-dim">
                          {new Date(review.createdAt).toLocaleDateString([], {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {review.text ? (
                        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-dim">
                          {review.text}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {review.status !== "approved" ? (
                          <button
                            type="button"
                            disabled={!review.consentToPublish}
                            title={
                              review.consentToPublish
                                ? undefined
                                : "The student did not agree to publish this."
                            }
                            onClick={() =>
                              act(
                                () => approve({ id: review.id }),
                                "Review approved",
                                review.consentToPublish
                                  ? "It is on the homepage now."
                                  : "It stays private until the student consents.",
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              act(
                                () => reject({ id: review.id }),
                                "Review hidden",
                                "It no longer appears on the homepage.",
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:text-foreground"
                          >
                            <EyeOff className="h-3 w-3" />
                            Hide
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            act(
                              () => remove({ id: review.id }),
                              "Review deleted",
                              "The row and its rating are gone.",
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:text-[var(--destructive)]"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                        {!review.consentToPublish ? (
                          <span className="text-[10px] text-text-dim">
                            No consent — stays private
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-3 text-[10.5px] leading-relaxed text-text-dim">
              Newest first. The stars and the average on the homepage are
              computed from the live rows, never typed in.
            </p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default ReviewsPanel;
