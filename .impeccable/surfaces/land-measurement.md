# Land measurement

Mode: Operate. Extend `/land-size` within the existing Poppins, royal blue, crimson and white interface. Retain the unit converter. No new visual world or global design-system changes.

## Direction contract

THESIS: Make a measured parcel inspectable, with measurements, a scaled boundary and the resulting area together.

OWN-WORLD: Existing Field, Input, Select and Button components; white working surface, royal selection and diagram, crimson calculation action. This calculator uses crimson-700 on the action's hover state to keep white 14px text above 4.5:1. Measurements use tabular numerals.

STORY: Choose rectangle, four sides plus diagonal, or ordered corners; enter measured values; calculate; inspect area, perimeter, corners and geographic location when GPS coordinates are supplied. Errors remove stale results and explain recovery.

FIRST VIEWPORT: Page title and purpose followed by method selection, units and measurements on the left and a labelled boundary preview/results on the right. Mobile stacks these in reading order. The existing unit converter remains below.

FORM: Extend the existing calculator surface; code-led. The signature interaction draws the computed boundary with corner labels and the AC diagonal. No generated art. seed: none (unavailable).

FINISH: The independent `finish-review.md` returns SHIP for this bounded feature after confirming both corrections, rerunning 36 geometry tests and inspecting all nine refreshed production captures. `PRODUCT.md`, feature documentation and the documentation audit record the result. Preserve the incumbent `DESIGN.md` and token sidecar; no new shipping raster artwork or provenance work applies.

Constraints: local measurements do not imply geographic position. GPS uses WGS84 shortest-geodesic area/perimeter, supports parcels within 10 km of A and latitudes −85 to 85 degrees; its preview is projected. Local coordinates use one Cartesian system in metres or feet. All inputs represent horizontal measurements; supported local coordinates are within ±1 billion input units and lengths/span within 1e-6 to 1e7 metres. Complete English or Nepali decimal/scientific input syntax is required; Nepali digits and Unicode minus normalize before validation. No persistence or production data changes. Numeric results are rounded only for display; accuracy depends on measured inputs and does not establish surveyed ownership boundaries.

Downloads are raw measurement JSON: ordered `{x, y}` metre coordinates or `{lat, lon}` decimal-degree coordinates, explicit local/WGS84 reference, Cartesian/geodesic edge model, metre/square-metre measurement units and full numeric results. GPS exports omit projected preview geometry and centroid. No GIS polygon line interpretation is asserted. This is a scoped extension; the global DESIGN.md and token sidecar stay unchanged.

## Nepali systems follow-up

The user requested Nepali-system support. Add complete Ropani–Aana–Paisa–Daam and Bigha–Kattha–Dhur results to the measurement panel and shared converter. The converter accepts single units (including paisa/daam) or combined entries. Keep the incumbent two-column form/results and stacked phone layout, native shared controls, descriptive labels and visible recovery. Retain fractions in daam/dhur and normalize carrying before display. Preserve current area when switching input systems. Both tools derive factors from DUDBC's square-foot relationships: 5,476 ft²/ropani and 72,900 ft²/bigha, using 0.09290304 m²/ft². Named Nepali parts and conventions also appear in JSON downloads. The shared area converter/decomposer caps area at 10¹⁵ m², covering the geometry span without overflowing numeric displays. No global design, listing-data or historical backend conversion migration is authorized. Follow-up evidence is `.impeccable/review/land-nepali-system/`.
