import { facilityLabel } from "./listing-facilities";

export const PROPERTY_TYPES = [
  "room",
  "flat",
  "apartment",
  "house",
  "office",
  "shop",
  "land",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_LABELS: Record<PropertyType, { en: string; ne: string }> =
  {
    room: { en: "Room", ne: "कोठा" },
    flat: { en: "Flat", ne: "फ्ल्याट" },
    apartment: { en: "Apartment", ne: "अपार्टमेन्ट" },
    house: { en: "House", ne: "घर" },
    office: { en: "Office", ne: "कार्यालय" },
    shop: { en: "Shop", ne: "पसल" },
    land: { en: "Land", ne: "जग्गा" },
  };

export type ListingDetailsDraft = {
  type: PropertyType;
  rent: string;
  deposit: string;
  floor: string;
  totalFloors: string;
  furnishing: string;
  availableFrom: string;
  address: string;
  nearbyLandmarks: string;
  facilities: string[];
};

// Twelve distinct writing templates for each of the seven property types: 84.
// Templates describe the offer without inventing amenities, quality or distances.
const NE_OPENINGS = [
  "{location}मा {type} भाडामा उपलब्ध छ।",
  "{location}मा {type} भाडामा लिनुहोस्। विवरण तल दिइएको छ।",
  "{location}मा भाडामा उपलब्ध यस {type}को विवरण हेर्नुहोस्।",
  "{location}मा {type} भाडाका लागि सूचीकृत छ।",
  "{location}मा {type} खोज्दै हुनुहुन्छ? यस भाडाको विवरण हेर्नुहोस्।",
  "{location}मा रहेको यो {type} भाडामा दिइन्छ।",
  "भाडाको विज्ञापन: {location}मा {type}।",
  "{location}मा यस {type}को भाडासम्बन्धी जानकारी लिनुहोस्।",
  "{location}मा {type} भाडामा उपलब्ध छ। थप विवरण तल छ।",
  "{location}मा भाडामा दिइएको {type}को विवरण हेर्नुहोस्।",
  "{location}मा अर्को भाडाका लागि यस {type}को विवरण हेर्नुहोस्।",
  "{location}मा भाडाका लागि नयाँ विज्ञापन: {type}।",
] as const;

// Each type has its own twelve openings, rather than a single generic sentence
// multiplied by property labels. All factual details are added from the draft.
const OPENINGS: Record<PropertyType, readonly string[]> = {
  room: [
    "A room is available for rent{location}.",
    "Looking for a room{location}? Review this rental and its listed facilities.",
    "Room rental{location}. The rent and property information are listed below.",
    "This room is offered for rent{location}. See the details before arranging a visit.",
    "Explore a room for rent{location}, with the rental terms outlined below.",
    "Find out about this room rental{location}.",
    "A room{location} has been listed for rent. Here is the information from the lister.",
    "Consider this room for your next rental{location}.",
    "View the rent, location and facilities for this room{location}.",
    "Now listed{location}: a room available to rent.",
    "Interested in renting a room{location}? The listing details follow.",
    "Room for rent{location}. Review the information and contact the lister with questions.",
  ],
  flat: [
    "A flat is available for rent{location}. Review the property details below.",
    "Looking for a flat{location}? This rental is listed with its terms and facilities.",
    "Flat rental{location}. See the rent and building information below.",
    "This flat{location} is offered for rent. Here is what the lister has provided.",
    "Explore this flat for rent{location} and review the listed facilities.",
    "Find out about renting this flat{location}.",
    "A flat{location} has been listed for rent. Review the information before a visit.",
    "Consider this flat rental{location}. The property information follows.",
    "View the rental terms and location for this flat{location}.",
    "Now available to rent{location}: a flat with the details listed below.",
    "Interested in a flat{location}? Review this rental offer.",
    "Flat for rent{location}. Check the details and get in touch to arrange a viewing.",
  ],
  apartment: [
    "An apartment is offered for rent{location}. See its rental details below.",
    "Looking for an apartment{location}? Review this listing.",
    "Apartment rental{location}. The terms and listed facilities follow.",
    "This apartment{location} is available to rent. Review the property information.",
    "Explore this apartment rental{location}, including the details supplied by the lister.",
    "Find out about the apartment offered for rent{location}.",
    "An apartment{location} has been listed for rent. See the rental information below.",
    "Consider this apartment for your next rental{location}.",
    "View the rent, building details and location for this apartment{location}.",
    "Now listed for rent{location}: an apartment. The details follow.",
    "Interested in renting an apartment{location}? Check this rental offer.",
    "Apartment for rent{location}. Review the listing before arranging a viewing.",
  ],
  house: [
    "A house is available for rent{location}. See the rental information below.",
    "Looking for a house to rent{location}? Review this property.",
    "House rental{location}. The terms and property details follow.",
    "This house{location} is offered for rent, with the details supplied below.",
    "Explore this house for rent{location} and its listed facilities.",
    "Find out about renting this house{location}.",
    "A house{location} has been listed for rent. Review the property information.",
    "Consider this house rental{location}. Check the details before a viewing.",
    "View the rent and building information for this house{location}.",
    "Now offered for rent{location}: a house. The rental details follow.",
    "Interested in a rental house{location}? See this listing.",
    "House for rent{location}. Review the details and contact the lister for a visit.",
  ],
  office: [
    "Office space is available for rent{location}. Review the terms and listed facilities.",
    "Looking for an office{location}? See this workspace rental.",
    "Office rental{location}. The rental terms and building details follow.",
    "This office{location} is offered for rent. Review the information before a visit.",
    "Explore an office for rent{location}, with the property details outlined below.",
    "Find out about renting this office space{location}.",
    "An office{location} has been listed for rent. See the terms supplied by the lister.",
    "Consider this office for your workspace rental{location}.",
    "View the rental cost, location and facilities for this office{location}.",
    "Now listed{location}: office space offered for rent.",
    "Interested in an office rental{location}? Review the following details.",
    "Office for rent{location}. Check whether the listed space meets your business requirements.",
  ],
  shop: [
    "A shop is offered for rent{location}. See the details for this business space.",
    "Looking for a shop{location}? Review this commercial rental.",
    "Shop rental{location}. The terms and property information are listed below.",
    "This shop{location} is available to rent. Review the details before arranging a visit.",
    "Explore this shop for rent{location} and its listed facilities.",
    "Find out about renting this shop space{location}.",
    "A shop{location} has been listed for rent. See the information from the lister.",
    "Consider this shop rental{location} for your business requirements.",
    "View the rent, location and property information for this shop{location}.",
    "Now listed for rent{location}: a shop. The rental details follow.",
    "Interested in renting a shop{location}? Check the details below.",
    "Shop for rent{location}. Review the listing and contact the lister to discuss the space.",
  ],
  land: [
    "Land is available for rent{location}. Review the rental and location details below.",
    "Looking for land to rent{location}? See this listing.",
    "Land rental{location}. The rental terms supplied by the lister follow.",
    "This land{location} is offered for rent. Review the details before arranging a site visit.",
    "Explore land for rent{location}, with the available information outlined below.",
    "Find out about this land rental{location}.",
    "Land{location} has been listed for rent. See the rental information provided.",
    "Consider this land rental{location}. Contact the lister to discuss your intended use.",
    "View the rent, location and listed facilities for this land{location}.",
    "Now offered for rent{location}: land with the rental details listed below.",
    "Interested in renting land{location}? Review this property listing.",
    "Land for rent{location}. Check the details and contact the lister to arrange a site visit.",
  ],
};

export const DETAIL_TEMPLATES = PROPERTY_TYPES.flatMap((type) =>
  NE_OPENINGS.map((ne, index) => ({
    id: `${type}-${index + 1}`,
    type,
    en: OPENINGS[type][index]!,
    ne,
  })),
);
export const TEMPLATES_PER_TYPE = NE_OPENINGS.length;

function money(value: string) {
  return value.trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0
    ? new Intl.NumberFormat("en-IN").format(Number(value))
    : "";
}

export function generateListingDetails(
  draft: ListingDetailsDraft,
  templateIndex = 0,
  locale: "en" | "ne" = "en",
) {
  const ne = locale === "ne";
  const label = PROPERTY_LABELS[draft.type][locale];
  const address = draft.address.trim();
  const landmark = draft.nearbyLandmarks.trim();
  const location = address
    ? ne
      ? address
      : ` in ${address}`
    : ne
      ? "यस स्थान"
      : "";
  const index =
    ((Math.trunc(templateIndex) % TEMPLATES_PER_TYPE) + TEMPLATES_PER_TYPE) %
    TEMPLATES_PER_TYPE;
  const template = DETAIL_TEMPLATES.find(
    (template) =>
      template.type === draft.type &&
      template.id === `${draft.type}-${index + 1}`,
  )!;
  const opening = template[locale]
    .replace("{type}", ne ? label : label.toLowerCase())
    .replace("{location}", location);
  const facts: string[] = [];
  const rent = money(draft.rent);
  const deposit = money(draft.deposit);
  if (landmark)
    facts.push(
      ne ? `नजिकको चिनारी: ${landmark}।` : `Nearby landmark: ${landmark}.`,
    );
  if (rent && Number(draft.rent) > 0)
    facts.push(ne ? `मासिक भाडा: रु. ${rent}।` : `Monthly rent: Rs. ${rent}.`);
  if (deposit)
    facts.push(ne ? `धरौटी: रु. ${deposit}।` : `Deposit: Rs. ${deposit}.`);
  if (draft.type !== "land") {
    if (draft.floor.trim() !== "" && Number.isFinite(Number(draft.floor))) {
      facts.push(
        ne
          ? `तला: ${Number(draft.floor) === 0 ? "भुइँतला" : draft.floor}।`
          : `Floor: ${Number(draft.floor) === 0 ? "Ground floor" : draft.floor}.`,
      );
    }
    if (
      Number(draft.totalFloors) > 0 &&
      Number.isFinite(Number(draft.totalFloors))
    )
      facts.push(
        ne
          ? `जम्मा तला: ${draft.totalFloors}।`
          : `Total floors: ${draft.totalFloors}.`,
      );
    const furnishing: Record<string, [string, string]> = {
      unfurnished: ["Unfurnished", "फर्निसिङ नभएको"],
      semiFurnished: ["Semi furnished", "आंशिक फर्निसिङ"],
      furnished: ["Furnished", "फर्निसिङ भएको"],
    };
    const furnished = furnishing[draft.furnishing];
    if (furnished)
      facts.push(
        `${ne ? "फर्निसिङ" : "Furnishing"}: ${furnished[ne ? 1 : 0]}${ne ? "।" : "."}`,
      );
  }
  if (draft.facilities.length)
    facts.push(
      `${ne ? "सुविधाहरू" : "Facilities"}: ${draft.facilities.map((value) => facilityLabel(value, locale)).join(", ")}${ne ? "।" : "."}`,
    );
  // Treat date-only values as date-only, independent of the browser's time zone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(draft.availableFrom))
    facts.push(
      ne
        ? `उपलब्ध हुने मिति: ${draft.availableFrom}।`
        : `Available from: ${draft.availableFrom}.`,
    );
  const titleLocation = address.split(",").slice(0, 3).join(",").trim();
  const title = ne
    ? `${label} भाडामा${titleLocation ? ` — ${titleLocation}` : ""}`
    : `${label} for rent${titleLocation ? ` in ${titleLocation}` : landmark ? ` near ${landmark}` : ""}`;
  return {
    title,
    description: [
      opening,
      facts.join("\n"),
      ne
        ? "थप जानकारी र हेर्ने समय मिलाउन सम्पर्क गर्नुहोस्।"
        : "Contact the lister for more information or to arrange a viewing.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    templateId: template.id,
  };
}
