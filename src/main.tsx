import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
// user-preference hooks (theme, motion, ambient, text comfort) — imported
// globally so a toggle in the settings dashboard lands on every route
import "./components/settings/settings.css";
import { installCdEngine } from "./components/landing/cd-engine";

// One rAF loop drives every spinning-disc button's speed smoothing.
installCdEngine();

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
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
 * Bridges Supabase Auth into Convex.
 *
 * Convex verifies the Supabase access token itself (see convex/auth.config.ts),
 * so all this has to do is hand the current token over whenever the session
 * appears, is refreshed, or ends. The token callback re-reads the session, so
 * the next connection always uses the freshest token.
 */
function SupabaseConvexProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const signedIn = useRef<boolean | null>(null);

  useEffect(() => {
    let active = true;

    const fetchToken = async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    };

    const apply = (isSignedIn: boolean, force = false) => {
      if (!force && signedIn.current === isSignedIn) return;
      signedIn.current = isSignedIn;
      if (isSignedIn) convex.setAuth(fetchToken);
      else convex.clearAuth();
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      apply(Boolean(data.session));
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        // A refreshed token (or one just picked up from the OAuth redirect)
        // has to be handed over again; only sign-in/sign-out changes our state.
        const force =
          event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION";
        apply(Boolean(session), force);
        setReady(true);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Wait for the session to be applied once, so the first queries never fire
  // unauthenticated (which would flash an empty dashboard).
  if (!ready) return <RouteLoading />;

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
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
      <SupabaseConvexProvider>
        <SettingsProvider>
        <BrowserRouter>
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
        </BrowserRouter>
        </SettingsProvider>
        <Toaster />
      </SupabaseConvexProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
