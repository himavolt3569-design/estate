import type { Metadata } from "next";
import Link from "next/link";
import { getTranslation } from "@/i18n";
import { LandCalculator } from "@/components/hamrokotha/land-calculator";

export const metadata: Metadata = {
  title: "Land measurement",
  description:
    "Measure land boundaries, corners, side lengths, interior angles, and GPS WGS84 coordinates in an interactive 3D boundary viewer on HamroKotha.",
};

export default async function LandMeasurementPage() {
  const { locale } = await getTranslation();
  const ne = locale === "ne";

  return (
    <div className="mx-auto max-w-6xl py-4 sm:py-8">
      <nav
        aria-label={ne ? "जग्गा उपकरणहरू" : "Land tools"}
        className="mb-5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-ink-200 bg-ink-50 p-1 text-sm"
      >
        <span
          aria-current="page"
          className="inline-flex min-h-9 items-center rounded-full bg-royal-700 px-4 font-semibold text-white shadow-sm"
        >
          {ne ? "जग्गाको मापन" : "Land measurement"}
        </span>
        <Link
          href="/land-size"
          className="inline-flex min-h-9 items-center rounded-full px-4 font-medium text-ink-700 transition-colors hover:bg-white hover:text-royal-700"
        >
          {ne ? "जग्गाको क्षेत्रफल" : "Land size"}
        </Link>
      </nav>

      <h1 className="text-display-md text-ink-900">
        {ne ? "जग्गाको मापन" : "Land measurement"}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600">
        {ne
          ? "जग्गाको लम्बाइ-चौडाइ, चार भुजा र विकर्ण वा स्थानीय र GPS कुनाबाट सही सीमाना, क्षेत्रफल र 3D आकार निकाल्नुहोस्।"
          : "Calculate surveyed boundaries, edge lengths, interior angles, and dual Nepali & metric area in an interactive 3D boundary viewer."}
      </p>

      <LandCalculator />
    </div>
  );
}
