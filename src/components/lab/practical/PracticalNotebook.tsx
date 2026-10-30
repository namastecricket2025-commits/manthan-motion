import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ChartLine,
  ChevronDown,
  Download,
  NotebookPen,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { downloadRecord } from "@/components/lab/practical/export";
import {
  columnsOf,
  defaultAxes,
  fitSeries,
  formatNumber,
  percentError,
  subjectLabel,
  type Fit,
  type NotebookRecord,
} from "@/components/lab/practical/stats";
import "@/components/lab/practical/practical.css";

/**
 * The practical notebook.
 *
 * Every bench that measures something can send a row here. The notebook keeps
 * the table, plots any two columns with a least-squares line, and turns the
 * student's result into a percentage error. It never fills in a reading: an
 * empty observation is an empty row, and the graph says so.
 */

type RecordRow = NotebookRecord & { id: Id<"labRecords"> };

function FitGraph({ fit }: { fit: Fit }) {
  const width = 460;
  const height = 240;
  const pad = { left: 52, right: 16, top: 14, bottom: 38 };

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

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const px = (value: number) => pad.left + ((value - x0) / (x1 - x0)) * plotW;
  const py = (value: number) => pad.top + plotH - ((value - y0) / (y1 - y0)) * plotH;

  return (
    <svg
      className="pnb-graph"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Graph of ${fit.yLabel} against ${fit.xLabel}`}
    >
      <rect
        x={pad.left}
        y={pad.top}
        width={plotW}
        height={plotH}
        fill="none"
        stroke="var(--card-border)"
      />
      {[0, 1, 2, 3, 4].map((tick) => {
        const gx = pad.left + (plotW * tick) / 4;
        const gy = pad.top + (plotH * tick) / 4;
        return (
          <g key={tick}>
            <line
              x1={gx}
              y1={pad.top}
              x2={gx}
              y2={pad.top + plotH}
              stroke="color-mix(in srgb, var(--text-main) 6%, transparent)"
            />
            <line
              x1={pad.left}
              y1={gy}
              x2={pad.left + plotW}
              y2={gy}
              stroke="color-mix(in srgb, var(--text-main) 6%, transparent)"
            />
            <text
              x={gx}
              y={pad.top + plotH + 14}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-dim)"
            >
              {formatNumber(x0 + ((x1 - x0) * tick) / 4, 2)}
            </text>
            <text
              x={pad.left - 8}
              y={gy + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-dim)"
            >
              {formatNumber(y1 - ((y1 - y0) * tick) / 4, 2)}
            </text>
          </g>
        );
      })}

      <line
        x1={px(x0)}
        y1={py(fit.slope * x0 + fit.intercept)}
        x2={px(x1)}
        y2={py(fit.slope * x1 + fit.intercept)}
        stroke="var(--signal)"
        strokeWidth="1.4"
      />
      {fit.points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={px(point.x)}
          cy={py(point.y)}
          r={3.2}
          fill="var(--text-main)"
        />
      ))}

      <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--text-dim)">
        {fit.xLabel}
        {fit.xUnit ? ` (${fit.xUnit})` : ""}
      </text>
      <text
        x={12}
        y={pad.top + plotH / 2}
        textAnchor="middle"
        fontSize="10"
        fill="var(--text-dim)"
        transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
      >
        {fit.yLabel}
        {fit.yUnit ? ` (${fit.yUnit})` : ""}
      </text>
    </svg>
  );
}

function RecordCard({ record, defaultOpen }: { record: RecordRow; defaultOpen: boolean }) {
  const removeObservation = useMutation(api.labRecords.removeObservation);
  const removeRecord = useMutation(api.labRecords.removeRecord);
  const setResult = useMutation(api.labRecords.setResult);

  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const [measured, setMeasured] = useState(record.measured?.toString() ?? "");
  const [accepted, setAccepted] = useState(record.accepted?.toString() ?? "");
  const [unit, setUnit] = useState(record.resultUnit ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const columns = useMemo(() => columnsOf(record.observations), [record.observations]);
  const initialAxes = useMemo(() => defaultAxes(record.observations), [record.observations]);
  const [xLabel, setXLabel] = useState(initialAxes?.x ?? "");
  const [yLabel, setYLabel] = useState(initialAxes?.y ?? "");

  /* A column can disappear when its last row is deleted. Fall back to a pair
     that still exists instead of plotting two labels no row carries. */
  useEffect(() => {
    if (!columns.length) return;
    const labels = columns.map((column) => column.label);
    const fallback = defaultAxes(record.observations);
    if (!labels.includes(xLabel)) setXLabel(fallback?.x ?? labels[0]);
    if (!labels.includes(yLabel)) setYLabel(fallback?.y ?? labels[1] ?? labels[0]);
  }, [columns, record.observations, xLabel, yLabel]);

  const fit = xLabel && yLabel ? fitSeries(record.observations, xLabel, yLabel, columns) : null;
  const measuredNumber = measured.trim() === "" ? null : Number(measured);
  const acceptedNumber = accepted.trim() === "" ? null : Number(accepted);
  const error = percentError(
    measuredNumber !== null && Number.isFinite(measuredNumber) ? measuredNumber : null,
    acceptedNumber !== null && Number.isFinite(acceptedNumber) ? acceptedNumber : null,
  );

  const saveResult = async () => {
    setSaving(true);
    try {
      await setResult({
        recordId: record.id,
        measured: measuredNumber !== null && Number.isFinite(measuredNumber) ? measuredNumber : undefined,
        accepted: acceptedNumber !== null && Number.isFinite(acceptedNumber) ? acceptedNumber : undefined,
        resultUnit: unit.trim() || undefined,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch {
      toast.error("Could not save the result", { description: "Try again in a moment." });
    } finally {
      setSaving(false);
    }
  };

  const exportPage = () => {
    try {
      downloadRecord(
        { ...record, measured: measuredNumber, accepted: acceptedNumber, resultUnit: unit || null },
        xLabel && yLabel ? { x: xLabel, y: yLabel } : null,
      );
    } catch {
      toast.error("The record could not be drawn", { description: "Your browser blocked the download." });
    }
  };

  return (
    <article className="pnb-record" data-open={open}>
      <button
        type="button"
        className="pnb-record__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className="pnb-record__chev" aria-hidden />
        <span className="pnb-record__title">{record.title}</span>
        <span className="pnb-record__meta">
          {subjectLabel(record.subject)} · {record.observations.length} reading
          {record.observations.length === 1 ? "" : "s"}
        </span>
      </button>

      {open ? (
        <div className="pnb-record__body">
          {record.observations.length === 0 ? (
            <p className="pnb-note">
              No readings yet. Record one from a bench, or add a row while you
              take measurements.
            </p>
          ) : (
            <div className="pnb-tablewrap">
              <table className="pnb-table">
                <thead>
                  <tr>
                    <th scope="col">No.</th>
                    {columns.map((column) => (
                      <th key={column.label} scope="col">
                        {column.label}
                        {column.unit ? <span> ({column.unit})</span> : null}
                      </th>
                    ))}
                    <th scope="col">
                      <span className="pnb-sr">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {record.observations.map((observation, index) => (
                    <tr key={`${record.id}-${index}-${observation.at}`}>
                      <td>{index + 1}</td>
                      {columns.map((column) => {
                        const field = observation.values.find((entry) => entry.label === column.label);
                        return (
                          <td key={column.label}>
                            {field ? formatNumber(field.value, 2) : "—"}
                          </td>
                        );
                      })}
                      <td>
                        <button
                          type="button"
                          className="pnb-rowdel"
                          aria-label={`Delete reading ${index + 1}`}
                          onClick={() =>
                            void removeObservation({ recordId: record.id, index }).catch(() =>
                              toast.error("Could not delete the reading"),
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {columns.length >= 2 ? (
            <div className="pnb-plot">
              <div className="pnb-axes">
                <label>
                  <span>X axis</span>
                  <select value={xLabel} onChange={(event) => setXLabel(event.target.value)}>
                    {columns.map((column) => (
                      <option key={column.label} value={column.label}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Y axis</span>
                  <select value={yLabel} onChange={(event) => setYLabel(event.target.value)}>
                    {columns.map((column) => (
                      <option key={column.label} value={column.label}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {fit ? (
                <>
                  <FitGraph fit={fit} />
                  <p className="pnb-fit">
                    <ChartLine className="h-3.5 w-3.5" />
                    y = {formatNumber(fit.slope, 3)}x {fit.intercept >= 0 ? "+" : "−"}{" "}
                    {formatNumber(Math.abs(fit.intercept), 3)}
                    {fit.slopeUnit ? ` · slope ${formatNumber(fit.slope, 3)} ${fit.slopeUnit}` : ""}
                    {" · "}R² = {fit.r2.toFixed(3)}
                  </p>
                </>
              ) : (
                <p className="pnb-note">
                  A line needs at least two rows with both columns filled.
                </p>
              )}
            </div>
          ) : (
            <p className="pnb-note">
              Two columns are needed for a graph — record two different
              measurements in one reading, or add a second bench.
            </p>
          )}

          <div className="pnb-result">
            <div className="pnb-result__inputs">
              <label>
                <span>Your result</span>
                <input
                  inputMode="decimal"
                  value={measured}
                  onChange={(event) => setMeasured(event.target.value)}
                  placeholder="9.6"
                />
              </label>
              <label>
                <span>Accepted value</span>
                <input
                  inputMode="decimal"
                  value={accepted}
                  onChange={(event) => setAccepted(event.target.value)}
                  placeholder="9.8"
                />
              </label>
              <label>
                <span>Unit</span>
                <input
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder="m/s²"
                />
              </label>
              <button
                type="button"
                className="pnb-chip pnb-save"
                onClick={() => void saveResult()}
                disabled={saving}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : saved ? "Saved" : "Save"}
              </button>
            </div>
            <p className="pnb-error">
              {error !== null ? (
                <>
                  Percentage error <strong>{error.toFixed(2)} %</strong>
                  {acceptedNumber !== null && Number.isFinite(acceptedNumber)
                    ? " · compared with the accepted value"
                    : ""}
                </>
              ) : (
                "Enter your result and the book value to see the percentage error."
              )}
            </p>
          </div>

          <div className="pnb-record__actions">
            <button type="button" className="pnb-chip" onClick={exportPage}>
              <Download className="h-3.5 w-3.5" />
              Export record
            </button>
            {confirming ? (
              <span className="pnb-confirm">
                <button
                  type="button"
                  className="pnb-danger"
                  onClick={() => {
                    void removeRecord({ recordId: record.id }).catch(() =>
                      toast.error("Could not delete the record"),
                    );
                  }}
                >
                  Delete permanently
                </button>
                <button type="button" className="pnb-link" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </span>
            ) : (
              <button type="button" className="pnb-link" onClick={() => setConfirming(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete record
              </button>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function PracticalNotebook({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const records = useQuery(api.labRecords.list) as RecordRow[] | undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="pnb-sheet w-full overflow-y-auto border-l border-[var(--card-border)] bg-[var(--panel)] sm:max-w-2xl"
      >
        <SheetHeader>
          <p className="pnb-kicker">STEM Lab</p>
          <SheetTitle className="pnb-heading">
            <NotebookPen className="h-4 w-4" />
            Practical notebook
          </SheetTitle>
          <SheetDescription className="pnb-sub">
            Every reading you record at a bench lands here. Pick two columns to
            graph them, write your result, and export the page for your file.
          </SheetDescription>
        </SheetHeader>

        <div className="pnb-list">
          {records === undefined ? (
            <p className="pnb-note">Opening your notebook…</p>
          ) : records.length === 0 ? (
            <div className="pnb-empty">
              <NotebookPen className="h-5 w-5" />
              <p className="pnb-empty__title">No practicals recorded yet</p>
              <p className="pnb-note">
                Open an instrument bench — Vernier calipers, the screw gauge, the
                microscope — and press <strong>Record reading</strong>. Each one
                joins the experiment of its own name.
              </p>
            </div>
          ) : (
            records.map((record, index) => (
              <RecordCard key={record.id} record={record} defaultOpen={index === 0} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default PracticalNotebook;
