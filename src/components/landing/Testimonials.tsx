import { InitialAvatar } from "@/components/shared/InitialAvatar";
import { useSpotlight } from "@/components/landing/use-spotlight";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What early testers said.
 *
 * The six seeded quotes are approved, consented rows in the database, and the
 * carousel reads them through `api.testimonials.approved` — the same public
 * query the average and the count come from. There is no review text, number
 * of reviewers or average rating in this file: if the owner removes a row, all
 * three change together on the next load.
 *
 * The removal link is deliberately beside the quotes rather than buried in the
 * footer, because that is where someone reading their own words would look.
 */

const REMOVAL_MAILTO =
  "mailto:owner@manthan.app?subject=" +
  encodeURIComponent("Request removal of a review") +
  "&body=" +
  encodeURIComponent(
    "Please tell us which review you would like removed — the name shown on it and, if you can, the class label.",
  );

type Review = {
  id: string;
  rating: number;
  text: string;
  displayName?: string;
  classLabel?: string;
};

function Stars({
  rating,
  size = 13,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const filled = Math.round(rating);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          strokeWidth={1.6}
          className={n <= filled ? "text-[var(--brand-ink)]" : "text-text-dim/35"}
          fill={n <= filled ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="glass-panel card-surface spot-card flex h-full flex-col p-6">
      <Stars rating={review.rating} />
      <blockquote className="mt-4 flex-1 text-[14px] leading-relaxed text-foreground/90">
        “{review.text}”
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-[var(--panel-line)] pt-4">
        <InitialAvatar name={review.displayName} size={44} />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
            {review.displayName?.trim() || "Manthan student"}
          </p>
          {review.classLabel ? (
            <p className="mt-0.5 text-xs text-text-dim">{review.classLabel}</p>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}

function RemovalLink() {
  return (
    <a
      href={REMOVAL_MAILTO}
      className="text-xs text-text-dim underline decoration-[var(--panel-line)] underline-offset-4 transition-colors hover:text-foreground"
    >
      Request removal of a review
    </a>
  );
}

export default function Testimonials() {
  const data = useQuery(api.testimonials.approved);
  const sectionRef = useRef<HTMLElement | null>(null);
  useSpotlight(sectionRef);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const syncEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    syncEdges();
    track.addEventListener("scroll", syncEdges, { passive: true });
    const observer = new ResizeObserver(syncEdges);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges, data?.reviews.length]);

  const page = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: direction * Math.round(track.clientWidth * 0.9),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const reviews: Review[] = data?.reviews ?? [];

  return (
    <section
      id="reviews"
      ref={sectionRef}
      aria-labelledby="reviews-title"
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 md:py-24"
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2
            id="reviews-title"
            className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px] md:text-[46px]"
          >
            From our <span className="gradient-text">early testers</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-dim">
            Students who used Manthan before launch — quoted exactly as they
            wrote it, with only their first name and class.
          </p>

          {data && data.count > 0 ? (
            <p className="mt-5 flex flex-wrap items-center gap-2.5 text-sm text-text-dim">
              <Stars rating={data.averageRating} size={15} />
              <span className="font-medium text-foreground">
                {data.averageRating.toFixed(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {data.count} {data.count === 1 ? "review" : "reviews"}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={!canPrev}
            aria-label="Previous reviews"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-line)] text-text-dim transition-colors hover:border-[var(--panel-line-strong)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={!canNext}
            aria-label="Next reviews"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-line)] text-text-dim transition-colors hover:border-[var(--panel-line-strong)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {data === undefined ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="glass-panel card-surface h-64 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="mt-10 text-sm text-text-dim">
          Reviews appear here once a tester has approved theirs for publishing.
        </p>
      ) : (
        <div
          ref={trackRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Reviews from early testers"
          className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {reviews.map((review) => (
            <div
              key={review.id}
              className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]"
            >
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <RemovalLink />
      </div>
    </section>
  );
}

/**
 * The compact version for the pricing page: three quotes, no carousel.
 * Same query, same rows, same live average — the strip just picks the first
 * three and trims each quote to three lines.
 */
export function TestimonialStrip({ className }: { className?: string }) {
  const data = useQuery(api.testimonials.approved);
  const reviews: Review[] = (data?.reviews ?? []).slice(0, 3);

  if (!data || reviews.length === 0) return null;

  return (
    <section
      aria-labelledby="pricing-reviews-title"
      className={cn("mt-16", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="pricing-reviews-title"
          className="font-display text-base font-semibold tracking-tight text-foreground"
        >
          From our early testers
        </h2>
        <p className="flex items-center gap-2 text-xs text-text-dim">
          <Stars rating={data.averageRating} size={12} />
          <span className="font-medium text-foreground">
            {data.averageRating.toFixed(1)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {data.count} {data.count === 1 ? "review" : "reviews"}
          </span>
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {reviews.map((review) => (
          <figure
            key={review.id}
            className="glass-panel card-surface flex flex-col p-4"
          >
            <Stars rating={review.rating} size={12} />
            <blockquote className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-foreground/85">
              “{review.text}”
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-2.5">
              <InitialAvatar name={review.displayName} size={32} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {review.displayName?.trim() || "Manthan student"}
                </p>
                {review.classLabel ? (
                  <p className="text-[11px] text-text-dim">{review.classLabel}</p>
                ) : null}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <RemovalLink />
      </div>
    </section>
  );
}
