import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { FeedbackPrompt } from "@/components/shared/TestimonialsFeedbackPrompt";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router";

/**
 * /feedback — the standing place to leave a review.
 *
 * The in-app prompt appears at most once a month; this page is the other half
 * of that deal: if someone wants to say something, they can find the form
 * without waiting to be asked. Both write the same testimonial row, and a row
 * only reaches the marketing page after approval and explicit consent.
 */
export default function Feedback() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative z-10">
        <Navbar />
        <main className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col items-center px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
          <header className="w-full">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Feedback<span className="text-[var(--signal)]">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-dim">
              Tell us what worked and what did not. A rating is enough; a line
              about the specific chapter helps more. Your review appears in the
              homepage reviews section straight away — untick the box on the
              form if you would rather keep it private.
            </p>
          </header>

          <div className="mt-8 flex w-full justify-center">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-text-dim" />
            ) : isAuthenticated ? (
              <FeedbackPrompt forceVisible />
            ) : (
              <div className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-6 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Sign in to leave feedback
                </p>
                <p className="mt-2 text-xs leading-relaxed text-text-dim">
                  A review is stored against one account so we can reply to a bug
                  report and remove it on request. That needs you signed in.
                </p>
                <Link
                  to="/auth?returnTo=%2Ffeedback"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--signal)] px-5 py-2.5 text-sm font-semibold text-[var(--panel)] transition-opacity hover:opacity-90"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>

          <p className="mt-6 max-w-sm text-center text-[11px] leading-relaxed text-text-dim">
            Feedback is stored against your account so we can follow up on a bug
            you report. You can ask for it to be removed at any time.
          </p>
        </main>
        <Footer />
      </div>
    </div>
  );
}
