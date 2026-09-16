import { BookOpen, FlaskConical, Info, LayoutDashboard, Settings2 } from "lucide-react";

/** Every destination reachable from the app sidebar. */
export type DashboardSection = "dashboard" | "notebooks" | "lab" | "settings" | "about";

const ITEMS: { key: DashboardSection; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "notebooks", label: "Notebooks", icon: BookOpen },
  { key: "lab", label: "STEM Lab", icon: FlaskConical },
  { key: "settings", label: "Settings", icon: Settings2 },
  { key: "about", label: "About Us", icon: Info },
];

/**
 * Shared sidebar navigation. Each page owns what a click *means* (the
 * dashboard swaps an in-place view, every other destination pushes a route),
 * so the markup and active styling stay in one place.
 */
export function DashboardNav({
  active,
  onSelect,
}: {
  active: DashboardSection;
  onSelect: (key: DashboardSection) => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.key)}
            className={
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors " +
              (isActive
                ? "border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-foreground"
                : "border border-transparent text-text-dim hover:text-foreground")
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export default DashboardNav;
