import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Mail,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.44a5.5 5.5 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.59-5.17 3.59-8.81Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.86-3c-1.08.72-2.45 1.16-4.09 1.16-3.14 0-5.8-2.12-6.74-4.97H1.29v3.1A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.26 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.29a12 12 0 0 0 0 10.76l3.97-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.97 3.1C6.2 6.87 8.86 4.75 12 4.75Z"
    />
  </svg>
);

/** Small labelled field used across every step of the auth flow. */
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-text-dim">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-[var(--card-border)] bg-transparent px-3.5 py-3 text-[16px] outline-none transition-colors placeholder:text-text-dim/60 focus:border-[var(--signal)]"
      />
    </label>
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const methods = useQuery(api.profile.authMethods);
  const googleConfigured = methods?.google ?? false;

  const completeProfile = useMutation(api.profile.completeGoogleProfile);

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [namePrompt, setNamePrompt] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const nameAskedRef = useRef(false);

  // Signed-in users go straight through — unless we still owe them a name.
  // One effect owns the decision so the redirect can never win the race
  // against the prompt, and guests (anonymous) are never asked for a name.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (user && !user.isAnonymous && !user.name && !nameAskedRef.current) {
      nameAskedRef.current = true;
      setNamePrompt(true);
      return;
    }
    if (!namePrompt) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, user, namePrompt, navigate, redirect]);

  /* --------------- email + password --------------- */

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    try {
      const result = await signIn("password", {
        flow: mode === "signUp" ? "signUp" : "signIn",
        email,
        password,
        // Name travels only on sign-up — sign-in never asks for it.
        ...(mode === "signUp" && name ? { name } : {}),
      });
      if (result.signingIn === false) {
        setError(
          "Those credentials did not match. Check the details and try again.",
        );
        setBusy(false);
        return;
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      setError(
        /already exists|taken/i.test(message)
          ? "An account with that email already exists — switch to Sign in."
          : /Invalid credentials|credentials/i.test(message)
            ? "Incorrect email or password."
            : mode === "signUp" && /password/i.test(message)
              ? "Password must be at least 8 characters."
              : message,
      );
      setBusy(false);
    }
  }

  /* --------------- email OTP fallback --------------- */

  async function handleOtpVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signIn("email-otp", {
        email: otpEmail,
        code: otp,
      });
      if (result.signingIn === false) {
        setError("That code is incorrect or has expired.");
        setOtp("");
        setBusy(false);
        return;
      }
      navigate(redirect, { replace: true });
    } catch {
      setError("That code is incorrect or has expired.");
      setOtp("");
    } finally {
      setBusy(false);
    }
  }

  /* --------------- Google --------------- */

  async function handleGoogle() {
    setGoogleError(null);
    try {
      // When configured, this performs a full-page redirect to Google and
      // returns to `redirectTo` with a one-time code; the client consumes it
      // automatically on load.
      await signIn("google", { redirectTo: redirect });
      setGoogleError(
        "Google sign-in did not complete. Use email and password instead.",
      );
    } catch {
      setGoogleError(
        "Google sign-in is not available right now. Use email and password below.",
      );
    }
  }

  /* --------------- guest --------------- */

  async function handleGuest() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect, { replace: true });
    } catch {
      setError("Could not start a guest session.");
      setBusy(false);
    }
  }

  const submitting = busy;

  return (
    <div className="relative min-h-[100svh] overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-0 bg-[radial-gradient(720px_420px_at_50%_-8%,color-mix(in_srgb,var(--signal)_16%,transparent),transparent_70%)]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
        <Link
          to="/"
          className="mb-7 flex flex-col items-center gap-2 text-center"
          aria-label="Manthan home"
        >
          <img src={logo} alt="" className="h-14 w-14" />
          <span className="font-display text-2xl font-bold tracking-tight">
            Manthan
          </span>
          <span className="text-xs font-medium tracking-wide text-text-dim">
            Study material, distilled.
          </span>
        </Link>

        <div className="glass-panel w-full rounded-3xl p-5 sm:p-7">
          {otpStep ? (
            /* ---------------- OTP verify ---------------- */
            <form onSubmit={handleOtpVerify} className="flex flex-col gap-4">
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  Check your email
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  We sent a 6-digit code to {otpEmail}.
                </p>
              </div>
              <input
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="••••••"
                className="w-full rounded-xl border border-[var(--card-border)] bg-transparent px-3.5 py-3.5 text-center text-[16px] font-semibold tracking-[0.5em] outline-none focus:border-[var(--signal)]"
              />
              {error && <ErrorNote text={error} />}
              <PrimaryButton disabled={busy || otp.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify and continue
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setOtpStep(false);
                  setError(null);
                  setOtp("");
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-text-dim transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Use a different method
              </button>
            </form>
          ) : namePrompt ? (
            /* ---------------- name completion (Google) ---------------- */
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const name = nameValue.trim();
                if (!name) return;
                await completeProfile({ name });
                navigate(redirect, { replace: true });
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  One last thing
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  What should we call you? This shows on your dashboard.
                </p>
              </div>
              <Field
                label="Your name"
                value={nameValue}
                autoFocus
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="e.g. Aarav"
                required
              />
              <PrimaryButton disabled={!nameValue.trim()}>
                Enter Manthan
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </form>
          ) : (
            <>
              {mode === "signIn" ? (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="flex flex-col gap-4"
                  key="signin"
                >
                  <div>
                    <h1 className="font-display text-lg font-bold tracking-tight">
                      Welcome back
                    </h1>
                    <p className="mt-1 text-sm text-text-dim">
                      Sign in to reach your notebooks.
                    </p>
                  </div>
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    required
                    disabled={submitting}
                  />
                  <div className="relative">
                    <Field
                      label="Password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      required
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-[30px] text-text-dim transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {error && <ErrorNote text={error} />}
                  <PrimaryButton disabled={submitting}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Sign in
                    {busy ? null : <ArrowRight className="h-4 w-4" />}
                  </PrimaryButton>
                </form>
              ) : (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="flex flex-col gap-4"
                  key="signup"
                >
                  <div>
                    <h1 className="font-display text-lg font-bold tracking-tight">
                      Create your account
                    </h1>
                    <p className="mt-1 text-sm text-text-dim">
                      Free to start — your first notebook is a minute away.
                    </p>
                  </div>
                  <Field
                    label="Your name"
                    name="name"
                    autoComplete="name"
                    placeholder="e.g. Aarav"
                    required
                    disabled={submitting}
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    required
                    disabled={submitting}
                  />
                  <div className="relative">
                    <Field
                      label="Password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      minLength={8}
                      required
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-[30px] text-text-dim transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {error && <ErrorNote text={error} />}
                  <PrimaryButton disabled={submitting}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create account
                    {busy ? null : <ArrowRight className="h-4 w-4" />}
                  </PrimaryButton>
                </form>
              )}

              {/* mode switch */}
              <p className="mt-4 text-center text-sm text-text-dim">
                {mode === "signIn"
                  ? "New to Manthan?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signIn" ? "signUp" : "signIn");
                    setError(null);
                  }}
                  className="font-semibold text-[var(--signal)] transition-opacity hover:opacity-80"
                >
                  {mode === "signIn" ? "Create one" : "Sign in"}
                </button>
              </p>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--card-border)]" />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-dim">
                  or
                </span>
                <span className="h-px flex-1 bg-[var(--card-border)]" />
              </div>

              {/* Google — only when the deployment has credentials */}
              {googleConfigured && (
                <button
                  type="button"
                  onClick={() => void handleGoogle()}
                  className="mb-3 flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--card-border)] bg-transparent px-5 py-3 text-sm font-semibold transition-colors hover:border-[var(--signal)]"
                >
                  <GoogleMark />
                  Continue with Google
                </button>
              )}
              {googleError && <ErrorNote text={googleError} />}

              {/* email code, secondary */}
              <div className="mb-3 flex justify-center">
                <EmailCodeForm busy={busy} onSent={(email) => {
                  setOtpEmail(email);
                  setOtpStep(true);
                  setError(null);
                }} onError={(m) => setError(m)} />
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void handleGuest()}
                  disabled={busy}
                  className="text-xs font-medium text-text-dim transition-colors hover:text-foreground"
                >
                  Just exploring? Continue as guest
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 max-w-xs text-center text-[11px] leading-relaxed text-text-dim">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

/* ------------------------- small local pieces ------------------------- */

function ErrorNote({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-[color-mix(in_srgb,var(--signal)_35%,transparent)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--signal)]">
      {text}
    </p>
  );
}

function PrimaryButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <MovingBorderButton
      type="submit"
      disabled={disabled}
      className="w-full"
      innerClassName="w-full px-5 py-3 text-sm"
    >
      {children}
    </MovingBorderButton>
  );
}

/** Collapsible email-code sign-in (kept from the original flow). */
function EmailCodeForm({
  busy,
  onSent,
  onError,
}: {
  busy: boolean;
  onSent: (email: string) => void;
  onError: (message: string) => void;
}) {
  const { signIn } = useAuthActions();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-dim transition-colors hover:text-foreground"
      >
        <Mail className="h-3.5 w-3.5" />
        Sign in with an email code instead
      </button>
    );
  }

  return (
    <form
      className="flex w-full gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending) return;
        setSending(true);
        try {
          await signIn("email-otp", { email: email.trim().toLowerCase() });
          onSent(email.trim().toLowerCase());
        } catch (err) {
          onError(
            err instanceof Error ? err.message : "Could not send the code.",
          );
        } finally {
          setSending(false);
        }
      }}
    >
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
        placeholder="name@example.com"
        className="min-w-0 flex-1 rounded-full border border-[var(--card-border)] bg-transparent px-4 py-2.5 text-[16px] outline-none placeholder:text-text-dim/60 focus:border-[var(--signal)]"
      />
      <button
        type="submit"
        disabled={sending || busy}
        className="glass-chip shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close email code form"
        className="px-1 text-xs text-text-dim"
      >
        Cancel
      </button>
    </form>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-text-dim" />
        </div>
      }
    >
      <Auth {...props} />
    </Suspense>
  );
}
