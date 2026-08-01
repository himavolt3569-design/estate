import { z } from 'zod';

/**
 * The listing form's contract.
 *
 * Every rule here exists because the database has the same rule. The old form
 * had none of them: a 20-character description or a "residential warehouse"
 * reached Postgres, hit a CHECK constraint, and came back to the seller as a
 * blank page reading "Internal Error". Validating the same things in the same
 * words on the way in is what turns that into a sentence next to the field.
 */

export const CATEGORIES = ['residential', 'commercial', 'land'] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Mirrors properties_subtype_matches_category in 0004. A subtype that does not
 * belong to its category is rejected by the database, so the form must never be
 * able to produce that pair — hence one source of truth, used to build the
 * options and to validate them.
 */
export const SUBTYPES_BY_CATEGORY = {
  residential: ['house', 'apartment', 'villa', 'condo', 'townhouse', 'studio'],
  land: ['residential_land', 'agricultural_land', 'commercial_land'],
  commercial: ['office', 'shop', 'warehouse', 'factory'],
} as const satisfies Record<Category, readonly string[]>;

export const ALL_SUBTYPES = [
  ...SUBTYPES_BY_CATEGORY.residential,
  ...SUBTYPES_BY_CATEGORY.land,
  ...SUBTYPES_BY_CATEGORY.commercial,
] as const;

export type Subtype = (typeof ALL_SUBTYPES)[number];

export const TRANSACTION_TYPES = ['sale', 'rent', 'lease', 'short_stay'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PRICE_PERIODS = ['month', 'year', 'night'] as const;

export const AREA_UNITS = ['ropani', 'aana', 'bigha', 'kattha', 'dhur', 'sqft', 'sqm'] as const;

/** Rooms only make sense on something with rooms. */
export function hasRooms(category: Category): boolean {
  return category !== 'land';
}

/** Land is the only thing where road access is the headline attribute. */
export function isLand(category: Category): boolean {
  return category === 'land';
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

export const basicsSchema = z
  .object({
    category: z.enum(CATEGORIES),
    subtype: z.enum(ALL_SUBTYPES),
    transactionType: z.enum(TRANSACTION_TYPES),
    /** Rupees as typed by the seller. Converted to paisa on the server. */
    price: z
      .number({ message: 'Enter the price' })
      .int('Enter a whole number of rupees')
      .min(1, 'Enter the price')
      .max(10_000_000_000, 'That price looks too large. Check the number.'),
    pricePeriod: z.enum(PRICE_PERIODS).nullable().optional(),
    priceNegotiable: z.boolean().default(false),
  })
  .refine((value) => (SUBTYPES_BY_CATEGORY[value.category] as readonly string[]).includes(value.subtype), {
    message: 'Choose a type that matches what you are listing',
    path: ['subtype'],
  })
  .refine((value) => value.transactionType === 'sale' || value.pricePeriod != null, {
    // properties_price_period_consistency: a rental must state its period.
    message: 'Say whether that price is per month, per year or per night',
    path: ['pricePeriod'],
  })
  .refine((value) => value.transactionType !== 'sale' || value.pricePeriod == null, {
    message: 'A sale price has no period',
    path: ['pricePeriod'],
  });

export const placeSchema = z.object({
  locationId: z.string().uuid('Choose the district'),
  addressLine: z
    .string()
    .trim()
    .max(300, 'Keep the address under 300 characters')
    .optional()
    .or(z.literal('')),
  lat: z.number().min(26).max(31, 'That point is outside Nepal'),
  lng: z.number().min(80).max(89, 'That point is outside Nepal'),
  /** Sellers of an occupied home may publish an approximate point. */
  geomPrecision: z.enum(['exact', 'approximate']).default('exact'),
});

export const storySchema = z.object({
  // char_length(trim(title)) between 10 and 140
  title: z
    .string()
    .trim()
    .min(10, 'Give the listing a name of at least 10 characters')
    .max(140, 'Keep the name under 140 characters'),
  // char_length(trim(description)) between 50 and 5000
  description: z
    .string()
    .trim()
    .min(50, 'Write at least 50 characters so buyers know what they are looking at')
    .max(5000, 'Keep the description under 5000 characters'),
});

export const detailsSchema = z.object({
  areaValue: z
    .number()
    .positive('Enter a size greater than zero')
    .max(1_000_000, 'That size looks too large')
    .nullable()
    .optional(),
  areaUnit: z.enum(AREA_UNITS).default('ropani'),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(),
  bathrooms: z.number().int().min(0).max(100).nullable().optional(),
  floors: z.number().int().min(0).max(200).nullable().optional(),
  parking: z.number().int().min(0).max(100).nullable().optional(),
  roadAccessFt: z.number().int().min(0).max(500).nullable().optional(),
  featureIds: z.array(z.string().uuid()).default([]),
  showPhone: z.boolean().default(true),
  showEmail: z.boolean().default(false),
  showWhatsapp: z.boolean().default(true),
});

/** Everything the create action accepts. */
export const createListingSchema = z.object({
  ...basicsSchema.shape,
  ...placeSchema.shape,
  ...storySchema.shape,
  ...detailsSchema.shape,
  /**
   * Master admin only. Lets the platform owner post on behalf of a seller who
   * called the office rather than using the site, which is most of them.
   */
  ownerId: z.string().uuid().nullable().optional(),
});

export type CreateListingInput = z.input<typeof createListingSchema>;
export type CreateListingValues = z.output<typeof createListingSchema>;

export const updateListingSchema = createListingSchema.extend({
  id: z.string().uuid(),
});

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */
/*
 * Plain words, not database words. A seller picking what to list should read
 * "Shop or showroom", never "commercial / shop".
 */

export const CATEGORY_LABELS: Record<Category, { en: string; ne: string; hint: string }> = {
  residential: { en: 'A place to live', ne: 'बस्ने ठाउँ', hint: 'House, flat, apartment' },
  land: { en: 'Land', ne: 'जग्गा', hint: 'Plot, field, ghaderi' },
  commercial: { en: 'A place for business', ne: 'व्यवसायको ठाउँ', hint: 'Shop, office, godown' },
};

export const SUBTYPE_LABELS: Record<Subtype, { en: string; ne: string }> = {
  house: { en: 'House', ne: 'घर' },
  apartment: { en: 'Apartment', ne: 'अपार्टमेन्ट' },
  villa: { en: 'Villa', ne: 'भिल्ला' },
  condo: { en: 'Condo', ne: 'कन्डो' },
  townhouse: { en: 'Townhouse', ne: 'टाउनहाउस' },
  studio: { en: 'Studio flat', ne: 'स्टुडियो फ्ल्याट' },
  residential_land: { en: 'Land to build on', ne: 'घडेरी' },
  agricultural_land: { en: 'Farm land', ne: 'खेतीयोग्य जग्गा' },
  commercial_land: { en: 'Land for business', ne: 'व्यापारिक जग्गा' },
  office: { en: 'Office', ne: 'कार्यालय' },
  shop: { en: 'Shop or showroom', ne: 'पसल' },
  warehouse: { en: 'Godown or warehouse', ne: 'गोदाम' },
  factory: { en: 'Factory', ne: 'कारखाना' },
};

export const TRANSACTION_LABELS: Record<TransactionType, { en: string; ne: string; hint: string }> = {
  sale: { en: 'Selling', ne: 'बेच्ने', hint: 'One price, one owner change' },
  rent: { en: 'Renting out', ne: 'भाडामा दिने', hint: 'A monthly rent' },
  lease: { en: 'Leasing', ne: 'लिजमा दिने', hint: 'A long agreement, usually for business' },
  short_stay: { en: 'Short stay', ne: 'छोटो बसाइ', hint: 'Homestay, by the night' },
};

export const PERIOD_LABELS: Record<(typeof PRICE_PERIODS)[number], string> = {
  month: 'per month',
  year: 'per year',
  night: 'per night',
};

export const AREA_UNIT_LABELS: Record<(typeof AREA_UNITS)[number], string> = {
  ropani: 'Ropani',
  aana: 'Aana',
  bigha: 'Bigha',
  kattha: 'Kattha',
  dhur: 'Dhur',
  sqft: 'Square feet',
  sqm: 'Square metres',
};

/** The five images the database insists on before a listing may go for review. */
export const MIN_IMAGES = 5;
