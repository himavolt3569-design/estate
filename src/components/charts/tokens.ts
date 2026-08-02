/**
 * Chart colours and the number/date formatting the charts share.
 *
 * The hexes are lifted straight from the design tokens in globals.css rather
 * than invented here, so a chart never introduces a colour the rest of the
 * product does not use. What decided *which* steps is not taste: the set was
 * run through a colour-vision check (adjacent-pair separation, lightness band,
 * contrast against the white card) and the failing steps were replaced.
 *
 *   marigold-400 and ink-300 were the first choices for "being checked" and
 *   "not finished". Both sit too light against white — under 2:1 — and the
 *   marigold/emerald pair was inseparable under protanopia. Stepping to
 *   marigold-600 and reordering the stack so emerald and marigold never touch
 *   fixes both.
 *
 * The one deliberate exception is `draft`: ink-500 is a near-neutral grey, and
 * grey is the point — "nothing has happened to this one yet". It never carries
 * meaning alone; every segment that uses it is labelled with its name and count.
 */

export const CHART = {
  /** Single-series hues. Distinct from each other at 37 ΔE, so a reader never
   *  has to check which card they are looking at. */
  views: '#2563eb', // royal-600
  enquiries: '#d76d06', // marigold-600
  saved: '#11714a', // emerald-700
  people: '#1d4ed8', // royal-700

  /** Listing states, in stack order. Ordering is the accessibility mechanism. */
  live: '#148e5a', // emerald-600
  closed: '#1d4ed8', // royal-700
  checking: '#d76d06', // marigold-600
  draft: '#64748b', // ink-500 — the deliberate neutral

  /** Chrome. Recessive by design: the data is the only loud thing. */
  grid: '#e2e8f0', // ink-200
  axis: '#cbd5e1', // ink-300
  muted: '#94a3b8', // ink-400
  ink: '#0f172a', // ink-900
  surface: '#ffffff',
} as const;

/** A wash, never a saturated block. */
export const AREA_FILL_OPACITY = 0.12;

/* -------------------------------------------------------------------------- */
/* Scales                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Axis ticks people can read: 0 / 20 / 40, never 0 / 17 / 34. Returns the top
 * of the scale and the tick values under it.
 */
export function niceScale(max: number, ticks = 3): { max: number; values: number[] } {
  if (max <= 0) return { max: 4, values: [0, 2, 4] };

  const rough = max / (ticks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => magnitude * m >= rough)! * magnitude;
  const top = Math.ceil(max / step) * step;

  const values: number[] = [];
  for (let value = 0; value <= top + 1e-9; value += step) values.push(Math.round(value * 100) / 100);
  return { max: top, values };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/** 1,284 — grouped the way the rest of the product groups numbers. */
export function tick(value: number): string {
  return value.toLocaleString('en-IN');
}

/** "2 Aug" from a yyyy-mm-dd key, without dragging a date library in. */
export function dayLabel(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/** "Mon 2 Aug" — the tooltip has room for the weekday, the axis does not. */
export function dayLabelLong(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}
