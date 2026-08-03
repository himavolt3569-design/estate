/**
 * The contact-number draft shape, shared by the form and the pages that seed it.
 *
 * This lives in a plain module rather than beside the component on purpose.
 * ContactNumbersField is a `'use client'` file, and Next replaces every export
 * of a client module with a client reference. Importing a *component* from one
 * into a Server Component is fine; **calling a plain function** from one during
 * a server render is not — it throws, and the visitor gets "A server error
 * occurred" with nothing but a digest to go on.
 *
 * That is exactly what the listing edit page did: it called emptyContactNumber()
 * to seed an empty row, so every listing with no saved numbers crashed the page.
 */

export type ContactNumberDraft = {
  /** What the seller typed. Normalised to E.164 on save, never before. */
  phone: string;
  label: string;
  isWhatsapp: boolean;
};

export const MAX_CONTACT_NUMBERS = 3;

export function emptyContactNumber(): ContactNumberDraft {
  return { phone: '', label: '', isWhatsapp: false };
}
