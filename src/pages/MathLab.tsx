import {
  DashboardNav,
  type DashboardSection,
} from "@/components/dashboard/DashboardNav";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { MathLab } from "@/components/mathlab/MathLab";
import { planName } from "@/lib/plans";
import { usePlan } from "@/components/plans/PlanProvider";
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
import { useState } from "react";
import { Link, useNavigate } from "react-router";

/**
 * /math-lab — the mathematics workspace (Classes 8 to 11).
 * Shares the app shell with the dashboard and settings; the lab itself owns
 * the grade tabs, the graphing canvas and the equation engine.
 */
export default function MathLabPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { plan } = usePlan();

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

  const nav = <DashboardNav active="mathlab" onSelect={selectSection} />;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative z-10">
        {/* ---- Sidebar (desktop) ---- */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between overflow-y-auto border-r border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-5 backdrop-blur-xl min-[760px]:flex">
          <div className="flex flex-col gap-8">
            <Logo />
            {nav}
          </div>
          <div className="flex items-center justify-between pt-6">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-[var(--card-border)] bg-transparent"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
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
                <div className="px-2">{nav}</div>
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
        <main className="px-4 py-6 sm:px-6 min-[760px]:ml-60 md:py-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Math Lab<span className="text-[var(--signal)]">.</span>
              </h1>
              <Link
                to="/pricing"
                className="premium-chip px-2.5 py-1 text-[11px] transition-colors hover:border-[var(--signal)]"
              >
                {planName(plan)}
              </Link>
            </div>

            <MathLab />
          </div>
        </main>
      </div>
    </div>
  );
}
