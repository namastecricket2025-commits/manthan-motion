import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { AviaWidget } from "@/components/voice/AviaWidget";
import { PlanProvider } from "@/components/plans/PlanProvider";
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
// user-preference hooks (theme, motion, ambient, text comfort) — imported
// globally so a toggle in the settings dashboard lands on every route
import "./components/settings/settings.css";
// NOTE: `installCdEngine()` used to be called here to drive the spinning-disc
// primary buttons (a permanent rAF loop writing --cd-angle / --cd-angle-r on
// every registered button). The buttons are flat fills now — there is no disc
// to rotate and no sheen wedge to sweep — so the loop would run forever on
// every page writing two custom properties that nothing consumes. Leaving it
// uninstalled is the fix; every call site already guards on the engine
// existing, so an absent engine is a no-op.

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const MathLab = lazy(() => import("./pages/MathLab.tsx"));
const Lab = lazy(() => import("./pages/Lab.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Honor = lazy(() => import("./pages/Honor.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
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
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
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
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
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
              <Route path="/about" element={<About />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/honor" element={<Honor />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </PlanProvider>
        </BrowserRouter>
        </SettingsProvider>
        {/* Avia floats above every route — she speaks through the browser's
            own Web Speech APIs, so she needs no keys and costs nothing. */}
        <AviaWidget />
        <Toaster />
      </ConvexBridge>
    </RootErrorBoundary>
  </StrictMode>,
);
