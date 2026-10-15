import { describe, expect, it } from 'vitest';
import { listingContact, validContactNumber, whatsAppNumber } from './contact';
import type { Listing } from './firebase/types';

const base = { id: 'listing', ownerId: 'owner', ownerName: 'Owner', title: 'Rental', roomType: 'room', rentPerMonth: 10000, status: 'active' } as Listing;

describe('public listing contact', () => {
  it('keeps old shared contact visible until a method is explicitly changed', () => {
    expect(listingContact({ ...base, publicContactNumber: '9812345678' })).toEqual({ call: '9812345678', whatsapp: '9812345678' });
    expect(listingContact({ ...base, publicContactNumber: '9812345678', publicCallNumber: '', publicWhatsAppNumber: '9800000000' })).toEqual({ call: '', whatsapp: '9800000000' });
  });

  it('normalizes Nepali mobile numbers for WhatsApp and rejects bad input', () => {
    expect(whatsAppNumber('98 1234 5678')).toBe('9779812345678');
    expect(whatsAppNumber('+977-9812345678')).toBe('9779812345678');
    expect(validContactNumber('9812345678')).toBe(true);
    expect(validContactNumber('abc')).toBe(false);
  });
});
