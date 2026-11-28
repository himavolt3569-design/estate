"use client";

import { ArrowRight, Ruler } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import {
  useSiteLanguage,
  useSiteText,
} from "@/components/hamrokotha/site-language";
import { DualUnitAreaPanel } from "@/components/hamrokotha/dual-unit-area";
import { LandPlot3D } from "@/components/hamrokotha/land-plot-3d";
import { formatLandNumber } from "@/components/hamrokotha/nepali-area-results";
import { createProportionalPlot } from "@/lib/land-3d";
import {
  compoundAreaToSqm,
  NEPALI_AREA_IN_SQM,
  NEPALI_AREA_SYSTEMS,
  nepaliAreaParts,
  nepaliAreaToSqm,
  parseLandNumber,
  type NepaliAreaSystem,
  type NepaliAreaUnit,
} from "@/lib/nepali-land";
import { cn } from "@/lib/utils";

type InputSystem = "single" | NepaliAreaSystem;

const INPUT_UNITS: NepaliAreaUnit[] = [
  "ropani",
  "aana",
  "paisa",
  "daam",
  "bigha",
  "kattha",
  "dhur",
  "hectare",
  "sqft",
  "sqm",
];

const ASPECT_OPTIONS = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "2:1", value: 2 },
] as const;

export function AreaConverter({
  t,
  initialSqm,
  redirectLegacyMeasureHash = false,
}: {
  t: Dictionary["converter"];
  initialSqm?: number;
  redirectLegacyMeasureHash?: boolean;
}) {
  const { ui, locale } = useSiteLanguage();
  const text = useSiteText();
  const router = useRouter();

  const [system, setSystem] = useState<InputSystem>("single");
  const [amount, setAmount] = useState(() =>
    initialSqm !== undefined ? String(initialSqm) : "4",
  );
  const [unit, setUnit] = useState<NepaliAreaUnit>(() =>
    initialSqm !== undefined ? "sqm" : "aana",
  );
  const [parts, setParts] = useState<string[]>(["0", "4", "0", "0"]);
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (!redirectLegacyMeasureHash) return;
    if (window.location.hash === "#measure-land") {
      router.replace("/land-measurement");
    }
  }, [redirectLegacyMeasureHash, router]);

  useEffect(() => {
    if (initialSqm === undefined) return;
    setSystem("single");
    setUnit("sqm");
    setAmount(String(initialSqm));
  }, [initialSqm]);

  let sqm: number | null = null;
  try {
    sqm =
      system === "single"
        ? nepaliAreaToSqm(parseLandNumber(amount), unit)
        : compoundAreaToSqm(system, parts.map(parseLandNumber));
  } catch {
    /* Invalid input clears outputs below. */
  }
  const invalid = sqm === null;
  const number = (value: number) => formatLandNumber(value, locale, 6);

  function changeSystem(next: InputSystem) {
    if (sqm !== null) {
      if (next === "single") setAmount(String(sqm / NEPALI_AREA_IN_SQM[unit]));
      else setParts(nepaliAreaParts(sqm, next).map(String));
    } else if (next !== "single")
      setParts(NEPALI_AREA_SYSTEMS[next].map(() => "0"));
    setSystem(next);
  }

  const proportionalPlot = useMemo(
    () => (sqm !== null && sqm > 0 ? createProportionalPlot(sqm, aspectRatio) : null),
    [sqm, aspectRatio],
  );

  const unitLabel = (u: NepaliAreaUnit) => {
    const map = t.units as Record<string, string>;
    if (map[u]) return map[u];
    if (u === "hectare") return locale === "ne" ? "हेक्टर" : "Hectare";
    return u;
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-soft">
        <div className="grid gap-px bg-ink-200 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5 bg-white p-5 sm:p-7">
            <Field
              label={text("Area input system", "क्षेत्रफल राख्ने प्रणाली")}
              htmlFor="area-input-system"
            >
              <Select
                id="area-input-system"
                value={system}
                onChange={(event) =>
                  changeSystem(event.target.value as InputSystem)
                }
              >
                <option value="single">
                  {text("Single unit", "एउटा एकाइ")}
                </option>
                <option value="ropani">
                  {text("Ropani–Aana–Paisa–Daam", "रोपनी–आना–पैसा–दाम")}
                </option>
                <option value="bigha">
                  {text("Bigha–Kattha–Dhur", "बिघा–कट्ठा–धुर")}
                </option>
              </Select>
            </Field>

            {system === "single" ? (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
                <Field label={t.plotSize} htmlFor="area-amount">
                  <Input
                    id="area-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-invalid={invalid}
                    aria-describedby="area-input-help area-converter-error"
                    className="px-3 tabular-nums"
                  />
                </Field>
                <Field label={t.unit} htmlFor="area-unit">
                  <Select
                    id="area-unit"
                    value={unit}
                    onChange={(event) =>
                      setUnit(event.target.value as NepaliAreaUnit)
                    }
                  >
                    {INPUT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-2 gap-3">
                {NEPALI_AREA_SYSTEMS[system].map((u, index) => (
                  <Field key={u} label={unitLabel(u)} htmlFor={"area-" + u}>
                    <Input
                      id={"area-" + u}
                      type="text"
                      inputMode="decimal"
                      value={parts[index] ?? ""}
                      onChange={(event) =>
                        setParts(
                          parts.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        )
                      }
                      aria-invalid={invalid}
                      aria-describedby="area-input-help area-converter-error"
                      className="px-3 tabular-nums"
                    />
                  </Field>
                ))}
              </div>
            )}

            <p
              id="area-input-help"
              className="text-xs leading-relaxed text-ink-600"
            >
              {system === "single"
                ? text(
                    "Enter English or Nepali digits, for example 4.5 or ४.५.",
                    "अङ्ग्रेजी वा नेपाली अङ्क राख्नुहोस्, जस्तै 4.5 वा ४.५।",
                  )
                : text(
                    "Use 0 for unused units. Larger units are whole numbers; daam or dhur can be fractional. Extra units carry automatically.",
                    "प्रयोग नभएको एकाइमा ० राख्नुहोस्। ठूला एकाइ पूर्णाङ्क र दाम वा धुर दशमलव हुन सक्छन्। बढी एकाइ अर्को एकाइमा आफैँ सर्छ।",
                  )}
            </p>

            <p
              id="area-converter-error"
              role={invalid ? "alert" : undefined}
              className="text-sm leading-relaxed text-crimson-700"
            >
              {invalid
                ? text(
                    "Enter complete, nonnegative numbers. Only the last combined unit can be fractional. Maximum area: 10¹⁵ m².",
                    "पूर्ण र शून्य वा सोभन्दा ठूला सङ्ख्या राख्नुहोस्। मिश्रित ढाँचामा अन्तिम एकाइ मात्र दशमलव हुन सक्छ। अधिकतम क्षेत्रफल: १०¹⁵ वर्ग मिटर।",
                  )
                : ""}
            </p>

            <dl
              aria-live="polite"
              className="space-y-3 border-t border-ink-200 pt-4 text-sm tabular-nums"
            >
              {[
                [
                  t.squareFeet,
                  sqm === null ? "-" : number(sqm / NEPALI_AREA_IN_SQM.sqft),
                ],
                [t.squareMetres, sqm === null ? "-" : number(sqm)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap items-baseline justify-between gap-3"
                >
                  <dt className="text-ink-600">{label}</dt>
                  <dd className="font-semibold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            className="min-w-0 bg-ink-50/40 p-5 sm:p-7"
            aria-live="polite"
          >
            {sqm !== null ? (
              <DualUnitAreaPanel sqm={sqm} />
            ) : (
              <p className="text-sm leading-relaxed text-ink-600">
                {text(
                  "Correct the area inputs to see both Nepali systems and metric conversions.",
                  "दुवै नेपाली प्रणाली र मेट्रिक मान हेर्न क्षेत्रफलको मापन सच्याउनुहोस्।",
                )}
              </p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-ink-600">
              {text(
                "1 ropani = 16 aana; 1 aana = 4 paisa; 1 paisa = 4 daam. 1 bigha = 20 kattha; 1 kattha = 20 dhur.",
                "१ रोपनी = १६ आना; १ आना = ४ पैसा; १ पैसा = ४ दाम। १ बिघा = २० कट्ठा; १ कट्ठा = २० धुर।",
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="royal">
                <Link href="/land-measurement">
                  <Ruler aria-hidden className="size-4" />
                  <span>
                    {text(
                      "Measure exact boundaries in 3D",
                      "3D मा यकिन सीमाना नाप्नुहोस्",
                    )}
                  </span>
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/#rentals">
                  <span>{ui.browse}</span>
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Proportional 3D Plot Footprint */}
      <section
        aria-labelledby="proportional-footprint-title"
        className="rounded-xl border border-ink-200 bg-white p-5 shadow-soft sm:p-7"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              id="proportional-footprint-title"
              className="text-lg font-semibold text-ink-900"
            >
              {text(
                "Proportional 3D Plot Footprint",
                "आनुपातिक 3D जग्गाको नमुना आकार",
              )}
            </h3>
            <p className="mt-1 text-xs text-ink-600">
              {text(
                "Preview how this total area looks at common length-to-width proportions, or upload a photo to visualize it inside the boundary.",
                "यो जम्मा क्षेत्रफल विभिन्न लम्बाइ-चौडाइको अनुपातमा कस्तो देखिन्छ हेर्नुहोस्, वा सीमानाभित्र फोटो राखेर हेर्नुहोस्।",
              )}
            </p>
          </div>
          <div
            role="group"
            aria-label={text("Plot aspect ratio", "जग्गाको अनुपात")}
            className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1"
          >
            {ASPECT_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={aspectRatio === option.value}
                onClick={() => setAspectRatio(option.value)}
                className={cn(
                  "min-h-8 rounded-md px-3 text-xs font-semibold transition-colors",
                  aspectRatio === option.value
                    ? "bg-royal-700 text-white shadow-xs"
                    : "text-ink-700 hover:bg-white",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {proportionalPlot ? (
          <LandPlot3D
            geometry={proportionalPlot}
            allowImageUpload
            isProportional
            title={text(
              `Proportional Footprint (${ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.label || "4:3"})`,
              `आनुपातिक नमुना (${ASPECT_OPTIONS.find((o) => o.value === aspectRatio)?.label || "4:3"})`,
            )}
            subtitle={text(
              "Sample rectangular footprint matching your converted area; use Land measurement for exact corner shapes.",
              "यो क्षेत्रफलअनुसारको नमुना आयताकार आकार हो; यकिन आकारका लागि जग्गाको मापन प्रयोग गर्नुहोस्।",
            )}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center text-sm text-ink-600">
            {text(
              "Enter a valid land area greater than zero to preview its proportional 3D footprint.",
              "आनुपातिक 3D आकार हेर्न शून्यभन्दा ठूलो मान्य क्षेत्रफल राख्नुहोस्।",
            )}
          </div>
        )}
      </section>
    </div>
  );
}
