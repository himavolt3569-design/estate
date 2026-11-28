# Land measurement & land size tools

HamroKotha separates exact boundary surveying (`/land-measurement`) from unit conversion (`/land-size`) so buyers, sellers, and agents can work with either workflow independently while sharing one verified mathematical core. All calculations run strictly in the browser; they do not call a remote geometry service, require sign-in, or modify listing data.

## Separated routes & navigation

- **`/land-measurement`**: Interactive 3D boundary calculator (`LandCalculator` + `LandPlot3D`). Supports rectangle dimensions, four sides + diagonal, local Cartesian corners, and WGS84 GPS corners, plus dual Nepali/metric area output, edge lengths in both `m` and `ft`, interior angles, calibrated scale bar, optional browser-only image overlay, and PNG/JSON exports.
- **`/land-size`**: Dual-unit land area converter (`AreaConverter` + `DualUnitAreaPanel` + proportional `LandPlot3D`). Supports single-unit inputs (Ropani, Aana, Paisa, Daam, Bigha, Kattha, Dhur, Hectare, Square feet, Square metres) and compound Ropani–Aana–Paisa–Daam or Bigha–Kattha–Dhur entry, optional `?sqm=` prefill from measurement or listing pages, and proportional 3D plot previews (`1:1`, `4:3`, `3:2`, `2:1`). Legacy `/land-size#measure-land` links automatically redirect to `/land-measurement`.
- **Tools menu (`HeaderTools`)**: Provides three separate links in both desktop and mobile navigation: **Land measurement** (`/land-measurement`), **Land size** (`/land-size`), and **EMI calculator** (`/emi`).
- **Land listings (`land-fields.tsx`, `listing/[id]/page.tsx`, `listing-card.tsx`)**: Listing forms offer separate new-tab links to `/land-measurement` and `/land-size`. Land detail pages separate **Land Size** (`DualUnitAreaPanel` + `/land-size?sqm=` link) from **Land Measurements & Boundaries** (frontage and road width in both `m` and `ft`, facing, road access, land use, compact proportional `LandPlot3D` with optional listing photo overlay, and `/land-measurement` link). Land cards display compact dual-unit summaries (`landAreaDual`).

## Inputs and results

- **Rectangle:** length AB and width BC, in metres or feet. AC is calculated with `hypot(length, width)`. Optional supplied AC must agree within `max(1e-9 m, expected × 1e-10)`; rounded survey diagonals can be omitted. The generated local boundary is A(0,0), B(length,0), C(length,width), D(0,width).
- **Four sides + diagonal:** AB, BC, CD, DA and AC for a convex quadrilateral. Stable Heron products construct two triangles on opposite sides of AC. Strict triangle inequalities and convexity checks reject impossible/ambiguous configurations. Reflection and geographic orientation are not inferred. Concave land uses ordered corners.
- **All corners / Local:** 3–50 X/Y pairs in consecutive boundary order, clockwise or counterclockwise, using one Cartesian coordinate system and one unit. Supports concave polygons (including L-shaped parcels). The final edge closes automatically; the first corner must not be repeated.
- **All corners / GPS:** 3–50 latitude/longitude pairs in decimal degrees on WGS84. Every corner must be within 10 km of A, with latitude between −85° and 85° and longitude between −180° and 180°. Antimeridian parcels within that range work. Boundary edges use shortest geodesics.

Results separate **Calculated Land Size** from **Boundary Measurements**:
- **Nepali Units:** Complete Ropani–Aana–Paisa–Daam and Bigha–Kattha–Dhur breakdowns plus decimal Aana and Kattha totals. Both tools use shared `NEPALI_AREA_IN_SQM` factors derived from the square-foot relationships in the [DUDBC Construction Handbook conversion table](https://www.giwmscdnone.gov.np/media/app/public/54/posts/1711001516_6.pdf): `1 ropani = 5,476 ft²`, `1 bigha = 72,900 ft²`, `1 ft² = 0.09290304 m²`, and `1 hectare = 10,000 m²`.
- **Metric & Standard Units:** Square metres (`m²`), Hectares (`ha`), Square feet (`ft²`), and equivalent square dimensions (`side × side` in both `m` and `ft`).
- **Boundary Measurements:** Perimeter, bounding box (`spanX × spanY`), diagonals, area centroid, and per-corner table showing coordinates, interior angles (`°`), and outgoing edge lengths in both `m` and `ft`.

## 3D projection invariants & primary size/image framing

`src/lib/land-3d.ts` and `LandPlot3D` (`src/components/hamrokotha/land-plot-3d.tsx`) enforce:
- **1:1:1 isotropic centering:** Vertices are centered around the parcel bounding-box center `(centerX, centerY)` with uniform axis scaling so proportions never distort.
- **Right-handed ground frame:** Ground `+X` is East/right, `+Y` is North/up, and `+Z` is vertical elevation. In `2D Plan` (`yaw = 0°`, `pitch = 90°`), screen X increases eastward and screen Y decreases northward.
- **Orthographic vs. Perspective projection:** `3D Isometric` and `2D Plan` use strict orthographic projection (zero perspective divide) so parallel edges stay strictly parallel and equal-length segments render at identical scale. `3D Perspective` uses pinhole projection scaled cleanly from `radiusM / sin(fov / 2)` so parcels frame cleanly without clipping.
- **Exact polygon triangulation & interior angles:** `earcutSimplePolygon` triangulates arbitrary simple 3–50 vertex convex or concave polygons while conserving area (`< 1e-9` error). `computeInteriorAngles` calculates exact angles (`0–360°`, including reflex angles `> 180°` on concave vertices) summing to `(n - 2) × 180°`.
- **Lambertian terrain extrusion & visual fence reference:** `buildExtrudedWalls` renders depth-sorted terrain side walls shaded from outward unit normals. An optional `0–3 m` boundary fence slider provides visual-only architectural height context.
- **Clipped browser-only image overlay:** Uploaded images (`FileReader`) or external listing photos (`crossOrigin="anonymous"` with tainted-canvas fallback for PNG export) are projected across every earcut triangle using per-triangle affine transforms (`0.6 px` centroid expansion to prevent hairline seams) wrapped inside an exact polygon `ctx.clip()` path.
- **High-DPI Canvas2D + synchronized vector SVG + exports:** Screen rendering combines a DPR-scaled Canvas2D base with a synchronized SVG vector overlay, live calibrated scale bar (`scaleBarLengthM`), and compass rose (`True North` for WGS84). Users can export `land-boundary-3d.png` or raw IEEE-754 `land-measurements.json`.

## Numerical method and supported precision

Feet convert via exact `0.3048 m`. Local polygons use translated, normalized shoelace terms, compensated summation, and the signed-area centroid formula. Coordinates must be finite and within ±1 billion input units; lengths/span must lie between `1e-6` and `1e7 m` (`1e-12` normalized predicate tolerance). English and Nepali (`०–९`) digits are accepted in every numeric field; invalid or extreme inputs reject cleanly and focus an actionable `#measure-land [role=alert]` or `#area-converter-error`. GPS computations use `geographiclib-geodesic@2.2.0` on WGS84.
