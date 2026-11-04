import type { Listing } from './firebase/types';

export type PublicLister = {
  id: string;
  name: string;
  photoUrl?: string;
  location?: string;
  bio?: string;
  publicPhone?: string;
  whatsappNumber?: string;
  hideDisplayName: boolean;
  verifiedAgent: boolean;
};

// The ID comes from the listing/document path, never a display field inside it.
export function listingListerId(listing?: Pick<Listing, 'agentId' | 'ownerId' | 'contactIsAnonymous'> | null) {
  if (!listing || listing.contactIsAnonymous) return null;
  return listing.agentId?.trim() || listing.ownerId?.trim() || null;
}

export function publicListerRecord(id: string, value: Record<string, unknown>, verifiedAgent = false): PublicLister {
  const text = (key: string) => typeof value[key] === 'string' ? value[key].trim() : '';
  // Only explicitly shared display/contact information may leave this mapper.
  return {
    id, name: text('name'), photoUrl: text('photoUrl'), location: text('location'),
    bio: text('bio'), publicPhone: text('publicPhone'), whatsappNumber: text('whatsappNumber'),
    hideDisplayName: value.hideDisplayName === true, verifiedAgent,
  };
}

export function listingsForPerson(listings: Listing[], id: string) {
  return listings.filter(listing => listing.status === 'active' && listingListerId(listing) === id);
}

export function listingListerName(listing: Listing, id: string | null) {
  // Some listings distinguish the agent from the owner. The owner's name must
  // never be presented as that separate agent's identity.
  return id && listing.ownerId === id ? listing.ownerName?.trim() || '' : '';
}
