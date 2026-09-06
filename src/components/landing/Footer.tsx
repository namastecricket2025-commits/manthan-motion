import { Link } from "react-router";
import { Logo } from "./Logo";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--card-border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <Logo markClassName="h-7 w-7" />
          <p className="max-w-xs text-center text-xs leading-relaxed text-text-dim md:text-left">
            Manthan churns raw notes, files and links into ready-to-study
            material — summaries, flashcards and question banks.
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-text-dim">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <Link to={AUTH_URL} className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <p className="text-xs text-text-dim">
          © {new Date().getFullYear()} Manthan · crafted in the dark
        </p>
      </div>
    </footer>
  );
}