import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useState } from "react";
import type { Field } from "@/components/lab/practical/stats";

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
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const record = useCallback(
    async (subject: string, title: string, values: Field[]) => {
      setState("saving");
      setMessage("");
      try {
        const reply = await add({ subject, title, values });
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
    [add],
  );

  const reset = useCallback(() => {
    setState("idle");
    setMessage("");
  }, []);

  return { record, state, message, reset };
}
