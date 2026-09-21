import { useAuth } from "@/hooks/use-auth";
import {
  IconAtom,
  IconBolt,
  IconHome,
  IconLayoutDashboard,
  IconLogin,
  IconSettings,
  IconSparkles,
  IconTag,
  IconUser,
  IconWand,
} from "@tabler/icons-react";
import { Logo } from "./Logo";
import { FloatingDock, type DockItem } from "./FloatingDock";
import { MobileMenu } from "./MobileMenu";
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
 * The workspace path is Dashboard -> STEM Lab -> Settings -> About Us.
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
  // The workspace path runs Dashboard -> STEM Lab -> Settings -> About Us.
  {
    title: "STEM Lab",
    icon: <IconAtom className="h-full w-full" strokeWidth={1.7} />,
    href: "/lab",
  },
  {
    title: "Plans",
    icon: <IconTag className="h-full w-full" strokeWidth={1.7} />,
    href: "/pricing",
  },
  {
    title: "Settings",
    icon: <IconSettings className="h-full w-full" strokeWidth={1.7} />,
    href: "/settings",
  },
  {
    title: "About Us",
    icon: <IconUser className="h-full w-full" strokeWidth={1.7} />,
    href: "/about",
  },
  {
    title: "Dashboard",
    icon: <IconLayoutDashboard className="h-full w-full" strokeWidth={1.7} />,
    href: "/dashboard",
  },
];

// Desktop icon magnification bounds (compact navbar placement).
// Tuned slightly smaller than the previous default so icons never zoom past
// the navbar on hover.
export const DOCK_ZOOM = {
  minSize: 34,
  maxSize: 46,
  minIconSize: 15,
  maxIconSize: 22,
};

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
          {/* Desktop (md+): the magnifying glass dock. Mobile: a readable
              labeled panel with a primary Get started / Open dashboard CTA,
              replacing the old icon-only fan. */}
          <div className="hidden md:block">
            <FloatingDock
              items={isAuthenticated ? dockItems : [...dockItems, signInItem]}
              desktopClassName="h-14 items-center gap-2 px-3 pb-0"
              minSize={DOCK_ZOOM.minSize}
              maxSize={DOCK_ZOOM.maxSize}
              minIconSize={DOCK_ZOOM.minIconSize}
              maxIconSize={DOCK_ZOOM.maxIconSize}
            />
          </div>
          <MobileMenu items={isAuthenticated ? dockItems : [...dockItems, signInItem]} />
          <ThemeToggle />
          {/* Sign in lives once, in the dock (icon + tooltip). */}
          <div className="hidden sm:block">{cta}</div>
        </div>
      </nav>
    </header>
  );
}
