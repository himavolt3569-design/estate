import geodesic from "geographiclib-geodesic";
import { nepaliAreaReport, parseLandNumber } from "./nepali-land";

export type Point = { x: number; y: number };
export type GeoPoint = { lat: number; lon: number };
export type LengthUnit = "m" | "ft";
export type LandGeometry = {
  areaSqm: number;
  perimeterM: number;
  corners: Point[];
  sidesM: number[];
  diagonalsM: { from: number; to: number; length: number }[];
  centroid: Point;
  geographic?: GeoPoint[];
};

/** Raw measured vertices with an explicit edge model, without GIS segment assumptions. */
export function landMeasurementReport(result: LandGeometry) {
  return {
    schemaVersion: 1,
    reference: result.geographic
      ? "WGS84"
      : "Local Cartesian; no geographic position supplied",
    edgeModel: result.geographic
      ? "Shortest WGS84 ellipsoidal geodesics"
      : "Straight Cartesian segments",
    coordinateOrder: result.geographic ? "latitude, longitude" : "x, y",
    coordinateUnit: result.geographic ? "decimal degrees" : "m",
    boundaryOrder: "Consecutive corners; last edge closes to the first corner",
    lengthUnit: "m",
    areaUnit: "sqm",
    areaSqm: result.areaSqm,
    nepaliArea: nepaliAreaReport(result.areaSqm),
    perimeterM: result.perimeterM,
    corners: result.geographic ?? result.corners,
    sidesM: result.sidesM,
    diagonalsM: result.diagonalsM,
    ...(!result.geographic ? { centroid: result.centroid } : {}),
  };
}

export type GeometryErrorCode =
  | "number"
  | "length"
  | "corners"
  | "duplicate"
  | "intersection"
  | "degenerate"
  | "triangle"
  | "convex"
  | "diagonal"
  | "latitude"
  | "longitude"
  | "extent";
export class GeometryError extends Error {
  constructor(public code: GeometryErrorCode) {
    super(code);
  }
}
const fail = (code: GeometryErrorCode): never => {
  throw new GeometryError(code);
};
const EPS = 1e-12;
const MAX_LENGTH = 10_000_000;
const geod = geodesic.Geodesic.WGS84;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const factor = (unit: LengthUnit) =>
  unit === "ft" ? 0.3048 : unit === "m" ? 1 : fail("number");

/** Full-string parsing: blank, partial numbers, Infinity and hex are not measurements. */
export function parseMeasurement(raw: string): number {
  try {
    return parseLandNumber(raw);
  } catch {
    return fail("number");
  }
}

function length(value: number): number {
  if (!Number.isFinite(value) || value < 0.000001 || value > MAX_LENGTH)
    return fail("length");
  return value;
}

function compensatedSum(values: number[]) {
  let total = 0,
    correction = 0;
  for (const value of values) {
    const adjusted = value - correction;
    const next = total + adjusted;
    correction = next - total - adjusted;
    total = next;
  }
  return total;
}

function onSegment(a: Point, b: Point, p: Point) {
  return (
    Math.abs(cross(a, b, p)) <= EPS &&
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}
function intersects(a: Point, b: Point, c: Point, d: Point) {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  return (
    (((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
      ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}

/** A simple polygon, entered in boundary order. No sorting or guessed boundaries. */
export function surveyPolygon(
  input: readonly Point[],
  unit: LengthUnit = "m",
): LandGeometry {
  if (input.length < 3 || input.length > 50) return fail("corners");
  const multiplier = factor(unit);
  const corners = input.map((p) => {
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      Math.abs(p.x) > 1e9 ||
      Math.abs(p.y) > 1e9
    )
      return fail("number");
    return { x: p.x * multiplier, y: p.y * multiplier };
  });
  const origin = corners[0]!;
  const span = Math.max(...corners.map((p) => distance(origin, p)));
  length(span);
  // Translate and normalize before predicates, area and centroid arithmetic.
  const points = corners.map((p) => ({
    x: (p.x - origin.x) / span,
    y: (p.y - origin.y) / span,
  }));
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!,
      c = points[(i + 2) % points.length]!;
    for (let j = i + 1; j < points.length; j++)
      if (distance(a, points[j]!) <= EPS) return fail("duplicate");
    length(distance(corners[i]!, corners[(i + 1) % points.length]!));
    // Adjacent edges must not double back and overlap.
    if (
      Math.abs(cross(a, b, c)) <= EPS &&
      (onSegment(a, b, c) || onSegment(b, c, a))
    )
      return fail("intersection");
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (intersects(a, b, points[j]!, points[(j + 1) % points.length]!))
        return fail("intersection");
    }
  }
  const terms = points.map(
    (p, i) =>
      p.x * points[(i + 1) % points.length]!.y -
      points[(i + 1) % points.length]!.x * p.y,
  );
  const twiceArea = compensatedSum(terms);
  if (Math.abs(twiceArea) <= EPS) return fail("degenerate");
  const centroid = {
    x:
      origin.x +
      (span *
        compensatedSum(
          points.map(
            (p, i) => (p.x + points[(i + 1) % points.length]!.x) * terms[i]!,
          ),
        )) /
        (3 * twiceArea),
    y:
      origin.y +
      (span *
        compensatedSum(
          points.map(
            (p, i) => (p.y + points[(i + 1) % points.length]!.y) * terms[i]!,
          ),
        )) /
        (3 * twiceArea),
  };
  const sidesM = corners.map((p, i) =>
    distance(p, corners[(i + 1) % corners.length]!),
  );
  const diagonalsM =
    corners.length === 4
      ? [
          { from: 0, to: 2, length: distance(corners[0]!, corners[2]!) },
          { from: 1, to: 3, length: distance(corners[1]!, corners[3]!) },
        ]
      : [];
  return {
    areaSqm: (Math.abs(twiceArea) * span * span) / 2,
    perimeterM: compensatedSum(sidesM),
    corners,
    sidesM,
    diagonalsM,
    centroid,
  };
}

export function rectangle(
  lengthValue: number,
  widthValue: number,
  unit: LengthUnit = "m",
  diagonal?: number,
): LandGeometry {
  const l = length(lengthValue * factor(unit)),
    w = length(widthValue * factor(unit));
  if (diagonal !== undefined) {
    const d = length(diagonal * factor(unit));
    if (
      Math.abs(d - Math.hypot(l, w)) > Math.max(1e-9, Math.hypot(l, w) * 1e-10)
    )
      return fail("diagonal");
  }
  return surveyPolygon([
    { x: 0, y: 0 },
    { x: l, y: 0 },
    { x: l, y: w },
    { x: 0, y: w },
  ]);
}

/** Stable Heron product; two triangles sharing AC on opposite sides. Convex only. */
export function quadrilateral(
  sides: readonly [number, number, number, number],
  diagonalAC: number,
  unit: LengthUnit = "m",
): LandGeometry {
  const [ab, bc, cd, da] = sides.map((s) => length(s * factor(unit))) as [
    number,
    number,
    number,
    number,
  ];
  const ac = length(diagonalAC * factor(unit));
  const corner = (first: number, second: number, sign: number): Point => {
    const scale = Math.max(first, second, ac);
    const [a, b, c] = [first / scale, second / scale, ac / scale].sort(
      (x, y) => y - x,
    ) as [number, number, number];
    if (c - (a - b) <= EPS) return fail("triangle");
    const triangleArea =
      Math.sqrt((a + (b + c)) * (c - (a - b)) * (c + (a - b)) * (a + (b - c))) /
      4;
    const x =
      ((first / scale - second / scale) * (first / scale + second / scale) +
        (ac / scale) ** 2) /
      ((2 * ac) / scale);
    return {
      x: x * scale,
      y: (sign * 2 * triangleArea * scale) / (ac / scale),
    };
  };
  const points = [
    { x: 0, y: 0 },
    corner(ab, bc, 1),
    { x: ac, y: 0 },
    corner(da, cd, -1),
  ];
  const normalized = points.map((p) => ({ x: p.x / ac, y: p.y / ac }));
  if (
    normalized.some(
      (p, i) =>
        cross(p, normalized[(i + 1) % 4]!, normalized[(i + 2) % 4]!) >= -EPS,
    )
  )
    return fail("convex");
  return surveyPolygon(points);
}

/** WGS84 shortest-geodesic boundary. Parcel scope: within 10 km of corner A. */
export function geographicPolygon(input: readonly GeoPoint[]): LandGeometry {
  if (input.length < 3 || input.length > 50) return fail("corners");
  const geographic = input.map((p) => {
    if (!Number.isFinite(p.lat) || Math.abs(p.lat) > 85)
      return fail("latitude");
    if (!Number.isFinite(p.lon) || Math.abs(p.lon) > 180)
      return fail("longitude");
    return { lat: p.lat, lon: p.lon };
  });
  const first = geographic[0]!;
  const corners = geographic.map((p) => {
    const inverse = geod.Inverse(first.lat, first.lon, p.lat, p.lon);
    const s = inverse.s12!;
    if (!Number.isFinite(s) || s > 10_000) return fail("extent");
    const angle = (inverse.azi1! * Math.PI) / 180;
    return { x: s * Math.sin(angle), y: s * Math.cos(angle) };
  });
  // The local azimuthal-equidistant projection is for topology and preview only.
  // It is never used to report geographic area or boundary distances.
  const result = surveyPolygon(corners);
  const polygon = geod.Polygon(false);
  geographic.forEach((p) => polygon.AddPoint(p.lat, p.lon));
  const computed = polygon.Compute(false, true);
  const sidesM = geographic.map((p, i) => {
    const next = geographic[(i + 1) % geographic.length]!;
    return geod.Inverse(p.lat, p.lon, next.lat, next.lon).s12!;
  });
  const diagonalsM = result.diagonalsM.map((d) => ({
    ...d,
    length: geod.Inverse(
      geographic[d.from]!.lat,
      geographic[d.from]!.lon,
      geographic[d.to]!.lat,
      geographic[d.to]!.lon,
    ).s12!,
  }));
  const areaSqm = Math.abs(computed.area!);
  if (!Number.isFinite(areaSqm) || areaSqm <= 1e-10) return fail("degenerate");
  return {
    ...result,
    areaSqm,
    perimeterM: computed.perimeter,
    sidesM,
    diagonalsM,
    geographic,
  };
}
