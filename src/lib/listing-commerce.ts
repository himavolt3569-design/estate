import type { Listing } from './firebase/types';

export type TransactionType = 'rent' | 'sale';
export const isForSale = (listing: Pick<Listing, 'transactionType' | 'purpose'>) => (listing.purpose || listing.transactionType) === 'sale';
export const listingPrice = (listing: Pick<Listing, 'transactionType' | 'purpose' | 'salePrice' | 'rentPerMonth'>) => isForSale(listing) ? Number(listing.salePrice || 0) : listing.rentPerMonth;
export const canSell = (propertyType: string) => propertyType !== 'flat';
export function validListingPrice(propertyType: string, transactionType: TransactionType, price: number) {
  return Number.isFinite(price) && price > 0 && (transactionType === 'rent' || canSell(propertyType));
}
