import {
  columnsOf,
  fitSeries,
  formatNumber,
  percentError,
  subjectLabel,
  type NotebookRecord,
} from "@/components/lab/practical/stats";

/**
 * The record page.
 *
 * A practical is submitted as a written record: aim, table, graph, result and
 * error. This draws exactly that onto a canvas and downloads it, so the
 * student has something they can print and paste into the school file. The
 * graph is the same least-squares fit the notebook shows on screen — the export
 * cannot disagree with the bench.
 */

const WIDTH = 1100;
const MARGIN = 64;
const INK = "#1f1c17";
const MUTED = "#6d665b";
const RULE = "#d8d2c4";
const PAPER = "#fffdf7";
const ACCENT = "#a4600a";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

export function downloadRecord(record: NotebookRecord, axes: { x: string; y: string } | null) {
  const observations = record.observations;
  const columns = columnsOf(observations);
  const fit = axes ? fitSeries(observations, axes.x, axes.y, columns) : null;
  const rows = Math.min(observations.length, 24);
  const tableHeight = 34 + rows * 28;
  const graphHeight = fit ? 360 : 90;
  const height = 170 + tableHeight + graphHeight + 190;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The browser could not draw the record.");
  ctx.scale(scale, scale);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, height);

  /* ---- header ---- */
  ctx.fillStyle = INK;
  ctx.font = "600 15px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("MANTHAN · STEM LAB", MARGIN, 62);
  ctx.font = "700 32px Georgia, 'Times New Roman', serif";
  const titleLines = wrap(ctx, record.title, WIDTH - MARGIN * 2);
  titleLines.forEach((line, index) => ctx.fillText(line, MARGIN, 106 + index * 38));
  ctx.font = "400 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = MUTED;
  const date = new Date(record.updatedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(`${subjectLabel(record.subject)}  ·  ${observations.length} observations  ·  ${date}`, MARGIN, 150 + (titleLines.length - 1) * 30);

  let y = 178 + (titleLines.length - 1) * 30;

  /* ---- table ---- */
  const shownColumns = columns.slice(0, 6);
  const colWidth = (WIDTH - MARGIN * 2) / (shownColumns.length + 1);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y + 8);
  ctx.lineTo(WIDTH - MARGIN, y + 8);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = "600 11px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("NO.", MARGIN + 6, y + 26);
  shownColumns.forEach((column, index) => {
    const label = column.unit ? `${column.label} (${column.unit})` : column.label;
    ctx.fillText(label.slice(0, 26), MARGIN + colWidth * (index + 1) + 6, y + 26);
  });
  y += 38;

  ctx.font = "400 13px ui-monospace, 'SF Mono', Menlo, monospace";
  for (let index = 0; index < rows; index += 1) {
    const observation = observations[index];
    ctx.fillStyle = MUTED;
    ctx.fillText(String(index + 1), MARGIN + 6, y + 17);
    ctx.fillStyle = INK;
    shownColumns.forEach((column, colIndex) => {
      const field = observation.values.find((entry) => entry.label === column.label);
      const value = field ? formatNumber(field.value, 2) : "—";
      ctx.fillText(value, MARGIN + colWidth * (colIndex + 1) + 6, y + 17);
    });
    ctx.strokeStyle = "rgba(31, 28, 23, 0.08)";
    ctx.beginPath();
    ctx.moveTo(MARGIN, y + 27);
    ctx.lineTo(WIDTH - MARGIN, y + 27);
    ctx.stroke();
    y += 28;
  }

  y += 24;

  /* ---- graph ---- */
  if (fit) {
    ctx.fillStyle = INK;
    ctx.font = "600 14px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText("Graph", MARGIN, y);
    y += 14;

    const plot = { left: MARGIN + 54, top: y + 12, width: WIDTH - MARGIN * 2 - 80, height: 240 };
    const xs = fit.points.map((point) => point.x);
    const ys = fit.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = (maxX - minX) * 0.08 || Math.abs(maxX || 1) * 0.1 || 1;
    const padY = (maxY - minY) * 0.1 || Math.abs(maxY || 1) * 0.1 || 1;
    const x0 = minX - padX;
    const x1 = maxX + padX;
    const y0 = Math.min(minY - padY, fit.slope * x0 + fit.intercept - padY);
    const y1 = Math.max(maxY + padY, fit.slope * x1 + fit.intercept + padY);

    const px = (value: number) => plot.left + ((value - x0) / (x1 - x0)) * plot.width;
    const py = (value: number) => plot.top + plot.height - ((value - y0) / (y1 - y0)) * plot.height;

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.strokeRect(plot.left, plot.top, plot.width, plot.height);

    // grid + ticks
    ctx.fillStyle = MUTED;
    ctx.font = "400 10px ui-monospace, 'SF Mono', Menlo, monospace";
    for (let tick = 0; tick <= 4; tick += 1) {
      const gx = plot.left + (plot.width * tick) / 4;
      const gy = plot.top + (plot.height * tick) / 4;
      ctx.strokeStyle = "rgba(31, 28, 23, 0.06)";
      ctx.beginPath();
      ctx.moveTo(gx, plot.top);
      ctx.lineTo(gx, plot.top + plot.height);
      ctx.moveTo(plot.left, gy);
      ctx.lineTo(plot.left + plot.width, gy);
      ctx.stroke();

      const xValue = x0 + ((x1 - x0) * tick) / 4;
      const yValue = y1 - ((y1 - y0) * tick) / 4;
      ctx.fillText(formatNumber(xValue, 2), gx - 12, plot.top + plot.height + 16);
      ctx.fillText(formatNumber(yValue, 2), plot.left - 46, gy + 3);
    }

    ctx.fillStyle = MUTED;
    ctx.font = "600 11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(fit.xLabel + (fit.xUnit ? ` (${fit.xUnit})` : ""), plot.left + plot.width / 2 - 40, plot.top + plot.height + 38);
    ctx.save();
    ctx.translate(plot.left - 44, plot.top + plot.height / 2 + 40);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(fit.yLabel + (fit.yUnit ? ` (${fit.yUnit})` : ""), 0, 0);
    ctx.restore();

    // best fit line
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px(x0), py(fit.slope * x0 + fit.intercept));
    ctx.lineTo(px(x1), py(fit.slope * x1 + fit.intercept));
    ctx.stroke();

    // observations
    ctx.fillStyle = INK;
    for (const point of fit.points) {
      ctx.beginPath();
      ctx.arc(px(point.x), py(point.y), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = MUTED;
    ctx.font = "400 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(
      `Best fit: y = ${formatNumber(fit.slope, 3)}x ${fit.intercept >= 0 ? "+" : "−"} ${formatNumber(Math.abs(fit.intercept), 3)}${fit.slopeUnit ? `   ·   slope ${formatNumber(fit.slope, 3)} ${fit.slopeUnit}` : ""}   ·   R² = ${fit.r2.toFixed(3)}`,
      MARGIN,
      y + 320,
    );
    y += 340;
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = "400 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText("Not enough paired readings for a graph yet.", MARGIN, y + 8);
    y += graphHeight;
  }

  /* ---- result ---- */
  y += 16;
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y);
  ctx.lineTo(WIDTH - MARGIN, y);
  ctx.stroke();
  y += 30;

  ctx.fillStyle = INK;
  ctx.font = "600 15px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const unit = record.resultUnit ? ` ${record.resultUnit}` : "";
  const measured = record.measured !== null ? `Result: ${formatNumber(record.measured, 3)}${unit}` : "Result: not entered";
  ctx.fillText(measured, MARGIN, y);

  const error = percentError(record.measured, record.accepted);
  ctx.fillStyle = MUTED;
  ctx.font = "400 13px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const accepted = record.accepted !== null ? `Accepted value: ${formatNumber(record.accepted, 3)}${unit}` : "Accepted value: not entered";
  ctx.fillText(accepted, MARGIN, y + 26);
  ctx.fillText(
    error !== null ? `Percentage error: ${error.toFixed(2)} %` : "Percentage error: add both values to compute",
    MARGIN,
    y + 48,
  );

  ctx.fillStyle = MUTED;
  ctx.font = "400 10px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(
    "Generated by Manthan STEM Lab · readings recorded at the bench",
    MARGIN,
    height - 28,
  );

  const link = document.createElement("a");
  link.download = `${record.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "practical"}-record.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  link.remove();
}
