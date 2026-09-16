import MeshBackground from "@/components/MeshBackground";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { DashboardNav, type DashboardSection } from "@/components/dashboard/DashboardNav";
import SettingsDashboard from "@/components/settings/SettingsDashboard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

/**
 * /settings — a standalone dashboard canvas dedicated to user configuration.
 * It shares the app shell (sidebar, theme toggle, sign out) but pulls in
 * nothing from the STEM Lab simulations. Deep links such as
 * `/settings#legal` open the matching accordion panel.
 */
export default function Settings() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectSection = (key: DashboardSection) => {
    setSheetOpen(false);
    if (key === "dashboard") navigate("/dashboard");
    else if (key === "lab") navigate("/lab");
    else if (key === "about") navigate("/about");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const nav = <DashboardNav active="settings" onSelect={selectSection} />;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <MeshBackground />
      <div className="relative z-10">
        {/* ---- Sidebar (desktop) ---- */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between border-r border-[var(--card-border)] bg-[var(--panel-bg)] px-4 py-5 backdrop-blur-xl min-[760px]:flex">
          <div className="flex flex-col gap-8">
            <Logo />
            {nav}
          </div>
          <div className="flex items-center justify-between">
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
                className="w-[80vw] max-w-xs border-r border-[var(--card-border)] bg-[var(--ink)]/95 backdrop-blur-xl"
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

        {/* ---- Settings canvas ---- */}
        <main className="px-4 py-6 sm:px-6 min-[760px]:ml-60 md:py-10">
          <div className="mx-auto max-w-5xl">
            <SettingsDashboard bare />
          </div>
        </main>
      </div>
    </div>
  );
}
