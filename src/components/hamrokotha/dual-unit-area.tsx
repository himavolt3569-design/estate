"use client";

import { metricAreaBreakdown } from "@/lib/nepali-land";
import { cn } from "@/lib/utils";
import { formatLandNumber, NepaliAreaResults } from "./nepali-area-results";
import { useSiteLanguage, useSiteText } from "./site-language";

/**
 * Symmetrical dual-unit area summary showing traditional Nepali systems
 * alongside metric and standard square-foot equivalents.
 */
export function DualUnitAreaPanel({
  sqm,
  entered,
  className,
}: {
  sqm: number;
  entered?: string;
  className?: string;
}) {
  const { locale } = useSiteLanguage();
  const text = useSiteText();
  const metric = metricAreaBreakdown(sqm);
  const num = (value: number, digits = 6) =>
    formatLandNumber(value, locale, digits);

  return (
    <div className={cn("space-y-3", className)}>
      {entered && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-royal-200 bg-royal-50/70 px-3.5 py-2 text-xs text-royal-900">
          <span className="font-medium">
            {text("Entered land size", "राखिएको क्षेत्रफल")}
          </span>
          <span className="font-semibold tabular-nums">{entered}</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-label={text("Nepali Units", "नेपाली एकाइ")}
          className="min-w-0 rounded-xl border border-ink-200 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 pb-2.5">
            <h4 className="text-sm font-semibold text-ink-900">
              {text("Nepali Units", "नेपाली एकाइ")}
            </h4>
            <span className="text-[11px] font-medium uppercase tracking-wider text-royal-700">
              {text("Hill & Terai", "पहाड र तराई")}
            </span>
          </div>
          <NepaliAreaResults
            sqm={sqm}
            className="mt-3"
            showHeading={false}
            showDecimalSummary
          />
        </section>

        <section
          aria-label={text("Metric & Standard Units", "मेट्रिक एकाइ")}
          className="min-w-0 rounded-xl border border-ink-200 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 pb-2.5">
            <h4 className="text-sm font-semibold text-ink-900">
              {text("Metric & Standard Units", "मेट्रिक एकाइ")}
            </h4>
            <span className="text-[11px] font-medium uppercase tracking-wider text-royal-700">
              {text("SI & sq ft", "एसआई र वर्ग फुट")}
            </span>
          </div>
          <dl className="mt-3 divide-y divide-ink-100 text-sm tabular-nums">
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0">
              <dt className="text-ink-600">
                {text("Square metres (m²)", "वर्ग मिटर (m²)")}
              </dt>
              <dd className="text-base font-semibold text-ink-900">
                {num(metric.sqm)} m²
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <dt className="text-ink-600">
                {text("Hectares (ha)", "हेक्टर (ha)")}
              </dt>
              <dd className="text-base font-semibold text-ink-900">
                {num(metric.hectare)} ha
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <dt className="text-ink-600">
                {text("Square feet (ft²)", "वर्ग फुट (ft²)")}
              </dt>
              <dd className="text-base font-semibold text-ink-900">
                {num(metric.sqft)} ft²
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2.5">
              <dt className="text-ink-600">
                {text("Equivalent square", "बराबर वर्गाकार")}
              </dt>
              <dd className="text-right font-semibold text-ink-900">
                <span>
                  {num(metric.equivalentSideM, 2)} ×{" "}
                  {num(metric.equivalentSideM, 2)} m
                </span>
                <span className="block text-xs font-normal text-ink-600">
                  {num(metric.equivalentSideFt, 2)} ×{" "}
                  {num(metric.equivalentSideFt, 2)} ft
                </span>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
