"use client";

import {
  NEPALI_AREA_IN_SQM,
  NEPALI_AREA_SYSTEMS,
  nepaliAreaParts,
} from "@/lib/nepali-land";
import { landLabel } from "@/lib/land";
import { cn } from "@/lib/utils";
import { useSiteLanguage, useSiteText } from "./site-language";

/** Format a land value with locale-aware numerals and stable decimal precision. */
export function formatLandNumber(
  value: number,
  locale: string,
  digits = 6,
): string {
  return new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-NP", {
    numberingSystem: locale === "ne" ? "deva" : "latn",
    ...(value !== 0 && Math.abs(value) < 10 ** -digits
      ? { maximumSignificantDigits: 8 }
      : { maximumFractionDigits: digits }),
  }).format(value);
}

export function NepaliAreaResults({
  sqm,
  className,
  showHeading = true,
  showDecimalSummary = false,
}: {
  sqm: number;
  className?: string;
  showHeading?: boolean;
  showDecimalSummary?: boolean;
}) {
  const { locale } = useSiteLanguage();
  const text = useSiteText();
  const number = (value: number, digits = 6) =>
    formatLandNumber(value, locale, digits);

  return (
    <div
      className={cn(showHeading ? "mt-5" : "", className)}
      aria-label={text("Area in Nepali systems", "नेपाली प्रणालीमा क्षेत्रफल")}
    >
      {showHeading && (
        <h4 className="text-base font-semibold text-ink-900">
          {text("Area in Nepali systems", "नेपाली प्रणालीमा क्षेत्रफल")}
        </h4>
      )}
      <dl className={cn(showHeading ? "mt-3" : "", "space-y-4")}>
        {(["ropani", "bigha"] as const).map((system, sysIdx) => {
          const units = NEPALI_AREA_SYSTEMS[system];
          const parts = nepaliAreaParts(sqm, system, 6);
          return (
            <div
              key={system}
              className={cn(
                "border-ink-200",
                showHeading || sysIdx > 0 ? "border-t pt-3" : "pt-0",
              )}
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
      {showDecimalSummary && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-600 tabular-nums">
          <span>
            {text("Total in Aana", "जम्मा आना")}:{" "}
            <strong className="font-semibold text-ink-900">
              {number(sqm / NEPALI_AREA_IN_SQM.aana, 4)}{" "}
              {landLabel("aana", locale)}
            </strong>
          </span>
          <span>
            {text("Total in Kattha", "जम्मा कट्ठा")}:{" "}
            <strong className="font-semibold text-ink-900">
              {number(sqm / NEPALI_AREA_IN_SQM.kattha, 4)}{" "}
              {landLabel("kattha", locale)}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
