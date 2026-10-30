import { useMemo, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useSearchParams } from "react-router";

/**
 * A bench setup as a link.
 *
 * A teacher can hand out an exact arrangement — this slide at 40×, this salt,
 * this instrument on this specimen — with a task attached. The preset is
 * encoded into the URL itself, so there is no server row to expire and the link
 * works for a student who is not signed in yet. Only values the bench actually
 * uses are shared; a malformed preset is ignored and the bench opens on its
 * defaults rather than guessing.
 */

export type BenchPreset = Record<string, string | number | boolean | null>;

function encode(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const value = JSON.parse(json) as unknown;
    return value && typeof value === "object" ? (value as T) : null;
  } catch {
    return null;
  }
}

/** Read the preset and task from the current URL. */
export function useBenchPreset<T extends BenchPreset>(): { preset: T | null; task: string } {
  const [params] = useSearchParams();
  const raw = params.get("preset");
  const task = params.get("task") ?? "";
  const preset = useMemo(() => decode<T>(raw), [raw]);
  return { preset, task };
}

export function presetUrl(subject: string, bench: string, preset: BenchPreset, task: string) {
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("bench", bench);
  /* Biology calls its benches plates; the same key lets its link name the
     right one without a second URL scheme. */
  params.set("plate", bench);
  params.set("preset", encode(preset));
  if (task.trim()) params.set("task", task.trim().slice(0, 220));
  return `${window.location.origin}/lab?${params.toString()}`;
}

/**
 * The share control under a bench.
 *
 * It asks for the task in the same breath as the link, because a setup without
 * an instruction is just a screenshot. Copying uses the clipboard API; if the
 * browser refuses, the link is shown selected so it can still be copied by
 * hand.
 */
export function ShareSetup({
  subject,
  bench,
  preset,
  className,
}: {
  subject: string;
  bench: string;
  preset: BenchPreset;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");

  const link = open ? presetUrl(subject, bench, preset, task) : "";

  const copy = async () => {
    const url = presetUrl(subject, bench, preset, task);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManual("");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setManual(url);
    }
  };

  return (
    <div className={"lab-share " + (className ?? "")}>
      <button
        type="button"
        className="lab-share__trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share this setup
      </button>

      {open ? (
        <div className="lab-share__panel">
          <label className="lab-share__task">
            <span>Task for the student (optional)</span>
            <input
              value={task}
              maxLength={220}
              onChange={(event) => setTask(event.target.value)}
              placeholder="e.g. Read the diameter to 0.01 mm, then find the zero error."
            />
          </label>
          <div className="lab-share__row">
            <button type="button" className="apple-lab-btn !px-2.5 !py-1 !text-[11px]" onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
            <span className="lab-share__note">
              The link restores this exact bench, setup and task.
            </span>
          </div>
          {manual ? (
            <input
              className="lab-share__manual"
              readOnly
              value={manual}
              aria-label="Setup link"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
          {link ? <span className="lab-share__sr">{link.length} characters</span> : null}
        </div>
      ) : null}
    </div>
  );
}
