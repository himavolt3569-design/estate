/**
 * Nepali phone numbers, normalised to E.164.
 *
 * Sellers type a number in whatever shape they think in: 9840838944,
 * 984-083-8944, 0984 083 8944, +977 9840838944. All four are the same number and
 * all four have to end up as +9779840838944, or the same person appears twice
 * and a WhatsApp link built from the raw text does not resolve.
 *
 * Two shapes are valid, and the distinction matters because only one of them can
 * be on WhatsApp:
 *
 *   Mobile    10 digits beginning 96, 97 or 98 (NTC, Ncell, Smart Cell).
 *   Landline  8 digits: a 1-2 digit area code then the subscriber number.
 *             Kathmandu is 1, so 01-4XXXXXX is 14XXXXXX nationally.
 */

export const NEPAL_DIAL_CODE = '+977';

export type PhoneKind = 'mobile' | 'landline';

export type ParsedPhone =
  | { ok: true; e164: string; national: string; kind: PhoneKind }
  | { ok: false; error: string };

/** Everything that is not a digit, gone. Users paste brackets, dots and dashes. */
function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Reduces any accepted form to the national significant number: no country
 * code, no trunk zero.
 */
function toNational(input: string): string {
  let digits = digitsOnly(input);

  // +977 / 00977 / 977 prefix.
  if (digits.startsWith('00977')) digits = digits.slice(5);
  else if (digits.startsWith('977') && digits.length > 10) digits = digits.slice(3);

  // Trunk zero, as written on a landline: 01-4XXXXXX.
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');

  return digits;
}

export function parseNepaliPhone(input: string): ParsedPhone {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, error: 'Enter a phone number' };

  if (/[a-z]/i.test(raw)) {
    return { ok: false, error: 'A phone number cannot contain letters' };
  }

  const national = toNational(raw);

  if (national.length === 0) return { ok: false, error: 'Enter a phone number' };

  if (national.startsWith('9')) {
    if (national.length !== 10) {
      return {
        ok: false,
        error: `A mobile number has 10 digits. You entered ${national.length}.`,
      };
    }
    if (!/^9[678]/.test(national)) {
      return { ok: false, error: 'A Nepali mobile number starts 96, 97 or 98' };
    }
    return { ok: true, e164: `${NEPAL_DIAL_CODE}${national}`, national, kind: 'mobile' };
  }

  // Landline. 8 digits nationally once the trunk zero is off.
  if (national.length < 7 || national.length > 9) {
    return { ok: false, error: 'That is not a Nepali phone number' };
  }

  return { ok: true, e164: `${NEPAL_DIAL_CODE}${national}`, national, kind: 'landline' };
}

/** Grouped for reading: +977 984-083-8944. */
export function formatNepaliPhone(e164: string): string {
  const national = toNational(e164);

  if (national.length === 10) {
    return `${NEPAL_DIAL_CODE} ${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  }
  if (national.length === 8) {
    return `${NEPAL_DIAL_CODE} ${national.slice(0, 1)}-${national.slice(1)}`;
  }
  return `${NEPAL_DIAL_CODE} ${national}`;
}

/**
 * wa.me takes digits only, with the country code and no plus. Anything else
 * silently opens WhatsApp on a blank chat, which reads to the user as "the
 * button is broken".
 */
export function whatsappLink(e164: string, message?: string): string {
  const digits = digitsOnly(e164);
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(e164: string): string {
  return `tel:${e164}`;
}
