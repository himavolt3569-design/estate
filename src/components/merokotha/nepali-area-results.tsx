"use client";

import { NEPALI_AREA_SYSTEMS, nepaliAreaParts } from "@/lib/nepali-land";
import { landLabel } from "@/lib/land";
import { useSiteLanguage, useSiteText } from "./site-language";

export function NepaliAreaResults({ sqm }: { sqm: number }) {
  const { locale } = useSiteLanguage();
  const text = useSiteText();
  const number = (value: number) =>
    new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-NP", {
      numberingSystem: locale === "ne" ? "deva" : "latn",
      ...(value !== 0 && value < 1e-6
        ? { maximumSignificantDigits: 8 }
        : { maximumFractionDigits: 6 }),
    }).format(value);
  return (
    <div
      className="mt-5"
      aria-label={text("Area in Nepali systems", "नेपाली प्रणालीमा क्षेत्रफल")}
    >
      <h4 className="text-base font-semibold text-ink-900">
        {text("Area in Nepali systems", "नेपाली प्रणालीमा क्षेत्रफल")}
      </h4>
      <dl className="mt-3 space-y-4">
        {(["ropani", "bigha"] as const).map((system) => {
          const units = NEPALI_AREA_SYSTEMS[system];
          const parts = nepaliAreaParts(sqm, system, 6);
          return (
            <div
              key={system}
              className="border-t border-ink-200 pt-3"
              data-land-system={system}
            >
              <dt className="text-sm font-medium text-ink-700">
                {units.map((unit) => landLabel(unit, locale)).join("–")}
              </dt>
              <dd className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-ink-900">
                {units.map((unit, index) => (
                  <span
                    key={unit}
                    className="inline-flex items-baseline gap-1 whitespace-nowrap"
                  >
                    <span className="text-base font-semibold tabular-nums">
                      {number(parts[index]!)}
                    </span>
                    <span className="text-xs text-ink-600">
                      {landLabel(unit, locale)}
                    </span>
                  </span>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
