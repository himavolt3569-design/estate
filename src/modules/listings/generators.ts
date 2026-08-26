import { SUBTYPE_LABELS } from './schema';

function sample<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)] as T;
}

const ADJECTIVES = [
  'Beautiful', 'Spacious', 'Modern', 'Premium', 'Prime', 'Excellent',
  'Stunning', 'Well-maintained', 'Newly built', 'Cozy', 'Elegant',
  'Desirable', 'Perfect', 'Fantastic', 'Luxurious'
];

const SALE_OPENINGS = [
  "Looking for the perfect investment or a place to call home? We are offering a {adj} {type} for sale in the heart of {loc}.",
  "Do not miss this incredible opportunity to own a {adj} {type} located in {loc}.",
  "A {adj} {type} is available for sale in the highly sought-after area of {loc}.",
  "Make your dream a reality with this {adj} {type} situated in {loc}.",
  "Exceptional value meets great location! Presenting a {adj} {type} for sale in {loc}."
];

const RENT_OPENINGS = [
  "Searching for a great place to live? We have a {adj} {type} available for rent in {loc}.",
  "Step into comfort with this {adj} {type} ready for immediate rent in {loc}.",
  "A {adj} {type} is now available for rent in the vibrant neighborhood of {loc}.",
  "Find your next home in this {adj} {type}, perfectly located in {loc}.",
  "Enjoy hassle-free living in this {adj} {type} located in {loc}."
];

const COMMERCIAL_OPENINGS = [
  "Set up your business in a prime location! A {adj} {type} is available in {loc}.",
  "Expand your operations with this {adj} {type} located strategically in {loc}.",
  "A highly visible {adj} {type} is ready for your business in {loc}.",
  "Take advantage of high foot traffic with this {adj} {type} in {loc}."
];

const LAND_OPENINGS = [
  "Build your dream project on this {adj} {type} located in {loc}.",
  "An excellent parcel of {adj} {type} is now available in {loc}.",
  "Prime {adj} {type} offering massive potential in the growing area of {loc}.",
  "Invest in the future with this {adj} {type} situated in {loc}."
];

const CLOSINGS = [
  "This property is situated in a prime location with excellent access to main roads, water supply, and local amenities. Perfect for those looking to settle down in a peaceful neighborhood.",
  "Enjoy the convenience of having markets, schools, and hospitals just a short distance away. Act fast before it is gone.",
  "With great transport links and a welcoming community, this is an opportunity you do not want to miss.",
  "Contact us today to schedule a viewing or for more detailed information about the property.",
  "A rare find in today's market. Get in touch for further details and to arrange a visit."
];

function formatPrice(priceStr: string, negotiable: boolean, period: string | null): string {
  if (!priceStr) return 'Price on call';
  const priceNum = Number(priceStr);
  const formatted = new Intl.NumberFormat('en-IN').format(priceNum);
  
  let base = `Rs ${formatted}`;
  if (period) {
    base += ` / ${period}`;
  }
  if (negotiable) {
    base += ' (Negotiable)';
  }
  return base;
}

export function generateTitle(draft: any, locationName: string): string {
  const adj = sample(ADJECTIVES);
  const typeLabel = SUBTYPE_LABELS[draft.subtype as keyof typeof SUBTYPE_LABELS]?.en || 'Property';
  
  let action = 'for Sale';
  if (draft.transactionType === 'rent') action = 'for Rent';
  if (draft.transactionType === 'lease') action = 'for Lease';
  if (draft.transactionType === 'short_stay') action = 'for Short Stay';

  const loc = draft.addressLine || locationName || 'a prime location';

  return `${adj} ${typeLabel} ${action} in ${loc}`;
}

export function generateDescription(draft: any, locationName: string): string {
  const adj = sample(ADJECTIVES).toLowerCase();
  const typeLabel = (SUBTYPE_LABELS[draft.subtype as keyof typeof SUBTYPE_LABELS]?.en || 'property').toLowerCase();
  const loc = draft.addressLine || locationName || 'a prime location';
  
  let openings = SALE_OPENINGS;
  if (draft.category === 'land') openings = LAND_OPENINGS;
  else if (draft.category === 'commercial') openings = COMMERCIAL_OPENINGS;
  else if (draft.transactionType === 'rent') openings = RENT_OPENINGS;

  const openingTemplate = sample(openings);
  const opening = openingTemplate
    .replace('{adj}', adj)
    .replace('{type}', typeLabel)
    .replace('{loc}', loc);

  const lines: string[] = [];
  lines.push(opening);
  lines.push('');
  lines.push('Key Details:');
  
  if (draft.areaValue && draft.areaUnit) {
    lines.push(`* Size: ${draft.areaValue} ${draft.areaUnit}`);
  }
  
  if (draft.bedrooms) {
    lines.push(`* Bedrooms: ${draft.bedrooms}`);
  }
  
  if (draft.bathrooms) {
    lines.push(`* Bathrooms: ${draft.bathrooms}`);
  }
  
  if (draft.floors) {
    lines.push(`* Floors: ${draft.floors}`);
  }
  
  if (draft.parking) {
    lines.push(`* Parking: Available for ${draft.parking} vehicles`);
  }
  
  if (draft.roadAccessFt) {
    lines.push(`* Road Access: ${draft.roadAccessFt} ft`);
  }

  lines.push(`* Price: ${formatPrice(draft.price, draft.priceNegotiable, draft.pricePeriod)}`);
  
  lines.push('');
  lines.push(sample(CLOSINGS));

  return lines.join('\n');
}
