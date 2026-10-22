import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { Logo } from "@/components/landing/Logo";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/site";
import { Link } from "react-router";

/**
 * Shared shell for the standalone legal pages (Terms, Privacy): the Manthan
 * palette on a solid ink background, simple prose typesetting, back to home.
 * Copy lives with each page — this component only handles layout.
 */
export default function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Policy pages keep the site's own navigation. Dropping it made /terms,
          /privacy and /honor the only public pages with no way onwards except
          the browser's back button. */}
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-dim transition-colors hover:text-foreground"
        >
          ← Back to home
          <span
            aria-hidden="true"
            className="h-1 w-1 rounded-full bg-[var(--signal)]"
          />
        </Link>

        <header className="mt-8">
          <Logo markClassName="h-6 w-6" />
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-text-dim">{intro}</p>
        </header>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-3">
                {section.body.map((para, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed text-text-dim sm:text-base"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-[var(--card-border)] pt-6 text-sm leading-relaxed text-text-dim">
          Questions about this policy? Write to{" "}
          <a
            href={supportMailto("Manthan — policy question")}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
      <Footer />
    </div>
  );
}
