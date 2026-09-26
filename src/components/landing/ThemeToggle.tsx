import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useResolvedTheme } from "@/lib/app-settings";

const STORAGE_KEY = "manthan-theme";

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  /* A direct toggle writes the class itself, so announce it: useResolvedTheme
     (and every theme-aware chart or widget that reads the tokens) listens for
     this event rather than polling the DOM. */
  window.dispatchEvent(new CustomEvent("manthan:theme", { detail: { dark } }));
}

function readStored(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored === "dark";
  } catch {
    /* private mode etc. */
  }
  return true; // Manthan's default theme is dark
}

/**
 * Theme toggle — keeps the data-theme attribute + .dark class pattern from
 * the reference files (no JS theme framework), defaulting to dark.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined" ? readStored() : true,
  );
  /* the settings dashboard owns theme mode too (light / dark / system), so
     mirror whatever it resolves to instead of drifting out of sync */
  const resolved = useResolvedTheme();

  useEffect(() => {
    setDark(resolved === "dark");
  }, [resolved]);

  useEffect(() => {
    applyTheme(dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setDark((d) => !d)}
      className={
        "glass-chip btn-ghost inline-flex h-10 w-10 items-center justify-center text-text-dim transition-colors duration-200 hover:text-[var(--signal)] " +
        (className ?? "")
      }
    >
      <span className="relative block h-4 w-4">
        <Sun
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
            dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
        <Moon
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
            dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
      </span>
    </button>
  );
}