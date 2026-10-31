import { Moon, Sun } from "lucide-react";
import { useResolvedTheme } from "@/lib/app-settings";
import { useSettings } from "@/components/settings/SettingsProvider";

/**
 * Theme toggle — writes the same `themeMode` the Settings page writes.
 *
 * It used to toggle only the `.dark` class and `localStorage`, which left the
 * settings store still saying "dark". Any later settings change (turning on
 * eye comfort, changing text size) then re-applied the stale value and the app
 * snapped back to dark. There is one source of truth now: the settings store.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { update } = useSettings();
  const resolved = useResolvedTheme();
  const dark = resolved === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => update({ themeMode: dark ? "light" : "dark" })}
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