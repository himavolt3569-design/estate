export type ListingFeedSlot<L, A> = { kind: 'listing'; listing: L } | { kind: 'sponsor'; ad: A };

/** Use each campaign once, without a trailing ad or repeated carousel. */
export function listingFeed<L, A>(listings: L[], sponsors: A[] | null, interval = 4): ListingFeedSlot<L, A>[] {
  const every = Math.min(5, Math.max(3, Number.isFinite(interval) ? Math.round(interval) : 4));
  const slots: ListingFeedSlot<L, A>[] = [];
  let nextSponsor = 0;
  listings.forEach((listing, index) => {
    slots.push({ kind: 'listing', listing });
    if (sponsors && nextSponsor < sponsors.length && (index + 1) % every === 0 && index < listings.length - 1) slots.push({ kind: 'sponsor', ad: sponsors[nextSponsor++]! });
  });
  return slots;
}
