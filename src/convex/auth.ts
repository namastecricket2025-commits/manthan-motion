// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { emailOtp } from "./auth/emailOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    emailOtp,
    Anonymous,
    // Email + password: the primary local sign-in (flow: "signIn"/"signUp").
    // The custom profile hook stores the display name captured only on the
    // sign-up screen — sign-in never asks for it again.
    Password({
      profile: (params) => {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email) throw new Error("Email is required.");
        const name = String(params.name ?? "").trim();
        return {
          email,
          name: name || email.split("@")[0],
        };
      },
    }),
    // "Continue with Google": a standard OIDC provider. Credentials are read
    // from the deployment's AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET env vars via
    // the Keys/API keys UI — the button degrades gracefully when unset.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google]
      : []),
  ],
});
