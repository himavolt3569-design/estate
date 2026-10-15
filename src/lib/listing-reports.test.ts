import { describe, expect, it } from "vitest";
import {
  canDecideReport,
  decisionSchema,
  reportSchema,
} from "./listing-reports";

describe("listing reports", () => {
  it("requires a recognized reason and a useful description", () => {
    expect(
      reportSchema.safeParse({
        reason: "fraud",
        details: "  Photos belong to a different property.  ",
      }).data?.details,
    ).toBe("Photos belong to a different property.");
    expect(
      reportSchema.safeParse({
        reason: "invented",
        details: "A description of the issue",
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({ reason: "fraud", details: "        " }).success,
    ).toBe(false);
    expect(decisionSchema.safeParse("  ").success).toBe(false);
  });
  it("permits review and closure without silently reopening or overwriting decisions", () => {
    expect(canDecideReport("open", "reviewing")).toBe(true);
    expect(canDecideReport("reviewing", "resolved")).toBe(true);
    expect(canDecideReport("open", "dismissed")).toBe(true);
    expect(canDecideReport("resolved", "reviewing")).toBe(false);
    expect(canDecideReport("dismissed", "resolved")).toBe(false);
    expect(canDecideReport("reviewing", "reviewing")).toBe(false);
  });
});
