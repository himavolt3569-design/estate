"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select, Surface, Textarea } from "@/components/ui/primitives";
import type { Listing, ListingReport } from "@/lib/firebase/types";
import {
  submitListingReport,
  useListingReports,
  useOwnListingReport,
} from "@/lib/firebase/property-features";
import {
  reportReasons,
  reportSchema,
  reportStatuses,
  type ReportReason,
} from "@/lib/listing-reports";
import { timestampMillis } from "@/lib/listing-analytics";
import { useAuth } from "./auth-provider";
import { useSiteLanguage, useSiteText } from "./site-language";

function ReportResult({ report }: { report: ListingReport }) {
  const t = useSiteText();
  const labels = reportStatuses[report.status];
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">
        {t("Report status", "उजुरीको अवस्था")}:{" "}
        {labels ? t(labels[0], labels[1]) : report.status}
      </p>
      {report.decisionReason && (
        <p className="whitespace-pre-line text-ink-600">
          {t("Moderator note", "समीक्षकको टिप्पणी")}: {report.decisionReason}
        </p>
      )}
      <Link
        href="/dashboard?tab=reports"
        className="inline-block text-royal-700 underline"
      >
        {t("My reports", "मेरा उजुरीहरू")}
      </Link>
    </div>
  );
}

export function ListingReportForm({ listing }: { listing: Listing }) {
  const t = useSiteText();
  const { user, profile } = useAuth();
  const existing = useOwnListingReport(listing.id, user?.uid || "");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  if (user?.uid === listing.ownerId) return null;
  return (
    <Surface className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Flag aria-hidden className="size-4 text-clay-700" />
        {t("Something wrong with this rental?", "यो विज्ञापनमा केही गलत छ?")}
      </h2>
      <p className="mt-2 text-xs text-ink-500">
        {t(
          "Report misleading information, fraud or an unavailable property. Your report and identity are private to you and the administrators.",
          "गलत विवरण, ठगी वा अनुपलब्ध घरबारे उजुरी गर्नुहोस्। तपाईंको उजुरी र परिचय तपाईं र प्रशासकलाई मात्र देखिन्छ।",
        )}
      </p>
      <div className="mt-4">
        {!user ? (
          <Button asChild size="sm" variant="secondary">
            <Link
              href={`/sign-in?next=${encodeURIComponent(`/listing/${listing.id}`)}`}
            >
              {t("Sign in to report", "उजुरी गर्न साइन इन गर्नुहोस्")}
            </Link>
          </Button>
        ) : !profile ? (
          <Button asChild size="sm" variant="secondary">
            <Link href="/dashboard">
              {t("Complete your profile", "प्रोफाइल पूरा गर्नुहोस्")}
            </Link>
          </Button>
        ) : profile.isBanned ? (
          <p className="text-sm text-clay-700">
            {t(
              "Suspended accounts cannot submit reports.",
              "रोकिएका खाताले उजुरी गर्न सक्दैनन्।",
            )}
          </p>
        ) : existing.report ? (
          <ReportResult report={existing.report} />
        ) : submitted ? (
          <p role="status" className="text-sm text-emerald-700">
            {t(
              "Report submitted. An administrator will review it.",
              "उजुरी पठाइयो। प्रशासकले समीक्षा गर्नेछन्।",
            )}
          </p>
        ) : expanded ? (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const data = new FormData(event.currentTarget);
              const parsed = reportSchema.safeParse({
                reason: data.get("reason"),
                details: data.get("details"),
              });
              if (!parsed.success) {
                setError(
                  parsed.error.issues[0]?.message || "Describe the issue.",
                );
                return;
              }
              setBusy(true);
              setError("");
              try {
                await submitListingReport(listing, user.uid, parsed.data);
                setSubmitted(true);
                toast.success(t("Report submitted", "उजुरी पठाइयो"));
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not submit report.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={t("Reason", "कारण")} htmlFor="report-reason">
              <Select id="report-reason" name="reason" disabled={busy}>
                {Object.entries(reportReasons).map(([value, labels]) => (
                  <option key={value} value={value}>
                    {t(labels[0], labels[1])}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("What happened?", "के भयो?")}
              htmlFor="report-details"
            >
              <Textarea
                id="report-details"
                name="details"
                required
                minLength={10}
                maxLength={1000}
                disabled={busy}
                placeholder={t(
                  "Describe the issue. Avoid sharing private contact or payment information.",
                  "समस्या वर्णन गर्नुहोस्। निजी सम्पर्क वा भुक्तानी विवरण नराख्नुहोस्।",
                )}
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-clay-700">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={busy || existing.loading}
              >
                {busy
                  ? t("Submitting…", "पठाउँदै…")
                  : t("Submit report", "उजुरी पठाउनुहोस्")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setExpanded(false)}
              >
                {t("Cancel", "रद्द गर्नुहोस्")}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={existing.loading}
            onClick={() => setExpanded(true)}
          >
            {t("Report this listing", "यो विज्ञापनबारे उजुरी गर्नुहोस्")}
          </Button>
        )}
      </div>
    </Surface>
  );
}

export function MyListingReports() {
  const t = useSiteText();
  const { locale } = useSiteLanguage();
  const { user } = useAuth();
  const reports = useListingReports(user?.uid || "", false);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">
        {t("My reports", "मेरा उजुरीहरू")}
      </h2>
      <p className="text-sm text-ink-500">
        {t(
          "Track the issues you reported and the administrator’s response.",
          "आफ्नो उजुरी र प्रशासकको जवाफ हेर्नुहोस्।",
        )}
      </p>
      {reports.loading && (
        <p role="status">{t("Loading reports…", "उजुरी लोड हुँदैछ…")}</p>
      )}
      {reports.error && (
        <Surface role="alert" className="p-4 text-sm text-clay-700">
          {t(
            "Reports could not load. Please try again later.",
            "उजुरी लोड भएन। पछि फेरि प्रयास गर्नुहोस्।",
          )}
        </Surface>
      )}
      {reports.capped && (
        <p className="text-xs text-ink-500">
          {t(
            "Showing your latest 200 reports.",
            "पछिल्ला २०० उजुरी देखाइएको छ।",
          )}
        </p>
      )}
      {!reports.loading && !reports.error && !reports.items.length && (
        <Surface className="p-6 text-sm text-ink-500">
          {t(
            "You have not submitted any reports.",
            "तपाईंले कुनै उजुरी पठाउनुभएको छैन।",
          )}
        </Surface>
      )}
      {reports.items.map((report) => (
        <Surface key={report.id} className="space-y-3 p-5">
          <Link
            href={`/listing/${report.listingId}`}
            className="font-semibold text-royal-700"
          >
            {report.listingTitle}
          </Link>
          <p className="text-xs text-ink-500">
            {reportReasons[report.reason]
              ? t(
                  reportReasons[report.reason as ReportReason][0],
                  reportReasons[report.reason as ReportReason][1],
                )
              : report.reason}{" "}
            ·{" "}
            {new Date(timestampMillis(report.createdAt)).toLocaleDateString(
              locale === "ne" ? "ne-NP" : "en-NP",
              { timeZone: "Asia/Kathmandu" },
            )}
          </p>
          <p className="whitespace-pre-line text-sm text-ink-600">
            {report.details}
          </p>
          <ReportResult report={report} />
        </Surface>
      ))}
    </section>
  );
}
