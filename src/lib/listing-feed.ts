export type ListingFeedSlot<L, A> = { kind: 'listing'; listing: L } | { kind: 'sponsor'; ad: A };

/** Place a real sponsor in slot three, after up to two regular listings. */
export function listingFeed<L, A>(listings: L[], sponsor: A | null): ListingFeedSlot<L, A>[] {
  const slots: ListingFeedSlot<L, A>[] = listings.map(listing => ({ kind: 'listing', listing }));
  if (sponsor) slots.splice(Math.min(2, slots.length), 0, { kind: 'sponsor', ad: sponsor });
  return slots;
}
