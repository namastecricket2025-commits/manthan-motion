import { useEffect, useState } from "react";

/**
 * The single sidebar-width preference, shared by every page with the rail.
 *
 * A student who folds the sidebar on the dashboard expects it folded in the
 * Math Lab too, so the choice lives in localStorage and every shell reads the
 * same key rather than keeping its own copy.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("manthan-sidebar") === "collapsed";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "manthan-sidebar",
        collapsed ? "collapsed" : "open",
      );
    } catch {
      /* private mode */
    }
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}
