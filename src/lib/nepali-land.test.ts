import { describe, expect, it } from "vitest";
import {
  compoundAreaToSqm,
  NEPALI_AREA_IN_SQM as units,
  NEPALI_AREA_SYSTEMS,
  nepaliAreaParts,
  nepaliAreaReport,
  nepaliAreaToSqm,
  parseLandNumber,
} from "./nepali-land";

describe("Nepali numeral measurements", () => {
  it.each([
    ["३०", 30],
    ["−२.५", -2.5],
    ["२७.७००२", 27.7002],
    ["१e−३", 0.001],
    [" ०.५ ", 0.5],
    ["1२.३", 12.3],
  ] as const)("accepts %s", (raw, expected) =>
    expect(parseLandNumber(raw)).toBe(expected),
  );
  it.each(["१२abc", "१,०००", "", "NaN", "०x१०", "१e९९९", "−−१"])(
    "rejects malformed %s",
    (raw) => expect(() => parseLandNumber(raw)).toThrow(RangeError),
  );
});

describe("Nepali land systems", () => {
  it("uses the published square-foot relationships and exact international foot", () => {
    expect(units.ropani / units.sqft).toBeCloseTo(5476, 10);
    expect(units.aana / units.sqft).toBeCloseTo(342.25, 10);
    expect(units.paisa / units.sqft).toBeCloseTo(85.5625, 10);
    expect(units.daam / units.sqft).toBeCloseTo(21.390625, 10);
    expect(units.bigha / units.sqft).toBeCloseTo(72900, 8);
    expect(units.kattha / units.sqft).toBeCloseTo(3645, 10);
    expect(units.dhur / units.sqft).toBeCloseTo(182.25, 10);
  });
  it("decomposes exact major units and carries overflow", () => {
    expect(nepaliAreaParts(units.ropani, "ropani")).toEqual([1, 0, 0, 0]);
    expect(nepaliAreaParts(units.bigha, "bigha")).toEqual([1, 0, 0]);
    expect(
      nepaliAreaParts(compoundAreaToSqm("ropani", [0, 16, 0, 0]), "ropani"),
    ).toEqual([1, 0, 0, 0]);
    expect(
      nepaliAreaParts(compoundAreaToSqm("bigha", [0, 0, 400]), "bigha"),
    ).toEqual([1, 0, 0]);
    expect(
      nepaliAreaParts(compoundAreaToSqm("ropani", [0, 0, 3, 4]), "ropani"),
    ).toEqual([0, 1, 0, 0]);
  });
  it("retains fractional daam/dhur instead of rounding to whole units", () => {
    expect(
      nepaliAreaParts(compoundAreaToSqm("ropani", [1, 2, 3, 0.5]), "ropani"),
    ).toEqual([1, 2, 3, 0.5]);
    const terai = nepaliAreaParts(
      compoundAreaToSqm("bigha", [1, 2, 3.5]),
      "bigha",
    );
    expect(terai.slice(0, 2)).toEqual([1, 2]);
    expect(terai[2]).toBeCloseTo(3.5, 11);
    expect(nepaliAreaToSqm(0.5, "daam")).toBeCloseTo(units.daam / 2, 12);
  });
  it("carries after display rounding and keeps tiny areas visible", () => {
    expect(nepaliAreaParts(units.daam * 255.9999999, "ropani", 6)).toEqual([
      1, 0, 0, 0,
    ]);
    expect(nepaliAreaParts(units.dhur * 399.9999999, "bigha", 6)).toEqual([
      1, 0, 0,
    ]);
    expect(nepaliAreaParts(units.daam * 1e-9, "ropani", 6)[3]).toBeGreaterThan(
      0,
    );
  });
  it("round-trips varied parcels and both systems within floating-point tolerance", () => {
    for (const sqm of [0, 1e-8, 100, 600, 12345.6789, 1e10])
      for (const system of ["ropani", "bigha"] as const) {
        const parts = nepaliAreaParts(sqm, system);
        const recovered = compoundAreaToSqm(system, parts);
        expect(Math.abs(recovered - sqm)).toBeLessThanOrEqual(
          Math.max(1e-12, sqm * 1e-14),
        );
        expect(parts).toHaveLength(NEPALI_AREA_SYSTEMS[system].length);
      }
  });
  it("rejects negative, nonfinite, missing or fractional larger-unit inputs", () => {
    for (const values of [
      [-1, 0, 0, 0],
      [1.5, 0, 0, 0],
      [0, 0, 0],
      [Infinity, 0, 0, 0],
    ])
      expect(() => compoundAreaToSqm("ropani", values)).toThrow(RangeError);
    expect(() => nepaliAreaParts(NaN, "ropani")).toThrow(RangeError);
    expect(() => nepaliAreaToSqm(-1, "aana")).toThrow(RangeError);
    expect(() => nepaliAreaToSqm(1e308, "bigha")).toThrow(RangeError);
    expect(() => nepaliAreaToSqm(1e300, "sqm")).toThrow(RangeError);
    expect(() => nepaliAreaParts(1e300, "ropani", 6)).toThrow(RangeError);
    expect(nepaliAreaToSqm(1e16, "sqft")).toBeCloseTo(9.290304e14, 0);
  });
  it("includes explicit local conventions and full precision in downloads", () => {
    const result = nepaliAreaReport(
      compoundAreaToSqm("ropani", [1, 2, 3, 0.5]),
    );
    expect(result.ropaniAanaPaisaDaam).toEqual({
      ropani: 1,
      aana: 2,
      paisa: 3,
      daam: 0.5,
    });
    expect(result.convention).toEqual({ ropaniSqFt: 5476, bighaSqFt: 72900 });
  });
});
