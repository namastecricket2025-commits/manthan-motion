import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import {
  Atom,
  LayoutDashboard,
  LogIn,
  Sigma,
  Tag,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { MovingBorderButton } from "./MovingBorderButton";
import { useAuth } from "@/hooks/use-auth";

/**
 * The mobile navigation panel.
 *
 * Routes only — the homepage section anchors (Features / How it works /
 * Impact) are deliberately absent on touch: the user can scroll the page
 * themselves, and the menu is for getting somewhere. Each entry is a full
 * row with its name; the primary action (Get started / Open dashboard)
 * pins to the top so a first-time visitor cannot miss it.
 *
 * The panel is a compact sheet sized to its content — never a full-screen
 * takeover — and closes on any navigation.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();
  const { pathname, search, hash } = useLocation();
  const returnTo = pathname === "/" ? "/dashboard" : `${pathname}${search}${hash}`;
  const authHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const rows: {
    title: string;
    sub: string;
    href: string;
    icon: React.ReactNode;
  }[] = [
    ...(isAuthenticated
      ? [
          {
            title: "Dashboard",
            sub: "Your notebooks and study material",
            href: "/dashboard",
            icon: (
              <LayoutDashboard
                className="h-full w-full"
                strokeWidth={1.7}
              />
            ),
          },
        ]
      : []),
    {
      title: "Math Lab",
      sub: "Grades 8-11 graphing and equation engine",
      href: "/math-lab",
      icon: <Sigma className="h-full w-full" strokeWidth={1.7} />,
    },
    {
      title: "STEM Lab",
      sub: "Physics, chemistry, biology sandboxes",
      href: "/lab",
      icon: <Atom className="h-full w-full" strokeWidth={1.7} />,
    },
    {
      title: "Plans",
      sub: "Allowances and pricing",
      href: "/pricing",
      icon: <Tag className="h-full w-full" strokeWidth={1.7} />,
    },
    {
      title: "Feedback",
      sub: "Tell us what worked, and what didn't",
      href: "/feedback",
      icon: null,
    },
    {
      title: "About Us",
      sub: "The idea behind Manthan",
      href: "/about",
      icon: <User className="h-full w-full" strokeWidth={1.7} />,
    },
    ...(isAuthenticated
      ? [
          {
            title: "Settings",
            sub: "Theme, motion and account",
            href: "/settings",
            icon: null,
          },
        ]
      : [
          {
            title: "Sign in",
            sub: "Email or Google",
            href: authHref,
            icon: <LogIn className="h-full w-full" strokeWidth={1.7} />,
          },
        ]),
  ];

  return (
    <div ref={rootRef} className="relative md:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-chip absolute right-0 top-full z-50 mt-2 w-[264px] origin-top-right rounded-2xl p-2"
          >
            {/* The primary action, first and unmistakable. */}
            <div className="p-1.5 pb-2">
              {isAuthenticated ? (
                <MovingBorderButton
                  to="/dashboard"
                  className="w-full"
                  innerClassName="w-full px-4 py-2.5 text-[13px]"
                >
                  Open dashboard
                </MovingBorderButton>
              ) : (
                <MovingBorderButton
                  to={authHref}
                  className="w-full"
                  innerClassName="w-full px-4 py-2.5 text-[13px]"
                >
                  Get started — it's free
                </MovingBorderButton>
              )}
            </div>

            <div className="mx-2 border-t border-[var(--glass-hairline)]" />

            <nav className="mt-1.5 flex flex-col">
              {rows.map((item) => (
                <Link
                  key={item.title}
                  to={item.href}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--signal)_7%,transparent)]"
                  onClick={() => setOpen(false)}
                >
                  {item.icon && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--glass-hairline)] text-[var(--signal)]">
                      <span className="h-4 w-4">{item.icon}</span>
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] leading-snug text-text-dim">
                      {item.sub}
                    </span>
                  </span>
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "glass-chip btn-ghost inline-flex h-10 w-10 items-center justify-center text-foreground",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn(
            "h-5 w-5 transition-transform duration-300",
            open && "rotate-90",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
