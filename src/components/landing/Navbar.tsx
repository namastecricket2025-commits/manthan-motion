import { useAuth } from "@/hooks/use-auth";
import { openCommandPalette } from "@/components/shared/CommandPalette";
import { TransitionLink } from "@/components/shared/TransitionLink";
import { useViewTransitionNavigate } from "@/lib/view-transitions";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { MovingBorderButton } from "./MovingBorderButton";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The site header.
 *
 * One full-width bar pinned to the top of every page: hairline bottom edge,
 * a 72%-opaque canvas behind it with a blur (the one place a blur still earns
 * its cost — content scrolling underneath stays legible), the mark on the
 * left, plain TEXT links in the middle and the actions on the right, with the
 * primary action as a filled pill.
 *
 * This replaced a floating magnifying icon-dock in a glass capsule. That dock
 * was a lot of machinery — a pointer-proximity magnifier, tooltips, an icon
 * grid — to express five links, and an icon-only nav makes a visitor hover to
 * find out where anything goes. Text links are what a product site uses, and
 * they are unambiguous at a glance.
 *
 * Below md the links collapse into MobileMenu; the theme toggle and the CTA
 * stay put at every width.
 */

const LINKS: { label: string; to: string }[] = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Math Lab", to: "/math-lab" },
  { label: "STEM Lab", to: "/lab" },
  { label: "Plans", to: "/pricing" },
  { label: "Feedback", to: "/feedback" },
  { label: "About", to: "/about" },
];

/**
 * The landing page's reading rule — one hairline under the header that fills
 * as the page is read.
 *
 * Only on the marketing page: a dashboard has no "end", so a progress bar
 * there would be measuring nothing a visitor cares about. The scroll work is
 * rAF-throttled and writes a transform, so the header never re-renders while
 * the page moves.
 */
function ReadingRule() {
  const lineRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    let frame = 0;
    let max = 0;

    /* Measure the scrollable height when it can actually change, not on every
       scroll frame: reading `scrollHeight` before writing a transform is the
       read-write pair that forces layout. */
    const measure = () => {
      max = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
    };
    const paint = () => {
      frame = 0;
      const progress =
        max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      line.style.transform = `scaleX(${progress.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const remeasure = () => {
      measure();
      onScroll();
    };

    measure();
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -bottom-px h-px overflow-hidden"
    >
      <span
        ref={lineRef}
        className="block h-full origin-left bg-[var(--brand)] opacity-45"
        style={{ transform: "scaleX(0)" }}
      />
    </span>
  );
}

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const go = useViewTransitionNavigate();
  const { pathname, search, hash } = useLocation();
  /* Signing in from a deep page should come back to it, not to the dashboard.
     The landing page is the exception: there is nothing to return to. */
  const returnTo = pathname === "/" ? "/dashboard" : `${pathname}${search}${hash}`;
  const authUrl = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--ink)_72%,transparent)] backdrop-blur-xl max-md:bg-[var(--ink)]">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 max-md:h-14 sm:px-6">
        {/* The mark is the way home: navigate there from any other page,
            scroll to the top when already on the landing page. */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-6">
          <Link
            to="/"
            aria-label="Manthan home"
            onClick={(event) => {
              if (pathname === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                event.preventDefault();
                go("/");
              }
            }}
            className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--signal)]"
          >
            <Logo markClassName="vt-mark h-6 w-6" />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    aria-current={active ? "page" : undefined}
                    className={
                      "rounded-md px-3 py-2 text-sm transition-colors " +
                      (active
                        ? "text-foreground"
                        : "text-text-dim hover:text-foreground")
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="md:hidden">
            <MobileMenu />
          </div>
          {/* ⌘K is the fast path; this is the visible one for a mouse. */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Search pages, chapters and notebooks (Command K)"
            title="Search (⌘K)"
            className="hidden h-8 w-8 items-center justify-center rounded-md text-text-dim transition-colors hover:text-foreground sm:inline-flex"
          >
            <Search className="h-4 w-4" />
          </button>
          {/* At the narrowest widths the bar carries only the mark, the menu
              and the primary action: a fourth control in a 320px row is how a
              header starts wrapping. The theme control still lives on every
              wider screen and in Settings (light / dark / system). */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          {!isAuthenticated && (
            <TransitionLink
              to={authUrl}
              className="hidden rounded-md px-3 py-2 text-sm text-text-dim transition-colors hover:text-foreground md:block"
            >
              Sign in
            </TransitionLink>
          )}
          <MovingBorderButton
            to={isAuthenticated ? "/dashboard" : authUrl}
            viewTransition
            innerClassName="px-4 py-2 text-[13px]"
          >
            {isAuthenticated ? "Dashboard" : "Get started"}
          </MovingBorderButton>
        </div>
      </nav>
      {pathname === "/" && <ReadingRule />}
    </header>
  );
}
