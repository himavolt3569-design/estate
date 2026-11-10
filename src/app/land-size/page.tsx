import type { Metadata } from "next";
import { getTranslation } from "@/i18n";
import { AreaConverter } from "@/modules/discovery/components/AreaConverter";
import { LandCalculator } from "@/components/merokotha/land-calculator";

export const metadata: Metadata = {
  title: "Land measurement & size | MeroKotha",
  description:
    "Calculate land area and boundaries from rectangle dimensions, sides and a diagonal, or surveyed corners. Locate GPS boundaries and convert Nepali land units.",
};

export default async function LandSizePage() {
  const { t, locale } = await getTranslation();
  const ne = locale === "ne";
  return (
    <div className="mx-auto max-w-5xl py-4 sm:py-8">
      <h1 className="text-display-md text-ink-900">
        {ne ? "जग्गाको मापन र क्षेत्रफल" : "Land measurement & size"}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-600">
        {ne
          ? "मापनबाट जग्गाको क्षेत्रफल र आकार निकाल्नुहोस्, GPS कुनाबाट स्थान पत्ता लगाउनुहोस् र स्थानीय एकाइ बदल्नुहोस्।"
          : "Calculate the size and shape of your land, locate its GPS boundary, and convert between local units."}
      </p>
      <LandCalculator />
      <section className="mt-12" aria-labelledby="land-converter-title">
        <h2
          id="land-converter-title"
          className="text-xl font-semibold text-ink-900"
        >
          {t.converter.title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
          {t.converter.intro}
        </p>
        <div className="mt-6">
          <AreaConverter t={t.converter} />
        </div>
      </section>
    </div>
  );
}
