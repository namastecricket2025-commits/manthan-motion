import {
  DashboardNav,
  SidebarCollapseButton,
  type DashboardSection,
} from "@/components/dashboard/DashboardNav";
import { useSidebarCollapsed } from "@/components/dashboard/use-sidebar";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { MathLab } from "@/components/mathlab/MathLab";
import { SearchWithGoogle } from "@/components/shared/SearchWithGoogle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { Menu, LogOut } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";

/**
 * /math-lab — the mathematics workspace (Classes 8 to 11).
 * Shares the app shell with the dashboard and settings; the lab itself owns
 * the grade tabs, the graphing canvas and the equation engine.
 */
export default function MathLabPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  const selectSection = (key: DashboardSection) => {
    setSheetOpen(false);
    if (key === "dashboard") navigate("/dashboard");
    else if (key === "notebooks") navigate("/dashboard?view=notebooks");
    else if (key === "mathlab") navigate("/math-lab");
    else if (key === "lab") navigate("/lab");
    else if (key === "settings") navigate("/settings");
    else if (key === "pricing") navigate("/pricing");
    else if (key === "about") navigate("/about");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const nav = (
    <DashboardNav
      active="mathlab"
      onSelect={selectSection}
      collapsed={collapsed}
    />
  );
  const mobileNav = <DashboardNav active="mathlab" onSelect={selectSection} />;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative z-10">
        {/* ---- Sidebar (desktop) ---- */}
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-[var(--card-border)] bg-[var(--panel-bg)] py-5 backdrop-blur-xl transition-[width,padding] duration-300 ease-out min-[760px]:flex"
          style={{
            width: collapsed ? 76 : 240,
            paddingLeft: collapsed ? 10 : 16,
            paddingRight: collapsed ? 10 : 16,
          }}
        >
          <div className="flex min-w-0 flex-col gap-7">
            <div
              className={
                collapsed
                  ? "flex justify-center"
                  : "flex items-center justify-between gap-2"
              }
            >
              {!collapsed && <Logo />}
              <SidebarCollapseButton
                collapsed={collapsed}
                onToggle={() => setCollapsed((value) => !value)}
              />
            </div>
            {nav}
          </div>
          <div
            className={
              collapsed
                ? "flex flex-col items-center gap-3 pt-6"
                : "flex items-center justify-between pt-6"
            }
          >
            <ThemeToggle />
            {collapsed ? (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] text-text-dim transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-[var(--card-border)] bg-transparent"
                onClick={handleSignOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            )}
          </div>
        </aside>

        {/* ---- Mobile top bar ---- */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-3 backdrop-blur-xl min-[760px]:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="glass-chip inline-flex h-10 w-10 items-center justify-center text-foreground"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[80vw] max-w-xs overflow-y-auto border-r border-[var(--card-border)] bg-[var(--ink)]/95 backdrop-blur-xl"
              >
                <SheetHeader>
                  <SheetTitle className="text-left">
                    <Logo />
                  </SheetTitle>
                </SheetHeader>
                <div className="px-2">{mobileNav}</div>
                <div className="mt-auto px-4 pb-8">
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-[var(--card-border)] bg-transparent"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* ---- Canvas ---- */}
        <main
          className="px-4 py-6 transition-[margin-left] duration-300 ease-out sm:px-6 min-[760px]:ml-[var(--sidebar-w)] md:py-10"
          style={{ "--sidebar-w": collapsed ? "76px" : "240px" } as CSSProperties}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Math Lab<span className="text-[var(--signal)]">.</span>
              </h1>
              <SearchWithGoogle
                compact
                label="Search with Google"
                topic="CBSE maths concept explained step by step"
              />
            </div>

            <MathLab />
          </div>
        </main>
      </div>
    </div>
  );
}
