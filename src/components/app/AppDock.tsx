import { useAuth } from "@/hooks/use-auth";
import { useViewTransitionNavigate } from "@/lib/view-transitions";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

/**
 * Thumb-level navigation for the signed-in app.
 *
 * The phone used to make every destination a trip through a hamburger drawer.
 * Apps land you somewhere useful and keep the five durable places in reach, so
 * this dock is mounted once by the router and only appears on signed-in app
 * routes. A notebook interior is immersive: it has its own Sources / Ask /
 * Study dock, so this one steps aside while a notebook is open.
 */

type DockKey = "home" | "notebooks" | "math" | "stem" | "you";

type DockItem = {
  key: DockKey;
  label: string;
  to: string;
};

const ITEMS: DockItem[] = [
  { key: "home", label: "Home", to: "/dashboard" },
  {
    key: "notebooks",
    label: "Notebooks",
    to: "/dashboard?view=notebooks",
  },
  { key: "math", label: "Math", to: "/math-lab" },
  { key: "stem", label: "STEM", to: "/lab" },
  { key: "you", label: "You", to: "/settings" },
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

/**
 * Each destination gets a glyph that performs its own tiny piece of theatre
 * when tapped. Only the strokes that matter are animated, so the idle dock is
 * still a quiet row of five marks — the motion is a reaction, not decoration.
 */
function DockGlyph({ name }: { name: DockKey }) {
  const common = {
    className: "dock-glyph",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path className="dock-stroke dock-stroke--1" pathLength={1} d="M3.6 10.7 12 3.8l8.4 6.9" />
        <path className="dock-stroke dock-stroke--2" pathLength={1} d="M5.4 9.4v10.2h13.2V9.4" />
        <path className="dock-stroke dock-stroke--3" pathLength={1} d="M9.6 19.6v-5.2h4.8v5.2" />
      </svg>
    );
  }

  if (name === "notebooks") {
    return (
      <svg {...common}>
        <rect
          className="dock-stroke dock-stroke--1"
          pathLength={1}
          x="3.9"
          y="3.3"
          width="12.4"
          height="17.4"
          rx="2.2"
        />
        <path className="dock-stroke dock-stroke--2" pathLength={1} d="M7 3.3v17.4" />
        <path className="dock-written" pathLength={1} d="M9.5 8.6h4.6" />
        <path className="dock-written dock-written--2" pathLength={1} d="M9.5 12.1h3.3" />
        <g className="dock-pencil">
          <path d="M12.7 20.1l1.2-4.2 5.8-5.8 3 3-5.8 5.8-4.2 1.2Z" />
          <path d="m15.2 13.5 3 3" />
        </g>
      </svg>
    );
  }

  if (name === "math") {
    return (
      <svg {...common}>
        <path className="dock-stroke dock-stroke--1" pathLength={1} d="M16.8 5.2H6.9l5.9 6.8-5.9 6.8h9.9" />
        <path className="dock-plus dock-plus--1" pathLength={1} d="M17.8 3.2v3.7M16 5h3.6" />
        <path className="dock-plus dock-plus--2" pathLength={1} d="M18.2 17.2v3.4M16.5 18.9h3.4" />
      </svg>
    );
  }

  if (name === "stem") {
    return (
      <svg {...common}>
        <path className="dock-stroke dock-stroke--1" pathLength={1} d="M9.1 3.4h5.8M10 3.5v4.9l-4.7 8.9a2.6 2.6 0 0 0 2.3 3.9h8.8a2.6 2.6 0 0 0 2.3-3.9L14 8.4V3.5" />
        <path className="dock-liquid" pathLength={1} d="M7.2 14.5h9.6" />
        <circle className="dock-bubble dock-bubble--1" cx="10" cy="17" r="1" />
        <circle className="dock-bubble dock-bubble--2" cx="14" cy="15.4" r=".8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle className="dock-stroke dock-stroke--1" pathLength={1} cx="11.7" cy="8.2" r="3.7" />
      <path className="dock-stroke dock-stroke--2" pathLength={1} d="M4.5 20.2c.5-3.6 3.4-5.9 7.2-5.9 1.6 0 3 .4 4.1 1.2" />
      <path className="dock-check" pathLength={1} d="M16.6 4.1l1.4 1.4 2.5-2.7" />
    </svg>
  );
}

export function AppDock() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [search] = useSearchParams();
  const go = useViewTransitionNavigate();
  const [pulse, setPulse] = useState<{ key: DockKey; n: number } | null>(null);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  function animateTab(key: DockKey) {
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    setPulse((current) => ({ key, n: (current?.n ?? 0) + 1 }));
    pulseTimer.current = window.setTimeout(() => setPulse(null), 700);
  }

  if (!isAuthenticated || !APP_ROUTES.includes(location.pathname)) {
    return null;
  }

  /* The notebook workspace owns the bottom edge while it is open. */
  if (location.pathname === "/dashboard" && search.get("notebook")) {
    return null;
  }

  const onNotebooks =
    location.pathname === "/dashboard" && search.get("view") === "notebooks";
  const active: DockKey | null =
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
        const isActive = item.key === active;
        const isPulsing = pulse?.key === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className="app-tabbar__item"
            data-active={isActive ? "true" : undefined}
            data-pulse={isPulsing ? "true" : undefined}
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              animateTab(item.key);
              if (!isActive) go(item.to);
            }}
          >
            <span
              key={`${item.key}-${isPulsing ? pulse.n : 0}`}
              className="app-tabbar__icon"
              aria-hidden="true"
            >
              <DockGlyph name={item.key} />
            </span>
            <span className="app-tabbar__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default AppDock;
