import { Moon, Sun } from "lucide-react";
import { useState } from "react";

/**
 * The bench light/dark switch.
 *
 * Every bench carries its own theme instead of following the app theme: the
 * STEM Lab is a dark room by design, so a student lights one bench to read a
 * plate in daylight without flipping the whole site. Each bench starts dark,
 * matching the room it sits in, and remembers nothing between visits — the
 * switch is about the bench in front of you.
 */
export function useLabTheme() {
  const [chosen, setChosen] = useState<"dark" | "light" | null>(null);
  const theme: "dark" | "light" = chosen ?? "dark";
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
      <span className="hidden sm:inline">{next === "light" ? "Light bench" : "Dark bench"}</span>
    </button>
  );
}
