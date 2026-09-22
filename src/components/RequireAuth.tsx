import { useAuth } from "@/hooks/use-auth";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  // Supabase owns the session; this is whether Convex has been handed the
  // token yet. Waiting for it here stops a signed-in student from seeing a
  // flash of "empty account" before their data loads.
  const { isLoading: convexLoading, isAuthenticated: convexAuthenticated } =
    useConvexAuth();
  const location = useLocation();

  if (isLoading || (isAuthenticated && convexLoading && !convexAuthenticated)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    // Keep the hash too: deep links like /settings#legal must still land on
    // their panel after the sign-in round trip.
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
