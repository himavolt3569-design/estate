'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/i18n/config';

export const SiteLanguageContext = createContext<Locale>('en');

export const ui = {
  en: {
    explore: 'Explore', saved: 'Saved', messages: 'Messages', signIn: 'Sign in', signOut: 'Sign out', post: 'Post your property', account: 'My account',
    heroTitle: 'Find your next home', heroIntro: 'Save what you’re looking for. Come back to matching rentals and see what’s new since your last visit.', exploreListings: 'Explore listings',
    savedSearchesTitle: 'Saved searches & new matches', seeMyMatches: 'See my matches', browseRentals: 'Browse rentals', browseEyebrow: 'Want to explore first?', browseIntro: 'Explore available rentals below. Save your criteria above to keep track of new matches.',
    locationTitle: 'Location or title', locationHint: 'Where would you like to live?', propertyType: 'Property type', anyType: 'Any type', maxRent: 'Maximum rent', rentHint: 'Rs. per month', search: 'Search', moreFilters: 'More filters', minRent: 'Minimum rent', anyFurnishing: 'Any furnishing', furnished: 'Furnished', semiFurnished: 'Semi furnished', unfurnished: 'Unfurnished', facilityContains: 'Facility contains', facilityHint: 'Parking, water, Wi-Fi…', verifiedOnly: 'Verified listings only',
    featured: 'Featured', featuredTitle: 'A place to explore', featuredEmpty: 'No featured listing yet', featuredEmptyText: 'New listings will appear here when available.', seeAll: 'See all listings', verifiedListing: 'Verified listing', featuredListing: 'Featured listing', viewDetails: 'View property details',
    listingsTitle: 'Available listings', listingsEyebrow: 'Places to call home', listPlace: 'List your place', loading: 'Loading listings…', found: 'listings found', showCards: 'Show cards', showMap: 'Show map', nearby: 'Within 10 km', showAll: 'Show all', noMatches: 'No listings match these filters', tryAgain: 'Try another location, property type or rent amount.', sortBy: 'Sort listings', sortRecommended: 'Recommended', sortNewest: 'Newest first', sortLow: 'Lowest rent', sortHigh: 'Highest rent', clearFilters: 'Clear filters', showMore: 'Show more listings', sponsorTitle: 'From our partners', sponsorEyebrow: 'Sponsored', sponsorInListings: 'Sponsored in listings', visitSponsor: 'Visit sponsor',
    reviewed: 'Reviewed listings', reviewedText: 'A verified badge appears only after an administrator reviews a listing.', agentChecks: 'Agent checks', agentChecksText: 'Agents apply for approval before posting for someone else.', searchArea: 'Search where it matters', searchAreaText: 'Filter by location, explore the map, or find listings near you.', learnAgents: 'Learn about agents', browseType: 'Browse by property type',
    forRent: 'For rent', listingLabel: 'Listing', verified: 'Verified', agent: 'Agent', noPhoto: 'No photo yet', month: '/ month', floor: 'floor', deposit: 'deposit', save: 'Save listing', removeSave: 'Remove from saved listings',
    back: 'Listings', unavailable: 'Listing unavailable', unavailableText: 'The listing may have been removed or you may not have access to it.', browse: 'Browse listings', loadingDetails: 'Loading details…', agentListing: 'Agent listing', reviewNote: 'Review note', locationOnMap: 'Location available on map', savedLabel: 'Saved',
    furnishing: 'Furnishing', views: 'Views', available: 'Available from', fromLister: 'From the lister', about: 'About this property', noDescription: 'No description was provided.', facilities: 'Facilities', whatItHas: 'What it has', findIt: 'Find it', location: 'Location', addressMissing: 'Address not stated', near: 'Near', openMap: 'Open location on map', monthlyRent: 'Monthly rent', listedBy: 'Listed by', contact: 'Get in touch', ask: 'Ask about this property', signInInquire: 'Sign in to inquire', completeProfile: 'Complete your profile', message: 'Message', moveInDate: 'Move in date', sendInquiry: 'Send inquiry', privateLister: 'Private lister', call: 'Call', whatsapp: 'WhatsApp', noDirectNumber: 'This lister accepts inquiries through MeroKotha.', notProvided: 'Not provided', propertyTypeLabel: 'Property type',
  },
  ne: {
    explore: 'खोज्नुहोस्', saved: 'सेभ गरिएका', messages: 'सन्देश', signIn: 'साइन इन', signOut: 'साइन आउट', post: 'घरजग्गा राख्नुहोस्', account: 'मेरो खाता',
    heroTitle: 'आफ्नो नयाँ घर खोज्नुहोस्', heroIntro: 'आफूलाई चाहिएको घरजग्गाको खोज सेभ गर्नुहोस्। फर्कँदा मिल्ने विज्ञापन र पछिल्लो भ्रमणपछि थपिएका नयाँ विज्ञापन हेर्नुहोस्।', exploreListings: 'घरजग्गा हेर्नुहोस्',
    savedSearchesTitle: 'सेभ गरिएका खोज र नयाँ मिलान', seeMyMatches: 'मेरा मिलान हेर्नुहोस्', browseRentals: 'भाडाका घरजग्गा हेर्नुहोस्', browseEyebrow: 'पहिले हेर्न चाहनुहुन्छ?', browseIntro: 'तल उपलब्ध घरजग्गा हेर्नुहोस्। नयाँ मिलान हेर्न आफ्ना मापदण्ड माथि सेभ गर्नुहोस्।',
    locationTitle: 'ठाउँ वा शीर्षक', locationHint: 'कहाँ बस्न चाहनुहुन्छ?', propertyType: 'घरजग्गाको प्रकार', anyType: 'सबै प्रकार', maxRent: 'अधिकतम भाडा', rentHint: 'रु. प्रति महिना', search: 'खोज्नुहोस्', moreFilters: 'थप फिल्टर', minRent: 'न्यूनतम भाडा', anyFurnishing: 'सबै फर्निसिङ', furnished: 'फर्निसिङ भएको', semiFurnished: 'आंशिक फर्निसिङ', unfurnished: 'फर्निसिङ नभएको', facilityContains: 'सुविधा खोज्नुहोस्', facilityHint: 'पार्किङ, पानी, वाइफाइ…', verifiedOnly: 'प्रमाणित विज्ञापन मात्र',
    featured: 'विशेष', featuredTitle: 'हेर्न लायक घरजग्गा', featuredEmpty: 'अहिले विशेष घरजग्गा छैन', featuredEmptyText: 'नयाँ घरजग्गा उपलब्ध भएपछि यहाँ देखिनेछ।', seeAll: 'सबै घरजग्गा हेर्नुहोस्', verifiedListing: 'प्रमाणित घरजग्गा', featuredListing: 'विशेष घरजग्गा', viewDetails: 'विस्तृत जानकारी हेर्नुहोस्',
    listingsTitle: 'उपलब्ध घरजग्गा', listingsEyebrow: 'आफ्नो ठाउँ खोज्नुहोस्', listPlace: 'आफ्नो घरजग्गा राख्नुहोस्', loading: 'घरजग्गा लोड हुँदैछ…', found: 'घरजग्गा भेटिए', showCards: 'कार्ड हेर्नुहोस्', showMap: 'नक्सा हेर्नुहोस्', nearby: '१० किमि भित्र', showAll: 'सबै हेर्नुहोस्', noMatches: 'यो खोजसँग मिल्ने घरजग्गा भेटिएन', tryAgain: 'अर्को ठाउँ, प्रकार वा भाडा राखेर खोज्नुहोस्।', sortBy: 'क्रम मिलाउनुहोस्', sortRecommended: 'सिफारिस गरिएका', sortNewest: 'नयाँ पहिले', sortLow: 'कम भाडा पहिले', sortHigh: 'धेरै भाडा पहिले', clearFilters: 'फिल्टर हटाउनुहोस्', showMore: 'थप घरजग्गा हेर्नुहोस्', sponsorTitle: 'हाम्रा साझेदारहरूबाट', sponsorEyebrow: 'प्रायोजित', sponsorInListings: 'सूचीमा प्रायोजित', visitSponsor: 'प्रायोजकको साइटमा जानुहोस्',
    reviewed: 'समीक्षा गरिएका घरजग्गा', reviewedText: 'प्रशासकले समीक्षा गरेपछि मात्र प्रमाणित चिन्ह देखिन्छ।', agentChecks: 'एजेन्ट जाँच', agentChecksText: 'अरूका लागि घरजग्गा राख्नुअघि एजेन्टले स्वीकृति लिनुपर्छ।', searchArea: 'आफूलाई चाहिएको ठाउँमा खोज्नुहोस्', searchAreaText: 'ठाउँ अनुसार छान्नुहोस्, नक्सा हेर्नुहोस् वा नजिकका घरजग्गा खोज्नुहोस्।', learnAgents: 'एजेन्टबारे जान्नुहोस्', browseType: 'प्रकार अनुसार खोज्नुहोस्',
    forRent: 'भाडामा', listingLabel: 'विज्ञापन', verified: 'प्रमाणित', agent: 'एजेन्ट', noPhoto: 'अहिलेसम्म फोटो छैन', month: '/ महिना', floor: 'तला', deposit: 'धरौटी', save: 'घरजग्गा सेभ गर्नुहोस्', removeSave: 'सेभबाट हटाउनुहोस्',
    back: 'घरजग्गा', unavailable: 'यो घरजग्गा उपलब्ध छैन', unavailableText: 'यो विज्ञापन हटाइएको हुन सक्छ वा तपाईंलाई हेर्ने अनुमति नहुन सक्छ।', browse: 'घरजग्गा खोज्नुहोस्', loadingDetails: 'विवरण लोड हुँदैछ…', agentListing: 'एजेन्टको विज्ञापन', reviewNote: 'समीक्षा टिप्पणी', locationOnMap: 'ठाउँ नक्सामा हेर्नुहोस्', savedLabel: 'सेभ गरिएको',
    furnishing: 'फर्निसिङ', views: 'हेरिएको', available: 'उपलब्ध हुने मिति', fromLister: 'विज्ञापनदाताबाट', about: 'यो घरजग्गाबारे', noDescription: 'विवरण दिइएको छैन।', facilities: 'सुविधाहरू', whatItHas: 'यसमा के छ', findIt: 'ठाउँ पत्ता लगाउनुहोस्', location: 'स्थान', addressMissing: 'ठेगाना दिइएको छैन', near: 'नजिक', openMap: 'नक्सामा ठाउँ हेर्नुहोस्', monthlyRent: 'मासिक भाडा', listedBy: 'विज्ञापनदाता', contact: 'सम्पर्क गर्नुहोस्', ask: 'यो घरजग्गाबारे सोध्नुहोस्', signInInquire: 'सोध्न साइन इन गर्नुहोस्', completeProfile: 'प्रोफाइल पूरा गर्नुहोस्', message: 'सन्देश', moveInDate: 'सर्ने मिति', sendInquiry: 'सोधपुछ पठाउनुहोस्', privateLister: 'नाम गोप्य राखिएको', call: 'फोन गर्नुहोस्', whatsapp: 'व्हाट्सएप', noDirectNumber: 'यस विज्ञापनदातालाई MeroKotha मार्फत सोधपुछ गर्नुहोस्।', notProvided: 'दिइएको छैन', propertyTypeLabel: 'घरजग्गाको प्रकार',
  },
};

export function useSiteLanguage() {
  const locale = useContext(SiteLanguageContext);
  return { locale, ui: ui[locale] };
}

export function useSiteText() {
  const locale = useContext(SiteLanguageContext);
  return (english: string, nepali: string) => locale === 'ne' ? nepali : english;
}
