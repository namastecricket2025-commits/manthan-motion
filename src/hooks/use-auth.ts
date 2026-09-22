import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { avatarOf, displayNameOf, supabase } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  image?: string;
};

/**
 * The signed-in Supabase account.
 *
 * Supabase owns the session (persisted in localStorage and refreshed in the
 * background), so every consumer of this hook is just a subscriber to it. The
 * access token is handed to Convex separately, in `main.tsx`.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        if (!active) return;
        setSession(next);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const account = session?.user ?? null;

  const user: AuthUser | null = account
    ? {
        id: account.id,
        name: displayNameOf(account),
        email: account.email ?? undefined,
        image: avatarOf(account),
      }
    : null;

  return {
    isLoading,
    isAuthenticated: Boolean(account),
    user,
    session,
    signOut: () => supabase.auth.signOut(),
  };
}
