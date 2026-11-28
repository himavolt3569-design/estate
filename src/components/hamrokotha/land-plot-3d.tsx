"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Box,
  Compass,
  Download,
  Eye,
  Grid3X3,
  ImagePlus,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildExtrudedWalls,
  computePolygon3DMetrics,
  projectPoint3D,
  scaleBarLengthM,
  type CameraMode,
  type CameraState,
  type Point3D,
  type ProjectedPoint,
  type Viewport3D,
} from "@/lib/land-3d";
import type { LandGeometry } from "@/lib/land-geometry";
import {
  metricAreaBreakdown,
  metresToFeet,
  nepaliAreaParts,
  NEPALI_AREA_SYSTEMS,
} from "@/lib/nepali-land";
import { landLabel } from "@/lib/land";
import { cn } from "@/lib/utils";
import { formatLandNumber } from "./nepali-area-results";
import { useSiteLanguage, useSiteText } from "./site-language";

type LayerVisibility = {
  grid: boolean;
  lengths: boolean;
  angles: boolean;
  diagonals: boolean;
  pillars: boolean;
};

type ImageFit = "cover" | "stretch";

const DEFAULT_CAMERA: CameraState = {
  mode: "isometric",
  yawDeg: -34,
  pitchDeg: 38,
  zoom: 1,
  fovDeg: 40,
};

const cornerName = (index: number) =>
  index < 26 ? String.fromCharCode(65 + index) : `P${index + 1}`;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interiorAngleLabelPos(
  orderedTop: readonly ProjectedPoint[],
  index: number,
  angleDeg: number,
  fallbackCenter: { x: number; y: number },
  offsetPx = 26,
): { x: number; y: number } {
  const n = orderedTop.length;
  const curr = orderedTop[index]!;
  const prev = orderedTop[(index - 1 + n) % n]!;
  const next = orderedTop[(index + 1) % n]!;
  const ux = prev.x - curr.x;
  const uy = prev.y - curr.y;
  const uLen = Math.hypot(ux, uy) || 1;
  const vx = next.x - curr.x;
  const vy = next.y - curr.y;
  const vLen = Math.hypot(vx, vy) || 1;
  const sign = angleDeg > 180 ? -1 : 1;
  let bx = sign * (ux / uLen + vx / vLen);
  let by = sign * (uy / uLen + vy / vLen);
  let bLen = Math.hypot(bx, by);
  if (bLen < 1e-3) {
    bx = fallbackCenter.x - curr.x;
    by = fallbackCenter.y - curr.y;
    bLen = Math.hypot(bx, by) || 1;
  }
  return {
    x: curr.x + (bx / bLen) * offsetPx,
    y: curr.y + (by / bLen) * offsetPx,
  };
}

function defaultCameraForMode(mode: CameraMode): CameraState {
  if (mode === "plan") {
    return { mode: "plan", yawDeg: 0, pitchDeg: 90, zoom: 1, fovDeg: 40 };
  }
  if (mode === "perspective") {
    return {
      mode: "perspective",
      yawDeg: -34,
      pitchDeg: 34,
      zoom: 1,
      fovDeg: 40,
    };
  }
  return { ...DEFAULT_CAMERA };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function LandPlot3D({
  geometry,
  title,
  subtitle,
  allowImageUpload = false,
  initialImageUrl = null,
  compact = false,
  isProportional = false,
  className,
  ariaLabel,
}: {
  geometry: LandGeometry;
  title?: string;
  subtitle?: string;
  allowImageUpload?: boolean;
  initialImageUrl?: string | null;
  compact?: boolean;
  isProportional?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const { locale } = useSiteLanguage();
  const text = useSiteText();
  const ne = locale === "ne";

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
    pointerType: string;
  } | null>(null);

  const [stageSize, setStageSize] = useState({
    width: 680,
    height: compact ? 300 : 420,
  });
  const [camera, setCamera] = useState<CameraState>(DEFAULT_CAMERA);
  const [layers, setLayers] = useState<LayerVisibility>({
    grid: true,
    lengths: true,
    angles: true,
    diagonals: true,
    pillars: true,
  });
  const [fenceHeightM, setFenceHeightM] = useState(0);

  // Reference image / cadastral naksa state
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [dismissedInitial, setDismissedInitial] = useState(false);
  const [imageOpacity, setImageOpacity] = useState(75);
  const [imageRotationDeg, setImageRotationDeg] = useState(0);
  const [imageFit, setImageFit] = useState<ImageFit>("cover");
  const [loadedImage, setLoadedImage] = useState<{
    img: HTMLImageElement;
    tainted: boolean;
  } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const activeImageUrl =
    uploadedDataUrl ?? (!dismissedInitial ? initialImageUrl : null) ?? null;

  useEffect(() => {
    setDismissedInitial(false);
  }, [initialImageUrl]);

  useEffect(() => {
    if (!activeImageUrl) {
      setLoadedImage(null);
      setImageError(null);
      return;
    }
    let cancelled = false;
    setImageError(null);
    const isLocal =
      activeImageUrl.startsWith("data:") || activeImageUrl.startsWith("blob:");

    const loadDirect = () => {
      const fallback = new Image();
      fallback.onload = () => {
        if (!cancelled) setLoadedImage({ img: fallback, tainted: true });
      };
      fallback.onerror = () => {
        if (!cancelled) {
          setLoadedImage(null);
          setImageError(
            ne
              ? "यो फोटो लोड गर्न सकिएन।"
              : "Could not load the reference image.",
          );
        }
      };
      fallback.src = activeImageUrl;
    };

    const img = new Image();
    if (!isLocal) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setLoadedImage({ img, tainted: false });
    };
    img.onerror = () => {
      if (cancelled) return;
      if (!isLocal) {
        loadDirect();
      } else {
        setLoadedImage(null);
        setImageError(
          ne
            ? "यो फोटो फाइल पढ्न सकिएन।"
            : "Could not read the selected image file.",
        );
      }
    };
    img.src = activeImageUrl;

    return () => {
      cancelled = true;
    };
  }, [activeImageUrl, ne]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);

  const metrics = useMemo(
    () => computePolygon3DMetrics(geometry.corners),
    [geometry.corners],
  );

  const viewport: Viewport3D = useMemo(
    () => ({
      width: stageSize.width,
      height: stageSize.height,
      radiusM: metrics.bounds.radius,
      padding: compact ? 44 : 64,
    }),
    [stageSize.width, stageSize.height, metrics.bounds.radius, compact],
  );

  const scaleBar = useMemo(
    () => scaleBarLengthM(camera, viewport, compact ? 76 : 96),
    [camera, viewport, compact],
  );

  const num = useCallback(
    (value: number, digits = 2) => formatLandNumber(value, locale, digits),
    [locale],
  );

  // Projected scene geometry used identically by Canvas2D, SVG overlay, and PNG export.
  const computeScene = useCallback(
    (targetViewport: Viewport3D, targetCamera: CameraState) => {
      const project = (pt: Point3D) =>
        projectPoint3D(pt, targetCamera, targetViewport);

      const orderedTop = metrics.orderedVertices.map((v) =>
        project({ x: v.x, y: v.y, z: 0 }),
      );
      const ccwTop = metrics.ccwVertices.map((v) =>
        project({ x: v.x, y: v.y, z: 0 }),
      );
      const ccwBottom = metrics.ccwVertices.map((v) =>
        project({ x: v.x, y: v.y, z: -metrics.slabDepthM }),
      );
      const walls = buildExtrudedWalls(
        metrics,
        metrics.slabDepthM,
        targetCamera,
        targetViewport,
        0,
      );

      // Optional visual fence faces (z: 0 -> fenceHeightM)
      const fenceFaces =
        fenceHeightM > 0
          ? metrics.ccwVertices
              .map((v, i) => {
                const next =
                  metrics.ccwVertices[(i + 1) % metrics.ccwVertices.length]!;
                const b0 = project({ x: v.x, y: v.y, z: 0 });
                const b1 = project({ x: next.x, y: next.y, z: 0 });
                const t1 = project({ x: next.x, y: next.y, z: fenceHeightM });
                const t0 = project({ x: v.x, y: v.y, z: fenceHeightM });
                return {
                  corners2D: [b0, b1, t1, t0] as const,
                  avgDepth: (b0.depth + b1.depth + t1.depth + t0.depth) / 4,
                };
              })
              .sort((a, b) => b.avgDepth - a.avgDepth)
          : [];

      const centroidLocal = {
        x: geometry.centroid.x - metrics.bounds.centerX,
        y: geometry.centroid.y - metrics.bounds.centerY,
      };
      const centroid2D = project({ x: centroidLocal.x, y: centroidLocal.y, z: 0 });

      const pinHeight =
        targetCamera.mode === "plan" || targetCamera.pitchDeg >= 88
          ? 0
          : Math.max(metrics.bounds.radius * 0.055, 0.35);

      const polygonScreenCenter = orderedTop.reduce(
        (acc, p) => ({
          x: acc.x + p.x / (orderedTop.length || 1),
          y: acc.y + p.y / (orderedTop.length || 1),
        }),
        { x: 0, y: 0 },
      );

      const pillars2D = metrics.orderedVertices.map((v, i) => {
        const angleDeg =
          metrics.interiorAnglesDeg[i] ??
          metrics.interiorAnglesDeg[v.index] ??
          0;
        return {
          index: i,
          label: cornerName(i),
          base: orderedTop[i]!,
          top: project({ x: v.x, y: v.y, z: pinHeight }),
          angleDeg,
          anglePos: interiorAngleLabelPos(
            orderedTop,
            i,
            angleDeg,
            polygonScreenCenter,
            26,
          ),
        };
      });

      const diagonals2D = geometry.diagonalsM.map((d) => {
        const a = orderedTop[d.from]!;
        const b = orderedTop[d.to]!;
        return {
          ...d,
          a,
          b,
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
      });

      const edges2D = metrics.orderedVertices.map((_v, i) => {
        const nextIdx = (i + 1) % metrics.orderedVertices.length;
        const a = orderedTop[i]!;
        const b = orderedTop[nextIdx]!;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        // Outward normal away from polygon screen center
        let nx = -dy / len;
        let ny = dx / len;
        if (
          (mx + nx - polygonScreenCenter.x) ** 2 +
            (my + ny - polygonScreenCenter.y) ** 2 <
          (mx - polygonScreenCenter.x) ** 2 +
            (my - polygonScreenCenter.y) ** 2
        ) {
          nx = -nx;
          ny = -ny;
        }
        const sideM = geometry.sidesM[i] ?? 0;
        return {
          index: i,
          a,
          b,
          mid: { x: mx, y: my },
          labelPos: { x: mx + nx * 16, y: my + ny * 16 },
          sideM,
          screenLen: len,
        };
      });

      return {
        project,
        orderedTop,
        ccwTop,
        ccwBottom,
        walls,
        fenceFaces,
        centroid2D,
        pillars2D,
        diagonals2D,
        edges2D,
        polygonScreenCenter,
      };
    },
    [metrics, geometry.centroid, geometry.diagonalsM, geometry.sidesM, fenceHeightM],
  );

  const scene = useMemo(
    () => computeScene(viewport, camera),
    [computeScene, viewport, camera],
  );

  // Paint Canvas2D layers (shared with PNG export)
  const paintCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      targetViewport: Viewport3D,
      targetCamera: CameraState,
      targetScene: ReturnType<typeof computeScene>,
      options: { includeVectorAnnotations: boolean; allowTaintedImage: boolean },
    ) => {
      const { width: w, height: h } = targetViewport;
      ctx.clearRect(0, 0, w, h);

      // Architectural backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#f8fafc");
      bg.addColorStop(1, "#eff6ff");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 1. Adaptive metric grid on ground plane
      if (layers.grid) {
        const step = metrics.gridStepM;
        const halfSpan =
          Math.ceil((Math.max(metrics.bounds.spanX, metrics.bounds.spanY) * 0.9) / step) *
          step;
        const minG = -Math.max(halfSpan, step * 3);
        const maxG = Math.max(halfSpan, step * 3);
        const gridZ = targetCamera.mode === "plan" ? 0 : -metrics.slabDepthM;

        for (let g = minG; g <= maxG + step * 0.001; g += step) {
          const isAxis = Math.abs(g) < step * 0.01;
          const isMajor = Math.abs(Math.round(g / step)) % 5 === 0;
          ctx.strokeStyle = isAxis
            ? "rgba(29, 78, 216, 0.22)"
            : isMajor
              ? "rgba(148, 163, 184, 0.35)"
              : "rgba(203, 213, 225, 0.45)";
          ctx.lineWidth = isAxis ? 1.25 : 0.85;

          const pX1 = targetScene.project({ x: minG, y: g, z: gridZ });
          const pX2 = targetScene.project({ x: maxG, y: g, z: gridZ });
          ctx.beginPath();
          ctx.moveTo(pX1.x, pX1.y);
          ctx.lineTo(pX2.x, pX2.y);
          ctx.stroke();

          const pY1 = targetScene.project({ x: g, y: minG, z: gridZ });
          const pY2 = targetScene.project({ x: g, y: maxG, z: gridZ });
          ctx.beginPath();
          ctx.moveTo(pY1.x, pY1.y);
          ctx.lineTo(pY2.x, pY2.y);
          ctx.stroke();
        }
      }

      // 2. Soft ground drop shadow beneath slab in 3D modes
      if (targetCamera.mode !== "plan" && targetCamera.pitchDeg < 88) {
        ctx.save();
        ctx.beginPath();
        targetScene.ccwBottom.forEach((p, idx) =>
          idx === 0 ? ctx.moveTo(p.x + 6, p.y + 8) : ctx.lineTo(p.x + 6, p.y + 8),
        );
        ctx.closePath();
        ctx.fillStyle = "rgba(15, 23, 42, 0.11)";
        ctx.fill();
        ctx.restore();
      }

      // 3. Depth-sorted extruded terrain side walls (Lambertian shading)
      if (targetCamera.mode !== "plan" && targetCamera.pitchDeg < 88) {
        for (const wall of targetScene.walls) {
          const [p0, p1, p2, p3] = wall.corners2D;
          const lum = Math.round(135 + clamp(wall.shade, 0, 1) * 90);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = `rgb(${Math.round(lum * 0.88)}, ${Math.round(lum * 0.92)}, ${lum})`;
          ctx.fill();
          ctx.strokeStyle = "rgba(51, 65, 85, 0.28)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 4. Top polygon surface fill
      ctx.save();
      ctx.beginPath();
      targetScene.ccwTop.forEach((p, idx) =>
        idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
      );
      ctx.closePath();
      const surfGrad = ctx.createLinearGradient(0, 0, w, h);
      surfGrad.addColorStop(0, "rgba(239, 246, 255, 0.96)");
      surfGrad.addColorStop(1, "rgba(219, 234, 254, 0.92)");
      ctx.fillStyle = surfGrad;
      ctx.fill();

      // 5. Clipped reference image projected across every earcut triangle
      if (
        loadedImage &&
        (options.allowTaintedImage || !loadedImage.tainted) &&
        imageOpacity > 0
      ) {
        const { img } = loadedImage;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        if (imgW > 0 && imgH > 0) {
          const rad = (imageRotationDeg * Math.PI) / 180;
          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);
          const spanX = metrics.bounds.spanX || 1;
          const spanY = metrics.bounds.spanY || 1;
          const pxPerM = Math.min(imgW / spanX, imgH / spanY);

          const uvForVertex = (vx: number, vy: number) => {
            const rx = vx * cosR + vy * sinR;
            const ry = -vx * sinR + vy * cosR;
            if (imageFit === "stretch") {
              return {
                u: (rx / spanX + 0.5) * imgW,
                v: (-ry / spanY + 0.5) * imgH,
              };
            }
            return {
              u: imgW / 2 + rx * pxPerM,
              v: imgH / 2 - ry * pxPerM,
            };
          };

          const uvCoords = metrics.orderedVertices.map((v) =>
            uvForVertex(v.x, v.y),
          );

          ctx.save();
          ctx.beginPath();
          targetScene.ccwTop.forEach((p, idx) =>
            idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
          );
          ctx.closePath();
          ctx.clip();
          ctx.globalAlpha = clamp(imageOpacity / 100, 0, 1);

          for (const [i0, i1, i2] of metrics.triangles) {
            const p0 = targetScene.orderedTop[i0];
            const p1 = targetScene.orderedTop[i1];
            const p2 = targetScene.orderedTop[i2];
            const uv0 = uvCoords[i0];
            const uv1 = uvCoords[i1];
            const uv2 = uvCoords[i2];
            if (!p0 || !p1 || !p2 || !uv0 || !uv1 || !uv2) continue;

            const du1 = uv1.u - uv0.u;
            const dv1 = uv1.v - uv0.v;
            const du2 = uv2.u - uv0.u;
            const dv2 = uv2.v - uv0.v;
            const det = du1 * dv2 - du2 * dv1;
            if (Math.abs(det) < 1e-8) continue;

            const dx1 = p1.x - p0.x;
            const dy1 = p1.y - p0.y;
            const dx2 = p2.x - p0.x;
            const dy2 = p2.y - p0.y;

            const a = (dx1 * dv2 - dx2 * dv1) / det;
            const b = (dy1 * dv2 - dy2 * dv1) / det;
            const c = (dx2 * du1 - dx1 * du2) / det;
            const d = (dy2 * du1 - dy1 * du2) / det;
            const e = p0.x - a * uv0.u - c * uv0.v;
            const f = p0.y - b * uv0.u - d * uv0.v;

            // Expand triangle ~0.6px from centroid to avoid hairline seams
            const cx = (p0.x + p1.x + p2.x) / 3;
            const cy = (p0.y + p1.y + p2.y) / 3;
            const expand = (pt: ProjectedPoint) => {
              const vx = pt.x - cx;
              const vy = pt.y - cy;
              const len = Math.hypot(vx, vy) || 1;
              return { x: pt.x + (vx / len) * 0.6, y: pt.y + (vy / len) * 0.6 };
            };
            const ep0 = expand(p0);
            const ep1 = expand(p1);
            const ep2 = expand(p2);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(ep0.x, ep0.y);
            ctx.lineTo(ep1.x, ep1.y);
            ctx.lineTo(ep2.x, ep2.y);
            ctx.closePath();
            ctx.clip();
            ctx.transform(a, b, c, d, e, f);
            ctx.drawImage(img, 0, 0);
            ctx.restore();
          }

          ctx.restore();
        }
      }
      ctx.restore();

      // 6. Optional visual boundary fence (clearly reference-only)
      if (fenceHeightM > 0 && targetScene.fenceFaces.length > 0) {
        for (const face of targetScene.fenceFaces) {
          const [b0, b1, t1, t0] = face.corners2D;
          ctx.beginPath();
          ctx.moveTo(b0.x, b0.y);
          ctx.lineTo(b1.x, b1.y);
          ctx.lineTo(t1.x, t1.y);
          ctx.lineTo(t0.x, t0.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(37, 99, 235, 0.14)";
          ctx.fill();
          ctx.strokeStyle = "rgba(37, 99, 235, 0.55)";
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }

      // 7. Export-only vector annotations pass (matches SVG overlay 1:1)
      if (options.includeVectorAnnotations) {
        if (layers.diagonals) {
          ctx.save();
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 1.25;
          for (const d of targetScene.diagonals2D) {
            ctx.beginPath();
            ctx.moveTo(d.a.x, d.a.y);
            ctx.lineTo(d.b.x, d.b.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Crisp royal-blue boundary outline
        ctx.beginPath();
        targetScene.orderedTop.forEach((p, idx) =>
          idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Centroid cross-hair
        const c = targetScene.centroid2D;
        ctx.strokeStyle = "#d81b45";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.x - 6, c.y);
        ctx.lineTo(c.x + 6, c.y);
        ctx.moveTo(c.x, c.y - 6);
        ctx.lineTo(c.x, c.y + 6);
        ctx.stroke();

        // Edge lengths
        if (layers.lengths) {
          ctx.font = "600 11px Poppins, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const edge of targetScene.edges2D) {
            if (targetScene.edges2D.length > 14 && edge.screenLen < 42) continue;
            const label = `${num(edge.sideM, 2)} m · ${num(metresToFeet(edge.sideM), 1)} ft`;
            const tw = ctx.measureText(label).width + 12;
            drawRoundedRect(
              ctx,
              edge.labelPos.x - tw / 2,
              edge.labelPos.y - 10,
              tw,
              20,
              5,
            );
            ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
            ctx.fill();
            ctx.strokeStyle = "#cbd5e1";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "#1e293b";
            ctx.fillText(label, edge.labelPos.x, edge.labelPos.y);
          }
        }

        // Survey pillars & interior angles
        for (const pillar of targetScene.pillars2D) {
          if (layers.pillars) {
            ctx.strokeStyle = "#1e40af";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pillar.base.x, pillar.base.y);
            ctx.lineTo(pillar.top.x, pillar.top.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pillar.top.x, pillar.top.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = "#1d4ed8";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = "600 11px Poppins, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(pillar.label, pillar.top.x, pillar.top.y + 0.5);
          }
          if (layers.angles && targetScene.pillars2D.length <= 16) {
            ctx.font = "600 10px Poppins, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#172554";
            ctx.fillText(
              `${num(pillar.angleDeg, 1)}°`,
              pillar.anglePos.x,
              pillar.anglePos.y,
            );
          }
        }
      }
    },
    [
      layers,
      metrics,
      loadedImage,
      imageOpacity,
      imageRotationDeg,
      imageFit,
      fenceHeightM,
      num,
    ],
  );

  // Redraw Canvas2D synchronously before paint so slab and SVG stay locked in the exact same frame
  useIsomorphicLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    canvas.width = Math.round(stageSize.width * dpr);
    canvas.height = Math.round(stageSize.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCanvas(ctx, viewport, camera, scene, {
      includeVectorAnnotations: false,
      allowTaintedImage: true,
    });
  }, [stageSize, viewport, camera, scene, paintCanvas]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startYaw: camera.yawDeg,
      startPitch: camera.pitchDeg,
      pointerType: event.pointerType,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    setCamera((prev) => ({
      ...prev,
      mode: prev.mode === "plan" ? "isometric" : prev.mode,
      yawDeg: drag.startYaw + dx * 0.45,
      pitchDeg:
        drag.pointerType === "touch"
          ? prev.pitchDeg
          : clamp(drag.startPitch + dy * 0.35, 14, 89),
    }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCamera((c) => ({
        ...c,
        mode: c.mode === "plan" ? "isometric" : c.mode,
        yawDeg: c.yawDeg - 6,
      }));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setCamera((c) => ({
        ...c,
        mode: c.mode === "plan" ? "isometric" : c.mode,
        yawDeg: c.yawDeg + 6,
      }));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCamera((c) => ({
        ...c,
        mode: c.mode === "plan" ? "isometric" : c.mode,
        pitchDeg: clamp(c.pitchDeg + 5, 14, 89),
      }));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCamera((c) => ({
        ...c,
        mode: c.mode === "plan" ? "isometric" : c.mode,
        pitchDeg: clamp(c.pitchDeg - 5, 14, 89),
      }));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setCamera((c) => ({ ...c, zoom: clamp(c.zoom * 1.15, 0.55, 2.6) }));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setCamera((c) => ({ ...c, zoom: clamp(c.zoom / 1.15, 0.55, 2.6) }));
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      setCamera({ ...DEFAULT_CAMERA });
    }
  };

  const onFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError(
        ne ? "कृपया फोटो फाइल छान्नुहोस्।" : "Please choose an image file.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedDataUrl(reader.result);
        setImageError(null);
      }
    };
    reader.onerror = () => {
      setImageError(
        ne ? "फोटो पढ्न सकिएन।" : "Could not read the selected image.",
      );
    };
    reader.readAsDataURL(file);
  };

  const downloadPng = () => {
    const exportW = Math.max(stageSize.width, 960);
    const exportH = Math.max(stageSize.height, 560);
    const headerH = 54;
    const totalH = exportH + headerH;
    const dpr = 2;

    const out = document.createElement("canvas");
    out.width = exportW * dpr;
    out.height = totalH * dpr;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    const exportViewport: Viewport3D = {
      width: exportW,
      height: exportH,
      radiusM: metrics.bounds.radius,
      padding: 68,
    };
    const exportScene = computeScene(exportViewport, camera);
    const exportBar = scaleBarLengthM(camera, exportViewport, 100);

    // Draw 3D stage below header banner
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, headerH * dpr);
    paintCanvas(ctx, exportViewport, camera, exportScene, {
      includeVectorAnnotations: true,
      allowTaintedImage: false,
    });

    // Draw calibrated scale bar on export canvas
    const sbX = 18;
    const sbY = exportH - 22;
    drawRoundedRect(ctx, sbX - 8, sbY - 22, exportBar.pixels + 28, 30, 6);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY);
    ctx.lineTo(sbX + exportBar.pixels, sbY);
    ctx.moveTo(sbX, sbY - 5);
    ctx.lineTo(sbX, sbY + 2);
    ctx.moveTo(sbX + exportBar.pixels, sbY - 5);
    ctx.lineTo(sbX + exportBar.pixels, sbY + 2);
    ctx.stroke();
    ctx.font = "600 11px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `${num(exportBar.metres, 2)} m · ${num(exportBar.feet, 1)} ft`,
      sbX,
      sbY - 5,
    );

    // Draw compass rose on export canvas
    const cx = exportW - 42;
    const cy = 42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.rotate((camera.yawDeg * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(5, 4);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fillStyle = "#d81b45";
    ctx.fill();
    ctx.font = "700 9px Poppins, system-ui, sans-serif";
    ctx.fillStyle = "#172554";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("N", 0, -14);
    ctx.restore();
    ctx.restore();

    // Draw primary top Land Size Boundary Bar
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#172554";
    ctx.fillRect(0, 0, exportW, headerH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 13px Poppins, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const metricSummary = `${num(metricBreakdown.sqm, 2)} m² · ${num(metricBreakdown.hectare, 4)} ha · ${num(metricBreakdown.sqft, 2)} ft²`;
    const ropaniSummary = ropaniParts
      .map((v, i) => `${num(v, 2)} ${landLabel(NEPALI_AREA_SYSTEMS.ropani[i]!, locale)}`)
      .join(" · ");
    ctx.fillText(`HamroKotha · ${ropaniSummary}`, 18, headerH / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#bfdbfe";
    ctx.fillText(metricSummary, exportW - 18, headerH / 2);
    ctx.restore();

    try {
      const url = out.toDataURL("image/png");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "land-boundary-3d.png";
      anchor.click();
    } catch {
      /* Fallback if browser blocks canvas serialization unexpectedly. */
    }
  };

  const metricBreakdown = useMemo(
    () => metricAreaBreakdown(geometry.areaSqm),
    [geometry.areaSqm],
  );
  const ropaniParts = useMemo(
    () => nepaliAreaParts(geometry.areaSqm, "ropani", 4),
    [geometry.areaSqm],
  );
  const bighaParts = useMemo(
    () => nepaliAreaParts(geometry.areaSqm, "bigha", 4),
    [geometry.areaSqm],
  );

  const toggleLayer = (key: keyof LayerVisibility) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-ink-200 bg-white shadow-soft",
        className,
      )}
    >
      {/* 1. Primary Land Size Boundary Bar */}
      <div className="border-b border-royal-900/20 bg-royal-950 px-4 py-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-royal-200">
                {title ||
                  (isProportional
                    ? text("Proportional Land Size", "आनुपातिक जग्गाको आकार")
                    : text("Primary Land Size", "जग्गाको मुख्य क्षेत्रफल"))}
              </span>
              <span className="rounded-full bg-royal-800 px-2 py-0.5 text-[10px] font-medium text-royal-100">
                {isProportional
                  ? text("Proportional", "आनुपातिक")
                  : geometry.geographic
                    ? text("WGS84 Survey", "WGS84 नापी")
                    : text("Local Survey", "स्थानीय नापी")}
              </span>
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-royal-200">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tabular-nums text-white sm:text-sm">
            <span>{num(metricBreakdown.sqm, 2)} m²</span>
            <span aria-hidden className="text-royal-400">
              ·
            </span>
            <span>{num(metricBreakdown.hectare, 4)} ha</span>
            <span aria-hidden className="text-royal-400">
              ·
            </span>
            <span>{num(metricBreakdown.sqft, 2)} ft²</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-royal-800/80 pt-2 text-xs text-royal-100 tabular-nums">
          <span>
            <strong className="font-semibold text-white">
              {text("Ropani:", "रोपनी:")}
            </strong>{" "}
            {ropaniParts
              .map(
                (v, i) =>
                  `${num(v, 3)} ${landLabel(NEPALI_AREA_SYSTEMS.ropani[i]!, locale)}`,
              )
              .join(" · ")}
          </span>
          <span>
            <strong className="font-semibold text-white">
              {text("Bigha:", "बिघा:")}
            </strong>{" "}
            {bighaParts
              .map(
                (v, i) =>
                  `${num(v, 3)} ${landLabel(NEPALI_AREA_SYSTEMS.bigha[i]!, locale)}`,
              )
              .join(" · ")}
          </span>
        </div>
      </div>

      {/* 2. Camera & Layer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2">
        <div
          role="group"
          aria-label={text("Camera projection mode", "क्यामेरा दृश्य")}
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-white p-0.5"
        >
          {(
            [
              ["isometric", text("3D Isometric", "3D आइसोमेट्रिक")],
              ["perspective", text("3D Perspective", "3D परिप्रेक्ष्य")],
              ["plan", text("2D Plan", "2D नक्सा")],
            ] as const
          ).map(([mode, label]) => {
            const active = camera.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setCamera(defaultCameraForMode(mode))}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-royal-700 text-white"
                    : "text-ink-700 hover:bg-royal-50 hover:text-royal-800",
                )}
              >
                <Box aria-hidden className="size-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={text("Zoom out", "जुम घटाउनुहोस्")}
            onClick={() =>
              setCamera((c) => ({
                ...c,
                zoom: clamp(c.zoom / 1.18, 0.55, 2.6),
              }))
            }
          >
            <Minus aria-hidden className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={text("Zoom in", "जुम बढाउनुहोस्")}
            onClick={() =>
              setCamera((c) => ({
                ...c,
                zoom: clamp(c.zoom * 1.18, 0.55, 2.6),
              }))
            }
          >
            <Plus aria-hidden className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCamera({ ...DEFAULT_CAMERA })}
          >
            <RotateCcw aria-hidden className="size-3.5" />
            <span>{text("Reset", "रिसेट")}</span>
          </Button>
          <Button
            type="button"
            variant="royal"
            size="sm"
            onClick={downloadPng}
          >
            <Download aria-hidden className="size-3.5" />
            <span>{text("Download PNG", "PNG डाउनलोड")}</span>
          </Button>
        </div>
      </div>

      {/* Layer Toggles Strip */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-100 bg-white px-3 py-2">
        <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink-500">
          <Layers aria-hidden className="size-3.5" />
          {text("Layers:", "तहहरू:")}
        </span>
        {(
          [
            ["grid", text("Grid", "ग्रिड"), Grid3X3],
            ["lengths", text("Lengths", "लम्बाइ"), Ruler],
            ["angles", text("Angles", "कोण"), Compass],
            ["diagonals", text("Diagonals", "विकर्ण"), Eye],
            ["pillars", text("Pillars", "खम्बा"), Box],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={layers[key]}
            onClick={() => toggleLayer(key)}
            className={cn(
              "inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
              layers[key]
                ? "border-royal-200 bg-royal-50 text-royal-800"
                : "border-ink-200 bg-white text-ink-500 hover:bg-ink-50",
            )}
          >
            <Icon aria-hidden className="size-3" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 3. High-DPI Canvas2D + Synchronized Vector SVG Overlay */}
      <div
        ref={stageRef}
        tabIndex={0}
        role="img"
        aria-label={
          ariaLabel ||
          text(
            "Interactive 3D boundary viewer. Use arrow keys to orbit, plus or minus to zoom, and R to reset.",
            "अन्तर्क्रियात्मक 3D सीमाना दृश्य। घुमाउन एरो कि, जुम गर्न +/- र रिसेट गर्न R थिच्नुहोस्।",
          )
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{ touchAction: "pan-y" }}
        className={cn(
          "relative w-full select-none overflow-hidden bg-ink-50 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-royal-600 cursor-grab active:cursor-grabbing",
          compact ? "h-[280px] sm:h-[320px]" : "h-[360px] sm:h-[460px]",
        )}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none block size-full"
        />

        {/* Synchronized Vector SVG Overlay */}
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${stageSize.width} ${stageSize.height}`}
          style={{ transition: "none" }}
          className="pointer-events-none absolute inset-0 size-full transition-none [&_*]:transition-none!"
        >
          {/* Dashed diagonals */}
          {layers.diagonals &&
            scene.diagonals2D.map((d) => (
              <line
                key={`${d.from}-${d.to}`}
                x1={d.a.x}
                y1={d.a.y}
                x2={d.b.x}
                y2={d.b.y}
                stroke="#3b82f6"
                strokeWidth={1.3}
                strokeDasharray="6 4"
                style={{ transition: "none" }}
              />
            ))}

          {/* Crisp royal-blue boundary polygon */}
          <polygon
            points={scene.orderedTop.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth={2.4}
            strokeLinejoin="round"
            style={{ transition: "none" }}
          />

          {/* Area centroid cross-hair */}
          <g stroke="#d81b45" strokeWidth={1.6} style={{ transition: "none" }}>
            <line
              x1={scene.centroid2D.x - 6}
              y1={scene.centroid2D.y}
              x2={scene.centroid2D.x + 6}
              y2={scene.centroid2D.y}
              style={{ transition: "none" }}
            />
            <line
              x1={scene.centroid2D.x}
              y1={scene.centroid2D.y - 6}
              x2={scene.centroid2D.x}
              y2={scene.centroid2D.y + 6}
              style={{ transition: "none" }}
            />
            <circle
              cx={scene.centroid2D.x}
              cy={scene.centroid2D.y}
              r={3}
              fill="none"
              style={{ transition: "none" }}
            />
          </g>

          {/* Dual-unit edge lengths (m · ft) */}
          {layers.lengths &&
            scene.edges2D.map((edge) => {
              if (scene.edges2D.length > 14 && edge.screenLen < 42) return null;
              const label = `${num(edge.sideM, 2)} m · ${num(metresToFeet(edge.sideM), 1)} ft`;
              const boxW = Math.max(76, label.length * 6.2 + 12);
              return (
                <g key={`edge-${edge.index}`} style={{ transition: "none" }}>
                  <rect
                    x={edge.labelPos.x - boxW / 2}
                    y={edge.labelPos.y - 10}
                    width={boxW}
                    height={20}
                    rx={5}
                    fill="rgba(255,255,255,0.92)"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    style={{ transition: "none" }}
                  />
                  <text
                    x={edge.labelPos.x}
                    y={edge.labelPos.y + 3.5}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={600}
                    fill="#1e293b"
                    style={{ transition: "none" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

          {/* Corner pillars & interior angles */}
          {scene.pillars2D.map((pillar) => (
            <g key={`pillar-${pillar.index}`} style={{ transition: "none" }}>
              {layers.pillars && (
                <>
                  <line
                    x1={pillar.base.x}
                    y1={pillar.base.y}
                    x2={pillar.top.x}
                    y2={pillar.top.y}
                    stroke="#1e40af"
                    strokeWidth={1.6}
                    style={{ transition: "none" }}
                  />
                  <circle
                    cx={pillar.top.x}
                    cy={pillar.top.y}
                    r={10}
                    fill="#1d4ed8"
                    stroke="#ffffff"
                    strokeWidth={2}
                    style={{ transition: "none" }}
                  />
                  <text
                    x={pillar.top.x}
                    y={pillar.top.y + 3.5}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={600}
                    fill="#ffffff"
                    style={{ transition: "none" }}
                  >
                    {pillar.label}
                  </text>
                </>
              )}
              {layers.angles && scene.pillars2D.length <= 16 && (
                <text
                  x={pillar.anglePos.x}
                  y={pillar.anglePos.y + 3}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="#172554"
                  style={{ transition: "none" }}
                >
                  {num(pillar.angleDeg, 1)}°
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* North / Compass Rose HUD */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 flex flex-col items-center gap-1 rounded-xl border border-ink-200 bg-white/90 px-2.5 py-2 shadow-sm backdrop-blur-xs"
        >
          <svg
            width={34}
            height={34}
            viewBox="-20 -20 40 40"
            className="overflow-visible"
          >
            <circle r={17} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.2} />
            <g transform={`rotate(${camera.yawDeg})`}>
              <polygon points="0,-13 4.5,3 0,0 -4.5,3" fill="#d81b45" />
              <polygon points="0,13 4.5,3 0,0 -4.5,3" fill="#94a3b8" />
              <text
                x={0}
                y={-14}
                textAnchor="middle"
                fontSize={8}
                fontWeight={700}
                fill="#172554"
              >
                N
              </text>
            </g>
          </svg>
          <span className="text-[10px] font-semibold text-ink-700">
            {geometry.geographic
              ? text("True North", "साँचो उत्तर")
              : text("Plan North (+Y)", "उत्तर (+Y)")}
          </span>
        </div>

        {/* Calibrated Live Scale Bar HUD */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-ink-200 bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur-xs"
        >
          <div className="text-[11px] font-semibold text-ink-900 tabular-nums">
            {num(scaleBar.metres, 2)} m · {num(scaleBar.feet, 1)} ft
          </div>
          <div
            className="mt-1 h-1.5 border-x-2 border-b-2 border-ink-900"
            style={{ width: `${Math.max(24, Math.round(scaleBar.pixels))}px` }}
          />
        </div>

        {!compact && (
          <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-md bg-white/85 px-2 py-1 text-[10px] font-medium text-ink-600 shadow-xs sm:block">
            {text(
              "Drag to orbit · Arrows / +/- / R",
              "घुमाउन तान्नुहोस् · एरो / +/- / R",
            )}
          </div>
        )}
      </div>

      {/* 4. Visual Fence Reference & Optional Clipped Cadastral/Land Photo Overlay */}
      <div className="space-y-3 border-t border-ink-200 bg-white p-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="flex items-center justify-between gap-2 font-medium text-ink-800">
              <span>
                {text(
                  "Boundary fence height (visual reference only)",
                  "सीमाना बार उचाइ (दृश्य सन्दर्भ मात्र)",
                )}
              </span>
              <span className="font-semibold text-royal-700 tabular-nums">
                {fenceHeightM.toFixed(2)} m ({(fenceHeightM / 0.3048).toFixed(1)}{" "}
                ft)
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.25}
              value={fenceHeightM}
              onChange={(event) => setFenceHeightM(Number(event.target.value))}
              className="range w-full"
            />
          </label>

          {allowImageUpload && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileSelect}
                className="sr-only"
                aria-label={text(
                  "Upload reference land photo or cadastral naksa (browser only)",
                  "जग्गाको फोटो वा नक्सा राख्नुहोस् (ब्राउजरमा मात्र)",
                )}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus aria-hidden className="size-3.5" />
                <span>
                  {activeImageUrl
                    ? text("Change overlay image", "फोटो/नक्सा बदल्नुहोस्")
                    : text("Overlay land photo / naksa", "फोटो / नक्सा राख्नुहोस्")}
                </span>
              </Button>
            </div>
          )}
        </div>

        {(activeImageUrl || allowImageUpload) && !activeImageUrl && (
          <p className="text-[11px] text-ink-500">
            {text(
              "Optional reference image projects inside the clipped parcel boundary in your browser only (zero server upload).",
              "इच्छाधीन फोटो वा कित्ता नक्सा तपाईंको ब्राउजरभित्रै जग्गाको सीमानाभित्र मात्र देखिन्छ (सर्भरमा अपलोड हुँदैन)।",
            )}
          </p>
        )}

        {activeImageUrl && (
          <div className="space-y-2.5 rounded-lg border border-ink-200 bg-ink-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink-800">
                {text(
                  "Clipped Boundary Image Overlay",
                  "सीमानाभित्रको फोटो / नक्सा तह",
                )}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["cover", "stretch"] as const).map((fitMode) => (
                  <button
                    key={fitMode}
                    type="button"
                    aria-pressed={imageFit === fitMode}
                    onClick={() => setImageFit(fitMode)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[11px] font-medium",
                      imageFit === fitMode
                        ? "border-royal-700 bg-royal-700 text-white"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-royal-50",
                    )}
                  >
                    {fitMode === "cover"
                      ? text("Cover", "कभर")
                      : text("Stretch", "तन्काउने")}
                  </button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUploadedDataUrl(null);
                    setDismissedInitial(true);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <Trash2 aria-hidden className="size-3.5 text-clay-700" />
                  <span>{text("Remove", "हटाउनुहोस्")}</span>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-[11px] text-ink-700">
                  <span>{text("Opacity", "पारदर्शिता")}</span>
                  <span className="font-semibold tabular-nums">
                    {imageOpacity}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={imageOpacity}
                  onChange={(e) => setImageOpacity(Number(e.target.value))}
                  className="range w-full"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="flex justify-between text-[11px] text-ink-700">
                  <span>{text("Rotation", "घुमाइ")}</span>
                  <span className="font-semibold tabular-nums">
                    {imageRotationDeg}°
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={imageRotationDeg}
                  onChange={(e) => setImageRotationDeg(Number(e.target.value))}
                  className="range w-full"
                />
              </label>
            </div>

            {loadedImage?.tainted && (
              <p className="text-[11px] text-ink-600">
                {text(
                  "External photo is displayed inside the boundary on screen; PNG downloads omit external images blocked by host CORS policy.",
                  "बाहिरी फोटो स्क्रिनमा देखिएको छ; होस्ट CORS नीतिका कारण PNG डाउनलोडमा बाहिरी फोटो समावेश हुँदैन।",
                )}
              </p>
            )}
          </div>
        )}

        {imageError && (
          <p role="alert" className="text-xs font-medium text-crimson-700">
            {imageError}
          </p>
        )}
      </div>
    </div>
  );
}
