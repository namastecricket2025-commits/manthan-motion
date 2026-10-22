import { Link } from "react-router";
import { supportMailto } from "@/lib/site";
import { Logo } from "./Logo";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";
/** Every policy lives on its own page now — not inside the settings accordion. */
const LEGAL = [
  { to: "/terms", label: "Terms of Service" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/honor", label: "Academic Honor" },
] as const;

/**
 * Site footer — Apple-style glass instead of an opaque panel, so it blends
 * into the animated blob canvas behind it, with founder credit and legal
 * links. `--text-dim` is re-declared here so secondary copy keeps a readable
 * contrast ratio on the translucent surface.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer relative z-10">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Brand */}
          <div className="flex flex-col items-start gap-3">
            <Logo markClassName="h-7 w-7" />
            <p className="max-w-xs text-sm leading-relaxed text-text-dim">
              Manthan churns raw notes, files and links into ready-to-study
              material — summaries, flashcards and question banks.
            </p>
            <p className="text-xs font-medium text-text-dim">
              Founded by{" "}
              <span className="font-display font-bold text-foreground">
                Luv Moond
              </span>
            </p>
          </div>

          {/* Product */}
          <nav
            aria-label="Product"
            className="flex flex-col items-start gap-2.5 text-sm font-medium text-text-dim"
          >
            {/* A plain label, not a bordered pill: these two DO carry
                information (which column is which), so they stay — just
                without a box around them. */}
            <span className="mb-1 text-sm font-medium text-foreground">
              Product
            </span>
            {/* The footer lives on every public page, so the section anchors
                are absolute. A bare `#features` on /about or /feedback only
                changed the URL and scrolled nowhere. */}
            <Link to="/#features" className="transition-colors hover:text-foreground">
              Features
            </Link>
            <Link to="/#how" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link to="/#stats" className="transition-colors hover:text-foreground">
              Impact
            </Link>
            <Link to="/pricing" className="transition-colors hover:text-foreground">
              Plans & Pricing
            </Link>
            <Link
              to={AUTH_URL}
              className="transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>

          {/* Legal — one dedicated page per policy. */}
          <nav
            aria-label="Legal"
            className="flex flex-col items-start gap-2.5 text-sm font-medium text-text-dim"
          >
            <span className="mb-1 text-sm font-medium text-foreground">
              Legal
            </span>
            {LEGAL.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={supportMailto("Manthan — contact")}
              className="transition-colors hover:text-foreground"
            >
              Contact
            </a>
            <a
              href={supportMailto(
                "Request removal of a review",
                "Please describe the review you would like removed, including the reviewer name and any details that help us identify it.",
              )}
              className="transition-colors hover:text-foreground"
            >
              Request removal of a review
            </a>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--card-border)] pt-6 text-xs text-text-dim sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-text-dim sm:justify-start">
            <nav aria-label="Footer" className="flex flex-wrap gap-3">
              {LEGAL.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <p>© {year} Manthan · All rights reserved</p>
          <p>Built for learners, by learners.</p>
        </div>
      </div>
    </footer>
  );
}
