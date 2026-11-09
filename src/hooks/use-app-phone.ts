import { useEffect, useState } from "react";

const PHONE_QUERY = "(max-width: 759px)";

/**
 * The app's phone breakpoint, resolved before the first paint where possible.
 *
 * The shell changes at 760px (the desktop rail begins there), so a component
 * that needs a genuinely different phone composition must use the same line.
 * Starting from `matchMedia` instead of `false` avoids rendering the desktop
 * dashboard for one frame on a phone.
 */
export function useAppPhone() {
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia(PHONE_QUERY).matches;
    } catch {
      return window.innerWidth < 760;
    }
  });

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(PHONE_QUERY);
    } catch {
      return;
    }
    const onChange = () => setPhone(mql.matches);
    mql.addEventListener("change", onChange);
    setPhone(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return phone;
}
