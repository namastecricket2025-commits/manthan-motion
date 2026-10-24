import BiologyVectorLab from "@/components/lab/BiologyVectorLab";
import ChemistryGlassLab from "@/components/lab/ChemistryGlassLab";
import PhysicsVectorLab from "@/components/lab/PhysicsVectorLab";
import {
  DashboardNav,
  SidebarCollapseButton,
  type DashboardSection,
} from "@/components/dashboard/DashboardNav";
import { useSidebarCollapsed } from "@/components/dashboard/use-sidebar";
import { Logo } from "@/components/landing/Logo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { SearchWithGoogle } from "@/components/shared/SearchWithGoogle";
import { StemAsk } from "@/components/lab/StemAsk";
import { useResolvedTheme } from "@/lib/app-settings";
import { useSpringTransition, viewVariants } from "@/lib/motion";
import { useAuth } from "@/hooks/use-auth";
import { AnimatePresence, motion } from "motion/react";
import {
  Atom,
  Beaker,
  Dna,
  FlaskConical,
  ListChecks,
  LogOut,
  Menu,
  Sparkles,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import "@/components/lab/apple-lab.css";

type Subject = "physics" | "chemistry" | "biology";

const SUBJECTS: Array<{
  id: Subject;
  label: string;
  icon: typeof Atom;
}> = [
  { id: "physics", label: "Physics", icon: Atom },
  { id: "chemistry", label: "Chemistry", icon: FlaskConical },
  { id: "biology", label: "Biology", icon: Dna },
];

/**
 * /lab — the STEM Lab.
 *
 * It sits in the same shell as the dashboard and the Math Lab: the same
 * sidebar, the same page canvas, the same dot field and the same top wash. The
 * lab used to be a room of its own with its own header bar, which read as a
 * different product a click away from the dashboard.
 *
 * Three environments live inside it, each one vector-first: Physics (circuits /
 * motion / dynamics / waves), Chemistry (periodic table + Bohr model) and
 * Biology (structural schematics + the DNA indicator). The benches still carry
 * their own switch for reading a single plate in daylight, while the room
 * follows the site theme.
 *
 * Switching subject is a state shift, so it moves on the shared spring: the
 * outgoing bench lifts away and the incoming one settles in.
 */
export default function Lab() {
  const [subject, setSubject] = useState<Subject>("physics");
  const [askOpen, setAskOpen] = useState(false);
  const [askMode, setAskMode] = useState<"ask" | "drill">("ask");
  const [askSeed, setAskSeed] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const transition = useSpringTransition();
  const theme = useResolvedTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const active = SUBJECTS.find((entry) => entry.id === subject) ?? SUBJECTS[0];

  const selectSection = (key: DashboardSection) => {
    setSheetOpen(false);
    if (key === "dashboard") navigate("/dashboard");
    else if (key === "notebooks") navigate("/dashboard?view=notebooks");
    else if (key === "exam") navigate("/exam");
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

  function openAssistant(mode: "ask" | "drill") {
    setAskMode(mode);
    setAskOpen(true);
  }

  const nav = (
    <DashboardNav active="lab" onSelect={selectSection} collapsed={collapsed} />
  );
  const mobileNav = <DashboardNav active="lab" onSelect={selectSection} />;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative z-10">
        {/* The page's own two layers, mounted exactly as the dashboard mounts
            them: the dot field, then the top wash on top of it. */}
        <div className="dot-field" aria-hidden="true" />
        <div className="glow-aura" aria-hidden="true" />

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
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim">
                Workspace · Physics, Chemistry, Biology
              </p>
              <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                STEM Lab<span className="text-[var(--signal)]">.</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-dim">
                Run a circuit, tilt an organ or heat a reaction, then ask the
                lab the question the bench cannot answer. Every answer ends
                with three questions so the idea stays.
              </p>
            </div>

            <div className="apple-lab apple-lab--embedded">
              {/* The light/dark switch sits on the lab's own controls, not on
                  the shell: every bench-level daylight rule is written as
                  `.apple-lab [data-lab-theme="light"] …`, so the tab rail,
                  the actions and the chip take their paper values from the
                  same attribute the benches read. */}
              <div
                data-lab-theme={theme}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div
                  className="apple-lab-tabrail"
                  role="tablist"
                  aria-label="STEM Lab subjects"
                >
                  {SUBJECTS.map((entry) => {
                    const Icon = entry.icon;
                    const isActive = subject === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className="apple-lab-tab"
                        onClick={() => setSubject(entry.id)}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="lab-subject-pill"
                            className="apple-lab-pill"
                            transition={transition}
                          />
                        )}
                        <Icon
                          className={`relative z-10 h-4 w-4 ${isActive ? "text-[var(--lab-ink)]" : ""}`}
                        />
                        <span className="relative z-10">{entry.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="apple-lab-btn apple-lab-btn--solid"
                    onClick={() => openAssistant("ask")}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ask the lab
                  </button>
                  <button
                    type="button"
                    className="apple-lab-btn"
                    onClick={() => openAssistant("drill")}
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Quick drill
                  </button>
                  <SearchWithGoogle
                    topic={`${active.label} practical experiment — NCERT CBSE explained`}
                    label="Search on Google"
                  />
                </div>
              </div>

              <div className="mt-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={subject}
                    variants={viewVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={transition}
                  >
                    {subject === "physics" && <PhysicsVectorLab />}
                    {subject === "chemistry" && <ChemistryGlassLab />}
                    {subject === "biology" && <BiologyVectorLab />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <p className="flex items-center gap-2 text-[11px] text-text-dim">
              <Beaker className="h-3 w-3" />
              Manthan STEM Lab
            </p>
          </div>
        </main>
      </div>

      {/* Mounted only while open: each visit starts from the subject, mode and
          seed in hand, and the seed is spent on close. */}
      {askOpen ? (
        <StemAsk
          open
          onOpenChange={(next) => {
            setAskOpen(next);
            if (!next) setAskSeed(null);
          }}
          subject={subject}
          mode={askMode}
          seed={askSeed}
        />
      ) : null}
    </div>
  );
}
