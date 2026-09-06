import { useAuth } from "@/hooks/use-auth";
import { Menu } from "lucide-react";
import { Link } from "react-router";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "./Logo";
import { MovingBorderButton } from "./MovingBorderButton";
import { ThemeToggle } from "./ThemeToggle";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";
const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#pipeline" },
];

export default function Navbar() {
  const { isAuthenticated, isLoading } = useAuth();

  const cta = isAuthenticated ? (
    <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[13px]">
      Open dashboard
    </MovingBorderButton>
  ) : (
    <MovingBorderButton to={AUTH_URL} innerClassName="px-5 py-2.5 text-[13px]">
      Get started
    </MovingBorderButton>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav className="glass-chip mx-auto flex max-w-6xl items-center justify-between gap-3 py-2.5 pl-4 pr-2.5 sm:pl-5">
        <Link
          to="/"
          aria-label="Manthan home"
          className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--signal)]"
        >
          <Logo markClassName="h-7 w-7" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-text-dim transition-colors duration-200 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isAuthenticated && !isLoading && (
            <Link
              to={AUTH_URL}
              className="btn-ghost hidden rounded-full border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-text-dim md:inline-block"
            >
              Sign in
            </Link>
          )}
          <div className="hidden sm:block">{cta}</div>

          {/* Mobile drawer trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="glass-chip btn-ghost inline-flex h-10 w-10 items-center justify-center text-foreground sm:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[82vw] max-w-xs border-l border-[var(--card-border)] bg-[var(--ink)]/95 backdrop-blur-xl"
            >
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Logo markClassName="h-7 w-7" />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <a
                      href={link.href}
                      className="rounded-xl px-4 py-3 font-display text-base font-semibold text-foreground transition-colors hover:bg-[var(--panel-bg)]"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3 px-4 pb-8">
                <MovingBorderButton
                  to={isAuthenticated ? "/dashboard" : AUTH_URL}
                  className="w-full"
                  innerClassName="w-full px-5 py-3 text-[13px]"
                >
                  {isAuthenticated ? "Open dashboard" : "Get started"}
                </MovingBorderButton>
                {!isAuthenticated && !isLoading && (
                  <SheetClose asChild>
                    <Link
                      to={AUTH_URL}
                      className="btn-ghost inline-flex items-center justify-center rounded-full border border-[var(--card-border)] px-6 py-3 text-sm font-semibold text-foreground"
                    >
                      Sign in
                    </Link>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}