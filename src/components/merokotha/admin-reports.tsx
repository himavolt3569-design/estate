"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Select, Surface, Textarea } from "@/components/ui/primitives";
import {
  moderateListingReport,
  useListingReports,
} from "@/lib/firebase/property-features";
import type { ListingReport } from "@/lib/firebase/types";
import {
  decisionSchema,
  reportReasons,
  reportStatuses,
} from "@/lib/listing-reports";
import { timestampMillis } from "@/lib/listing-analytics";
import { useAuth } from "./auth-provider";
import { useSiteLanguage, useSiteText } from "./site-language";

export function AdminReports() {
  const t = useSiteText();
  const { user, profile } = useAuth();
  const [status, setStatus] = useState("open");
  const reports = useListingReports(
    profile?.role === "superAdmin" ? user?.uid || "" : "",
    true,
    status,
  );
  if (profile?.role !== "superAdmin") return null;
  return (
    <section
      className="space-y-4"
      aria-label={t("Report moderation", "उजुरी समीक्षा")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-semibold">
          <Flag aria-hidden className="size-5 text-clay-700" />
          {t("Report moderation", "उजुरी समीक्षा")}
        </h3>
        <Select
          aria-label={t("Report status filter", "उजुरी अवस्था फिल्टर")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-44"
        >
          {Object.entries(reportStatuses).map(([value, labels]) => (
            <option key={value} value={value}>
              {t(labels[0], labels[1])}
            </option>
          ))}
          <option value="all">{t("All reports", "सबै उजुरी")}</option>
        </Select>
      </div>
      <p className="text-sm text-ink-500">
        {t(
          "Open reports are oldest first. Review the evidence, record a decision, and pause misleading rentals when needed.",
          "खुला उजुरी पुरानो क्रमबाट देखिन्छ। प्रमाण जाँचेर निर्णय लेख्नुहोस् र आवश्यक भए गलत विज्ञापन रोक्नुहोस्।",
        )}
      </p>
      {reports.loading && (
        <p role="status">{t("Loading reports…", "उजुरी लोड हुँदैछ…")}</p>
      )}
      {reports.error && (
        <Surface role="alert" className="p-4 text-sm text-clay-700">
          Reports could not load: {reports.error}
        </Surface>
      )}
      {reports.capped && (
        <p role="status" className="text-xs text-ink-500">
          {t(
            "Showing 200 reports. Narrow the status filter to find a decision.",
            "२०० उजुरी देखाइएको छ। अवस्था अनुसार फिल्टर गर्नुहोस्।",
          )}
        </p>
      )}
      {!reports.loading && !reports.error && !reports.items.length && (
        <p className="text-sm text-ink-500">
          {t("No reports in this view.", "यस दृश्यमा उजुरी छैन।")}
        </p>
      )}
      {reports.items.map((report) => (
        <ReportReview
          key={`${report.id}-${report.status}`}
          report={report}
          actorId={user!.uid}
        />
      ))}
    </section>
  );
}

function ReportReview({
  report,
  actorId,
}: {
  report: ListingReport;
  actorId: string;
}) {
  const t = useSiteText();
  const { locale } = useSiteLanguage();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = report.status === "open" || report.status === "reviewing";
  const decide = async (action: "review" | "resolve" | "dismiss" | "pause") => {
    if (busy) return;
    const result = decisionSchema.safeParse(note);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Add a decision note.");
      return;
    }
    if (
      action === "pause" &&
      !window.confirm(
        "Pause this rental and resolve the report? It will disappear from public search.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await moderateListingReport(report.id, actorId, action, result.data);
      toast.success(t("Report updated", "उजुरी अद्यावधिक भयो"));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update report.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Surface className="space-y-3 p-5">
      <div className="flex flex-wrap justify-between gap-2">
        <Link
          href={`/listing/${report.listingId}`}
          className="font-semibold text-royal-700 hover:underline"
        >
          {report.listingTitle}
        </Link>
        <span className="rounded-full bg-ink-50 px-3 py-1 text-xs font-medium">
          {t(
            reportStatuses[report.status][0],
            reportStatuses[report.status][1],
          )}
        </span>
      </div>
      <p className="text-xs text-ink-500">
        {reportReasons[report.reason]
          ? t(reportReasons[report.reason][0], reportReasons[report.reason][1])
          : report.reason}{" "}
        ·{" "}
        {new Date(timestampMillis(report.createdAt)).toLocaleString(
          locale === "ne" ? "ne-NP" : "en-NP",
          { timeZone: "Asia/Kathmandu" },
        )}
      </p>
      <p className="whitespace-pre-line text-sm text-ink-700">
        {report.details}
      </p>
      <p className="break-all text-xs text-ink-500">
        Reporter ID: {report.reporterId}
      </p>
      {report.decisionReason && (
        <p className="whitespace-pre-line border-l-2 border-royal-200 pl-3 text-sm text-ink-600">
          {t("Previous decision", "पहिलेको निर्णय")}: {report.decisionReason}
        </p>
      )}
      {open && (
        <>
          <Field
            label={t("Decision note (required)", "निर्णय टिप्पणी (आवश्यक)")}
            htmlFor={`report-note-${report.id}`}
          >
            <Textarea
              id={`report-note-${report.id}`}
              value={note}
              maxLength={1000}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {report.status === "open" && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void decide("review")}
              >
                {t("Start review", "समीक्षा सुरु गर्नुहोस्")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="approve"
              disabled={busy}
              onClick={() => void decide("resolve")}
            >
              {t("Resolve", "समाधान गर्नुहोस्")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void decide("dismiss")}
            >
              {t("Dismiss", "खारेज गर्नुहोस्")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void decide("pause")}
            >
              {t(
                "Pause rental & resolve",
                "विज्ञापन रोक्नुहोस् र समाधान गर्नुहोस्",
              )}
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-clay-700">
          {error}
        </p>
      )}
    </Surface>
  );
}
