import { Check, Copy, Mail, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SUPPORT_EMAIL, gmailComposeUrl, supportMailto } from "@/lib/site";

/**
 * A contact action that always visibly does something.
 *
 * A bare `mailto:` is swallowed in a sandboxed frame or on a device with no
 * mail app, which read as a dead link. The click opens a small card that shows
 * the address and offers a copy button; the main action opens Gmail's compose
 * window with the recipient and subject already filled in, because Gmail in a
 * browser is what almost every student actually has. A small `mailto:` link is
 * still there for a desktop mail client.
 */
export function ContactButton({
  subject,
  body,
  className,
  children,
}: {
  subject: string;
  body?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      toast.success("Email copied", { description: SUPPORT_EMAIL });
    } catch {
      toast.info("Write to", { description: SUPPORT_EMAIL });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-card-title"
            className="w-full max-w-sm rounded-3xl border border-[var(--card-border)] bg-[var(--panel)] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="contact-card-title"
                  className="font-display text-base font-semibold tracking-tight"
                >
                  {subject}
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-text-dim">
                  Write to us and we reply from this inbox.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-text-dim transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <a
              href={gmailComposeUrl(subject, body)}
              target="_blank"
              rel="noreferrer"
              title="Open Gmail with the address filled in"
              className="mt-4 block truncate rounded-xl border border-[var(--card-border)] px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--text-main)_36%,transparent)]"
            >
              {SUPPORT_EMAIL}
            </a>

            <a
              href={gmailComposeUrl(subject, body)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--text-main)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--panel)] transition-transform active:scale-[0.98]"
            >
              <Mail className="h-3.5 w-3.5" />
              Open in Gmail
            </a>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyEmail()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--card-border)] px-4 py-2 text-[12px] font-medium text-text-dim transition-colors hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy address"}
              </button>
              <a
                href={supportMailto(subject, body)}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-[var(--card-border)] px-4 py-2 text-[12px] font-medium text-text-dim transition-colors hover:text-foreground"
              >
                Another mail app
              </a>
            </div>

            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-text-dim">
              Gmail opens a new message to us — add your own words and send.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ContactButton;
