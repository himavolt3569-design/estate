"use client";

import { useRef, useState } from "react";
import { Download, MapPin, Plus, Ruler, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/primitives";
import { NEPALI_AREA_IN_SQM as AREA_IN_SQM } from "@/lib/nepali-land";
import { NepaliAreaResults } from "./nepali-area-results";
import { landLabel } from "@/lib/land";
import {
  geographicPolygon,
  landMeasurementReport,
  GeometryError,
  parseMeasurement,
  quadrilateral,
  rectangle,
  surveyPolygon,
  type GeometryErrorCode,
  type LandGeometry,
  type LengthUnit,
} from "@/lib/land-geometry";
import { useSiteLanguage, useSiteText } from "./site-language";

type Method = "rectangle" | "diagonal" | "corners";
type CoordinateSystem = "local" | "gps";
type CornerInput = { id: number; x: string; y: string };
const cornerName = (index: number) =>
  index < 26 ? String.fromCharCode(65 + index) : `P${index + 1}`;
const blankCorners = (): CornerInput[] =>
  Array.from({ length: 4 }, (_, id) => ({ id, x: "", y: "" }));
const messages: Record<GeometryErrorCode, [string, string]> = {
  number: [
    "Enter a complete, finite number in every required field using English or Nepali digits. Local coordinates must be within ±1 billion units.",
    "हरेक आवश्यक ठाउँमा अङ्ग्रेजी वा नेपाली अङ्कमा पूर्ण र सीमित सङ्ख्या राख्नुहोस्। स्थानीय निर्देशाङ्क ±१ अर्ब एकाइभित्र हुनुपर्छ।",
  ],
  length: [
    "Each length must be between 0.000001 and 10,000,000 metres. Check the dimensions and units.",
    "हरेक लम्बाइ ०.०००००१ देखि १,००,००,००० मिटरसम्म हुनुपर्छ। मापन र एकाइ जाँच्नुहोस्।",
  ],
  corners: [
    "Enter 3 to 50 corners in order around the boundary.",
    "सीमानाको क्रमअनुसार ३ देखि ५० वटा कुना राख्नुहोस्।",
  ],
  duplicate: [
    "Two corners have the same position. Remove the duplicate; do not repeat the first corner at the end.",
    "दुई कुनाको स्थान एउटै छ। दोहोरिएको कुना हटाउनुहोस्; पहिलो कुना अन्त्यमा फेरि नराख्नुहोस्।",
  ],
  intersection: [
    "Boundary edges cross, touch or overlap. Enter corners consecutively around the outside of the land.",
    "सीमानाका रेखाहरू काटिएका वा खप्टिएका छन्। जग्गाको बाहिरी सीमानाको क्रमअनुसार कुना राख्नुहोस्।",
  ],
  degenerate: [
    "These measurements form a line or an area too small to resolve reliably. Check the corners.",
    "यो मापनले रेखा वा भरपर्दो गणना गर्न नसकिने सानो क्षेत्र बनाउँछ। कुनाहरू जाँच्नुहोस्।",
  ],
  triangle: [
    "The AC diagonal cannot form two valid triangles with these sides. Check all four sides and AC.",
    "यो AC विकर्णले यी भुजाहरूसँग दुईवटा मान्य त्रिभुज बनाउँदैन। चारै भुजा र AC जाँच्नुहोस्।",
  ],
  convex: [
    "These lengths do not form a convex four-sided plot with AC inside. For an inward corner, use All corners.",
    "यो मापनले AC भित्र पर्ने उत्तल चारकुने जग्गा बनाउँदैन। भित्र पसेको कुनाका लागि सबै कुना प्रयोग गर्नुहोस्।",
  ],
  diagonal: [
    "The diagonal does not match this rectangle. Leave it blank to calculate it, or enter √(length² + width²).",
    "विकर्ण यो आयतसँग मिलेन। गणना गर्न खाली छोड्नुहोस् वा √(लम्बाइ² + चौडाइ²) राख्नुहोस्।",
  ],
  latitude: [
    "Enter WGS84 latitudes between −85° and 85°. Polar parcels are outside this tool’s supported range.",
    "WGS84 अक्षांश −८५° देखि ८५° सम्म राख्नुहोस्। ध्रुवीय जग्गा यो उपकरणको दायराबाहिर छ।",
  ],
  longitude: [
    "Enter longitudes between −180° and 180°.",
    "देशान्तर −१८०° देखि १८०° सम्म राख्नुहोस्।",
  ],
  extent: [
    "Every GPS corner must be within 10 km of corner A. This tool supports individual land parcels.",
    "हरेक GPS कुना A कुनाबाट १० किमिभित्र हुनुपर्छ। यो उपकरण छुट्टाछुट्टै जग्गाका लागि हो।",
  ],
};

export function LandCalculator() {
  const text = useSiteText();
  const { locale } = useSiteLanguage();
  const [method, setMethod] = useState<Method>("rectangle");
  const [unit, setUnit] = useState<LengthUnit>("m");
  const [system, setSystem] = useState<CoordinateSystem>("local");
  const [dimensions, setDimensions] = useState<Record<string, string>>({});
  const [corners, setCorners] = useState<CornerInput[]>(blankCorners);
  const nextCornerId = useRef(4);
  const [result, setResult] = useState<LandGeometry | null>(null);
  const [error, setError] = useState<GeometryErrorCode | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const clearResult = () => {
    setResult(null);
    setError(null);
  };
  const gps = method === "corners" && system === "gps";
  const displayUnit = gps ? "m" : unit;
  const metresPerUnit = displayUnit === "ft" ? 0.3048 : 1;
  const number = (value: number, digits = 6) =>
    new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-NP", {
      numberingSystem: locale === "ne" ? "deva" : "latn",
      ...(value !== 0 && Math.abs(value) < 10 ** -digits
        ? { maximumSignificantDigits: 8 }
        : { maximumFractionDigits: digits }),
    }).format(value);
  const distance = (value: number) =>
    `${number(value / metresPerUnit)} ${displayUnit}`;
  function calculate() {
    try {
      const read = (key: string) => parseMeasurement(dimensions[key] || "");
      const value =
        method === "rectangle"
          ? rectangle(
              read("length"),
              read("width"),
              unit,
              dimensions.diagonal?.trim() ? read("diagonal") : undefined,
            )
          : method === "diagonal"
            ? quadrilateral(
                [read("ab"), read("bc"), read("cd"), read("da")],
                read("ac"),
                unit,
              )
            : gps
              ? geographicPolygon(
                  corners.map((p) => ({
                    lat: parseMeasurement(p.x),
                    lon: parseMeasurement(p.y),
                  })),
                )
              : surveyPolygon(
                  corners.map((p) => ({
                    x: parseMeasurement(p.x),
                    y: parseMeasurement(p.y),
                  })),
                  unit,
                );
      setResult(value);
      setError(null);
    } catch (caught) {
      setResult(null);
      setError(caught instanceof GeometryError ? caught.code : "number");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  function example() {
    clearResult();
    if (method === "rectangle")
      setDimensions({ length: "30", width: "20", diagonal: "" });
    else if (method === "diagonal")
      setDimensions({
        ab: "30",
        bc: "20",
        cd: "30",
        da: "20",
        ac: String(Math.hypot(30, 20)),
      });
    else
      setCorners(
        (gps
          ? [
              ["27.7", "85.3"],
              ["27.7", "85.3003"],
              ["27.7002", "85.3003"],
              ["27.7002", "85.3"],
            ]
          : [
              ["0", "0"],
              ["30", "0"],
              ["30", "20"],
              ["0", "20"],
            ]
        ).map(([x, y]) => ({ id: nextCornerId.current++, x: x!, y: y! })),
      );
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(landMeasurementReport(result), null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "land-measurements.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const dimensionField = (key: string, label: string, optional = false) => (
    <Field
      key={key}
      label={label}
      htmlFor={`parcel-${key}`}
      required={!optional}
    >
      <Input
        id={`parcel-${key}`}
        type="text"
        inputMode="decimal"
        value={dimensions[key] || ""}
        required={!optional}
        onChange={(event) => {
          setDimensions({ ...dimensions, [key]: event.target.value });
          clearResult();
        }}
        autoComplete="off"
      />
    </Field>
  );

  return (
    <section
      aria-labelledby="parcel-title"
      id="measure-land"
      className="mt-8 rounded-xl border border-ink-200 bg-white"
    >
      <div className="border-b border-ink-200 px-5 py-5 sm:px-7">
        <h2 id="parcel-title" className="text-xl font-semibold text-ink-900">
          {text("Measure your land", "आफ्नो जग्गा नाप्नुहोस्")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          {text(
            "Enter horizontal measurements or surveyed corners to calculate the boundary, area and perimeter.",
            "सीमाना, क्षेत्रफल र परिधि निकाल्न समतल मापन वा सर्वेक्षण गरिएका कुनाहरू राख्नुहोस्।",
          )}
        </p>
      </div>
      <div className="grid min-w-0 lg:grid-cols-2">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            calculate();
          }}
          className="min-w-0 space-y-5 p-5 sm:p-7"
        >
          <Field
            label={text("Measurement method", "मापन विधि")}
            htmlFor="parcel-method"
          >
            <Select
              id="parcel-method"
              value={method}
              onChange={(event) => {
                setMethod(event.target.value as Method);
                clearResult();
              }}
            >
              <option value="rectangle">{text("Rectangle", "आयत")}</option>
              <option value="diagonal">
                {text("Four sides + diagonal", "चार भुजा + विकर्ण")}
              </option>
              <option value="corners">{text("All corners", "सबै कुना")}</option>
            </Select>
          </Field>
          {method === "corners" && (
            <Field
              label={text("Coordinate system", "निर्देशाङ्क प्रणाली")}
              htmlFor="parcel-system"
            >
              <Select
                id="parcel-system"
                value={system}
                onChange={(event) => {
                  setSystem(event.target.value as CoordinateSystem);
                  setCorners(blankCorners());
                  clearResult();
                }}
              >
                <option value="local">
                  {text("Local X / Y coordinates", "स्थानीय X / Y निर्देशाङ्क")}
                </option>
                <option value="gps">
                  {text(
                    "GPS latitude / longitude (WGS84)",
                    "GPS अक्षांश / देशान्तर (WGS84)",
                  )}
                </option>
              </Select>
            </Field>
          )}
          {!gps && (
            <Field
              label={text("Length unit", "लम्बाइको एकाइ")}
              htmlFor="parcel-unit"
            >
              <Select
                id="parcel-unit"
                value={unit}
                onChange={(event) => {
                  setUnit(event.target.value as LengthUnit);
                  clearResult();
                }}
              >
                <option value="m">{text("Metres (m)", "मिटर (m)")}</option>
                <option value="ft">{text("Feet (ft)", "फुट (ft)")}</option>
              </Select>
            </Field>
          )}
          {method === "rectangle" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {dimensionField(
                "length",
                `${text("Length AB", "लम्बाइ AB")} (${unit})`,
              )}
              {dimensionField(
                "width",
                `${text("Width BC", "चौडाइ BC")} (${unit})`,
              )}
              <div className="sm:col-span-2">
                {dimensionField(
                  "diagonal",
                  `${text("Diagonal AC (optional check)", "विकर्ण AC (वैकल्पिक जाँच)")} (${unit})`,
                  true,
                )}
                <p className="mt-2 text-xs leading-relaxed text-ink-600">
                  {text(
                    "Leave the diagonal blank to calculate it. A supplied diagonal must agree with the length and width.",
                    "विकर्ण निकाल्न खाली छोड्नुहोस्। राखिएको विकर्ण लम्बाइ र चौडाइसँग मिल्नुपर्छ।",
                  )}
                </p>
              </div>
            </div>
          )}
          {method === "diagonal" && (
            <>
              <p className="text-sm leading-relaxed text-ink-600">
                {text(
                  "Label the corners A → B → C → D around a convex plot. Measure AC across the inside. For concave or more complex land, use All corners.",
                  "उत्तल जग्गाको वरिपरि A → B → C → D नाम दिनुहोस्। भित्रबाट AC नाप्नुहोस्। अवतल वा जटिल जग्गाका लागि सबै कुना प्रयोग गर्नुहोस्।",
                )}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {["ab", "bc", "cd", "da"].map((side) =>
                  dimensionField(
                    side,
                    `${text("Side", "भुजा")} ${side.toUpperCase()} (${unit})`,
                  ),
                )}
                <div className="col-span-2">
                  {dimensionField(
                    "ac",
                    `${text("Diagonal AC", "विकर्ण AC")} (${unit})`,
                  )}
                </div>
              </div>
            </>
          )}
          {method === "corners" && (
            <>
              <p className="text-sm leading-relaxed text-ink-600">
                {text(
                  "Enter every corner in clockwise or counterclockwise boundary order. Do not repeat the first corner; the last edge closes automatically.",
                  "हरेक कुना सीमानाको घडीको दिशा वा उल्टो क्रममा राख्नुहोस्। पहिलो कुना नदोहोर्‍याउनुहोस्; अन्तिम भुजा आफैँ जोडिन्छ।",
                )}
              </p>
              {gps && (
                <p className="text-xs leading-relaxed text-ink-600">
                  {text(
                    "Decimal degrees, latitude first. Supported: within 10 km of A, between 85°S and 85°N. Edges follow shortest WGS84 geodesics.",
                    "दशमलव डिग्रीमा पहिले अक्षांश राख्नुहोस्। दायरा: A बाट १० किमि, ८५° दक्षिणदेखि ८५° उत्तरसम्म। भुजा छोटो WGS84 जियोडेसिकअनुसार जोडिन्छन्।",
                  )}
                </p>
              )}
              <div className="space-y-3">
                {corners.map((corner, i) => (
                  <fieldset
                    key={corner.id}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
                  >
                    <legend className="mb-1 text-sm font-semibold text-ink-800">
                      {text("Corner", "कुना")} {cornerName(i)}
                    </legend>
                    {(["x", "y"] as const).map((axis) => (
                      <Field
                        key={axis}
                        label={
                          gps
                            ? axis === "x"
                              ? text("Latitude (°)", "अक्षांश (°)")
                              : text("Longitude (°)", "देशान्तर (°)")
                            : `${axis.toUpperCase()} (${unit})`
                        }
                        htmlFor={`parcel-${corner.id}-${axis}`}
                        required
                      >
                        <Input
                          id={`parcel-${corner.id}-${axis}`}
                          type="text"
                          inputMode="text"
                          required
                          value={corner[axis]}
                          onChange={(event) => {
                            setCorners(
                              corners.map((p) =>
                                p.id === corner.id
                                  ? { ...p, [axis]: event.target.value }
                                  : p,
                              ),
                            );
                            clearResult();
                          }}
                          autoComplete="off"
                          className="px-2 tabular-nums"
                        />
                      </Field>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 shrink-0"
                      disabled={corners.length <= 3}
                      aria-label={`${text("Remove corner", "कुना हटाउनुहोस्")} ${cornerName(i)}`}
                      onClick={() => {
                        setCorners(corners.filter((p) => p.id !== corner.id));
                        clearResult();
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </fieldset>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={corners.length >= 50}
                onClick={() => {
                  setCorners([
                    ...corners,
                    { id: nextCornerId.current++, x: "", y: "" },
                  ]);
                  clearResult();
                }}
              >
                <Plus aria-hidden />
                {text("Add corner", "कुना थप्नुहोस्")}
              </Button>
            </>
          )}
          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-lg bg-crimson-50 p-3 text-sm leading-relaxed text-crimson-700 outline-none focus-visible:ring-2 focus-visible:ring-crimson-600"
            >
              {text(...messages[error])}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" className="hover:bg-crimson-700">
              <Ruler aria-hidden />
              {text("Calculate land", "जग्गाको गणना गर्नुहोस्")}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={example}>
              {text("Load example", "उदाहरण राख्नुहोस्")}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-ink-600">
            {text(
              "Results use the measurements you enter. Sloping distances must be reduced to horizontal distances before entry. Display values are rounded; downloads retain full numeric precision.",
              "नतिजा राखिएको मापनमा आधारित हुन्छ। भिरालो दूरीलाई पहिले समतल दूरीमा बदल्नुहोस्। देखाइएका अङ्क गोलाकार हुन्छन्; डाउनलोडमा पूरा सङ्ख्यात्मक परिशुद्धता रहन्छ।",
            )}
          </p>
        </form>
        <div
          className="min-w-0 border-t border-ink-200 bg-ink-50 p-5 sm:p-7 lg:border-t-0 lg:border-l"
          aria-live="polite"
          aria-atomic="true"
        >
          {!result ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <Ruler aria-hidden className="size-10 text-royal-700" />
              <h3 className="mt-4 text-lg font-semibold">
                {text("Your measured boundary", "तपाईंले नापेको सीमाना")}
              </h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-600">
                {text(
                  "Calculate to see a scaled plot, its area, perimeter and every corner.",
                  "मापनअनुसारको नक्सा, क्षेत्रफल, परिधि र हरेक कुना हेर्न गणना गर्नुहोस्।",
                )}
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold">
                {text("Calculated boundary", "गणना गरिएको सीमाना")}
              </h3>
              <ParcelPlot
                result={result}
                label={text("Scaled boundary preview", "मापनअनुसारको सीमाना")}
              />
              <p className="mt-2 text-xs leading-relaxed text-ink-600">
                {gps
                  ? text(
                      "Projected preview. Area and distances are calculated on WGS84.",
                      "प्रक्षेपित दृश्य। क्षेत्रफल र दूरी WGS84 अनुसार निकालिन्छन्।",
                    )
                  : text(
                      "Local drawing coordinates; orientation on Earth is not specified.",
                      "स्थानीय रेखाचित्र निर्देशाङ्क; पृथ्वीमा दिशा तोकिएको छैन।",
                    )}
              </p>
              <dl className="mt-5 divide-y divide-ink-200 text-sm tabular-nums">
                {[
                  [
                    text("Area (square metres)", "क्षेत्रफल (वर्ग मिटर)"),
                    `${number(result.areaSqm)} m²`,
                  ],
                  [
                    text("Area (square feet)", "क्षेत्रफल (वर्ग फुट)"),
                    `${number(result.areaSqm / AREA_IN_SQM.sqft)} ft²`,
                  ],
                  [text("Perimeter", "परिधि"), distance(result.perimeterM)],
                  ...(["aana", "kattha"] as const).map((u) => [
                    landLabel(u, locale),
                    number(result.areaSqm / AREA_IN_SQM[u]),
                  ]),
                  ...result.diagonalsM.map((d) => [
                    `${text("Diagonal", "विकर्ण")} ${cornerName(d.from)}${cornerName(d.to)}`,
                    distance(d.length),
                  ]),
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5"
                  >
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="font-semibold text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <NepaliAreaResults sqm={result.areaSqm} />
              <p className="mt-2 text-xs leading-relaxed text-ink-600">
                {text(
                  "Nepal convention: 1 ropani = 16 aana = 5,476 ft²; 1 bigha = 20 kattha = 72,900 ft². Fractions are retained in daam and dhur.",
                  "नेपाली मानक: १ रोपनी = १६ आना = ५,४७६ वर्ग फुट; १ बिघा = २० कट्ठा = ७२,९०० वर्ग फुट। दाम र धुरमा दशमलव अंश राखिन्छ।",
                )}
              </p>
              <h4 className="mt-6 font-semibold">
                {result.geographic
                  ? text("Location · WGS84 corners", "स्थान · WGS84 कुना")
                  : text("Local corner positions", "स्थानीय कुनाको स्थान")}
              </h4>
              <div
                tabIndex={0}
                role="region"
                aria-label={text(
                  "Corner coordinates, scroll horizontally for all measurements",
                  "कुनाका निर्देशाङ्क, सबै मापनका लागि तेर्सो स्क्रोल गर्नुहोस्",
                )}
                className="mt-3 overflow-x-auto rounded-lg border border-ink-200 bg-white focus-visible:outline-2 focus-visible:outline-royal-700"
              >
                <table className="w-full text-left text-xs tabular-nums">
                  <caption className="sr-only">
                    {text(
                      "Calculated corner coordinates and outgoing boundary edges",
                      "गणना गरिएका कुनाका निर्देशाङ्क र अगाडिको भुजा",
                    )}
                  </caption>
                  <thead>
                    <tr className="border-b border-ink-200 text-ink-600">
                      <th scope="col" className="p-2">
                        {text("Corner", "कुना")}
                      </th>
                      <th scope="col" className="p-2">
                        {gps
                          ? text("Latitude", "अक्षांश")
                          : `X (${displayUnit})`}
                      </th>
                      <th scope="col" className="p-2">
                        {gps
                          ? text("Longitude", "देशान्तर")
                          : `Y (${displayUnit})`}
                      </th>
                      <th scope="col" className="p-2">
                        {text("Next edge", "अगाडिको भुजा")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.corners.map((p, i) => (
                      <tr
                        key={i}
                        className="border-b border-ink-100 last:border-0"
                      >
                        <th scope="row" className="p-2">
                          {cornerName(i)}
                        </th>
                        <td className="p-2">
                          {number(
                            result.geographic?.[i]?.lat ?? p.x / metresPerUnit,
                            gps ? 10 : 6,
                          )}
                        </td>
                        <td className="p-2">
                          {number(
                            result.geographic?.[i]?.lon ?? p.y / metresPerUnit,
                            gps ? 10 : 6,
                          )}
                        </td>
                        <td className="whitespace-nowrap p-2">
                          {cornerName(i)}
                          {cornerName((i + 1) % result.corners.length)}:{" "}
                          {distance(result.sidesM[i]!)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.geographic ? (
                <Button asChild variant="secondary" className="mt-4">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${result.geographic[0]!.lat},${result.geographic[0]!.lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin aria-hidden />
                    {text("Open corner A on map", "नक्सामा A कुना खोल्नुहोस्")}
                  </a>
                </Button>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-ink-600">
                  {text(
                    "Geographic location needs GPS coordinates. Lengths alone determine size, but cannot determine where the land is on Earth.",
                    "भौगोलिक स्थानका लागि GPS निर्देशाङ्क चाहिन्छ। लम्बाइबाट आकार निस्कन्छ, तर पृथ्वीमा जग्गाको स्थान निस्कँदैन।",
                  )}
                </p>
              )}
              {!gps && (
                <p className="mt-3 text-xs text-ink-600">
                  {text("Area centroid", "क्षेत्रफलको केन्द्र")}: X{" "}
                  {number(result.centroid.x / metresPerUnit)}, Y{" "}
                  {number(result.centroid.y / metresPerUnit)} {displayUnit}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                className="mt-4"
                onClick={download}
              >
                <Download aria-hidden />
                {text("Download measurements", "मापन डाउनलोड गर्नुहोस्")}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ParcelPlot({
  result,
  label,
}: {
  result: LandGeometry;
  label: string;
}) {
  const minX = Math.min(...result.corners.map((p) => p.x)),
    maxX = Math.max(...result.corners.map((p) => p.x));
  const minY = Math.min(...result.corners.map((p) => p.y)),
    maxY = Math.max(...result.corners.map((p) => p.y));
  const scale = Math.min(280 / (maxX - minX || 1), 190 / (maxY - minY || 1));
  const points = result.corners.map((p) => ({
    x: 180 + (p.x - (minX + maxX) / 2) * scale,
    y: 125 - (p.y - (minY + maxY) / 2) * scale,
  }));
  return (
    <svg
      viewBox="0 0 360 250"
      role="img"
      aria-label={label}
      className="mt-4 w-full rounded-lg bg-white text-royal-700"
    >
      <polygon
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="2"
      />
      {points.length === 4 && (
        <line
          x1={points[0]!.x}
          y1={points[0]!.y}
          x2={points[2]!.x}
          y2={points[2]!.y}
          stroke="currentColor"
          strokeDasharray="5 4"
          strokeWidth="1"
        />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="currentColor" />
          {(points.length <= 16 || i % Math.ceil(points.length / 16) === 0) && (
            <text
              x={p.x}
              y={p.y + (p.y < 125 ? -12 : 19)}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="currentColor"
            >
              {cornerName(i)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
