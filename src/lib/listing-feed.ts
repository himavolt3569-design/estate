export type ListingFeedSlot<L, A> = { kind: 'listing'; listing: L } | { kind: 'sponsor'; ad: A };

/** Repeat a full-width campaign break after 3–5 rentals, without a trailing ad. */
export function listingFeed<L, A>(listings: L[], sponsor: A | null, interval = 4): ListingFeedSlot<L, A>[] {
  const every = Math.min(5, Math.max(3, Number.isFinite(interval) ? Math.round(interval) : 4));
  const slots: ListingFeedSlot<L, A>[] = [];
  listings.forEach((listing, index) => {
    slots.push({ kind: 'listing', listing });
    if (sponsor && (index + 1) % every === 0 && index < listings.length - 1) slots.push({ kind: 'sponsor', ad: sponsor });
  });
  return slots;
}
