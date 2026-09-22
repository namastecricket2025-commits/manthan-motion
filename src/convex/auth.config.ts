import type { AuthConfig } from "convex/server";

// Freebuff-signed federated tokens (see freebuff web's
// src/lib/vly-convex-jwt.ts) let a signed-in freebuff.com user carry their
// identity into this project without going through local sign-in. customJwt
// is correct for this provider: freebuff's tokens and JWKS both carry a
// `kid` header, which the customJwt validation path requires.
const freebuffIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://freebuff.com";

// The Supabase project that owns Manthan sign-in — the same public URL the
// browser client uses (src/lib/supabase.ts). It publishes an asymmetric ES256
// key, so Convex can verify its access tokens directly from the JWKS endpoint
// — no shared secret. `applicationID: "authenticated"` matches the `aud`
// claim Supabase puts on every access token it issues for a logged-in user.
// (Kept literal rather than read from the environment: Convex refuses to
// deploy an auth config that references an unset variable, and this value is
// public by design.)
const supabaseUrl = "https://ahbbhzxnblphuxjybhfk.supabase.co";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `${supabaseUrl}/auth/v1`,
      jwks: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      applicationID: "authenticated",
      algorithm: "ES256",
    },
    // Standard Convex Auth provider for this project's own sign-in ("Get
    // Started" email/guest, see src/convex/auth.ts). The deployment
    // self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header) validated
    // via OIDC discovery at `${domain}/.well-known/openid-configuration`,
    // served by auth.addHttpRoutes() in convex/http.ts. Do NOT convert this
    // entry to `type: "customJwt"` — that path rejects tokens without a
    // `kid` header, so sign-in would silently never confirm and RequireAuth
    // would loop back to /auth forever.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: freebuffIssuer,
      jwks: `${freebuffIssuer}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
