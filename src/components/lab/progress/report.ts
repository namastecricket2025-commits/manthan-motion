import { EXPERIMENTS, matchesExperiment, progressKey } from "./catalog";

export type ProgressRow = {
  key: string;
  subject: string;
  title: string;
  status: "in_progress" | "completed";
  timeSeconds: number;
  observations: number;
  answers: number;
  notebookEntries: number;
  lastActiveAt: number;
  completedAt: number | null;
};

export type RecordRow = {
  title: string;
  subject: string;
  observations: Array<{
    values: Array<{ label: string; value: number; unit?: string }>;
    at: number;
  }>;
  measured: number | null;
  accepted: number | null;
  resultUnit: string | null;
};

export type NotebookRow = {
  id: string;
  kind: "worksheet" | "journal" | "notes";
  title: string;
  subject: string;
  experimentKey: string | null;
  content: {
    aim: string;
    apparatus: string;
    procedure: string;
    observations: string;
    conclusion: string;
    answers: Array<{ question: string; answer: string }>;
  };
  entries: Array<{ authorName: string; text: string; at: number }>;
  completedAt: number | null;
};

type ReportInput = {
  name: string;
  progress: ProgressRow[];
  records: RecordRow[];
  notebooks: NotebookRow[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(value: string) {
  return escapeHtml(value)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function number(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value) >= 1000
    ? value.toExponential(2)
    : value.toFixed(Math.abs(value) >= 100 ? 1 : 2).replace(/\.?0+$/, "");
}

function duration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

function tableForRecord(record: RecordRow) {
  const labels: Array<{ label: string; unit?: string }> = [];
  for (const row of record.observations) {
    for (const value of row.values) {
      if (!labels.some((entry) => entry.label === value.label)) {
        labels.push({ label: value.label, unit: value.unit });
      }
    }
  }
  if (!labels.length) return "";
  const head = labels
    .map((entry) => `<th>${escapeHtml(entry.label)}${entry.unit ? ` (${escapeHtml(entry.unit)})` : ""}</th>`)
    .join("");
  const body = record.observations
    .slice(-24)
    .map((row, index) => {
      const cells = labels
        .map((label) => {
          const found = row.values.find((value) => value.label === label.label);
          return `<td>${found ? number(found.value) : "—"}</td>`;
        })
        .join("");
      return `<tr><td>${index + 1}</td>${cells}</tr>`;
    })
    .join("");
  return `<table><thead><tr><th>No.</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * A printable lab report, not a JSON dump. It carries the same facts the
 * notebook shows: what was completed, the readings, the worksheet answers and
 * who contributed. Styling is deliberately plain so a browser's "Save as PDF"
 * produces a clean document.
 */
export function buildLabReport({ name, progress, records, notebooks }: ReportInput) {
  const completedKeys = new Set(
    progress.filter((row) => row.status === "completed").map((row) => row.key),
  );
  const touchedKeys = new Set(progress.map((row) => row.key));
  const completed = EXPERIMENTS.filter(
    (experiment) =>
      completedKeys.has(experiment.key) ||
      [...completedKeys].some((key) => matchesExperiment(key, experiment)),
  );
  const inProgress = EXPERIMENTS.filter(
    (experiment) =>
      !completed.includes(experiment) &&
      [...touchedKeys].some((key) => matchesExperiment(key, experiment)),
  );
  const notAttempted = EXPERIMENTS.filter(
    (experiment) =>
      !completed.includes(experiment) && !inProgress.includes(experiment),
  );
  const observations = records.reduce((total, record) => total + record.observations.length, 0);
  const answers = notebooks.reduce(
    (total, notebook) =>
      total +
      notebook.content.answers.filter((answer) => answer.answer.trim().length > 0).length,
    0,
  );
  const notes = notebooks.reduce((total, notebook) => total + notebook.entries.length, 0);
  const seconds = progress.reduce((total, row) => total + row.timeSeconds, 0);
  const generated = new Date().toLocaleString();

  const progressRows = EXPERIMENTS.map((experiment) => {
    const status = completed.includes(experiment)
      ? "Completed"
      : inProgress.includes(experiment)
        ? "In progress"
        : "Not attempted";
    const matching = progress.filter((row) => matchesExperiment(row.key, experiment));
    const time = matching.reduce((total, row) => total + row.timeSeconds, 0);
    const observed = records
      .filter((record) =>
        matchesExperiment(progressKey(record.subject, record.title), experiment),
      )
      .reduce((total, record) => total + record.observations.length, 0);
    return `<tr><td>${escapeHtml(experiment.title)}</td><td>${escapeHtml(experiment.subject)}</td><td>${status}</td><td>${duration(time)}</td><td>${observed}</td></tr>`;
  }).join("");

  const worksheets = notebooks
    .filter((notebook) => notebook.kind === "worksheet")
    .map((notebook) => {
      const answers = notebook.content.answers
        .map(
          (answer, index) =>
            `<div class="qa"><p class="q">${index + 1}. ${escapeHtml(answer.question)}</p><p>${answer.answer.trim() ? escapeHtml(answer.answer) : "<em>Not answered</em>"}</p></div>`,
        )
        .join("");
      const contributions = notebook.entries
        .map(
          (entry) =>
            `<li><strong>${escapeHtml(entry.authorName)}</strong> · ${new Date(entry.at).toLocaleString()}<br>${escapeHtml(entry.text)}</li>`,
        )
        .join("");
      return `<section class="sheet">
        <h2>${escapeHtml(notebook.title)}</h2>
        <p class="meta">${escapeHtml(notebook.subject)} · ${notebook.completedAt ? "Completed" : "In progress"} · updated ${new Date(notebook.completedAt ?? Date.now()).toLocaleDateString()}</p>
        <h3>Aim</h3>${paragraphs(notebook.content.aim) || "<p class='muted'>Not written</p>"}
        <h3>Apparatus</h3>${paragraphs(notebook.content.apparatus) || "<p class='muted'>Not written</p>"}
        <h3>Procedure</h3>${paragraphs(notebook.content.procedure) || "<p class='muted'>Not written</p>"}
        <h3>Observations</h3>${paragraphs(notebook.content.observations) || "<p class='muted'>No written observations</p>"}
        <h3>Questions</h3>${answers || "<p class='muted'>No questions</p>"}
        <h3>Conclusion</h3>${paragraphs(notebook.content.conclusion) || "<p class='muted'>Not written</p>"}
        ${contributions ? `<h3>Shared contributions</h3><ul>${contributions}</ul>` : ""}
      </section>`;
    })
    .join("");

  const recordsHtml = records
    .map(
      (record) => `<section class="sheet">
        <h2>${escapeHtml(record.title)}</h2>
        <p class="meta">${escapeHtml(record.subject)} · ${record.observations.length} readings${record.measured !== null ? ` · result ${number(record.measured)} ${escapeHtml(record.resultUnit ?? "")}` : ""}</p>
        ${tableForRecord(record)}
        ${record.measured !== null && record.accepted ? `<p class="meta">Percentage error: ${(Math.abs((record.measured - record.accepted) / record.accepted) * 100).toFixed(2)}%</p>` : ""}
      </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Manthan lab progress</title>
<style>
  @page { margin: 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #24221e; line-height: 1.5; margin: 0; }
  header { border-bottom: 2px solid #24221e; padding-bottom: 14px; margin-bottom: 22px; }
  .kicker { font-family: system-ui, sans-serif; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; }
  h1 { font-size: 30px; margin: 6px 0 4px; }
  h2 { font-size: 19px; margin: 0 0 2px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin: 16px 0 3px; }
  p { margin: 4px 0; }
  .meta, .muted { color: #6a655c; font-size: 12px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
  .card { border: 1px solid #d7d2c8; padding: 10px; }
  .card b { display: block; font-size: 22px; }
  table { width: 100%; border-collapse: collapse; font-family: system-ui, sans-serif; font-size: 11px; margin-top: 8px; }
  th, td { text-align: left; border-bottom: 1px solid #ddd8ce; padding: 5px 4px; }
  .sheet { break-inside: avoid; border-top: 1px solid #d7d2c8; padding-top: 14px; margin-top: 18px; }
  .qa { margin: 8px 0; }
  .q { font-weight: 600; }
  ul { padding-left: 16px; font-size: 12px; }
  footer { margin-top: 26px; border-top: 1px solid #d7d2c8; padding-top: 10px; font-family: system-ui, sans-serif; font-size: 10px; color: #6a655c; }
  @media print { .sheet { break-inside: avoid; } }
</style></head>
<body>
  <header>
    <p class="kicker">Manthan · STEM Lab</p>
    <h1>Lab progress report</h1>
    <p>${escapeHtml(name || "Student")} · generated ${escapeHtml(generated)}</p>
  </header>
  <div class="summary">
    <div class="card"><span class="meta">Completed</span><b>${completed.length} / ${EXPERIMENTS.length}</b></div>
    <div class="card"><span class="meta">In progress</span><b>${inProgress.length}</b></div>
    <div class="card"><span class="meta">Time at the bench</span><b>${duration(seconds)}</b></div>
    <div class="card"><span class="meta">Observations</span><b>${observations}</b></div>
    <div class="card"><span class="meta">Answers saved</span><b>${answers}</b></div>
    <div class="card"><span class="meta">Notebook entries</span><b>${notes}</b></div>
    <div class="card"><span class="meta">Not attempted</span><b>${notAttempted.length}</b></div>
  </div>
  <table>
    <thead><tr><th>Experiment</th><th>Subject</th><th>Status</th><th>Time</th><th>Readings</th></tr></thead>
    <tbody>${progressRows}</tbody>
  </table>
  ${worksheets}
  ${recordsHtml}
  <footer>Generated from saved bench readings and notebook entries. Empty fields are left empty, not filled in by the report.</footer>
</body></html>`;
}

export function downloadLabReport(input: ReportInput) {
  const html = buildLabReport(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `manthan-lab-progress-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function printLabReport(input: ReportInput) {
  const html = buildLabReport(input);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
