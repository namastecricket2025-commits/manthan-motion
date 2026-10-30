/**
 * Reading the practical notebook.
 *
 * The notebook does not know what an experiment means, so it treats every
 * observation as labelled numbers and lets the student choose which two columns
 * form the graph. That is enough for Ohm's law (V against I), the pendulum
 * (T² against L) and the lens practical (1/v against 1/u), and it keeps this
 * file free of experiment-specific assumptions that would quietly go wrong.
 */

export type Field = { label: string; value: number; unit?: string };

export type Observation = { values: Field[]; at: number };

export type NotebookRecord = {
  id: string;
  subject: string;
  title: string;
  observations: Observation[];
  measured: number | null;
  accepted: number | null;
  resultUnit: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Column = { label: string; unit?: string };

/** Every column in the table, in the order the labels first appeared. */
export function columnsOf(observations: Observation[]): Column[] {
  const seen = new Map<string, Column>();
  for (const observation of observations) {
    for (const field of observation.values) {
      if (!seen.has(field.label)) seen.set(field.label, { label: field.label, unit: field.unit });
    }
  }
  return [...seen.values()];
}

export function valueOf(observation: Observation, label: string): number | null {
  const field = observation.values.find((entry) => entry.label === label);
  return field && Number.isFinite(field.value) ? field.value : null;
}

export type Fit = {
  slope: number;
  intercept: number;
  r2: number;
  points: Array<{ x: number; y: number }>;
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  /** Unit of the slope, when both axes declare one. */
  slopeUnit?: string;
};

/** Least squares for the rows where both chosen columns have a number. */
export function fitSeries(
  observations: Observation[],
  xLabel: string,
  yLabel: string,
  columns: Column[],
): Fit | null {
  const points: Array<{ x: number; y: number }> = [];
  for (const observation of observations) {
    const x = valueOf(observation, xLabel);
    const y = valueOf(observation, yLabel);
    if (x === null || y === null) continue;
    points.push({ x, y });
  }
  if (points.length < 2) return null;

  const n = points.length;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;
  const r2 = sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 1;

  const x = columns.find((column) => column.label === xLabel);
  const y = columns.find((column) => column.label === yLabel);
  return {
    slope,
    intercept,
    r2,
    points,
    xLabel,
    yLabel,
    xUnit: x?.unit,
    yUnit: y?.unit,
    slopeUnit: x?.unit && y?.unit ? `${y.unit}/${x.unit}` : undefined,
  };
}

/**
 * The graph the notebook opens on: the first two columns.
 *
 * That is the measured pair in the order a practical writes it (volume then
 * pH, object distance then image distance), while the last column is often a
 * constant such as the focal length — a horizontal line is not a discovery.
 */
export function defaultAxes(observations: Observation[]): { x: string; y: string } | null {
  const columns = columnsOf(observations);
  if (columns.length < 2) return null;
  return { x: columns[0].label, y: columns[1].label };
}

export function percentError(measured: number | null, accepted: number | null): number | null {
  if (measured === null || accepted === null) return null;
  if (!Number.isFinite(measured) || !Number.isFinite(accepted) || accepted === 0) return null;
  return Math.abs((measured - accepted) / accepted) * 100;
}

export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1000 || magnitude < 0.001) return value.toExponential(2);
  const places = magnitude >= 100 ? 1 : magnitude >= 10 ? 2 : digits;
  return value
    .toFixed(places)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

export function subjectLabel(subject: string): string {
  if (subject === "physics") return "Physics";
  if (subject === "chemistry") return "Chemistry";
  if (subject === "biology") return "Biology";
  return subject;
}
