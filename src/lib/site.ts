import { toast } from "sonner";

/**
 * One place for the public site facts.
 *
 * The product runs on `manthan.freebuff.app`; `SUPPORT_EMAIL` is the only
 * contact inbox. Change it here and every link follows — the footer, the legal
 * pages, the review-removal link and every "write to us" action.
 *
 * `SITE_URL` is used for canonical/OG tags and the sitemap that ships in
 * `public/`. Keep it in step with the deployment.
 */
export const SITE_URL = "https://manthan.freebuff.app";

export const SUPPORT_EMAIL = "luvmoond1508@gmail.com";

/** A mailto with an optional prefilled subject and body, correctly encoded. */
export function supportMailto(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${SUPPORT_EMAIL}${query ? `?${query}` : ""}`;
}

/**
 * What a click on a contact link does.
 *
 * A bare `mailto:` silently does nothing on machines with no mail client and
 * inside sandboxed frames — which is exactly the "click does nothing" bug. So
 * the click always copies the address and says so, and the `href` still carries
 * the mailto for the browsers that can open one.
 */
export function supportClick(subject?: string) {
  return () => {
    const detail = subject ? `${SUPPORT_EMAIL} — subject “${subject}”` : SUPPORT_EMAIL;
    const copied = navigator.clipboard?.writeText(SUPPORT_EMAIL);
    if (copied && typeof copied.then === "function") {
      copied.then(
        () => toast.success("Email copied", { description: detail }),
        () => toast.info("Write to", { description: detail }),
      );
    } else {
      toast.info("Write to", { description: detail });
    }
  };
}
