import { describe, expect, it } from "vitest";
import {
  buildExtrudedWalls,
  chooseMetricGridStep,
  computeInteriorAngles,
  computePolygon3DMetrics,
  createProportionalPlot,
  earcutSimplePolygon,
  projectPoint3D,
  scaleBarLengthM,
  type CameraState,
  type Viewport3D,
} from "./land-3d";
import { surveyPolygon, type Point } from "./land-geometry";

function triangleArea(a: Point, b: Point, c: Point): number {
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

function sumTriangleAreas(vertices: readonly Point[], triangles: [number, number, number][]): number {
  return triangles.reduce(
    (sum, [i, j, k]) => sum + triangleArea(vertices[i]!, vertices[j]!, vertices[k]!),
    0,
  );
}

describe("earcutSimplePolygon and interior angles", () => {
  it("computes exact interior angles including 270 deg reflex corners and (n-2)*180 sum", () => {
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ];
    const anglesCCW = computeInteriorAngles(lShape);
    expect(anglesCCW).toHaveLength(6);
    expect(anglesCCW[0]).toBeCloseTo(90, 10);
    expect(anglesCCW[1]).toBeCloseTo(90, 10);
    expect(anglesCCW[2]).toBeCloseTo(90, 10);
    expect(anglesCCW[3]).toBeCloseTo(270, 10);
    expect(anglesCCW[4]).toBeCloseTo(90, 10);
    expect(anglesCCW[5]).toBeCloseTo(90, 10);
    expect(anglesCCW.reduce((a, b) => a + b, 0)).toBeCloseTo(720, 10);

    // Reversed (CW) ordering preserves exact angles in vertex order.
    const anglesCW = computeInteriorAngles([...lShape].reverse());
    expect(anglesCW).toHaveLength(6);
    expect(anglesCW[2]).toBeCloseTo(270, 10);
    expect(anglesCW.reduce((a, b) => a + b, 0)).toBeCloseTo(720, 10);
  });

  it("handles concave U-shapes, darts, collinear vertices, and large survey offsets", () => {
    const uShape: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 3.5, y: 4 },
      { x: 3.5, y: 1.5 },
      { x: 1.5, y: 1.5 },
      { x: 1.5, y: 4 },
      { x: 0, y: 4 },
    ];
    const uAngles = computeInteriorAngles(uShape);
    expect(uAngles[4]).toBeCloseTo(270, 10);
    expect(uAngles[5]).toBeCloseTo(270, 10);
    expect(uAngles.reduce((a, b) => a + b, 0)).toBeCloseTo((8 - 2) * 180, 9);

    const shiftedCollinear: Point[] = [
      { x: 500000, y: 3000000 },
      { x: 500015, y: 3000000 },
      { x: 500030, y: 3000000 },
      { x: 500030, y: 3000020 },
      { x: 500000, y: 3000020 },
    ];
    const colAngles = computeInteriorAngles(shiftedCollinear);
    expect(colAngles[1]).toBeCloseTo(180, 9);
    expect(colAngles.reduce((a, b) => a + b, 0)).toBeCloseTo((5 - 2) * 180, 8);
  });

  it("conserves exact polygon area (< 1e-9) across convex, concave, CW/CCW, collinear, and 50-vertex polygons", () => {
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ];
    const uShape: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 3.5, y: 4 },
      { x: 3.5, y: 1.5 },
      { x: 1.5, y: 1.5 },
      { x: 1.5, y: 4 },
      { x: 0, y: 4 },
    ];
    const comb10: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 8, y: 5 },
      { x: 8, y: 2 },
      { x: 6, y: 2 },
      { x: 6, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ];
    const star50 = Array.from({ length: 50 }, (_, i) => {
      const r = i % 2 === 0 ? 25 : 13;
      const a = (i * 2 * Math.PI) / 50;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    });
    const collinearRect: Point[] = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];

    for (const poly of [lShape, [...lShape].reverse(), uShape, comb10, star50, collinearRect]) {
      const expectedArea = surveyPolygon(poly).areaSqm;
      const tris = earcutSimplePolygon(poly);
      expect(tris.length).toBeGreaterThanOrEqual(1);
      for (const [a, b, c] of tris) {
        expect(triangleArea(poly[a]!, poly[b]!, poly[c]!)).toBeGreaterThan(0);
      }
      const triAreaSum = sumTriangleAreas(poly, tris);
      expect(Math.abs(triAreaSum - expectedArea)).toBeLessThan(1e-9);
    }
  });
});

describe("metric grid, isotropic centering, and 3D projection invariants", () => {
  it("picks clean 1/2/5 * 10^k metric grid steps", () => {
    for (const span of [0.05, 0.4, 4, 12, 30, 100, 750, 4200]) {
      const step = chooseMetricGridStep(span);
      const exp = Math.floor(Math.log10(step));
      const mantissa = step / 10 ** exp;
      expect([1, 2, 5]).toContain(Math.round(mantissa));
      expect(Math.abs(mantissa - Math.round(mantissa))).toBeLessThan(1e-9);
    }
    expect(chooseMetricGridStep(30)).toBe(5);
    expect(chooseMetricGridStep(0)).toBe(1);
  });

  it("centers coordinates isotropically (1:1:1) without distorting aspect ratio", () => {
    const shiftedBox: Point[] = [
      { x: 500000, y: 3000000 },
      { x: 500030, y: 3000000 },
      { x: 500030, y: 3000020 },
      { x: 500000, y: 3000020 },
    ];
    const metrics = computePolygon3DMetrics(shiftedBox);
    expect(metrics.bounds.spanX).toBeCloseTo(30, 10);
    expect(metrics.bounds.spanY).toBeCloseTo(20, 10);
    expect(metrics.bounds.centerX).toBeCloseTo(500015, 10);
    expect(metrics.bounds.centerY).toBeCloseTo(3000010, 10);
    expect(metrics.bounds.minX).toBeCloseTo(-15, 10);
    expect(metrics.bounds.maxX).toBeCloseTo(15, 10);
    expect(metrics.bounds.minY).toBeCloseTo(-10, 10);
    expect(metrics.bounds.maxY).toBeCloseTo(10, 10);
    expect(metrics.bounds.radius).toBeCloseTo(Math.hypot(15, 10), 10);
    expect(metrics.slabDepthM).toBeGreaterThanOrEqual(0.35);
    expect(metrics.isCCW).toBe(true);
    expect(metrics.triangles).toHaveLength(2);

    const cwMetrics = computePolygon3DMetrics([...shiftedBox].reverse());
    expect(cwMetrics.isCCW).toBe(false);
    expect(cwMetrics.ccwVertices.map((v) => v.index)).toEqual([3, 2, 1, 0]);
  });

  it("keeps strict north-up orientation in 2D plan and preserves parallel edges & equal lengths in orthographic mode", () => {
    const rect: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];
    const metrics = computePolygon3DMetrics(rect);
    const viewport: Viewport3D = {
      width: 640,
      height: 440,
      radiusM: metrics.bounds.radius,
      padding: 40,
    };

    // 2D Plan: yaw=0, pitch=90 -> X increases right, Y increases upward (screenY decreases).
    const planCam: CameraState = { mode: "plan", yawDeg: 0, pitchDeg: 90, zoom: 1 };
    const planPts = metrics.orderedVertices.map((v) =>
      projectPoint3D({ x: v.x, y: v.y, z: 0 }, planCam, viewport),
    );
    expect(planPts[1]!.x).toBeGreaterThan(planPts[0]!.x);
    expect(planPts[3]!.y).toBeLessThan(planPts[0]!.y);
    const planWidth = planPts[1]!.x - planPts[0]!.x;
    const planHeight = planPts[0]!.y - planPts[3]!.y;
    expect(planWidth / planHeight).toBeCloseTo(30 / 20, 10);

    // 3D Isometric: parallel edges remain strictly parallel and equal-length.
    const isoCam: CameraState = { mode: "isometric", yawDeg: 35, pitchDeg: 35, zoom: 1.2 };
    const isoPts = metrics.orderedVertices.map((v) =>
      projectPoint3D({ x: v.x, y: v.y, z: 0 }, isoCam, viewport),
    );
    // Opposite edges AB (0->1) and DC (3->2) must have identical 2D vectors.
    const abX = isoPts[1]!.x - isoPts[0]!.x;
    const abY = isoPts[1]!.y - isoPts[0]!.y;
    const dcX = isoPts[2]!.x - isoPts[3]!.x;
    const dcY = isoPts[2]!.y - isoPts[3]!.y;
    expect(abX).toBeCloseTo(dcX, 10);
    expect(abY).toBeCloseTo(dcY, 10);
    expect(Math.hypot(abX, abY)).toBeCloseTo(Math.hypot(dcX, dcY), 10);
    expect(isoPts[0]!.scale).toBeCloseTo(isoPts[2]!.scale, 10);

    // Vertical extrusions remain parallel/vertical on screen.
    const topA = projectPoint3D({ x: -15, y: -10, z: 3 }, isoCam, viewport);
    const botA = projectPoint3D({ x: -15, y: -10, z: 0 }, isoCam, viewport);
    expect(topA.x).toBeCloseTo(botA.x, 10);
    expect(topA.y).toBeLessThan(botA.y);
  });

  it("orders perspective depth, applies foreshortening, and fits viewport cleanly without clipping", () => {
    const rect: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];
    const metrics = computePolygon3DMetrics(rect);
    const viewport: Viewport3D = {
      width: 600,
      height: 420,
      radiusM: metrics.bounds.radius,
      padding: 36,
    };
    const perspCam: CameraState = {
      mode: "perspective",
      yawDeg: 0,
      pitchDeg: 30,
      zoom: 1,
      fovDeg: 42,
    };
    const pts = metrics.orderedVertices.map((v) =>
      projectPoint3D({ x: v.x, y: v.y, z: 0 }, perspCam, viewport),
    );

    // At yaw=0, camera sits South (-Y) looking North (+Y): A,B are closer than D,C.
    expect(pts[0]!.depth).toBeLessThan(pts[3]!.depth);
    expect(pts[0]!.scale).toBeGreaterThan(pts[3]!.scale);
    const frontWidth = pts[1]!.x - pts[0]!.x;
    const backWidth = pts[2]!.x - pts[3]!.x;
    expect(frontWidth).toBeGreaterThan(backWidth);

    // All corners at zoom=1 remain inside viewport padding across rotations.
    for (const yawDeg of [0, 35, 90, 145, 225, 310]) {
      const cam: CameraState = { mode: "perspective", yawDeg, pitchDeg: 32, zoom: 1, fovDeg: 42 };
      for (const v of metrics.orderedVertices) {
        const p = projectPoint3D({ x: v.x, y: v.y, z: 0 }, cam, viewport);
        expect(p.x).toBeGreaterThanOrEqual(viewport.padding! - 1e-6);
        expect(p.x).toBeLessThanOrEqual(viewport.width - viewport.padding! + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(viewport.padding! - 1e-6);
        expect(p.y).toBeLessThanOrEqual(viewport.height - viewport.padding! + 1e-6);
      }
    }
  });

  it("builds depth-sorted extruded walls with accurate outward camera-facing & Lambertian shading", () => {
    const rect: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ];
    const metrics = computePolygon3DMetrics(rect);
    const viewport: Viewport3D = {
      width: 640,
      height: 440,
      radiusM: metrics.bounds.radius,
      padding: 40,
    };
    const isoCam: CameraState = { mode: "isometric", yawDeg: 35, pitchDeg: 35, zoom: 1 };
    const walls = buildExtrudedWalls(metrics, metrics.slabDepthM, isoCam, viewport, 2);

    expect(walls).toHaveLength(4);
    for (let i = 1; i < walls.length; i++) {
      expect(walls[i - 1]!.avgDepth).toBeGreaterThanOrEqual(walls[i]!.avgDepth);
    }
    // At yaw=35 (SE camera), edge 0 (South) and edge 1 (East) face camera; edges 2, 3 do not.
    const facingEdges = walls.filter((w) => w.facingCamera).map((w) => w.edgeIndex).sort();
    expect(facingEdges).toEqual([0, 1]);
    walls.forEach((w) => {
      expect(w.shade).toBeGreaterThanOrEqual(0.35);
      expect(w.shade).toBeLessThanOrEqual(1);
    });

    // Plan view has no side walls facing camera.
    const planWalls = buildExtrudedWalls(
      metrics,
      metrics.slabDepthM,
      { mode: "plan", yawDeg: 0, pitchDeg: 90, zoom: 1 },
      viewport,
    );
    expect(planWalls.every((w) => !w.facingCamera)).toBe(true);
  });

  it("calibrates scaleBarLengthM accurately to the active camera and creates proportional plots safely", () => {
    const viewport: Viewport3D = { width: 640, height: 440, radiusM: 18, padding: 40 };
    const cam: CameraState = { mode: "isometric", yawDeg: 35, pitchDeg: 35, zoom: 1 };
    const bar = scaleBarLengthM(cam, viewport, 96);
    expect(bar.feet).toBeCloseTo(bar.metres / 0.3048, 10);

    // Projected pixel distance along horizontal camRight must match bar.pixels exactly.
    const cosY = Math.cos((cam.yawDeg * Math.PI) / 180);
    const sinY = Math.sin((cam.yawDeg * Math.PI) / 180);
    const p0 = projectPoint3D({ x: 0, y: 0, z: 0 }, cam, viewport);
    const p1 = projectPoint3D(
      { x: bar.metres * cosY, y: bar.metres * sinY, z: 0 },
      cam,
      viewport,
    );
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeCloseTo(bar.pixels, 8);

    const plot43 = createProportionalPlot(127.18426176, 4 / 3);
    expect(plot43.areaSqm).toBeCloseTo(127.18426176, 8);
    expect(plot43.sidesM[0]! / plot43.sidesM[1]!).toBeCloseTo(4 / 3, 10);

    // Clamps degenerate areas safely without throwing.
    expect(createProportionalPlot(0).areaSqm).toBeGreaterThan(0);
    expect(createProportionalPlot(-100, 2).areaSqm).toBeGreaterThan(0);
    expect(createProportionalPlot(NaN).areaSqm).toBeGreaterThan(0);
    expect(createProportionalPlot(1e20, 1).areaSqm).toBeGreaterThan(0);
  });
});
