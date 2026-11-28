import { rectangle, type LandGeometry, type Point } from "./land-geometry";

export type Point3D = { x: number; y: number; z: number };
export type ProjectedPoint = { x: number; y: number; depth: number; scale: number };
export type CameraMode = "isometric" | "perspective" | "plan";
export type CameraState = {
  mode: CameraMode;
  yawDeg: number;
  pitchDeg: number;
  zoom: number;
  fovDeg?: number;
};
export type Viewport3D = {
  width: number;
  height: number;
  radiusM: number;
  padding?: number;
};
export type CenteredVertex = { index: number; x: number; y: number };
export type Polygon3DMetrics = {
  /** Vertices centered around bounds center, ordered counter-clockwise; `.index` maps back to `orderedVertices`. */
  ccwVertices: CenteredVertex[];
  /** Vertices centered around bounds center in their original boundary order (`0..n-1`). */
  orderedVertices: CenteredVertex[];
  /** Exact interior angle in degrees `(0..360)` at each corner in `orderedVertices` order. */
  interiorAnglesDeg: number[];
  /** Ear-clipped CCW triangles indexing into `orderedVertices` (and the original `corners` array). */
  triangles: [number, number, number][];
  /** Centered bounding box (`minX..maxY` around `(0,0)`) plus original world center `(centerX, centerY)` and bounding radius. */
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    spanX: number;
    spanY: number;
    centerX: number;
    centerY: number;
    radius: number;
  };
  gridStepM: number;
  slabDepthM: number;
  isCCW: boolean;
};
export type ExtrudedWallFace = {
  edgeIndex: number;
  corners2D: [ProjectedPoint, ProjectedPoint, ProjectedPoint, ProjectedPoint];
  avgDepth: number;
  shade: number;
  facingCamera: boolean;
};

const METRES_PER_FOOT = 0.3048;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EPS = 1e-11;

// Normalized upper-southeast directional sunlight for distinct wall shading.
const LIGHT_RAW = { x: 0.58, y: -0.48, z: 0.66 };
const LIGHT_LEN = Math.hypot(LIGHT_RAW.x, LIGHT_RAW.y, LIGHT_RAW.z);
const LIGHT_DIR: Point3D = {
  x: LIGHT_RAW.x / LIGHT_LEN,
  y: LIGHT_RAW.y / LIGHT_LEN,
  z: LIGHT_RAW.z / LIGHT_LEN,
};

function cross2D(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function dot2D(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

function signedTwiceArea(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  const origin = points[0]!;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const ax = a.x - origin.x;
    const ay = a.y - origin.y;
    const bx = b.x - origin.x;
    const by = b.y - origin.y;
    sum += ax * by - bx * ay;
  }
  return sum;
}

function normalizePolygon(vertices: readonly Point[]): { points: Point[]; span: number } {
  const origin = vertices[0]!;
  let maxDist = 0;
  for (const p of vertices) {
    const d = Math.hypot(p.x - origin.x, p.y - origin.y);
    if (d > maxDist) maxDist = d;
  }
  if (!Number.isFinite(maxDist) || maxDist <= 0) {
    return { points: [], span: 0 };
  }
  return {
    points: vertices.map((p) => ({
      x: (p.x - origin.x) / maxDist,
      y: (p.y - origin.y) / maxDist,
    })),
    span: maxDist,
  };
}

function pointInCCWTriangle(a: Point, b: Point, c: Point, p: Point, eps: number): boolean {
  return (
    cross2D(a, b, p) >= -eps &&
    cross2D(b, c, p) >= -eps &&
    cross2D(c, a, p) >= -eps
  );
}

function stripCollinearVertices(active: number[], points: readonly Point[], eps: number): boolean {
  let removed = false;
  let i = 0;
  while (active.length > 3 && i < active.length) {
    const n = active.length;
    const prevIdx = active[(i - 1 + n) % n]!;
    const currIdx = active[i]!;
    const nextIdx = active[(i + 1) % n]!;
    const prev = points[prevIdx]!;
    const curr = points[currIdx]!;
    const next = points[nextIdx]!;
    const c = cross2D(prev, curr, next);
    const d = dot2D(curr.x - prev.x, curr.y - prev.y, next.x - curr.x, next.y - curr.y);
    if (Math.abs(c) <= eps && d > 0) {
      active.splice(i, 1);
      removed = true;
    } else {
      i++;
    }
  }
  return removed;
}

/**
 * Triangulate a simple 3+ vertex polygon (convex or concave) via ear clipping.
 * Returned triangle indices refer to the supplied `vertices` array in CCW order.
 */
export function earcutSimplePolygon(vertices: readonly Point[]): [number, number, number][] {
  const n = vertices.length;
  if (n < 3) return [];

  const { points, span } = normalizePolygon(vertices);
  if (span <= 0) return [];

  const twiceArea = signedTwiceArea(points);
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) <= EPS) return [];

  const active =
    twiceArea > 0
      ? Array.from({ length: n }, (_, i) => i)
      : Array.from({ length: n }, (_, i) => n - 1 - i);

  stripCollinearVertices(active, points, EPS);
  const triangles: [number, number, number][] = [];

  const tryClipEar = (minCross: number, containmentEps: number): boolean => {
    const len = active.length;
    for (let i = 0; i < len; i++) {
      const prevIdx = active[(i - 1 + len) % len]!;
      const currIdx = active[i]!;
      const nextIdx = active[(i + 1) % len]!;
      const prev = points[prevIdx]!;
      const curr = points[currIdx]!;
      const next = points[nextIdx]!;

      if (cross2D(prev, curr, next) <= minCross) continue;

      let containsVertex = false;
      for (let j = 0; j < len; j++) {
        const testIdx = active[j]!;
        if (testIdx === prevIdx || testIdx === currIdx || testIdx === nextIdx) continue;
        if (pointInCCWTriangle(prev, curr, next, points[testIdx]!, containmentEps)) {
          containsVertex = true;
          break;
        }
      }
      if (containsVertex) continue;

      triangles.push([prevIdx, currIdx, nextIdx]);
      active.splice(i, 1);
      return true;
    }
    return false;
  };

  let guard = active.length * active.length + 16;
  while (active.length > 3 && guard-- > 0) {
    if (tryClipEar(EPS, EPS)) {
      stripCollinearVertices(active, points, EPS);
      continue;
    }
    if (tryClipEar(1e-14, 1e-13)) {
      stripCollinearVertices(active, points, 1e-10);
      continue;
    }
    if (stripCollinearVertices(active, points, 1e-9)) continue;
    // Fallback for degenerate/self-intersecting input so the loop never stalls.
    break;
  }

  if (active.length === 3) {
    const [a, b, c] = active as [number, number, number];
    if (Math.abs(cross2D(points[a]!, points[b]!, points[c]!)) > 1e-14) {
      triangles.push([a, b, c]);
    }
  }

  return triangles;
}

/**
 * Compute exact interior angles (in degrees, `0..360`) for every corner in order,
 * preserving reflex angles `> 180` for concave polygons. Total sum equals `(n - 2) * 180`.
 */
export function computeInteriorAngles(corners: readonly Point[]): number[] {
  const n = corners.length;
  if (n < 3) return [];

  const { points, span } = normalizePolygon(corners);
  if (span <= 0) return corners.map(() => 0);

  const twiceArea = signedTwiceArea(points);
  const orientation = twiceArea >= 0 ? 1 : -1;

  return points.map((curr, i) => {
    const prev = points[(i - 1 + n) % n]!;
    const next = points[(i + 1) % n]!;
    const ux = prev.x - curr.x;
    const uy = prev.y - curr.y;
    const vx = next.x - curr.x;
    const vy = next.y - curr.y;
    const cross = orientation * (vx * uy - vy * ux);
    const dot = vx * ux + vy * uy;
    let deg = Math.atan2(cross, dot) * RAD_TO_DEG;
    if (deg < 0) deg += 360;
    // Snap tiny -0/360 floating drift on exact 180-deg straight corners.
    if (deg > 360 - 1e-12 && dot < 0) deg = 180;
    return deg;
  });
}

/** Pick a clean `1 / 2 / 5 * 10^k` metric grid step producing roughly 4–10 divisions. */
export function chooseMetricGridStep(maxSpanM: number): number {
  if (!Number.isFinite(maxSpanM) || maxSpanM <= 0) return 1;
  const rough = maxSpanM / 6;
  const pow10 = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / pow10;
  const step = norm <= 1.5 ? 1 : norm <= 3.5 ? 2 : norm <= 7.5 ? 5 : 10;
  return step * pow10;
}

/** Center polygon vertices isotropically (1:1:1) and precompute 3D bounds, angles, and triangles. */
export function computePolygon3DMetrics(corners: readonly Point[]): Polygon3DMetrics {
  if (corners.length === 0) {
    return {
      ccwVertices: [],
      orderedVertices: [],
      interiorAnglesDeg: [],
      triangles: [],
      bounds: {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        spanX: 0,
        spanY: 0,
        centerX: 0,
        centerY: 0,
        radius: 1,
      },
      gridStepM: 1,
      slabDepthM: 0.35,
      isCCW: true,
    };
  }

  let rawMinX = Infinity;
  let rawMaxX = -Infinity;
  let rawMinY = Infinity;
  let rawMaxY = -Infinity;
  for (const p of corners) {
    if (p.x < rawMinX) rawMinX = p.x;
    if (p.x > rawMaxX) rawMaxX = p.x;
    if (p.y < rawMinY) rawMinY = p.y;
    if (p.y > rawMaxY) rawMaxY = p.y;
  }

  const spanX = rawMaxX - rawMinX;
  const spanY = rawMaxY - rawMinY;
  const centerX = (rawMinX + rawMaxX) / 2;
  const centerY = (rawMinY + rawMaxY) / 2;

  const orderedVertices: CenteredVertex[] = corners.map((p, index) => ({
    index,
    x: p.x - centerX,
    y: p.y - centerY,
  }));

  let maxRadius = 0;
  for (const v of orderedVertices) {
    const r = Math.hypot(v.x, v.y);
    if (r > maxRadius) maxRadius = r;
  }
  const radius = Math.max(1e-6, maxRadius);

  const twiceArea = signedTwiceArea(orderedVertices);
  const isCCW = twiceArea >= 0;
  const ccwVertices = isCCW ? [...orderedVertices] : [...orderedVertices].reverse();
  const interiorAnglesDeg = computeInteriorAngles(orderedVertices);
  const triangles = earcutSimplePolygon(orderedVertices);
  const gridStepM = chooseMetricGridStep(Math.max(spanX, spanY));
  const slabDepthM = Math.max(radius * 0.14, Math.min(0.35, radius * 0.35));

  return {
    ccwVertices,
    orderedVertices,
    interiorAnglesDeg,
    triangles,
    bounds: {
      minX: -spanX / 2,
      maxX: spanX / 2,
      minY: -spanY / 2,
      maxY: spanY / 2,
      spanX,
      spanY,
      centerX,
      centerY,
      radius,
    },
    gridStepM,
    slabDepthM,
    isCCW,
  };
}

type CameraBasis = {
  right: Point3D;
  up: Point3D;
  dir: Point3D;
  halfMin: number;
  radiusM: number;
  zoom: number;
  fovRad: number;
  camDist: number;
  focalPx: number;
};

function computeCameraBasis(camera: CameraState, viewport: Viewport3D): CameraBasis {
  const padding = viewport.padding ?? 48;
  const minDim = Math.max(2, Math.min(viewport.width, viewport.height));
  const halfMin = Math.max(1, minDim / 2 - padding);
  const radiusM = Math.max(1e-6, Number.isFinite(viewport.radiusM) ? viewport.radiusM : 1);
  const zoom = Math.max(0.1, Number.isFinite(camera.zoom) ? camera.zoom : 1);

  const yawRad = (Number.isFinite(camera.yawDeg) ? camera.yawDeg : 0) * DEG_TO_RAD;
  const pitchDeg =
    camera.mode === "plan"
      ? 90
      : Math.max(-90, Math.min(90, Number.isFinite(camera.pitchDeg) ? camera.pitchDeg : 35));
  const pitchRad = pitchDeg * DEG_TO_RAD;

  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);

  const right: Point3D = { x: cosY, y: sinY, z: 0 };
  const up: Point3D = { x: -sinY * sinP, y: cosY * sinP, z: cosP };
  const dir: Point3D = { x: sinY * cosP, y: -cosY * cosP, z: sinP };

  const fovDeg = Math.max(10, Math.min(120, camera.fovDeg ?? 42));
  const fovRad = fovDeg * DEG_TO_RAD;
  const halfFov = fovRad / 2;
  const camDist = radiusM / Math.sin(halfFov);
  const focalPx = (halfMin / Math.tan(halfFov)) * zoom;

  return { right, up, dir, halfMin, radiusM, zoom, fovRad, camDist, focalPx };
}

/**
 * Project a 3D point (ground +X east, +Y north, +Z up) into viewport pixel coordinates.
 * Isometric & Plan use strict orthographic projection; Perspective uses pinhole projection.
 */
export function projectPoint3D(
  point: Point3D,
  camera: CameraState,
  viewport: Viewport3D,
): ProjectedPoint {
  const basis = computeCameraBasis(camera, viewport);
  const cx = point.x * basis.right.x + point.y * basis.right.y + point.z * basis.right.z;
  const cy = point.x * basis.up.x + point.y * basis.up.y + point.z * basis.up.z;
  const cz = point.x * basis.dir.x + point.y * basis.dir.y + point.z * basis.dir.z;

  if (camera.mode === "perspective") {
    const rawDepth = basis.camDist - cz;
    const safeDepth = Math.max(rawDepth, basis.radiusM * 0.05, 1e-4);
    const scale = basis.focalPx / safeDepth;
    return {
      x: viewport.width / 2 + cx * scale,
      y: viewport.height / 2 - cy * scale,
      depth: rawDepth,
      scale,
    };
  }

  const scale = (basis.halfMin / basis.radiusM) * basis.zoom;
  return {
    x: viewport.width / 2 + cx * scale,
    y: viewport.height / 2 - cy * scale,
    depth: -cz,
    scale,
  };
}

/**
 * Build depth-sorted extruded side/fence wall quads with exact outward Lambertian shading
 * and camera-facing flags.
 */
export function buildExtrudedWalls(
  metrics: Polygon3DMetrics,
  slabDepthM: number,
  camera: CameraState,
  viewport: Viewport3D,
  wallHeightM = 0,
): ExtrudedWallFace[] {
  const verts = metrics.ccwVertices;
  const n = verts.length;
  if (n < 3) return [];

  const basis = computeCameraBasis(camera, viewport);
  const zBottom = -Math.max(0, slabDepthM);
  const zTop = Math.max(0, wallHeightM);
  const camPos = {
    x: basis.dir.x * basis.camDist,
    y: basis.dir.y * basis.camDist,
    z: basis.dir.z * basis.camDist,
  };

  const faces: ExtrudedWallFace[] = [];

  for (let i = 0; i < n; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % n]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen <= 0) continue;

    // In CCW XY ordering, rotating edge (dx, dy) 90 deg CW yields the outward normal.
    const nx = dy / edgeLen;
    const ny = -dx / edgeLen;

    const c0 = projectPoint3D({ x: a.x, y: a.y, z: zTop }, camera, viewport);
    const c1 = projectPoint3D({ x: b.x, y: b.y, z: zTop }, camera, viewport);
    const c2 = projectPoint3D({ x: b.x, y: b.y, z: zBottom }, camera, viewport);
    const c3 = projectPoint3D({ x: a.x, y: a.y, z: zBottom }, camera, viewport);

    const avgDepth = (c0.depth + c1.depth + c2.depth + c3.depth) / 4;

    const facingDot =
      camera.mode === "perspective"
        ? nx * (camPos.x - (a.x + b.x) / 2) + ny * (camPos.y - (a.y + b.y) / 2)
        : nx * basis.dir.x + ny * basis.dir.y;

    const lambert = Math.max(0, nx * LIGHT_DIR.x + ny * LIGHT_DIR.y);
    const shade = 0.35 + 0.65 * lambert;

    faces.push({
      edgeIndex: metrics.isCCW ? a.index : b.index,
      corners2D: [c0, c1, c2, c3],
      avgDepth,
      shade,
      facingCamera: facingDot > 1e-6,
    });
  }

  faces.sort((a, b) => {
    if (b.avgDepth !== a.avgDepth) return b.avgDepth - a.avgDepth;
    return Number(a.facingCamera) - Number(b.facingCamera);
  });

  return faces;
}

/** Return a clean metric/imperial scale bar calibrated to the active camera projection. */
export function scaleBarLengthM(
  camera: CameraState,
  viewport: Viewport3D,
  targetPx = 96,
): { metres: number; feet: number; pixels: number } {
  const basis = computeCameraBasis(camera, viewport);
  const safeTargetPx = Math.max(8, Number.isFinite(targetPx) ? targetPx : 96);
  const pxPerMetre =
    camera.mode === "perspective"
      ? basis.focalPx / basis.camDist
      : (basis.halfMin / basis.radiusM) * basis.zoom;

  const targetMetres = Math.max(1e-6, safeTargetPx / Math.max(1e-9, pxPerMetre));
  const pow10 = 10 ** Math.floor(Math.log10(targetMetres));
  const candidates = [1, 2, 5, 10].map((m) => m * pow10);

  let best = candidates[0]!;
  let bestDiff = Math.abs(best * pxPerMetre - safeTargetPx);
  for (const cand of candidates.slice(1)) {
    const diff = Math.abs(cand * pxPerMetre - safeTargetPx);
    if (diff < bestDiff) {
      best = cand;
      bestDiff = diff;
    }
  }

  return {
    metres: best,
    feet: best / METRES_PER_FOOT,
    pixels: best * pxPerMetre,
  };
}

/**
 * Construct a valid rectangle `LandGeometry` with the supplied area (m²) and `length / width` ratio.
 * Safely clamps degenerate or extreme inputs so proportional previews never throw.
 */
export function createProportionalPlot(areaSqm: number, aspectRatio = 1): LandGeometry {
  const safeRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0
      ? Math.max(0.05, Math.min(20, aspectRatio))
      : 1;
  // surveyPolygon checks diagonal span <= MAX_LENGTH (10_000_000 m).
  const maxDiagonalM = 9_999_000;
  const maxAreaForRatio = (maxDiagonalM * maxDiagonalM) / (safeRatio + 1 / safeRatio);
  const rawArea = Number.isFinite(areaSqm) && areaSqm > 0 ? areaSqm : 1e-4;
  const safeArea = Math.max(1e-4, Math.min(rawArea, maxAreaForRatio));

  const width = Math.sqrt(safeArea / safeRatio);
  const length = width * safeRatio;
  return rectangle(length, width, "m");
}
