import { describe, expect, it } from "vitest";
import {
  DETAIL_TEMPLATES,
  generateListingDetails,
  PROPERTY_TYPES,
  TEMPLATES_PER_TYPE,
  type ListingDetailsDraft,
} from "./listing-details";
import { FACILITY_GROUPS } from "./listing-facilities";

const draft: ListingDetailsDraft = {
  type: "flat",
  rent: "25000",
  deposit: "50000",
  floor: "2",
  totalFloors: "4",
  furnishing: "semiFurnished",
  address: "Lainchaur, Kathmandu",
  nearbyLandmarks: "CIWEC Hospital",
  facilities: ["Water", "WiFi"],
  availableFrom: "2026-11-01",
};

describe("suggested listing details", () => {
  it("provides 84 distinct templates, with 12 usable descriptions for every property type", () => {
    expect(DETAIL_TEMPLATES).toHaveLength(84);
    expect(new Set(DETAIL_TEMPLATES.map((template) => template.id)).size).toBe(
      84,
    );
    expect(new Set(DETAIL_TEMPLATES.map((template) => template.en)).size).toBe(
      84,
    );
    for (const locale of ["en", "ne"] as const) {
      const descriptions = PROPERTY_TYPES.flatMap((type) =>
        Array.from(
          { length: TEMPLATES_PER_TYPE },
          (_, index) =>
            generateListingDetails({ ...draft, type }, index, locale)
              .description,
        ),
      );
      expect(new Set(descriptions).size).toBe(84);
      expect(
        descriptions.every(
          (text) => !/\{type\}|\{location\}|undefined|NaN/.test(text),
        ),
      ).toBe(true);
    }
  });

  it("uses both property and location information, including selected facilities", () => {
    const result = generateListingDetails(draft);
    expect(result.title).toBe("Flat for rent in Lainchaur, Kathmandu");
    for (const fact of [
      "flat",
      "Lainchaur, Kathmandu",
      "CIWEC Hospital",
      "25,000",
      "50,000",
      "Floor: 2",
      "Total floors: 4",
      "Semi furnished",
      "Water, WiFi",
      "2026-11-01",
    ])
      expect(result.description).toContain(fact);
    expect(
      generateListingDetails({
        ...draft,
        rent: "30000",
        nearbyLandmarks: "School",
        facilities: ["Parking"],
      }).description,
    ).toContain("30,000");
    expect(
      generateListingDetails({ ...draft, facilities: [] }).description,
    ).not.toContain("Facilities:");
    expect(generateListingDetails(draft, 0)).toEqual(result);
    expect(generateListingDetails(draft, 1).description).not.toBe(
      result.description,
    );
  });

  it("avoids invented facts and invalid numbers when details are incomplete", () => {
    const description = generateListingDetails({
      ...draft,
      address: "",
      nearbyLandmarks: "",
      rent: "NaN",
      deposit: "",
      floor: "",
      totalFloors: "",
      furnishing: "",
      facilities: [],
      availableFrom: "",
    }).description;
    expect(description).not.toMatch(
      /NaN|undefined|Rs\.|Floor:|Furnishing:|Facilities:|Available from:|Nearby landmark:|sunny|spacious|immediate|water supply/i,
    );
    expect(
      generateListingDetails({ ...draft, deposit: "0", floor: "0" })
        .description,
    ).toContain("Deposit: Rs. 0.");
    expect(
      generateListingDetails({ ...draft, floor: "0" }).description,
    ).toContain("Ground floor");
  });

  it("omits irrelevant building facts for land and localizes generated text", () => {
    expect(
      generateListingDetails({ ...draft, type: "land" }).description,
    ).not.toMatch(/Floor|Furnishing/);
    const nepali = generateListingDetails(draft, 0, "ne");
    expect(nepali.title).toContain("फ्ल्याट");
    expect(nepali.description).toContain("सुविधाहरू: पानी, वाइफाइ");
    expect(generateListingDetails(draft, TEMPLATES_PER_TYPE)).toEqual(
      generateListingDetails(draft, 0),
    );
  });

  it("keeps all established Android facilities available without duplicate checkbox values", () => {
    const values = FACILITY_GROUPS.flatMap((group) =>
      group.options.map((option) => option.value),
    );
    expect(new Set(values).size).toBe(values.length);
    for (const value of [
      "WiFi",
      "Parking",
      "Water",
      "Electricity",
      "Kitchen",
      "Laundry",
      "Security",
      "Lift",
      "CCTV",
      "Generator",
    ])
      expect(values).toContain(value);
  });
});
