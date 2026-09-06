import { useAuth } from "@/hooks/use-auth";
import {
  IconBolt,
  IconHome,
  IconLayoutDashboard,
  IconLogin,
  IconSparkles,
  IconWand,
} from "@tabler/icons-react";
import { Logo } from "./Logo";
import { FloatingDock, type DockItem } from "./FloatingDock";
import { MovingBorderButton } from "./MovingBorderButton";
import { ThemeToggle } from "./ThemeToggle";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

/**
 * Top-menu navigation via the Floating Dock.
 *
 * A single FloatingDock instance serves both modes: on desktop (md+) it is
 * an inline glass pill that magnifies icons subtly by mouse proximity, with
 * tooltips on hover; on mobile (<md) it is a compact +/× trigger that fans
 * the same links out downward.
 *
 * Hash targets scroll to landing sections; route targets use the SPA router.
 */
const DOCK_LINKS: DockItem[] = [
  {
    title: "Home",
    icon: <IconHome className="h-full w-full" strokeWidth={1.7} />,
    href: "#top",
  },
  {
    title: "Features",
    icon: <IconSparkles className="h-full w-full" strokeWidth={1.7} />,
    href: "#features",
  },
  {
    title: "How it works",
    icon: <IconWand className="h-full w-full" strokeWidth={1.7} />,
    href: "#how",
  },
  {
    title: "Impact",
    icon: <IconBolt className="h-full w-full" strokeWidth={1.7} />,
    href: "#stats",
  },
  {
    title: "Dashboard",
    icon: <IconLayoutDashboard className="h-full w-full" strokeWidth={1.7} />,
    href: "/dashboard",
  },
];

export default function Navbar() {
  const { isAuthenticated, isLoading } = useAuth();

  const cta = isAuthenticated ? (
    <MovingBorderButton to="/dashboard" innerClassName="px-5 py-2.5 text-[13px]">
      Open dashboard
    </MovingBorderButton>
  ) : (
    <MovingBorderButton
      to={AUTH_URL}
      innerClassName="px-5 py-2.5 text-[13px]"
    >
      Get started
    </MovingBorderButton>
  );

  const dockItems: DockItem[] = DOCK_LINKS;
  const signInItem: DockItem = {
    title: "Sign in",
    icon: (
      <IconLogin className="h-full w-full" strokeWidth={1.7} />
    ),
    href: AUTH_URL,
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav className="glass-chip mx-auto flex max-w-6xl items-center justify-between gap-3 py-2 pl-4 pr-2 sm:pl-5">
        <a
          href="#top"
          aria-label="Manthan home"
          className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--signal)]"
        >
          <Logo markClassName="h-7 w-7" />
        </a>

        <div className="flex items-center gap-2">
          {/* The one dock: a glass pill that magnifies gently on desktop,
              an expandable trigger on mobile. Magnification is capped so
              icons never balloon past the navbar. */}
          <FloatingDock
            items={isAuthenticated ? dockItems : [...dockItems, signInItem]}
            mobileDirection="down"
            desktopClassName="h-14 items-center gap-2 px-3 pb-0"
            minSize={36}
            maxSize={50}
            minIconSize={16}
            maxIconSize={24}
          />
          <ThemeToggle />
          {/* Sign in lives once, in the dock (icon + tooltip). */}
          <div className="hidden sm:block">{cta}</div>
        </div>
      </nav>
    </header>
  );
}
