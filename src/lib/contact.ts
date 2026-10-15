import type { Listing } from './firebase/types';

export function cleanContactNumber(value: string) {
  return value.trim();
}

export function validContactNumber(value: string) {
  return !value || /^\+?[0-9][0-9\s-]{6,17}$/.test(value);
}

export function listingContact(listing: Listing) {
  // Older web listings used one number for both methods.
  const legacy = listing.publicContactNumber || '';
  return {
    call: listing.publicCallNumber === undefined ? legacy : listing.publicCallNumber,
    whatsapp: listing.publicWhatsAppNumber === undefined ? legacy : listing.publicWhatsAppNumber,
  };
}

export function whatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('977')) return digits;
  if (digits.startsWith('0')) return `977${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `977${digits}`;
  return digits;
}
