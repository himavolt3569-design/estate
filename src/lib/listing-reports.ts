import { z } from "zod";

export const reportReasons = {
  fraud: ["Possible fraud", "सम्भावित ठगी"],
  duplicate: ["Duplicate listing", "दोहोरिएको विज्ञापन"],
  wrong_location: ["Wrong location", "गलत स्थान"],
  unavailable: ["Already rented or unavailable", "भाडामा गइसकेको वा अनुपलब्ध"],
  misleading_price: ["Misleading price or details", "भ्रामक मूल्य वा विवरण"],
  stolen_photos: [
    "Photos used without permission",
    "अनुमतिबिना प्रयोग गरिएका फोटो",
  ],
  not_owner: ["Lister has no right to post", "विज्ञापन राख्ने अधिकार नभएको"],
  offensive: ["Offensive content or spam", "आपत्तिजनक सामग्री वा स्प्याम"],
  other: ["Something else", "अन्य कारण"],
} as const;
export type ReportReason = keyof typeof reportReasons;
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export const reportStatuses: Record<ReportStatus, readonly [string, string]> = {
  open: ["Open", "खुला"],
  reviewing: ["Under review", "समीक्षामा"],
  resolved: ["Resolved", "समाधान भएको"],
  dismissed: ["Dismissed", "खारेज भएको"],
};
export const reportSchema = z.object({
  reason: z.enum(
    Object.keys(reportReasons) as [ReportReason, ...ReportReason[]],
  ),
  details: z
    .string()
    .trim()
    .min(10, "Describe the issue in at least 10 characters.")
    .max(1000),
});
export const decisionSchema = z
  .string()
  .trim()
  .min(5, "Add a decision note of at least 5 characters.")
  .max(1000);
export function canDecideReport(current: ReportStatus, next: ReportStatus) {
  return (
    (current === "open" || current === "reviewing") &&
    next !== "open" &&
    current !== next
  );
}
