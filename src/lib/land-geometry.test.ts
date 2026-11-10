import { describe, expect, it } from "vitest";
import {
  geographicPolygon,
  landMeasurementReport,
  GeometryError,
  parseMeasurement,
  quadrilateral,
  rectangle,
  surveyPolygon,
  type GeometryErrorCode,
  type Point,
} from "./land-geometry";

const error = (run: () => unknown, code: GeometryErrorCode) => {
  try {
    run();
    throw new Error("Expected invalid measurements to be rejected");
  } catch (caught) {
    expect(caught).toBeInstanceOf(GeometryError);
    expect((caught as GeometryError).code).toBe(code);
  }
};
const box: Point[] = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 20 },
  { x: 0, y: 20 },
];

describe("strict measurement parsing", () => {
  it.each([
    "",
    " ",
    "30 metres",
    "1,000",
    "0x10",
    "Infinity",
    "NaN",
    "1e999",
    "--1",
  ])("rejects %j", (raw) => error(() => parseMeasurement(raw), "number"));
  it.each([
    [" 12.5 ", 12.5],
    ["-2", -2],
    [".25", 0.25],
    ["1e-3", 0.001],
    ["0", 0],
  ] as const)("parses %s", (raw, expected) =>
    expect(parseMeasurement(raw)).toBe(expected),
  );
});

describe("rectangle measurements", () => {
  it("returns known area, perimeter, both diagonals, centroid and all corners", () => {
    const result = rectangle(30, 20);
    expect(result.areaSqm).toBeCloseTo(600, 10);
    expect(result.perimeterM).toBeCloseTo(100, 10);
    expect(result.corners).toEqual(box);
    expect(result.centroid.x).toBeCloseTo(15, 12);
    expect(result.centroid.y).toBeCloseTo(10, 12);
    result.diagonalsM.forEach((d) =>
      expect(d.length).toBeCloseTo(Math.sqrt(1300), 12),
    );
    expect(result.geographic).toBeUndefined();
  });
  it("converts feet exactly once and accepts a consistent optional diagonal", () => {
    const result = rectangle(40, 30, "ft", 50);
    expect(result.areaSqm).toBeCloseTo(1200 * 0.09290304, 10);
    expect(result.perimeterM).toBeCloseTo(140 * 0.3048, 10);
    error(() => rectangle(40, 30, "ft", 49), "diagonal");
    error(() => rectangle(30, 20, "m", 36.06), "diagonal");
  });
  it.each([0, -2, NaN, Infinity, 1e8, 1e-9])(
    "rejects unsupported length %s",
    (value) => error(() => rectangle(value, 20), "length"),
  );
});

describe("four sides and AC", () => {
  it("reconstructs a 3-4-5 rectangle and verifies all entered sides", () => {
    const result = quadrilateral([4, 3, 4, 3], 5);
    expect(result.areaSqm).toBeCloseTo(12, 12);
    expect(result.perimeterM).toBeCloseTo(14, 12);
    result.sidesM.forEach((side, i) =>
      expect(side).toBeCloseTo([4, 3, 4, 3][i]!, 12),
    );
  });
  it("handles an irregular convex quadrilateral with an independently known area", () => {
    // A(0,0), B(4,0), C(5,3), D(0,4): shoelace area = (12 + 20) / 2 = 16.
    const result = quadrilateral(
      [4, Math.sqrt(10), Math.sqrt(26), 4],
      Math.sqrt(34),
    );
    expect(result.areaSqm).toBeCloseTo(16, 12);
    expect(result.diagonalsM[1]!.length).toBeCloseTo(Math.sqrt(32), 12);
    expect(quadrilateral([4, 3, 4, 3], 5, "ft").areaSqm).toBeCloseTo(
      12 * 0.09290304,
      12,
    );
  });
  it("rejects impossible, flat or ambiguous concave configurations", () => {
    error(() => quadrilateral([1, 1, 1, 1], 3), "triangle");
    error(() => quadrilateral([1, 1, 1, 1], 2), "triangle");
    error(
      () =>
        quadrilateral(
          [Math.sqrt(5), Math.sqrt(5), Math.sqrt(5), Math.sqrt(17)],
          2,
        ),
      "convex",
    );
  });
});

describe("ordered local corners", () => {
  it("accepts either winding and translates large survey coordinates without losing area", () => {
    for (const points of [
      box,
      [...box].reverse(),
      box.map((p) => ({ x: p.x + 500000, y: p.y + 3000000 })),
    ])
      expect(surveyPolygon(points).areaSqm).toBeCloseTo(600, 8);
    const shifted = surveyPolygon(
      box.map((p) => ({ x: p.x + 500000, y: p.y + 3000000 })),
    );
    expect(shifted.centroid.x).toBeCloseTo(500015, 8);
    expect(shifted.centroid.y).toBeCloseTo(3000010, 8);
  });
  it("calculates concave land, triangles and redundant straight-line corners", () => {
    const concave = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(surveyPolygon(concave).areaSqm).toBeCloseTo(7, 12);
    expect(surveyPolygon(concave).perimeterM).toBeCloseTo(16, 12);
    expect(
      surveyPolygon([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 3 },
      ]).areaSqm,
    ).toBeCloseTo(6, 12);
    expect(
      surveyPolygon([{ x: 0, y: 0 }, { x: 15, y: 0 }, ...box.slice(1)]).areaSqm,
    ).toBeCloseTo(600, 10);
  });
  it("rejects duplicate, crossing, touching, overlapping, and zero-area boundaries", () => {
    error(() => surveyPolygon([...box, box[0]!]), "duplicate");
    error(
      () => surveyPolygon([box[0]!, box[2]!, box[1]!, box[3]!]),
      "intersection",
    );
    error(
      () =>
        surveyPolygon([
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 3 },
        ]),
      "intersection",
    );
    error(
      () =>
        surveyPolygon([
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 2, y: 0 },
          { x: 0, y: 4 },
        ]),
      "intersection",
    );
    expect(() =>
      surveyPolygon([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toThrow(GeometryError);
  });
  it("bounds work and rejects nonfinite coordinates", () => {
    error(() => surveyPolygon([]), "corners");
    error(() => surveyPolygon(Array(51).fill({ x: 0, y: 0 })), "corners");
    error(() => surveyPolygon([{ x: NaN, y: 0 }, ...box.slice(1)]), "number");
    error(() => surveyPolygon([{ x: 1e10, y: 0 }, ...box.slice(1)]), "number");
    const fifty = Array.from({ length: 50 }, (_, i) => ({
      x: Math.cos((i * 2 * Math.PI) / 50) * 20,
      y: Math.sin((i * 2 * Math.PI) / 50) * 20,
    }));
    expect(surveyPolygon(fifty).areaSqm).toBeCloseTo(
      (50 / 2) * 400 * Math.sin((2 * Math.PI) / 50),
      9,
    );
  });
  it("preserves area under rotation and matches triangulation across varied rectangles", () => {
    for (let i = 1; i <= 40; i++) {
      const l = i * 1.37,
        w = i / 3 + 0.01,
        angle = i * 0.19;
      const polygon = [
        { x: 0, y: 0 },
        { x: l, y: 0 },
        { x: l, y: w },
        { x: 0, y: w },
      ].map((p) => ({
        x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
        y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
      }));
      expect(surveyPolygon(polygon).areaSqm).toBeCloseTo(l * w, 8);
      expect(quadrilateral([l, w, l, w], Math.hypot(l, w)).areaSqm).toBeCloseTo(
        l * w,
        8,
      );
    }
  });
});

describe("GPS boundaries on WGS84", () => {
  it.each([false, true])(
    "exports explicit geodesic measurements without Cartesian GIS assumptions (reverse=%s)",
    (reverse) => {
      const points = [
        { lat: 0, lon: 179.9999 },
        { lat: 0, lon: -179.9999 },
        { lat: 0.0001, lon: -179.9999 },
        { lat: 0.0001, lon: 179.9999 },
      ];
      if (reverse) points.reverse();
      const report = landMeasurementReport(geographicPolygon(points));
      expect(report.reference).toBe("WGS84");
      expect(report.edgeModel).toBe("Shortest WGS84 ellipsoidal geodesics");
      expect(report.coordinateOrder).toBe("latitude, longitude");
      expect(report.coordinateUnit).toBe("decimal degrees");
      expect(report.corners).toEqual(points);
      expect(report).not.toHaveProperty("centroid");
      expect(report).not.toHaveProperty("geometry");
      expect(report.areaSqm).toBeCloseTo(246.18144159420677, 5);
    },
  );
  const nepal = [
    { lat: 27.7, lon: 85.3 },
    { lat: 27.7, lon: 85.3003 },
    { lat: 27.7002, lon: 85.3003 },
    { lat: 27.7002, lon: 85.3 },
  ];
  it("agrees with a separately executed Python GeographicLib 2.1 reference", () => {
    const result = geographicPolygon(nepal);
    expect(result.areaSqm).toBeCloseTo(655.7977133691311, 5);
    expect(result.perimeterM).toBeCloseTo(103.50555691983561, 7);
    expect(result.geographic).toEqual(nepal);
    expect(geographicPolygon([...nepal].reverse()).areaSqm).toBeCloseTo(
      result.areaSqm,
      5,
    );
  });
  it("handles parcels across the antimeridian without a world-spanning edge", () => {
    const result = geographicPolygon([
      { lat: 0, lon: 179.9999 },
      { lat: 0, lon: -179.9999 },
      { lat: 0.0001, lon: -179.9999 },
      { lat: 0.0001, lon: 179.9999 },
    ]);
    expect(result.areaSqm).toBeCloseTo(246.18144159420677, 5);
    expect(result.perimeterM).toBeCloseTo(66.64265148307365, 7);
  });
  it("matches the independent reference south of the equator", () => {
    const result = geographicPolygon([
      { lat: -33.9, lon: 151.2 },
      { lat: -33.9, lon: 151.2003 },
      { lat: -33.8998, lon: 151.2003 },
      { lat: -33.8998, lon: 151.2 },
    ]);
    expect(result.areaSqm).toBeCloseTo(615.5626990646124, 5);
    expect(result.perimeterM).toBeCloseTo(99.8640380876853, 7);
  });
  it("rejects missing, repeated, crossed, out-of-range and oversized GPS boundaries", () => {
    error(() => geographicPolygon([]), "corners");
    error(() => geographicPolygon([...nepal, nepal[0]!]), "duplicate");
    error(
      () => geographicPolygon([nepal[0]!, nepal[2]!, nepal[1]!, nepal[3]!]),
      "intersection",
    );
    error(
      () => geographicPolygon([{ lat: 90, lon: 0 }, ...nepal.slice(1)]),
      "latitude",
    );
    error(
      () => geographicPolygon([{ lat: 27.7, lon: 181 }, ...nepal.slice(1)]),
      "longitude",
    );
    error(
      () => geographicPolygon([{ lat: NaN, lon: 0 }, ...nepal.slice(1)]),
      "latitude",
    );
    error(
      () => geographicPolygon([{ lat: 0, lon: 0 }, ...nepal.slice(1)]),
      "extent",
    );
  });
});
