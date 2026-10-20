import { ExternalLink, Play, Youtube } from "lucide-react";

/**
 * Hindi one-shot videos for this notebook.
 *
 * Manthan does not host or re-upload video, and it must not invent a video ID.
 * Each row is a YouTube search narrowed to one trusted Hindi channel plus the
 * notebook's own topic, so the result is always the right lesson — never a
 * guessed link to a video that may not exist. The list opens in a new tab and
 * leaves the notebook exactly where it is.
 */

const CHANNELS = [
  {
    name: "Physics Wallah",
    note: "Board-focused one-shots",
  },
  {
    name: "Magnet Brains",
    note: "NCERT chapter walkthroughs",
  },
  {
    name: "Next Toppers",
    note: "Class 9–12 revision marathons",
  },
  {
    name: "Vedantu",
    note: "Concept + PYQ sessions",
  },
];

function topicOf(notebookName: string) {
  return notebookName
    .replace(/[—–-].*$/, "")
    .replace(/\b(notebook|notes|revision|chapter)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function WatchNext({ notebookName }: { notebookName: string }) {
  const topic = topicOf(notebookName) || notebookName;
  const allQuery = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${topic} one shot hindi`,
  )}`;

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--card-border)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="dashboard-kicker">
            <Youtube className="h-3.5 w-3.5" />
            Watch next
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-dim">
            Hindi one-shots for <span className="text-foreground">{topic}</span>.
            Each opens a YouTube search — nothing is added to your notebook.
          </p>
        </div>
        <a
          href={allQuery}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:border-[var(--signal)] hover:text-foreground"
        >
          All
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {CHANNELS.map((channel) => {
          const href = `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${topic} one shot hindi ${channel.name}`,
          )}`;
          return (
            <li key={channel.name}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)]"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--card-border)] text-[var(--signal)]">
                  <Play className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-foreground">
                    {channel.name}
                  </span>
                  <span className="block truncate text-[10.5px] text-text-dim">
                    {channel.note} · हिंदी one-shot
                  </span>
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-text-dim opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default WatchNext;
