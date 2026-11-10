import { LogoMark } from "@/components/landing/Logo";
import { useEffect, useState } from "react";

/**
 * The first paint of an installed app launch.
 *
 * This is deliberately outside the router so a route change never replays it.
 * It is also deliberately not shown in a browser tab: the marketing site and
 * the signed-in web app are websites, not the app window. Only a standalone
 * PWA / home-screen launch gets this one branded beat.
 */
function launchedAsApp() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  if (iosStandalone === true) return true;
  return ["standalone", "fullscreen", "minimal-ui"].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

export function AppLaunch() {
  const [enabled] = useState(() => launchedAsApp());
  const [gone, setGone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setGone(true), reduced ? 300 : 1060);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  if (!enabled || gone) return null;

  return (
    <div className="app-launch" aria-hidden="true">
      <LogoMark className="app-launch__mark h-auto" color="#fff" />
    </div>
  );
}

export default AppLaunch;
