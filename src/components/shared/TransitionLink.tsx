import { useViewTransitionNavigate } from "@/lib/view-transitions";
import { Link, type LinkProps } from "react-router";

/**
 * A `<Link>` whose navigation runs inside a View Transition.
 *
 * Ordinary link behaviour is preserved: modified clicks (new tab, download,
 * save) are left to the browser, and a link that calls `preventDefault` in its
 * own `onClick` keeps control. Only the plain left-click path is intercepted.
 */
export function TransitionLink({ to, onClick, ...rest }: LinkProps) {
  const go = useViewTransitionNavigate();

  return (
    <Link
      to={to}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        if (rest.target && rest.target !== "_self") return;
        if (rest.download) return;

        event.preventDefault();
        go(to, {
          replace: rest.replace,
          state: rest.state,
          preventScrollReset: rest.preventScrollReset,
          relative: rest.relative,
        });
      }}
    />
  );
}
