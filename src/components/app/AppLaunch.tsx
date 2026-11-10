import { LogoMark } from "@/components/landing/Logo";
import { useEffect, useState } from "react";

/**
 * The first paint of a cold launch.
 *
 * This is deliberately outside the router: route changes should feel instant,
 * while an actual app launch gets one branded beat. The overlay is pure CSS,
 * pointer-transparent, and removes itself before the student can reach the
 * first control. Reduced-motion gets the same hand-off, just without the zoom.
 */
export function AppLaunch() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setGone(true), reduced ? 300 : 1780);
    return () => window.clearTimeout(timer);
  }, []);

  if (gone) return null;

  return (
    <div className="app-launch" aria-hidden="true">
      <span className="app-launch__aura" />
      <LogoMark className="app-launch__mark" />
    </div>
  );
}

export default AppLaunch;
