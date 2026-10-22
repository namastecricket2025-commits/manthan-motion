import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { AviaWidget } from "@/components/voice/AviaWidget";
import { PlanProvider } from "@/components/plans/PlanProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { RequireAuth } from "@/components/RequireAuth";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, useRef, useState, useCallback, lazy, Suspense } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import "./components/settings/settings.css";
import { SITE_URL } from "./lib/site";

// Lazy load route components. MathLab and Lab are the two heaviest pages
// (three + chem/physics benches, mathlive, three.js previews), so they stay
// behind dynamic imports — they are never bundled into the initial shell.
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const MathLab = lazy(() => import("./pages/MathLab.tsx"));
const Lab = lazy(() => import("./pages/Lab.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const SharedMaterial = lazy(() => import("./pages/SharedMaterial.tsx"));
const Mistakes = lazy(() => import("./pages/Mistakes.tsx"));
const OfflineKits = lazy(() => import("./pages/OfflineKits.tsx"));

// The legal and utility pages are tiny; keep them eager so the strings ship
// in the shell and there is no separate round-trip on the rare deep link.
import About from "./pages/About.tsx";
import NotFound from "./pages/NotFound.tsx";
import Terms from "./pages/Terms.tsx";
import Privacy from "./pages/Privacy.tsx";
import Honor from "./pages/Honor.tsx";
import Pricing from "./pages/Pricing.tsx";
import Feedback from "./pages/Feedback.tsx";

/** A route chunk is loading. Show the mark and a quiet bar instead of the
 *  word "Loading…" — the first thing a slow connection sees should be the
 *  product, not a placeholder. */
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
          Manthan<span className="text-[var(--signal)]">.</span>
        </span>
        <span className="h-[3px] w-28 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-main)_10%,transparent)]">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-[var(--signal)]" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-dim">
          Opening the workspace
        </span>
      </div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-6 text-center">
            <span className="font-display text-lg font-semibold tracking-[-0.02em]">
              Manthan<span className="text-[var(--signal)]">.</span>
            </span>
            <h1 className="mt-5 font-display text-xl font-semibold tracking-tight">
              Something broke on this page.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              Your notebooks and study material are stored server-side and are
              safe. Reloading usually clears this; if it keeps happening, tell
              us through the feedback page.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-[var(--text-main)] px-5 py-2.5 text-sm font-semibold text-[var(--panel)]"
              >
                Reload the page
              </button>
              <a
                href="/"
                className="rounded-full border border-[var(--card-border)] px-5 py-2.5 text-sm font-medium text-foreground"
              >
                Back to home
              </a>
            </div>
            {import.meta.env.DEV && this.state.message ? (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-[var(--card-border)] p-2 text-left text-[10px] leading-4 text-text-dim">
                {this.state.message}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

/**
 * Supabase's session, in the shape `ConvexProviderWithAuth` consumes.
 *
 * `fetchAccessToken` reads a ref rather than state so handing Convex a token
 * never depends on a re-render, and honours `forceRefreshToken` so Convex can
 * demand a fresh token when the one it holds is rejected. Convex verifies the
 * Supabase token itself (see convex/auth.config.ts) — this side only supplies
 * it, and `ConvexProviderWithAuth` owns the connect/refresh/clear lifecycle.
 */
function useSupabaseAuthForConvex() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      sessionRef.current = data.session ?? null;
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        if (!active) return;
        sessionRef.current = next;
        setSession(next);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (forceRefreshToken) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) sessionRef.current = data.session;
      }
      return sessionRef.current?.access_token ?? null;
    },
    [],
  );

  return {
    isLoading,
    isAuthenticated: Boolean(session),
    fetchAccessToken,
  };
}

/**
 * Bridges Supabase Auth into Convex.
 *
 * `ConvexProviderWithAuth` (not a bare `ConvexProvider`) is required: it is
 * what publishes the Convex auth context that `useConvexAuth()` — and so
 * `RequireAuth` — reads. Without it the dashboard crashes on mount with
 * "Could not find ConvexProviderWithAuth as an ancestor component".
 */
function ConvexBridge({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useSupabaseAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}


/** Titles and descriptions for every public page. Kept next to the router so
 *  a new route shows up here as soon as it exists — shared links, browser
 *  history and search results then say what the page actually is. */
const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Manthan — Study smarter, not longer",
    description:
      "Turn a chapter into solved problems, sticky study kits and lab walkthroughs. Built for CBSE, ICSE and state-board students in Classes 9–12.",
  },
  "/auth": {
    title: "Sign in — Manthan",
    description: "Sign in to your Manthan workspace with email or Google.",
  },
  "/dashboard": {
    title: "Your workspace — Manthan",
    description: "Notebooks, study kits and the next thing worth revising.",
  },
  "/math-lab": {
    title: "Math Lab — Manthan",
    description:
      "Solve a problem step by step, graph it, or practise a board-paper set at your level.",
  },
  "/lab": {
    title: "Virtual Lab — Manthan",
    description:
      "Run chemistry, physics and biology experiments without the apparatus.",
  },
  "/settings": {
    title: "Settings — Manthan",
    description: "Your class, board, subjects, appearance and privacy controls.",
  },
  "/mistakes": {
    title: "Mistake Bank — Manthan",
    description:
      "Retry the quiz and practice answers you actually missed, and clear them one by one.",
  },
  "/offline": {
    title: "Offline kits — Manthan",
    description:
      "Downloaded summaries, flashcards and quizzes you can read without a connection.",
  },
  "/pricing": {
    title: "Plans — Manthan",
    description: "What is free, what Manthan Plus adds, and how billing works.",
  },
  "/about": {
    title: "About — Manthan",
    description: "Why Manthan exists and the principles behind how it teaches.",
  },
  "/feedback": {
    title: "Feedback — Manthan",
    description: "Tell us what is working and what is not.",
  },
  "/terms": {
    title: "Terms of Service — Manthan",
    description: "The terms that apply when you use Manthan.",
  },
  "/privacy": {
    title: "Privacy Policy — Manthan",
    description: "What Manthan stores, why, and the control you have over it.",
  },
  "/honor": {
    title: "Honour Code — Manthan",
    description: "How Manthan is meant to be used for learning.",
  },
};

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  /* Every route opens at the top of its own canvas. Anchors inside a page
     (which only change the hash) are left alone, and "instant" bypasses the
     global smooth-scroll so a new page never glides down from the old one. */
  useEffect(() => {
    if (location.hash) {
      /* The target may be a lazy route that has not painted yet. Wait two
         frames, then scroll; if it is still absent, fall back to the top. */
      const id = decodeURIComponent(location.hash.slice(1));
      let tries = 0;
      const tick = () => {
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
          return;
        }
        if (tries++ < 12) requestAnimationFrame(tick);
        else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      };
      requestAnimationFrame(tick);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname, location.hash]);

  /* Keep the document head honest for every client-side route. */
  useEffect(() => {
    const meta = PAGE_META[location.pathname];
    if (!meta) {
      /* Shared sheets set their own title from the material; every other
         unknown path is the 404 route. */
      if (!location.pathname.startsWith("/s/")) {
        document.title = "Page not found — Manthan";
      }
      return;
    }
    document.title = meta.title;
    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector<HTMLMetaElement>(selector);
      if (el) el.setAttribute(attr, value);
    };
    const canonical = `${SITE_URL}${location.pathname === "/" ? "/" : location.pathname}`;
    set('meta[name="description"]', "content", meta.description);
    set('meta[property="og:title"]', "content", meta.title);
    set('meta[property="og:description"]', "content", meta.description);
    set('meta[property="og:url"]', "content", canonical);
    set('meta[name="twitter:title"]', "content", meta.title);
    set('meta[name="twitter:description"]', "content", meta.description);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


/* The offline shell is production-only: a service worker in front of Vite's
   dev server would serve yesterday's modules while the app is being edited. */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Private mode and some embedded browsers refuse registration; the app
         works exactly the same without it. */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexBridge>
        <SettingsProvider>
        <BrowserRouter>
          {/* The plan gate lives inside the router: its lock prompt offers a
              jump to /pricing, and it wraps every route so any workspace can
              gate a click. */}
          <PlanProvider>
          <RouteSyncer />
          <OnboardingModal />
          <CommandPalette />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/math-lab"
                element={
                  <RequireAuth>
                    <MathLab />
                  </RequireAuth>
                }
              />
              <Route
                path="/lab"
                element={
                  <RequireAuth>
                    <Lab />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route
                path="/mistakes"
                element={
                  <RequireAuth>
                    <Mistakes />
                  </RequireAuth>
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/honor" element={<Honor />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/offline" element={<OfflineKits />} />
              <Route path="/s/:token" element={<SharedMaterial />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </PlanProvider>
        </BrowserRouter>
        {/* Toasts read the resolved theme, so the toaster belongs inside the
            settings provider — otherwise the system theme is assumed. */}
        <Toaster />
        </SettingsProvider>
        {/* Avia floats above every route — she speaks through the browser's
            own Web Speech APIs, so she needs no keys and costs nothing. */}
        <AviaWidget />
      </ConvexBridge>
    </RootErrorBoundary>
  </StrictMode>,
);
