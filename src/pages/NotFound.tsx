import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { ArrowLeft, Atom, Sigma, Tag } from "lucide-react";
import { Link } from "react-router";

/**
 * 404 — a real page, not a dead end.
 *
 * The previous version was a bare `text-gray-900` heading on the page
 * background with no header, no footer and no link out; in the dark theme it
 * was effectively blank. This one keeps the site's shell and gives the visitor
 * the three places they were most likely trying to reach.
 */
export default function NotFound() {
  const destinations = [
    {
      to: "/math-lab",
      label: "Math Lab",
      detail: "Solve, graph and practise Classes 8–11",
      icon: Sigma,
    },
    {
      to: "/lab",
      label: "STEM Lab",
      detail: "Physics, chemistry and biology benches",
      icon: Atom,
    },
    {
      to: "/pricing",
      label: "Plans",
      detail: "What each tier includes",
      icon: Tag,
    },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="glow-aura" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col justify-center px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--signal)]">
            404 · Not in the syllabus
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl md:text-6xl">
            This page didn&rsquo;t make it into the notes.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-text-dim">
            The link may be old, or the address may have a typo. Everything that
            does exist is one click away.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <MovingBorderButton
              to="/"
              innerClassName="px-6 py-3 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </MovingBorderButton>
            <Link
              to="/dashboard"
              className="btn-ghost inline-flex items-center gap-2 rounded-full border border-[var(--panel-line)] px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--panel-line-strong)]"
            >
              Open dashboard
            </Link>
          </div>

          <ul className="mt-12 grid gap-2 sm:grid-cols-3">
            {destinations.map((entry) => {
              const Icon = entry.icon;
              return (
                <li key={entry.to}>
                  <Link
                    to={entry.to}
                    className="group flex h-full flex-col gap-2 rounded-xl border border-[var(--panel-line)] bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] px-4 py-3 transition-colors hover:border-[var(--panel-line-strong)]"
                  >
                    <Icon className="h-4 w-4 text-[var(--signal)]" />
                    <span className="text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                    <span className="text-[11.5px] leading-snug text-text-dim">
                      {entry.detail}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </main>
        <Footer />
      </div>
    </div>
  );
}
