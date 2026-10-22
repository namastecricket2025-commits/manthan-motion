import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { LogoMark } from "@/components/landing/Logo";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
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
  if (
    returnTo?.startsWith("/") &&
    !returnTo.startsWith("//") &&
    /* Returning to the sign-in page would bounce the visitor straight back
       into the form they just completed. */
    !returnTo.startsWith("/auth")
  ) {
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState<string | null>(null);
  const [nameStep, setNameStep] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const askedRef = useRef(false);

  // "Forgot password?" links come back here marked as a recovery trip, and the
  // student chooses a new password before they are let into the app.
  const wantsRecovery = searchParams.get("mode") === "recovery";
  const [recoveryDone, setRecoveryDone] = useState(false);
  const inRecovery = wantsRecovery && isAuthenticated && !recoveryDone;

  // Signed-in users go straight through — unless they still owe us a name
  // (only possible with a provider that returned none) or a new password.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (inRecovery) return;
    if (user && !user.name && !askedRef.current) {
      askedRef.current = true;
      setNameStep(true);
      return;
    }
    if (!nameStep) navigate(redirect, { replace: true });
  }, [
    authLoading,
    isAuthenticated,
    user,
    nameStep,
    inRecovery,
    navigate,
    redirect,
  ]);

  /** Where Supabase should send the browser back to after Google / email links. */
  const returnUrl = `${window.location.origin}/auth?returnTo=${encodeURIComponent(redirect)}`;

  /* --------------- email + password --------------- */

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      if (mode === "signUp") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // The name travels with the account, so we never have to ask twice.
            data: { name: name || email.split("@")[0] },
            emailRedirectTo: returnUrl,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setConfirmationSent(email);
          setBusy(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      setError(
        /Invalid login credentials/i.test(message)
          ? "Incorrect email or password."
          : /Email not confirmed/i.test(message)
            ? "Confirm your email address first — the link is in your inbox."
            : /already registered|already exists/i.test(message)
              ? "An account with that email already exists — switch to Sign in."
              : /at least 6 characters/i.test(message)
                ? "Password must be at least 6 characters."
                : message,
      );
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    const email = (document.getElementById("auth-email") as HTMLInputElement)
      ?.value?.trim()
      .toLowerCase();
    if (!email) {
      setError("Enter your email address first, then tap “Forgot password?”.");
      return;
    }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth?mode=recovery` },
    );
    if (resetError) setError(resetError.message);
    else setNotice(`Password reset link sent to ${email}.`);
  }

  /* --------------- Google --------------- */

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: returnUrl,
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setBusy(false);
      setError(
        "Google sign-in could not start. Make sure the Google provider is enabled for this project, or use email and password.",
      );
    }
    // On success the browser leaves the page for Google, so nothing else to do.
  }

  const submitting = busy;

  return (
    <div className="relative min-h-[100svh] overflow-x-clip bg-background text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-dot-field" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-md flex-col items-center justify-center px-4 py-10">
        <Link
          to="/"
          className="mb-7 flex flex-col items-center gap-2 text-center"
          aria-label="Manthan home"
        >
          <LogoMark className="h-14 w-14" />
          <span className="font-display text-2xl font-bold tracking-tight">
            Manthan
          </span>
          <span className="text-xs font-medium tracking-wide text-text-dim">
            Study material, distilled.
          </span>
        </Link>

        <div className="glass-panel w-full rounded-3xl p-5 sm:p-7">
          {inRecovery ? (
            /* ---------------- choose a new password ---------------- */
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const password = String(form.get("password") ?? "");
                const confirm = String(form.get("confirm") ?? "");
                if (password !== confirm) {
                  setError("Both passwords must match.");
                  return;
                }
                setBusy(true);
                setError(null);
                const { error: updateError } = await supabase.auth.updateUser({
                  password,
                });
                setBusy(false);
                if (updateError) {
                  setError(updateError.message);
                  return;
                }
                setRecoveryDone(true);
                navigate(redirect, { replace: true });
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  Choose a new password
                </h1>
                <p className="mt-1 text-sm text-text-dim">
                  You're signed in from the reset link — set the password you'll
                  use next time.
                </p>
              </div>
              <Field
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                minLength={6}
                required
                autoFocus
              />
              <Field
                label="Confirm password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Type it again"
                minLength={6}
                required
              />
              {error && <ErrorNote text={error} />}
              <PrimaryButton disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save password
                {busy ? null : <ArrowRight className="h-4 w-4" />}
              </PrimaryButton>
            </form>
          ) : confirmationSent ? (
            /* ---------------- confirmation sent ---------------- */
            <div className="flex flex-col gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_10%,transparent)] text-[var(--signal)]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  Check your inbox
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-text-dim">
                  We sent a confirmation link to{" "}
                  <span className="text-foreground">{confirmationSent}</span>.
                  Open it to finish setting up your account — if you already had
                  an account with this address, just sign in instead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmationSent(null);
                  setMode("signIn");
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-text-dim transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
            </div>
          ) : nameStep ? (
            /* ---------------- name completion ---------------- */
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const name = nameValue.trim();
                if (!name) return;
                setBusy(true);
                await supabase.auth.updateUser({ data: { name } });
                setBusy(false);
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
                placeholder="e.g. Luv"
                required
              />
              <PrimaryButton disabled={!nameValue.trim() || busy}>
                Enter Manthan
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </form>
          ) : (
            <>
              <form
                onSubmit={handlePasswordSubmit}
                className="flex flex-col gap-4"
                key={mode}
              >
                <div>
                  <h1 className="font-display text-lg font-bold tracking-tight">
                    {mode === "signIn" ? "Welcome back" : "Create your account"}
                  </h1>
                  <p className="mt-1 text-sm text-text-dim">
                    {mode === "signIn"
                      ? "Sign in to reach your notebooks."
                      : "Free to start — your first notebook is a minute away."}
                  </p>
                </div>

                {mode === "signUp" && (
                  <Field
                    label="Your name"
                    name="name"
                    autoComplete="name"
                    placeholder="e.g. Luv"
                    required
                    disabled={submitting}
                  />
                )}

                <Field
                  label="Email"
                  id="auth-email"
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
                    autoComplete={
                      mode === "signIn" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "signIn"
                        ? "Your password"
                        : "At least 6 characters"
                    }
                    minLength={6}
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

                {mode === "signIn" && (
                  <div className="-mt-1 text-right">
                    <button
                      type="button"
                      onClick={() => void handleForgotPassword()}
                      className="text-xs font-medium text-text-dim transition-colors hover:text-foreground"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && <ErrorNote text={error} />}
                {notice && <NoticeNote text={notice} />}

                <PrimaryButton disabled={submitting}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {mode === "signIn" ? "Sign in" : "Create account"}
                  {busy ? null : <ArrowRight className="h-4 w-4" />}
                </PrimaryButton>
              </form>

              <p className="mt-4 text-center text-sm text-text-dim">
                {mode === "signIn"
                  ? "New to Manthan?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signIn" ? "signUp" : "signIn");
                    setError(null);
                    setNotice(null);
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

              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--card-border)] bg-transparent px-5 py-3 text-sm font-semibold transition-colors hover:border-[var(--signal)] disabled:opacity-60"
              >
                <GoogleMark />
                Continue with Google
              </button>
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

function NoticeNote({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--signal)_6%,transparent)] px-3.5 py-2.5 text-xs leading-relaxed text-text-dim">
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
