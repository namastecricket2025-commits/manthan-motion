import { useAuth } from "@/hooks/use-auth";
import {
  FlaskConical,
  Home,
  NotebookPen,
  Sigma,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

/**
 * Thumb-level navigation for the signed-in app.
 *
 * The phone used to make every destination a trip through a hamburger drawer.
 * Apps land you somewhere useful and keep the five durable places in reach, so
 * this dock is mounted once by the router and only appears on signed-in app
 * routes. A notebook interior is immersive: it has its own Sources / Ask /
 * Study dock, so this one steps aside while a notebook is open.
 */

type DockItem = {
  key: "home" | "notebooks" | "math" | "stem" | "you";
  label: string;
  icon: typeof Home;
  to: string;
};

const ITEMS: DockItem[] = [
  { key: "home", label: "Home", icon: Home, to: "/dashboard" },
  {
    key: "notebooks",
    label: "Notebooks",
    icon: NotebookPen,
    to: "/dashboard?view=notebooks",
  },
  { key: "math", label: "Math", icon: Sigma, to: "/math-lab" },
  { key: "stem", label: "STEM", icon: FlaskConical, to: "/lab" },
  { key: "you", label: "You", icon: UserRound, to: "/settings" },
];

const APP_ROUTES = [
  "/dashboard",
  "/math-lab",
  "/lab",
  "/settings",
  "/mistakes",
  "/review",
  "/exam",
  "/viva",
  "/offline",
];

export function AppDock() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  if (!isAuthenticated || !APP_ROUTES.includes(location.pathname)) {
    return null;
  }

  /* The notebook workspace owns the bottom edge while it is open. */
  if (location.pathname === "/dashboard" && search.get("notebook")) {
    return null;
  }

  const onNotebooks =
    location.pathname === "/dashboard" && search.get("view") === "notebooks";
  const active: DockItem["key"] | null =
    location.pathname === "/dashboard"
      ? onNotebooks
        ? "notebooks"
        : "home"
      : location.pathname === "/math-lab"
        ? "math"
        : location.pathname === "/lab"
          ? "stem"
          : location.pathname === "/settings"
            ? "you"
            : location.pathname === "/offline"
              ? "notebooks"
              : "home";

  return (
    <nav className="app-tabbar" aria-label="App">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            className="app-tabbar__item"
            data-active={isActive ? "true" : undefined}
            aria-current={isActive ? "page" : undefined}
            onClick={() => navigate(item.to)}
          >
            <span className="app-tabbar__icon" aria-hidden="true">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </span>
            <span className="app-tabbar__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default AppDock;
