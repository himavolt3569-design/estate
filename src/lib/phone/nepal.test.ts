import { describe, expect, it } from 'vitest';

import { formatNepaliPhone, parseNepaliPhone, telLink, whatsappLink } from './nepal';

describe('parseNepaliPhone', () => {
  it('accepts the four shapes a seller actually types', () => {
    // All the same number. If any of these stored differently, the same person
    // would appear twice and a WhatsApp link built from the raw text would not
    // resolve.
    for (const input of ['9840838944', '984-083-8944', '0984 083 8944', '+977 9840838944']) {
      const result = parseNepaliPhone(input);
      expect(result.ok, input).toBe(true);
      if (result.ok) expect(result.e164, input).toBe('+9779840838944');
    }
  });

  it('handles the 00977 and 977 country prefixes', () => {
    expect(parseNepaliPhone('009779840838944')).toMatchObject({ e164: '+9779840838944' });
    expect(parseNepaliPhone('9779840838944')).toMatchObject({ e164: '+9779840838944' });
  });

  it('classifies mobiles and landlines', () => {
    expect(parseNepaliPhone('9840838944')).toMatchObject({ kind: 'mobile' });
    expect(parseNepaliPhone('9741234567')).toMatchObject({ kind: 'mobile' });
    expect(parseNepaliPhone('9612345678')).toMatchObject({ kind: 'mobile' });
    // Kathmandu landline, written 01-4XXXXXX.
    expect(parseNepaliPhone('014123456')).toMatchObject({ kind: 'landline' });
    expect(parseNepaliPhone('01-4123456')).toMatchObject({ kind: 'landline' });
  });

  it('rejects letters outright', () => {
    const result = parseNepaliPhone('98408CALL');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/letters/i);
  });

  it('rejects a mobile of the wrong length and says which way', () => {
    const short = parseNepaliPhone('984083894');
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toMatch(/10 digits/);

    expect(parseNepaliPhone('98408389440').ok).toBe(false);
  });

  it('rejects a mobile prefix that is not issued in Nepal', () => {
    const result = parseNepaliPhone('9912345678');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/96, 97 or 98/);
  });

  it('rejects empty and nonsense input', () => {
    expect(parseNepaliPhone('').ok).toBe(false);
    expect(parseNepaliPhone('   ').ok).toBe(false);
    expect(parseNepaliPhone('12').ok).toBe(false);
  });
});

describe('link builders', () => {
  it('builds a wa.me link with digits only', () => {
    // wa.me silently opens a blank chat if the plus is left in, which reads to
    // the user as a broken button rather than as a malformed number.
    expect(whatsappLink('+9779840838944')).toBe('https://wa.me/9779840838944');
  });

  it('encodes a prefilled message', () => {
    expect(whatsappLink('+9779840838944', 'Hello there')).toBe(
      'https://wa.me/9779840838944?text=Hello%20there',
    );
  });

  it('keeps the plus for tel:, which needs it for international dialling', () => {
    expect(telLink('+9779840838944')).toBe('tel:+9779840838944');
  });
});

describe('formatNepaliPhone', () => {
  it('groups a mobile for reading', () => {
    expect(formatNepaliPhone('+9779840838944')).toBe('+977 984-083-8944');
  });

  it('groups a landline by area code', () => {
    expect(formatNepaliPhone('+97714123456')).toBe('+977 1-4123456');
  });
});
