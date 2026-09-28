/**
 * Reproduction harness — renders the Reactions tab, clicks React on every
 * preset under StrictMode, and asserts the readout renders from data.
 */import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register({ url: "http://localhost/" });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// Motionless Mode: the app collapses every transition (incl. the tab-swap
// AnimatePresence) to duration 0, so `mode="wait"` mounts the next tab
// without waiting on a spring that happy-dom's clock never advances.
document.documentElement.dataset.motion = "reduced";

const seen: string[] = [];
for (const level of ["error", "warn", "info", "log"] as const) {
  const orig = console[level];
  console[level] = (...args: unknown[]) => {
    const line = args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
        try {
          return typeof a === "string" ? a : JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");
    seen.push(`[console.${level}] ${line}`);
    orig.apply(console, args);
  };
}
window.addEventListener("error", (e) => {
  seen.push(`[window.error] ${e.message}`);
});
window.addEventListener("unhandledrejection", (e) => {
  // happy-dom rejects WAAPI Animation.finished on cancel(); real browsers
  // swallow this — tag it as an artifact instead of a failure.
  const text = String(e.reason);
  seen.push(
    text.includes("AbortError") || text.includes("animation was canceled")
      ? `[artifact] ${text.slice(0, 80)}`
      : `[unhandledrejection] ${text}`,
  );
});
// Keep the run alive when happy-dom's animation artifacts reject.
process.on("unhandledRejection", () => {});

const { createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { act, fireEvent, waitFor } = await import("@testing-library/react");

const ReactPkg = await import("react");
const ReactionsModule = await import("./src/components/lab/ChemistryGlassLab");

function findReactButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll("button"));
  return buttons.find((b) => (b.textContent ?? "").includes("React")) ?? null;
}

async function run() {
  const root = createRoot(document.body);
  const mod: any = ReactionsModule;
  console.info("exports:", Object.keys(mod));

  // Render ReactionsTab directly — the tab-swap AnimatePresence can't finish
  // its exit under happy-dom's clock, and this keeps the harness on the
  // component under test.
  const Component = mod.ReactionsTab;

  // StrictMode double-mount, like the dev server.
  await act(async () => {
    root.render(
      createElement(ReactPkg.StrictMode, null, createElement(Component)),
    );
  });

  const tabButton = Array.from(document.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").trim() === "Reactions",
  );
  // tabButton is unused when driving the inner tab directly.
  void tabButton;

  // The picked rows are the buttons carrying the equation (they contain the
  // arrow); group headings are plain divs, so this cannot catch them.
  const pickers = (Array.from(
    document.querySelectorAll("button[aria-pressed]"),
  ) as HTMLButtonElement[]).filter((b) => (b.textContent ?? "").includes("\u2192"));
  console.info(`picked buttons: ${pickers.length}`);
  const allPressed = Array.from(document.querySelectorAll("button[aria-pressed]"));
  console.info(
    `aria-pressed total: ${allPressed.length}; first texts: ` +
      allPressed
        .slice(0, 3)
        .map((b) => JSON.stringify((b.textContent ?? "").slice(0, 50)))
        .join(" | "),
  );

  const reactBtn = findReactButton();
  console.info(`react button found: ${Boolean(reactBtn)}`);

  for (const row of pickers) {
    fireEvent.click(row);
    const label = (row.textContent ?? "").slice(0, 40);
    const btn = findReactButton();
    if (!btn) {
      seen.push(`[harness] React button missing on "${label}"`);
      continue;
    }
    fireEvent.click(btn);
    // Double-click (impatient users) and let queued timers/effects flush.
    fireEvent.click(btn);
    await new Promise((r) => setTimeout(r, 40));

    // Assert the readout rendered from data, not an error string.
    const body = document.body.textContent ?? "";
    if (!body.includes("Classification"))
      seen.push(`[harness] no classification after React on "${label}"`);
    if (/something went wrong/i.test(body))
      seen.push(`[harness] error dialog visible on "${label}"`);
    if (!body.includes("Balanced equation"))
      seen.push(`[harness] equation card missing on "${label}"`);
  }

  await new Promise((r) => setTimeout(r, 1900));

  console.info("=== HARNESS DONE ===");
  const failures = seen.filter(
    (l) =>
      (l.startsWith("[harness]") ||
        l.startsWith("[unhandledrejection]") ||
        l.startsWith("[window.error]") ||
        (l.startsWith("[console.error]") && !l.includes("not wrapped in act")) ||
        l.startsWith("[console.warn]")) &&
      !l.startsWith("[artifact]"),
  );
  for (const line of Array.from(new Set(failures)).slice(0, 8)) console.info(line);
  console.info(`failures (unique: ${new Set(failures).size} of ${failures.length}):`);
  process.exit(failures.length ? 1 : 0);
}

run().catch((e) => {
  console.error("[harness crash]", e);
  console.info(seen.join("\n"));
  process.exit(1);
});
