import type { Metadata } from "next";
import Link from "next/link";
import { getTranslation } from "@/i18n";
import { MAX_NEPALI_AREA_SQM, parseLandNumber } from "@/lib/nepali-land";
import { AreaConverter } from "@/modules/discovery/components/AreaConverter";

export const metadata: Metadata = {
  title: "Land size",
  description:
    "Convert Nepali land area units (Ropani, Aana, Paisa, Daam, Bigha, Kattha, Dhur) with Metric (m², Hectares, ft²) and preview proportional 3D plot footprints on HamroKotha.",
};

export default async function LandSizePage({
  searchParams,
}: {
  searchParams?: Promise<{ sqm?: string | string[] }>;
}) {
  const { t, locale } = await getTranslation();
  const ne = locale === "ne";

  const resolved = searchParams ? await searchParams : {};
  const rawSqm = Array.isArray(resolved.sqm) ? resolved.sqm[0] : resolved.sqm;
  let initialSqm: number | undefined;
  if (typeof rawSqm === "string" && rawSqm.trim() !== "") {
    try {
      const parsed = parseLandNumber(rawSqm);
      if (
        Number.isFinite(parsed) &&
        parsed >= 0 &&
        parsed <= MAX_NEPALI_AREA_SQM
      ) {
        initialSqm = parsed;
      }
    } catch {
      /* Ignore malformed query string parameters cleanly. */
    }
  }

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <nav
        aria-label={ne ? "जग्गा उपकरणहरू" : "Land tools"}
        className="mb-5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-ink-200 bg-ink-50 p-1 text-sm"
      >
        <Link
          href="/land-measurement"
          className="inline-flex min-h-9 items-center rounded-full px-4 font-medium text-ink-700 transition-colors hover:bg-white hover:text-royal-700"
        >
          {ne ? "जग्गाको मापन" : "Land measurement"}
        </Link>
        <span
          aria-current="page"
          className="inline-flex min-h-9 items-center rounded-full bg-royal-700 px-4 font-semibold text-white shadow-sm"
        >
          {ne ? "जग्गाको क्षेत्रफल" : "Land size"}
        </span>
      </nav>

      <h1 className="text-display-md text-ink-900">
        {ne ? "जग्गाको क्षेत्रफल" : "Land size"}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600">
        {t.converter.intro}
      </p>

      <section className="mt-8" aria-labelledby="land-converter-title">
        <h2
          id="land-converter-title"
          className="text-xl font-semibold text-ink-900"
        >
          {t.converter.title}
        </h2>
        <div className="mt-5">
          <AreaConverter
            t={t.converter}
            initialSqm={initialSqm}
            redirectLegacyMeasureHash
          />
        </div>
      </section>
    </div>
  );
}
