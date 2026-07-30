/**
 * The brand, in one place.
 *
 * "Kitta" (कित्ता) is the plot number printed on every lalpurja: the registered
 * identity of a specific piece of land. It is the word Nepali land records
 * already use, which makes it the natural name for a product whose whole claim
 * is that the paperwork is open, and it sits directly on the parcel geometry
 * the interface is built from.
 *
 * Everything user-facing reads from here, so changing the name is one edit
 * rather than a search across forty files.
 */
export const BRAND = {
  /** Latin wordmark. */
  name: 'Kitta',
  /** Devanagari wordmark, shown beside the Latin one. */
  nameNe: 'कित्ता',
  /** Lowercase, safe for cookies, storage keys and package names. */
  slug: 'kitta',
} as const;
