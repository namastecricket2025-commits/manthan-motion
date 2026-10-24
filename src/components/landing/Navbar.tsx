import { useAuth } from "@/hooks/use-auth";
import { openCommandPalette } from "@/components/shared/CommandPalette";
import { Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
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

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  /* Signing in from a deep page should come back to it, not to the dashboard.
     The landing page is the exception: there is nothing to return to. */
  const returnTo = pathname === "/" ? "/dashboard" : `${pathname}${search}${hash}`;
  const authUrl = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--ink)_72%,transparent)] backdrop-blur-xl max-md:bg-[var(--ink)]">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* The mark is the way home: navigate there from any other page,
            scroll to the top when already on the landing page. */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-6">
          <Link
            to="/"
            aria-label="Manthan home"
            onClick={() => {
              if (pathname === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                navigate("/");
              }
            }}
            className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--signal)]"
          >
            <Logo markClassName="h-6 w-6" />
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
            <Link
              to={authUrl}
              className="hidden rounded-md px-3 py-2 text-sm text-text-dim transition-colors hover:text-foreground md:block"
            >
              Sign in
            </Link>
          )}
          <MovingBorderButton
            to={isAuthenticated ? "/dashboard" : authUrl}
            innerClassName="px-4 py-2 text-[13px]"
          >
            {isAuthenticated ? "Dashboard" : "Get started"}
          </MovingBorderButton>
        </div>
      </nav>
    </header>
  );
}
