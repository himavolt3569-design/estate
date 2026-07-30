/**
 * Formatting for a Nepali audience.
 *
 * Two things here are not incidental:
 *
 *   1. Prices are read in lakh and crore, not millions. "Rs 2.45 crore" is how a
 *      buyer thinks about a house; "NPR 24,500,000" is how a database thinks
 *      about it, and showing the second one makes the product feel foreign.
 *
 *   2. Land is measured in two traditional systems that are still in daily use:
 *      ropani/aana/paisa/daam in the hills and the Kathmandu valley, and
 *      bigha/kattha/dhur in the terai. Square metres are the storage unit; they
 *      are almost never the display unit.
 */

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Paisa (the storage unit) to rupees. */
export function paisaToRupees(paisa: number): number {
  return paisa / 100;
}

export function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Compact price the way it is spoken: "Rs 2.45 crore", "Rs 85 lakh", "Rs 45,000".
 * `period` renders rentals as "Rs 45,000 / month".
 */
export function formatPrice(
  paisa: number,
  options: { period?: 'month' | 'year' | 'night' | null; compact?: boolean } = {},
): string {
  const { period = null, compact = true } = options;
  const rupees = paisaToRupees(paisa);

  let value: string;
  if (compact && rupees >= CRORE) {
    value = `Rs ${trimZeros(rupees / CRORE)} crore`;
  } else if (compact && rupees >= LAKH) {
    value = `Rs ${trimZeros(rupees / LAKH)} lakh`;
  } else {
    value = `Rs ${formatIndianDigits(Math.round(rupees))}`;
  }

  if (!period) return value;
  return `${value} / ${period}`;
}

/** Exact rupee amount with Indian digit grouping: 24,50,000, not 2,450,000. */
export function formatIndianDigits(value: number): string {
  const negative = value < 0;
  const digits = Math.abs(Math.round(value)).toString();

  if (digits.length <= 3) return (negative ? '-' : '') + digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped},${last3}`;
}

function trimZeros(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// ---------------------------------------------------------------------------
// Nepali numerals
// ---------------------------------------------------------------------------

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

export function toNepaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)] ?? d);
}

// ---------------------------------------------------------------------------
// Area
// ---------------------------------------------------------------------------

export const AREA_IN_SQM = {
  sqm: 1,
  sqft: 0.09290304,
  // Hills and Kathmandu valley: 1 ropani = 16 aana = 64 paisa = 256 daam
  ropani: 508.72,
  aana: 31.795,
  paisa: 7.94875,
  daam: 1.9871875,
  // Terai: 1 bigha = 20 kattha = 400 dhur
  bigha: 6772.63,
  kattha: 338.6315,
  dhur: 16.931575,
} as const;

export type AreaUnit = keyof typeof AREA_IN_SQM;

/** Which system a district uses. Terai districts quote bigha; the rest ropani. */
export const TERAI_DISTRICTS = new Set([
  'jhapa', 'morang', 'sunsari', 'saptari', 'siraha', 'dhanusha', 'mahottari',
  'sarlahi', 'rautahat', 'bara', 'parsa', 'chitwan', 'nawalpur', 'parasi',
  'rupandehi', 'kapilvastu', 'dang', 'banke', 'bardiya', 'kailali', 'kanchanpur',
  'udayapur',
]);

export function defaultUnitForDistrict(districtSlug: string | null | undefined): AreaUnit {
  return districtSlug && TERAI_DISTRICTS.has(districtSlug) ? 'bigha' : 'ropani';
}

export function areaToSqm(value: number, unit: AreaUnit): number {
  return value * AREA_IN_SQM[unit];
}

export function sqmToArea(sqm: number, unit: AreaUnit): number {
  return sqm / AREA_IN_SQM[unit];
}

/**
 * Shown when a listing has no area recorded. Exported so callers can test for it
 * rather than comparing against a hardcoded string in two places.
 */
export const AREA_NOT_STATED = 'Not stated';

export type RopaniBreakdown = { ropani: number; aana: number; paisa: number; daam: number };
export type BighaBreakdown = { bigha: number; kattha: number; dhur: number };

/** Square metres decomposed into ropani-aana-paisa-daam, the way a deed states it. */
export function toRopaniBreakdown(sqm: number): RopaniBreakdown {
  let remaining = sqm;
  const ropani = Math.floor(remaining / AREA_IN_SQM.ropani);
  remaining -= ropani * AREA_IN_SQM.ropani;
  const aana = Math.floor(remaining / AREA_IN_SQM.aana);
  remaining -= aana * AREA_IN_SQM.aana;
  const paisa = Math.floor(remaining / AREA_IN_SQM.paisa);
  remaining -= paisa * AREA_IN_SQM.paisa;
  const daam = Math.round(remaining / AREA_IN_SQM.daam);
  return { ropani, aana, paisa, daam };
}

export function toBighaBreakdown(sqm: number): BighaBreakdown {
  let remaining = sqm;
  const bigha = Math.floor(remaining / AREA_IN_SQM.bigha);
  remaining -= bigha * AREA_IN_SQM.bigha;
  const kattha = Math.floor(remaining / AREA_IN_SQM.kattha);
  remaining -= kattha * AREA_IN_SQM.kattha;
  const dhur = Math.round(remaining / AREA_IN_SQM.dhur);
  return { bigha, kattha, dhur };
}

/**
 * Display string for an area. Traditional systems drop zero-valued trailing
 * units, so 508.72 m² reads "1 ropani" rather than "1-0-0-0".
 */
export function formatArea(
  sqm: number | null | undefined,
  unit: AreaUnit = 'ropani',
): string {
  if (sqm == null || sqm <= 0) return AREA_NOT_STATED;

  if (unit === 'sqm') return `${formatIndianDigits(Math.round(sqm))} m²`;
  if (unit === 'sqft') return `${formatIndianDigits(Math.round(sqmToArea(sqm, 'sqft')))} sq ft`;

  if (unit === 'bigha' || unit === 'kattha' || unit === 'dhur') {
    const { bigha, kattha, dhur } = toBighaBreakdown(sqm);
    const parts: string[] = [];
    if (bigha) parts.push(`${bigha} bigha`);
    if (kattha) parts.push(`${kattha} kattha`);
    if (dhur) parts.push(`${dhur} dhur`);
    return parts.length ? parts.join(' ') : `${sqmToArea(sqm, 'dhur').toFixed(1)} dhur`;
  }

  const { ropani, aana, paisa, daam } = toRopaniBreakdown(sqm);
  const parts: string[] = [];
  if (ropani) parts.push(`${ropani} ropani`);
  if (aana) parts.push(`${aana} aana`);
  if (paisa) parts.push(`${paisa} paisa`);
  if (daam) parts.push(`${daam} daam`);
  return parts.length ? parts.join(' ') : `${sqmToArea(sqm, 'daam').toFixed(1)} daam`;
}

/** Secondary line under the primary area, for buyers who think in feet. */
export function formatAreaSecondary(sqm: number | null | undefined): string | null {
  if (sqm == null || sqm <= 0) return null;
  return `${formatIndianDigits(Math.round(sqmToArea(sqm, 'sqft')))} sq ft`;
}

// ---------------------------------------------------------------------------
// Distance, dates, misc
// ---------------------------------------------------------------------------

export function formatDistance(metres: number | null | undefined): string | null {
  if (metres == null) return null;
  if (metres < 950) return `${Math.round(metres / 50) * 50} m away`;
  return `${(metres / 1000).toFixed(metres < 9500 ? 1 : 0)} km away`;
}

export function formatCompactNumber(n: number): string {
  if (n >= CRORE) return `${trimZeros(n / CRORE)}Cr`;
  if (n >= LAKH) return `${trimZeros(n / LAKH)}L`;
  if (n >= 1000) return `${trimZeros(n / 1000)}k`;
  return String(n);
}

const RELATIVE_STEPS: Array<[limitSeconds: number, divisor: number, unit: Intl.RelativeTimeFormatUnit]> = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [2592000, 86400, 'day'],
  [31536000, 2592000, 'month'],
  [Infinity, 31536000, 'year'],
];

export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const seconds = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(seconds);
  const step = RELATIVE_STEPS.find(([limit]) => abs < limit) ?? RELATIVE_STEPS.at(-1)!;
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return formatter.format(Math.round(seconds / step[1]), step[2]);
}

export function formatDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
