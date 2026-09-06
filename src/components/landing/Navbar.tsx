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
 * Desktop (md+): an inline glass pill that magnifies icons by mouse
 * proximity, with tooltips on hover.
 * Mobile (<md): a compact +/× trigger that fans the same links out downward.
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

        {/* Desktop dock (magnify-on-proximity) */}
        <div className="hidden md:block">
          <FloatingDock
            items={isAuthenticated ? dockItems : [...dockItems, signInItem]}
            desktopClassName="h-12 items-center gap-1.5 border-0 bg-transparent px-2 backdrop-blur-none"
            minSize={36}
            maxSize={58}
            minIconSize={17}
            maxIconSize={30}
          />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isAuthenticated && !isLoading && (
            <a
              href={AUTH_URL}
              className="btn-ghost hidden rounded-full border border-[var(--card-border)] px-4 py-2 text-sm font-medium text-text-dim md:inline-block"
            >
              Sign in
            </a>
          )}
          <div className="hidden sm:block">{cta}</div>
          {/* Mobile dock (expandable trigger) */}
          <FloatingDock
            items={isAuthenticated ? dockItems : [...dockItems, signInItem]}
            mobileDirection="down"
          />
        </div>
      </nav>
    </header>
  );
}
