"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { ChartCard } from "@/components/charts/ChartCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { Button } from "@/components/ui/button";
import { Field, Select, Surface } from "@/components/ui/primitives";
import type { Inquiry, Listing } from "@/lib/firebase/types";
import { useListingVisits } from "@/lib/firebase/property-features";
import { summarizeAnalytics, timestampMillis } from "@/lib/listing-analytics";
import { useAuth } from "./auth-provider";
import { useSiteLanguage, useSiteText } from "./site-language";

export function ListingAnalytics({
  listings,
  inquiries,
  admin = false,
  defaultListingId = "",
}: {
  listings: Listing[];
  inquiries: Inquiry[];
  admin?: boolean;
  defaultListingId?: string;
}) {
  const t = useSiteText();
  const { locale } = useSiteLanguage();
  const { user, profile } = useAuth();
  const [days, setDays] = useState(30);
  const [selected, setSelected] = useState(defaultListingId);
  const [now, setNow] = useState(() => new Date());
  const allowedAdmin = admin && profile?.role === "superAdmin";
  const visits = useListingVisits(user?.uid || "", allowedAdmin, days);
  useEffect(() => {
    setSelected(defaultListingId);
  }, [defaultListingId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const visible = listings.filter(
    (listing) =>
      (allowedAdmin || listing.ownerId === user?.uid) &&
      (!selected || selected === listing.id),
  );
  const result = summarizeAnalytics(
    visible,
    visits.items,
    inquiries,
    days,
    now,
  );
  const title = (listingId: string) =>
    listings.find((listing) => listing.id === listingId)?.title ||
    t("Removed rental", "हटाइएको विज्ञापन");
  const stats = [
    [t("Web visits", "वेब भ्रमण"), result.views],
    [t("Unique browsers", "फरक ब्राउजर"), result.uniqueVisitors],
    [t("Inquiries", "सोधपुछ"), result.inquiries],
    [t("Accepted inquiries", "स्वीकृत सोधपुछ"), result.accepted],
    [
      t("Inquiry / visit ratio", "सोधपुछ / भ्रमण अनुपात"),
      result.inquiryRate === null ? "—" : `${result.inquiryRate.toFixed(1)}%`,
    ],
    [t("Lifetime listing views", "जम्मा विज्ञापन हेराइ"), result.lifetimeViews],
  ];
  const breakdown = (items: { label: string; value: number }[]) =>
    items.length ? (
      <ul className="divide-y divide-ink-100">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span className="min-w-0 break-all text-ink-600">
              {item.label === "direct"
                ? t("Direct / this site", "प्रत्यक्ष / यही साइट")
                : item.label === "mobile"
                  ? t("Mobile", "मोबाइल")
                  : item.label === "desktop"
                    ? t("Desktop", "कम्प्युटर")
                    : item.label}
            </span>
            <span className="font-semibold tabular-nums">{item.value}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-ink-500">
        {t("No visits in this period.", "यो अवधिमा भ्रमण छैन।")}
      </p>
    );
  return (
    <section
      className="space-y-5"
      aria-label={t("Detailed analytics", "विस्तृत तथ्याङ्क")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <BarChart3 aria-hidden className="size-6 text-royal-700" />
            {t("Detailed analytics", "विस्तृत तथ्याङ्क")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            {t(
              "Web visits are recorded from this feature’s launch. Lifetime views also include the Android app. Dates use Nepal time.",
              "यो सुविधा सुरु भएपछि वेब भ्रमण रेकर्ड हुन्छ। जम्मा हेराइमा एन्ड्रोइड एप पनि समावेश छ। मिति नेपालको समय अनुसार छ।",
            )}
          </p>
        </div>
        <div
          role="group"
          aria-label={t("Analytics period", "तथ्याङ्क अवधि")}
          className="flex gap-1"
        >
          {[7, 30, 90].map((range) => (
            <Button
              key={range}
              type="button"
              size="sm"
              variant={days === range ? "royal" : "secondary"}
              aria-pressed={days === range}
              onClick={() => {
                setDays(range);
                setNow(new Date());
              }}
            >
              {range} {t("days", "दिन")}
            </Button>
          ))}
        </div>
      </div>
      <Field
        label={t("Rental", "विज्ञापन")}
        htmlFor={admin ? "admin-analytics-listing" : "analytics-listing"}
        className="max-w-md"
      >
        <Select
          id={admin ? "admin-analytics-listing" : "analytics-listing"}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">{t("All rentals", "सबै विज्ञापन")}</option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title}
            </option>
          ))}
        </Select>
      </Field>
      {visits.loading && (
        <p role="status" className="text-sm text-ink-500">
          {t("Loading visit history…", "भ्रमण इतिहास लोड हुँदैछ…")}
        </p>
      )}
      {visits.error && (
        <Surface
          role="alert"
          className="border-clay-200 bg-clay-50 p-4 text-sm text-clay-700"
        >
          {t(
            "Detailed visit history is temporarily unavailable. Inquiry counts and lifetime views remain available.",
            "विस्तृत भ्रमण इतिहास अहिले उपलब्ध छैन। सोधपुछ र जम्मा हेराइ उपलब्ध छन्।",
          )}
          {allowedAdmin && <p className="mt-2">{visits.error}</p>}
        </Surface>
      )}
      {visits.capped && (
        <p role="status" className="rounded-lg bg-marigold-50 p-3 text-sm">
          {t(
            "Visit metrics show the latest 2,000 records in this period. Use a shorter period for a more complete view.",
            "यस अवधिका पछिल्ला २,००० भ्रमण मात्र देखाइएको छ। पूरा विवरणका लागि छोटो अवधि छान्नुहोस्।",
          )}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <Surface key={label} className="p-4">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-royal-800">
              {[stats[0]?.[0], stats[1]?.[0], stats[4]?.[0]].includes(label) &&
              (visits.loading || visits.error)
                ? visits.loading
                  ? "…"
                  : "—"
                : value}
            </p>
          </Surface>
        ))}
      </div>
      <p className="text-xs text-ink-500">
        {t(
          "Repeat visits in the same browser are counted at most once every 30 minutes per rental. Browser counts are approximate; inquiries may also come from Android.",
          "एउटै ब्राउजरबाट प्रति विज्ञापन ३० मिनेटमा एक पटक मात्र भ्रमण गनिन्छ। ब्राउजर संख्या अनुमानित हो; सोधपुछ एन्ड्रोइडबाट पनि आउन सक्छ।",
        )}
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={t("Visits by day", "दिन अनुसार भ्रमण")}>
          <TrendChart
            points={result.viewSeries}
            label={t("Visits", "भ्रमण")}
            emptyMessage={t("No recorded visits", "भ्रमण रेकर्ड छैन")}
          />
        </ChartCard>
        <ChartCard title={t("Inquiries by day", "दिन अनुसार सोधपुछ")}>
          <TrendChart
            points={result.inquirySeries}
            label={t("Inquiries", "सोधपुछ")}
            variant="column"
            color="#be6b12"
            emptyMessage={t("No inquiries", "सोधपुछ छैन")}
          />
        </ChartCard>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title={t("Visitor sources", "भ्रमणको स्रोत")}>
          {breakdown(result.sources)}
        </ChartCard>
        <ChartCard title={t("Device sizes", "उपकरणको आकार")}>
          {breakdown(result.devices)}
        </ChartCard>
      </div>
      <Surface className="overflow-hidden p-5">
        <h3 className="font-semibold">
          {t("Rental performance", "विज्ञापनको प्रदर्शन")}
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {t(
                "Rental performance in the selected period",
                "छानिएको अवधिमा विज्ञापनको प्रदर्शन",
              )}
            </caption>
            <thead className="border-b border-ink-200 text-xs text-ink-500">
              <tr>
                <th scope="col" className="min-w-44 py-3">
                  {t("Rental", "विज्ञापन")}
                </th>
                <th scope="col" className="px-3">
                  {t("Visits", "भ्रमण")}
                </th>
                <th scope="col" className="px-3">
                  {t("Browsers", "ब्राउजर")}
                </th>
                <th scope="col" className="px-3">
                  {t("Inquiries", "सोधपुछ")}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.performance.map((row) => (
                <tr
                  key={row.listing.id}
                  className="border-b border-ink-100 last:border-0"
                >
                  <th scope="row" className="py-3 font-medium">
                    <Link
                      href={`/listing/${row.listing.id}`}
                      className="text-royal-700 hover:underline"
                    >
                      {row.listing.title}
                    </Link>
                  </th>
                  <td className="px-3 tabular-nums">{row.views}</td>
                  <td className="px-3 tabular-nums">{row.unique}</td>
                  <td className="px-3 tabular-nums">{row.inquiries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="mt-4 text-sm text-ink-500">
            {t("No rentals in this view.", "यस दृश्यमा विज्ञापन छैन।")}
          </p>
        )}
      </Surface>
      <Surface className="p-5">
        <h3 className="font-semibold">
          {t("Recent visit activity", "पछिल्लो भ्रमण गतिविधि")}
        </h3>
        <p className="mt-1 text-xs text-ink-500">
          {t(
            "Anonymous activity only. Visitor names, emails and phone numbers are not collected.",
            "नामरहित गतिविधि मात्र। आगन्तुकको नाम, इमेल वा फोन सङ्कलन हुँदैन।",
          )}
        </p>
        <ul className="mt-4 divide-y divide-ink-100">
          {result.recent.map((visit) => (
            <li
              key={visit.id}
              className="flex flex-wrap justify-between gap-2 py-3 text-sm"
            >
              <span>
                {title(visit.listingId)}{" "}
                <span className="text-ink-500">
                  · {visit.device} ·{" "}
                  {visit.referrer === "direct"
                    ? t("Direct", "प्रत्यक्ष")
                    : visit.referrer}
                </span>
              </span>
              <time
                className="text-xs text-ink-500"
                dateTime={new Date(
                  timestampMillis(visit.createdAt),
                ).toISOString()}
              >
                {new Date(timestampMillis(visit.createdAt)).toLocaleString(
                  locale === "ne" ? "ne-NP" : "en-NP",
                  { timeZone: "Asia/Kathmandu" },
                )}
              </time>
            </li>
          ))}
        </ul>
        {result.recent.length === 0 && (
          <p className="mt-4 text-sm text-ink-500">
            {t("No recent visits.", "हालै भ्रमण छैन।")}
          </p>
        )}
      </Surface>
    </section>
  );
}
