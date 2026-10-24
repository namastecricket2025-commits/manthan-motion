import { useResolvedTheme } from "@/lib/app-settings";

/**
 * The bench light.
 *
 * A bench used to carry its own dark/light switch on top of the site theme,
 * seeded once from the theme at mount. The two then drifted: flipping the site
 * to paper left the bench black, and its white "Light bench" control was drawn
 * on a paper page it could not be seen against. There is one theme in the
 * product now — the sidebar's switch — and every bench reads it. A bench is a
 * surface of the page, not a room with its own light.
 */
export function useLabTheme(): "dark" | "light" {
  return useResolvedTheme();
}
