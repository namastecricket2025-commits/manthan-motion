/**
 * One place for the public site facts.
 *
 * The product runs on `manthan.freebuff.app`, but the footer, the legal pages
 * and the review-removal link all used `@manthan.app` addresses, which is a
 * different domain — a user who clicked "Contact" wrote to a mailbox that does
 * not exist. The address below is the only verified inbox for this deployment
 * (it is also the owner configured through `MANTHAN_OWNER_EMAIL`), so it is the
 * one contact path. Change it here and every link follows.
 *
 * `SITE_URL` is used for canonical/OG tags and the sitemap that ships in
 * `public/`. Keep it in step with the deployment.
 */
export const SITE_URL = "https://manthan.freebuff.app";

export const SUPPORT_EMAIL = "namastecricket2025@gmail.com";

/** A mailto with an optional prefilled subject and body, correctly encoded. */
export function supportMailto(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${SUPPORT_EMAIL}${query ? `?${query}` : ""}`;
}
