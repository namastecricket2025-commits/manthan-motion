import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Field } from "@/components/lab/practical/stats";

function progressKey(subject: string, title: string) {
  return `${subject}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Record one observation from a bench.
 *
 * The bench supplies numbers it has already measured, never a value it thinks
 * the student should see. A failed write (signed out, offline) is reported at
 * the bench instead of being swallowed, so nobody believes a reading was saved
 * when it was not.
 */
export function useRecorder() {
  const add = useMutation(api.labRecords.addObservation);
  const touch = useMutation(api.labProgress.touch);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  /* Time starts at the first saved reading, not at page load: opening a bench
     and walking away should not count as lab work. */
  const session = useRef<{ subject: string; title: string; started: number } | null>(null);

  const flushTime = useCallback(() => {
    const active = session.current;
    if (!active) return;
    const seconds = Math.floor((Date.now() - active.started) / 1000);
    if (seconds < 2) return;
    active.started = Date.now();
    void touch({
      key: progressKey(active.subject, active.title),
      subject: active.subject,
      title: active.title,
      seconds,
    }).catch(() => undefined);
  }, [touch]);

  useEffect(() => {
    const timer = window.setInterval(flushTime, 60_000);
    return () => {
      window.clearInterval(timer);
      flushTime();
    };
  }, [flushTime]);

  const record = useCallback(
    async (subject: string, title: string, values: Field[]) => {
      setState("saving");
      setMessage("");
      try {
        const reply = await add({ subject, title, values });
        if (!session.current) {
          session.current = { subject, title, started: Date.now() };
        }
        void touch({
          key: progressKey(subject, title),
          subject,
          title,
          observations: 1,
        }).catch(() => undefined);
        setState("done");
        setMessage(
          reply.created
            ? `Started “${title}” — first reading saved.`
            : `Reading ${reply.count} saved to “${title}”.`,
        );
        return true;
      } catch (err) {
        setState("error");
        setMessage(
          err instanceof Error && /sign/i.test(err.message)
            ? "Sign in to keep a practical record."
            : "The reading could not be saved just now.",
        );
        return false;
      }
    },
    [add, touch],
  );

  const reset = useCallback(() => {
    flushTime();
    session.current = null;
    setState("idle");
    setMessage("");
  }, [flushTime]);

  return { record, state, message, reset };
}
