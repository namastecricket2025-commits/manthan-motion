import { useAuth } from "@/hooks/use-auth";
import {
  usePwaInstall,
  type InstallPlatform,
} from "@/hooks/use-pwa-install";
import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Layers,
  ListChecks,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { MovingBorderButton } from "./MovingBorderButton";

const AUTH_URL = "/auth?returnTo=%2Fdashboard";

const STEPS: Record<InstallPlatform, string[]> = {
  ios: [
    "Open this page in Safari.",
    "Tap the Share button in the toolbar.",
    "Scroll down and tap “Add to Home Screen”.",
    "Tap “Add” — Manthan appears with your other apps.",
  ],
  android: [
    "Open the browser menu (⋮).",
    "Tap “Install app” or “Add to Home screen”.",
    "Confirm — Manthan opens full-screen from your home screen.",
  ],
  desktop: [
    "Look for the install icon in the address bar.",
    "Or open the browser menu and choose “Install Manthan”.",
    "Confirm — Manthan opens in its own window.",
  ],
};

const PLATFORM_LABEL: Record<InstallPlatform, string> = {
  ios: "On iPhone or iPad",
  android: "On Android",
  desktop: "On this computer",
};

const APP_ROWS = [
  { label: "Summaries", Icon: BookOpen },
  { label: "Flashcards", Icon: Layers },
  { label: "Question banks", Icon: ListChecks },
] as const;

/**
 * The install section.
 *
 * Chromium hands the page a `beforeinstallprompt` event; everywhere else
 * (notably every iPhone, where Add to Home Screen is a Safari menu item) the
 * button opens the written steps instead. That is why the section never
 * claims a device can install when the browser has not offered it.
 */
export default function InstallApp() {
  const ref = useRef<HTMLElement | null>(null);
  const { isAuthenticated } = useAuth();
  const { canPrompt, installed, platform, install } = usePwaInstall();
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-install-reveal]");
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (canPrompt) {
      setBusy(true);
      try {
        const outcome = await install();
        // The event can disappear between render and click (another install
        // surface used it, or the browser withdrew it); fall back to steps.
        if (outcome === "unavailable") setShowSteps(true);
        if (outcome === "accepted") {
          toast.success("Manthan installed", {
            description: "Open it from your home screen.",
          });
        }
      } catch {
        setShowSteps(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setShowSteps((open) => !open);
  };

  const buttonLabel = canPrompt
    ? "Install Manthan"
    : platform === "ios"
      ? "Add to Home Screen"
      : "How to install";

  return (
    <section
      id="app"
      ref={ref}
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 pt-4 sm:px-6 sm:pb-24 sm:pt-8"
    >
      <div
        data-install-reveal
        className="glass-panel overflow-hidden"
      >
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 sm:p-10 lg:p-12">
            <span className="glass-chip inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">
              <Smartphone className="h-3.5 w-3.5 text-[var(--signal)]" />
              The Manthan app
            </span>

            <h2 className="mt-5 max-w-xl font-display text-[30px] font-normal leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[38px] md:text-[42px]">
              Keep Manthan{" "}
              <span className="gradient-text">one tap away.</span>
            </h2>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-text-dim">
              Install it straight from your browser. It opens full-screen like
              any other app, updates itself, and keeps your downloaded study
              kits reachable when the signal drops.
            </p>

            <ul className="mt-6 grid gap-2.5 text-sm text-text-dim sm:grid-cols-2">
              {[
                "Home-screen icon, no app store",
                "Works on Android and iPhone",
                "Free to install — no download fee",
                "Updates without an app store",
              ].map((fact) => (
                <li key={fact} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--primary-foreground)]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </span>
                  {fact}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <MovingBorderButton
                onClick={handleInstall}
                loading={busy}
                disabled={busy}
                ariaLabel={buttonLabel}
                innerClassName="px-6 py-3 text-sm"
              >
                <Download className="h-4 w-4" />
                {buttonLabel}
              </MovingBorderButton>
              <Link
                to={isAuthenticated ? "/dashboard" : AUTH_URL}
                className="inline-flex items-center gap-1.5 px-1 py-2 text-sm font-medium text-text-dim transition-colors hover:text-foreground"
              >
                {isAuthenticated ? "Open your workspace" : "Start free in the browser"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <p className="mt-3 text-[12px] leading-relaxed text-text-dim">
              No Play Store or App Store account. Nothing to pay to put it on
              your phone.
            </p>

            {showSteps && (
              <div
                role="region"
                aria-label="Install instructions"
                className="mt-6 rounded-xl border border-[var(--card-border)] bg-[color-mix(in_srgb,var(--text-main)_3%,transparent)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-foreground">
                    {platform === "ios" ? (
                      <Share2 className="h-3.5 w-3.5 text-[var(--signal)]" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5 text-[var(--signal)]" />
                    )}
                    {PLATFORM_LABEL[platform]}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSteps(false)}
                    aria-label="Close install instructions"
                    className="-mr-2 -mt-2 flex h-8 w-8 items-center justify-center rounded-md text-text-dim transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ol className="mt-3 space-y-2.5">
                  {STEPS[platform].map((step, index) => (
                    <li
                      key={step}
                      className="flex gap-2.5 text-[13px] leading-relaxed text-text-dim"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] text-[10px] font-semibold text-foreground">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {platform === "ios" && (
                  <p className="mt-3 text-[12px] leading-relaxed text-text-dim">
                    Add to Home Screen lives in Safari's Share menu. If you are
                    reading this inside another browser or an in-app browser,
                    open the page in Safari first.
                  </p>
                )}
                {platform === "android" && (
                  <p className="mt-3 text-[12px] leading-relaxed text-text-dim">
                    If the browser menu has no install option, open this page
                    in Chrome first — in-app browsers cannot add home-screen
                    apps.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* A real phone surface, not a claim about one. The frame is fixed
              dark in both themes because it is a device — the app icon and the
              cream-on-black screen are the same artwork everywhere. */}
          <div className="relative flex items-center justify-center border-t border-[var(--card-border)] p-8 lg:border-l lg:border-t-0 lg:p-10">
            <div className="relative w-[218px] rounded-[2.6rem] border border-[#302d27] bg-[#1a1917] p-2.5 shadow-[0_28px_60px_-28px_rgba(0,0,0,0.65)] sm:w-[238px]">
              <div className="overflow-hidden rounded-[2.05rem] border border-white/10 bg-[#0b0b0c]">
                <div className="flex justify-center pt-2">
                  <span className="h-1 w-14 rounded-full bg-white/15" />
                </div>
                <div className="px-5 pb-6 pt-5 text-center">
                  <img
                    src="/icons/icon-192.png"
                    alt=""
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16 rounded-[1.15rem]"
                  />
                  <p className="mt-3 font-display text-lg font-semibold tracking-[-0.025em] text-[#f7f3ea]">
                    Manthan<span className="text-[#fbbf24]">.</span>
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-[#8e887d]">
                    Study material, distilled
                  </p>

                  <div className="mt-5 space-y-2 text-left">
                    {APP_ROWS.map(({ label, Icon }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#fbbf24] text-[#181207]">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <span className="text-[11px] font-medium text-[#f3eee4]">
                          {label}
                        </span>
                        <span className="ml-auto h-1 w-1 rounded-full bg-[#fbbf24]" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#fbbf24]">
                    <Download className="h-3 w-3" />
                    Offline kits
                  </div>
                </div>
                <div className="flex justify-center pb-2">
                  <span className="h-1 w-16 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
