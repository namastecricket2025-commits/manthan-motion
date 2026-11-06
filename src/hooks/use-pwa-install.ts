import { useCallback, useEffect, useState } from "react";

/**
 * Chrome's install event, which the DOM lib does not type. It is deliberately
 * kept here rather than in a global `.d.ts`: only the install UI needs it.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export type InstallPlatform = "ios" | "android" | "desktop";

/** True once the page is running from a home-screen install rather than a tab. */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Only `standalone`: F11 fullscreen on a desktop tab also reports
  // `display-mode: fullscreen`, which would wrongly hide the install prompt.
  const standalone = window.matchMedia?.(
    "(display-mode: standalone)",
  ).matches;
  // iOS Safari reports the installed state on navigator, not in matchMedia.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  return Boolean(standalone || iosStandalone);
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const ios =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ presents itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * The install flow without a framework wrapper.
 *
 * `canPrompt` is true only when Chromium has fired `beforeinstallprompt` — the
 * event that lets a site open the native install sheet. iOS and some desktop
 * browsers never fire it, so the UI falls back to written steps instead of
 * pretending the install happened.
 */
export function usePwaInstall() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isRunningStandalone);
  const [platform] = useState<InstallPlatform>(detectInstallPlatform);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Without this the browser shows its own mini-infobar and ignores the
      // in-page button.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayMode = () => {
      if (isRunningStandalone()) setInstalled(true);
    };
    displayMode?.addEventListener?.("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      displayMode?.removeEventListener?.("change", onDisplayMode);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return "unavailable" as const;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    // The event can only be used once; whether accepted or dismissed, drop it.
    setPromptEvent(null);
    if (choice.outcome === "accepted") setInstalled(true);
    return choice.outcome;
  }, [promptEvent]);

  return {
    canPrompt: Boolean(promptEvent),
    installed,
    platform,
    install,
  };
}
