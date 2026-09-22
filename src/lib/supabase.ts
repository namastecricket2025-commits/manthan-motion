import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Auth is the single source of identity for Manthan.
 *
 * The URL and the *publishable* key are safe to ship to the browser — that is
 * what they are designed for. They default to this project's Supabase instance
 * so the app works out of the box, and can be overridden by adding
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the project's Keys tab.
 */
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://ahbbhzxnblphuxjybhfk.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "sb_publishable_6XM3zMYg9TwVTwiQauFFTg_43UjSwUT";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Keep the session in localStorage and refresh it in the background so a
    // returning student stays signed in.
    persistSession: true,
    autoRefreshToken: true,
    // Consume the `?code=` / `#access_token=` that Supabase appends when it
    // redirects back from Google or an email link.
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

/** Name to greet the student with, from the Supabase user record. */
export function displayNameOf(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null) {
  const meta = user?.user_metadata ?? {};
  const name =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    "";
  return name.trim() || (user?.email ? user.email.split("@")[0] : "");
}

/** Avatar URL from the Supabase user record, when the provider supplied one. */
export function avatarOf(user: {
  user_metadata?: Record<string, unknown> | null;
} | null) {
  const meta = user?.user_metadata ?? {};
  const url =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    "";
  return url || undefined;
}
