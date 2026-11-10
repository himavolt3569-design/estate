// Nepal square-foot relationships from DUDBC's Construction Handbook,
// Conversion Table. Derive metric values rather than compounding rounded m² factors.
export const NEPALI_AREA_IN_SQM = {
  sqm: 1,
  sqft: 0.09290304,
  ropani: 5476 * 0.09290304,
  aana: 342.25 * 0.09290304,
  paisa: 85.5625 * 0.09290304,
  daam: 21.390625 * 0.09290304,
  bigha: 72900 * 0.09290304,
  kattha: 3645 * 0.09290304,
  dhur: 182.25 * 0.09290304,
} as const;
export type NepaliAreaUnit = keyof typeof NEPALI_AREA_IN_SQM;
export type NepaliAreaSystem = "ropani" | "bigha";
export const NEPALI_AREA_SYSTEMS = {
  ropani: ["ropani", "aana", "paisa", "daam"],
  bigha: ["bigha", "kattha", "dhur"],
} as const;

/** Accept either numeral set without accepting partial or ambiguous grouped numbers. */
export function parseLandNumber(raw: string): number {
  const normalized = raw
    .trim()
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/−/g, "-");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized))
    throw new RangeError(
      "Enter a complete number using English or Nepali digits.",
    );
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new RangeError("Enter a finite number.");
  return value;
}

function nonnegative(value: number) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError("Area must be a finite nonnegative number.");
  return value;
}
// Covers the geometry tool's supported span while keeping decomposition finite.
export const MAX_NEPALI_AREA_SQM = 1e15;
function validArea(value: number) {
  nonnegative(value);
  if (value > MAX_NEPALI_AREA_SQM)
    throw new RangeError("Area exceeds the supported 10¹⁵ m² range.");
  return value;
}
export function nepaliAreaToSqm(value: number, unit: NepaliAreaUnit) {
  return validArea(nonnegative(value) * NEPALI_AREA_IN_SQM[unit]);
}
/** Larger units are whole counts; the final unit can be fractional. Overflow carries naturally. */
export function compoundAreaToSqm(
  system: NepaliAreaSystem,
  values: readonly number[],
) {
  const units = NEPALI_AREA_SYSTEMS[system];
  if (values.length !== units.length)
    throw new RangeError("Enter every unit in the selected system.");
  return validArea(
    values.reduce((total, value, i) => {
      nonnegative(value);
      if (i < values.length - 1 && !Number.isSafeInteger(value))
        throw new RangeError("Only the final unit can contain a fraction.");
      return total + value * NEPALI_AREA_IN_SQM[units[i]!];
    }, 0),
  );
}

/** Normalize carries before display, retaining a fractional final unit. */
export function nepaliAreaParts(
  sqm: number,
  system: NepaliAreaSystem,
  displayDecimals?: number,
): number[] {
  validArea(sqm);
  const units = NEPALI_AREA_SYSTEMS[system];
  const smallest = units[units.length - 1]!;
  const radices = system === "ropani" ? [256, 16, 4, 1] : [400, 20, 1];
  let remaining = sqm / NEPALI_AREA_IN_SQM[smallest];
  if (displayDecimals !== undefined) {
    const scale = 10 ** displayDecimals;
    const rounded = Math.round(remaining * scale) / scale;
    // Keep genuinely small areas visible instead of rounding them to zero.
    if (rounded > 0) remaining = rounded;
  }
  const nearest = Math.round(remaining);
  if (
    nearest > 0 &&
    Math.abs(remaining - nearest) <=
      Number.EPSILON * 16 * Math.max(1, remaining)
  )
    remaining = nearest;
  return radices.map((radix, index) => {
    if (index === radices.length - 1) return Math.max(0, remaining);
    const count = Math.floor(remaining / radix);
    remaining -= count * radix;
    return count;
  });
}

export function nepaliAreaReport(sqm: number) {
  return {
    convention: { ropaniSqFt: 5476, bighaSqFt: 72900 },
    ropaniAanaPaisaDaam: Object.fromEntries(
      NEPALI_AREA_SYSTEMS.ropani.map((unit, index) => [
        unit,
        nepaliAreaParts(sqm, "ropani")[index],
      ]),
    ),
    bighaKatthaDhur: Object.fromEntries(
      NEPALI_AREA_SYSTEMS.bigha.map((unit, index) => [
        unit,
        nepaliAreaParts(sqm, "bigha")[index],
      ]),
    ),
  };
}
