import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useResolvedTheme } from "@/lib/app-settings";

/**
 * The bench light/dark switch.
 *
 * The lab used to start every bench in the dark even when the rest of the site
 * was on paper, which meant a light-mode student was dropped into a black room
 * with an amber glow. The bench now starts on the site's own theme, and the
 * switch still belongs to the bench: lighting one bench does not flip the
 * whole dashboard.
 */
export function useLabTheme() {
  const appTheme = useResolvedTheme();
  const [chosen, setChosen] = useState<"dark" | "light" | null>(null);
  const theme: "dark" | "light" = chosen ?? appTheme;
  return {
    theme,
    toggle: () => setChosen(theme === "dark" ? "light" : "dark"),
  };
}

/** The switch itself, identical on all three benches. */
export function LabThemeToggle({
  theme,
  subject,
  onToggle,
}: {
  theme: "dark" | "light";
  subject: string;
  onToggle: () => void;
}) {
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="apple-lab-btn !px-3 !py-2 !text-[12px]"
      onClick={onToggle}
      aria-label={`Switch ${subject} bench to ${next} mode`}
    >
      {theme === "dark" ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {next === "light" ? "Light bench" : "Dark bench"}
      </span>
    </button>
  );
}
