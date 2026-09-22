import type { AuthConfig } from "convex/server";

// Freebuff-signed federated tokens (see freebuff web's
// src/lib/vly-convex-jwt.ts) let a signed-in freebuff.com user carry their
// identity into this project without going through local sign-in. customJwt
// is correct for this provider: freebuff's tokens and JWKS both carry a
// `kid` header, which the customJwt validation path requires.
const freebuffIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://freebuff.com";

// Manthan signs users in with Supabase Auth. Supabase issues ES256 access
// tokens and publishes the matching public key at its JWKS endpoint, so the
// deployment can verify them locally — no shared secret ever reaches Convex.
// The issuer and audience below are exactly what Supabase stamps on a token
// (`iss` = ".../auth/v1", `aud` = "authenticated").
// Literal on purpose: Convex requires every env var referenced from an auth
// config to be set on the deployment, and this URL is public either way.
const supabaseProject = "https://ahbbhzxnblphuxjybhfk.supabase.co";

export default {
  providers: [
    {
      type: "customJwt",
      issuer: `${supabaseProject}/auth/v1`,
      jwks: `${supabaseProject}/auth/v1/.well-known/jwks.json`,
      applicationID: "authenticated",
      algorithm: "ES256",
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
