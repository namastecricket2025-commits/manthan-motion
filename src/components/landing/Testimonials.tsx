import { assignAvatarColors } from "@/components/shared/avatar-colors";
import { InitialAvatar } from "@/components/shared/InitialAvatar";
import { useSpotlight } from "@/components/landing/use-spotlight";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * What early testers said.
 *
 * The quotes are approved, consented rows in the database, and both surfaces
 * read them through `api.testimonials.approved` — the same public query the
 * average and the count come from. There is no review text, number of
 * reviewers or average rating in this file: if the owner removes a row, all
 * three change together on the next load.
 *
 * Display order is an editorial mix, not the database order: casual short
 * reviews and longer ones alternate, and the three 4-star quotes are spaced
 * out instead of arriving together. The list is only reordered here; nothing
 * is written back, so a new approved review is picked up automatically.
 *
 * Avatar colours are assigned on that final order by `assignAvatarColors`, so
 * no two cards within two positions of each other share a hue — including
 * across the carousel's wrap.
 */

const REMOVAL_MAILTO =
  "mailto:owner@manthan.app?subject=" +
  encodeURIComponent("Request removal of a review") +
  "&body=" +
  encodeURIComponent(
    "Please tell us which review you would like removed — the name shown on it and, if you can, the class label.",
  );

/** Canonical mix for the current quote sheet; unknown names follow in order. */
const DISPLAY_ORDER = [
  "Aarav",
  "Nidhi",
  "Reyansh",
  "Anavi",
  "Kavya",
  "Anshul",
  "Rishabh",
  "Dev",
  "Ananya",
  "Siya",
  "Vivaan",
];

type Review = {
  id: string;
  rating: number;
  text: string;
  displayName?: string;
  classLabel?: string;
};

function orderReviews(reviews: Review[]): Review[] {
  const rank = new Map(DISPLAY_ORDER.map((name, index) => [name, index]));
  return [...reviews].sort((a, b) => {
    const aRank = rank.get((a.displayName ?? "").trim());
    const bRank = rank.get((b.displayName ?? "").trim());
    if (aRank === undefined && bRank === undefined) return 0;
    if (aRank === undefined) return 1;
    if (bRank === undefined) return -1;
    return aRank - bRank;
  });
}

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

function ReviewCard({
  review,
  colorIndex,
}: {
  review: Review;
  colorIndex: number;
}) {
  return (
    <figure className="glass-panel card-surface spot-card flex h-full flex-col p-6">
      <Stars rating={review.rating} />
      <blockquote className="mt-4 flex-1 whitespace-pre-line text-[14px] leading-relaxed text-foreground/90">
        “{review.text}”
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-[var(--panel-line)] pt-4">
        <InitialAvatar name={review.displayName} size={44} colorIndex={colorIndex} />
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

function useCardsPerView() {
  const [perView, setPerView] = useState(() => {
    if (typeof window === "undefined") return 1;
    if (window.matchMedia("(min-width: 1024px)").matches) return 3;
    if (window.matchMedia("(min-width: 640px)").matches) return 2;
    return 1;
  });

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const tablet = window.matchMedia("(min-width: 640px)");
    const update = () =>
      setPerView(desktop.matches ? 3 : tablet.matches ? 2 : 1);
    update();
    desktop.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);

  return perView;
}

export default function Testimonials() {
  const data = useQuery(api.testimonials.approved);
  const sectionRef = useRef<HTMLElement | null>(null);
  useSpotlight(sectionRef);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const perView = useCardsPerView();
  const [activePage, setActivePage] = useState(0);

  const ordered = useMemo(() => orderReviews(data?.reviews ?? []), [data?.reviews]);
  const colors = useMemo(() => assignAvatarColors(ordered), [ordered]);
  const pages = Math.max(1, Math.ceil(ordered.length / perView));

  /** Width of one card plus the track gap. */
  const stepWidth = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    const first = track.firstElementChild as HTMLElement | null;
    if (!first) return track.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 16;
    return first.getBoundingClientRect().width + gap;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const step = stepWidth() * perView;
      const max = track.scrollWidth - track.clientWidth;
      // The final page is reached by a smaller-than-normal scroll (the last
      // page holds the leftover cards), so map "at the end" to the last dot
      // rather than letting rounding leave the last dot unreachable.
      const next =
        max > 0 && track.scrollLeft >= max - 2
          ? pages - 1
          : step > 0
            ? Math.round(track.scrollLeft / step)
            : 0;
      setActivePage(Math.min(pages - 1, Math.max(0, next)));
    };

    sync();
    track.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [pages, perView, stepWidth, ordered.length]);

  const goToPage = useCallback(
    (page: number) => {
      const track = trackRef.current;
      if (!track) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const max = track.scrollWidth - track.clientWidth;
      const left = Math.min(
        Math.max(0, max),
        Math.max(0, Math.min(pages - 1, page)) * stepWidth() * perView,
      );
      track.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
    },
    [pages, perView, stepWidth],
  );

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
            onClick={() => goToPage(activePage - 1)}
            disabled={activePage === 0}
            aria-label="Previous reviews"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-line)] text-text-dim transition-colors hover:border-[var(--panel-line-strong)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToPage(activePage + 1)}
            disabled={activePage >= pages - 1}
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
      ) : ordered.length === 0 ? (
        <p className="mt-10 text-sm text-text-dim">
          Reviews appear here once a tester has approved theirs for publishing.
        </p>
      ) : (
        <>
          <div
            key={perView}
            ref={trackRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Reviews from early testers"
            className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ordered.map((review, index) => (
              <div
                key={review.id}
                className="w-full shrink-0 snap-start md:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)]"
              >
                <ReviewCard review={review} colorIndex={colors[index] ?? 0} />
              </div>
            ))}
          </div>

          <div
            className="mt-6 flex items-center justify-center gap-2"
            aria-label="Review pages"
          >
            {Array.from({ length: pages }, (_, page) => (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                aria-label={`Go to reviews page ${page + 1}`}
                aria-current={activePage === page ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--signal)]",
                  activePage === page
                    ? "w-5 bg-[var(--signal)]"
                    : "w-1.5 bg-[color-mix(in_srgb,var(--text-main)_22%,transparent)] hover:bg-[color-mix(in_srgb,var(--text-main)_42%,transparent)]",
                )}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex justify-center">
        <RemovalLink />
      </div>
    </section>
  );
}

/**
 * The compact version for the pricing page: three quotes, preferring the
 * shortest ones, rotating gently so more of the short reviews get seen. The
 * pool is deliberately capped at the six shortest — a pricing page should not
 * carry the longest paragraphs.
 *
 * Avatar colours are recomputed for the three cards currently in view, in
 * their own order, so the strip never shows a repeated colour either.
 */
export function TestimonialStrip({ className }: { className?: string }) {
  const data = useQuery(api.testimonials.approved);
  const reduceMotion = useReducedMotion();
  const reviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);

  const pool = useMemo(() => {
    return [...reviews]
      .sort(
        (a, b) =>
          a.text.length - b.text.length ||
          a.rating - b.rating ||
          (a.displayName ?? "").localeCompare(b.displayName ?? ""),
      )
      .slice(0, Math.min(6, reviews.length));
  }, [reviews]);

  useEffect(() => {
    if (reduceMotion || paused || pool.length <= 3) return;
    const timer = window.setInterval(() => {
      setOffset((current) => current + 1);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [paused, pool.length, reduceMotion]);

  const visible = useMemo(() => {
    if (pool.length === 0) return [];
    const start = offset % pool.length;
    return Array.from(
      { length: Math.min(3, pool.length) },
      (_, index) => pool[(start + index) % pool.length]!,
    );
  }, [offset, pool]);

  const colors = useMemo(() => assignAvatarColors(visible), [visible]);

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

      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <motion.div
          key={visible.map((review) => review.id).join("-")}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mt-5 grid gap-4 md:grid-cols-3"
        >
          {visible.map((review, index) => (
            <figure
              key={review.id}
              className="glass-panel card-surface flex flex-col p-4"
            >
              <Stars rating={review.rating} size={12} />
              <blockquote className="mt-3 line-clamp-3 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground/85">
                “{review.text}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-2.5">
                <InitialAvatar
                  name={review.displayName}
                  size={32}
                  colorIndex={colors[index] ?? 0}
                />
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
        </motion.div>
      </div>

      <div className="mt-4 flex justify-end">
        <RemovalLink />
      </div>
    </section>
  );
}
