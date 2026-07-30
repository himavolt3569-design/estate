import type { Dictionary } from './en';

/**
 * Nepali copy.
 *
 * Written the way people actually talk about property in Nepal, not the way a
 * textbook would. Real estate is घरजग्गा. A bedroom is a बेडरुम, not a शयनकक्ष.
 * An apartment is an अपार्टमेन्ट. Loanwords that everyone already uses are kept,
 * because a translation nobody recognises is worse than no translation.
 *
 * Numbers stay in Devanagari digits where they are read as words (५० लाख), and
 * in Latin digits where they are data, so prices and areas stay comparable
 * against the listing itself.
 */
export const ne: Dictionary = {
  nav: {
    buy: 'किन्ने',
    rent: 'भाडामा',
    land: 'जग्गा',
    commercial: 'पसल र अफिस',
    signIn: 'लगइन',
    listProperty: 'आफ्नो घरजग्गा राख्नुहोस्',
    dashboard: 'मेरो खाता',
    browseListings: 'घरजग्गा हेर्नुहोस्',
    home: 'कित्ता होम',
    language: 'भाषा',
  },

  hero: {
    eyebrow: 'नेपाल · सातै प्रदेश',
    titleLight: 'भरपर्दो घर र जग्गा',
    titleBold: 'यहीँ खोज्नुहोस्।',
    searchLabel: 'सहर, ठाउँ वा जिल्ला अनुसार खोज्नुहोस्',
    searchPlaceholder: 'बुढानीलकण्ठ, पोखरा, भक्तपुर…',
    nearMe: 'मेरो नजिक',
    locating: 'खोज्दै…',
    search: 'खोज्नुहोस्',
    locationBlocked:
      'तपाईंको ब्राउजरले लोकेसन दिइरहेको छैन। ब्राउजरको सेटिङमा खोल्नुहोस्, वा माथि ठाउँको नाम लेख्नुहोस्।',
    locationFailed: 'तपाईंको लोकेसन भेटिएन। माथि ठाउँको नाम लेख्नुहोस्।',
    chips: {
      checked: 'प्रमाणित मात्र',
      under1cr: '१ करोड भन्दा कम',
      land: 'जग्गा',
      rent: 'भाडामा',
    },
  },

  verified: {
    eyebrow: 'हाम्रो टोलीले जाँचेको',
    title: 'भर्खरै जाँचिएका',
    seeAll: 'सबै हेर्नुहोस्',
    emptyTitle: 'अहिलेसम्म केही छैन',
    emptyBody:
      'हाम्रो टोलीले लालपुर्जा हेरेर र ठाउँमै गएर पक्का गरेपछि मात्र घरजग्गा यहाँ देखिन्छ।',
    browseAll: 'सबै घरजग्गा हेर्नुहोस्',
  },

  types: {
    eyebrow: 'यहाँबाट सुरु गर्नुहोस्',
    title: 'तपाईं के खोज्दै हुनुहुन्छ?',
    house: { label: 'घर', note: 'एकल र जोडिएका घर' },
    apartment: { label: 'अपार्टमेन्ट', note: 'फ्ल्याट र स्टुडियो' },
    residentialLand: { label: 'घर बनाउने जग्गा', note: 'नयाँ घर बनाउन खाली जग्गा' },
    farmLand: { label: 'खेतीको जग्गा', note: 'खेत र बगैंचा' },
    shop: { label: 'पसल', note: 'सडक छेउको पसल' },
    warehouse: { label: 'गोदाम', note: 'सामान राख्ने र साना उद्योग' },
  },

  converter: {
    eyebrow: 'रोपनी, आना, बिघा, कट्ठा',
    title: 'जग्गाको नाप हिसाब',
    intro:
      'नेपालमा जग्गा नाप्ने दुई तरिका छन्। एउटामा नाप लेख्नुहोस्, अर्कोमा कति हुन्छ हेर्नुहोस्।',
    plotSize: 'जग्गाको नाप',
    unit: 'एकाइ',
    inBoth: 'उही जग्गा, दुवै तरिकामा',
    hills: 'पहाड र उपत्यका',
    terai: 'तराई',
    squareFeet: 'वर्ग फिट',
    squareMetres: 'वर्ग मिटर',
    findSimilar: 'यति नापको जग्गा खोज्नुहोस्',
    browseLand: 'सबै जग्गा हेर्नुहोस्',
    units: {
      ropani: 'रोपनी',
      aana: 'आना',
      bigha: 'बिघा',
      kattha: 'कट्ठा',
      paisa: 'पैसा',
      daam: 'दाम',
      dhur: 'धुर',
      sqft: 'वर्ग फिट',
      sqm: 'वर्ग मिटर',
    },
  },

  provinces: {
    eyebrow: 'सातै प्रदेश',
    title: 'प्रदेश अनुसार खोज्नुहोस्',
  },

  price: {
    eyebrow: 'बजेट अनुसार',
    title: 'मूल्य अनुसार खोज्नुहोस्',
    under50: '५० लाख भन्दा कम',
    between50and1cr: '५० लाख देखि १ करोड',
    between1and2cr: '१ करोड देखि २ करोड',
    above2cr: '२ करोड भन्दा माथि',
  },

  card: {
    forSale: 'बिक्रीमा',
    forRent: 'भाडामा',
    forLease: 'लिजमा',
    shortStay: 'छोटो बसाइ',
    bed: 'बेडरुम',
    beds: 'बेडरुम',
    bath: 'बाथरुम',
    baths: 'बाथरुम',
    plot: 'जग्गा',
    checked: 'प्रमाणित',
    noPhoto: 'फोटो छैन',
  },

  auth: {
    signInTitle: 'लगइन गर्नुहोस्',
    signInSubtitle: 'नयाँ हुनुहुन्छ?',
    createAccount: 'खाता खोल्नुहोस्',
    registerTitle: 'आफ्नो खाता खोल्नुहोस्',
    registerSubtitle: 'पहिले नै खाता छ?',
    googleSignIn: 'गुगलबाट लगइन गर्नुहोस्',
    googleSignUp: 'गुगलबाट खाता खोल्नुहोस्',
    orUseEmail: 'वा इमेल प्रयोग गर्नुहोस्',
    email: 'इमेल ठेगाना',
    password: 'पासवर्ड',
    forgotPassword: 'पासवर्ड बिर्सनुभयो?',
    terms: 'सर्तहरू',
    privacy: 'गोपनीयता',
    signingIn: 'लगइन हुँदै…',
    signInButton: 'लगइन गर्नुहोस्',
    showPassword: 'पासवर्ड देखाउनुहोस्',
    hidePassword: 'पासवर्ड लुकाउनुहोस्',
    signInNote:
      'हरेक पटक लगइन गर्दाको समय, डिभाइस र अन्दाजी ठाउँ हामी राख्छौं, ताकि तपाईं पछि सेटिङमा गएर हेर्न सक्नुहोस्।',
    creatingAccount: 'खाता खोल्दै…',
    createAccountButton: 'खाता खोल्नुहोस्',
    checkEmailTitle: 'आफ्नो इमेल हेर्नुहोस्',
    contact: 'सम्पर्क',
  },

  footer: {
    about:
      'नेपालभरिको घर र जग्गा। यहाँ भएको हरेक घरजग्गामा कसले राखेको हो र हाम्रो टोलीले के जाँच्यो भन्ने देखिन्छ।',
    search: 'खोज्नुहोस्',
    housesForSale: 'बिक्रीमा भएका घर',
    rentals: 'भाडामा',
    land: 'जग्गा',
    commercial: 'पसल र अफिस',
    posting: 'घरजग्गा राख्ने',
    listProperty: 'आफ्नो घरजग्गा राख्नुहोस्',
    howChecking: 'हामी कसरी जाँच्छौं',
    yourAccount: 'मेरो खाता',
    platform: 'हाम्रो बारेमा',
    aboutUs: 'बारेमा',
    report: 'घरजग्गाको उजुरी',
    mapCredit: 'नक्साको जानकारी',
    contributors: 'योगदानकर्ताहरूबाट',
  },

  dashboard: {
    greeting: 'नमस्ते',
    greetingBack: 'फेरि स्वागत छ',
    today: 'आज',
    secureTitle: 'लगइन गर्दा अर्को एउटा स्टेप थप्नुहोस्',
    secureBody: 'तपाईंको फोनबाट ६ अङ्कको कोड, ताकि पासवर्ड मात्र थाहा पाएर कोही भित्र छिर्न नसकोस्। एक मिनेट लाग्छ।',
    secureCta: 'सेट गर्नुहोस्',
    yourProperties: 'तपाईंका घरजग्गा',
    liveNow: 'अहिले देखिएका',
    beingChecked: 'हामीले जाँच्दै',
    notFinished: 'अझै पूरा नभएका',
    peopleLooked: 'हेर्ने मानिस',
    messagesTitle: 'किन्नेहरूका सन्देश',
    openInbox: 'सन्देश हेर्नुहोस्',
    totalMessages: 'जम्मा सन्देश',
    newMessages: 'नयाँ, नपढेका',
    noMessagesTitle: 'अहिलेसम्म सन्देश छैन',
    noMessagesBody: 'कसैलाई तपाईंको घरजग्गा मन पर्‍यो भने उहाँको सन्देश यहाँ देखिन्छ।',
    noListingsTitle: 'तपाईंले अझै घरजग्गा राख्नुभएको छैन',
    noListingsBody: 'फोटो, ठाउँ र लालपुर्जा चाहिन्छ। हाम्रो टोलीले नजाँचेसम्म कतै देखिँदैन।',
    addFirst: 'पहिलो घरजग्गा राख्नुहोस्',
    addProperty: 'घरजग्गा राख्नुहोस्',
    savedProperties: 'तपाईंले सेभ गरेका घरजग्गा',
    savedSearches: 'सेभ गरेका खोजी',
    startTitle: 'हेर्नबाट सुरु गर्नुहोस्',
    startBody: 'मन परेका सेभ गर्नुहोस्। मूल्य घट्यो वा नजिकै उस्तै आयो भने हामी खबर गर्छौं।',
    startCta: 'घरजग्गा हेर्नुहोस्',
    sellingTitle: 'बेच्ने वा भाडामा दिने सोच्दै?',
    sellingBody: 'यही खाताबाट घरजग्गा राख्न सक्नुहुन्छ। सार्वजनिक हुनुअघि लालपुर्जा माग्छौं।',
    nav: {
      overview: 'गृहपृष्ठ',
      myProperties: 'मेरा घरजग्गा',
      messages: 'सन्देश',
      saved: 'सेभ गरेका',
      savedSearches: 'सेभ गरेका खोजी',
      admin: 'एडमिन',
      settings: 'सेटिङ',
      profile: 'मेरो विवरण',
      security: 'लगइन र सुरक्षा',
      payments: 'भुक्तानी विवरण',
      signOut: 'लगआउट',
      emailNotConfirmed: 'इमेल पुष्टि भएको छैन',
      suspended: 'रोकिएको',
      twoFactorOn: '२-स्टेप खुला',
      confirmEmailBody: 'घरजग्गा राख्नु वा सन्देश पठाउनुअघि इमेल पुष्टि गर्नुहोस्। हामीले पठाएको लिंक इनबक्समा हेर्नुहोस्।',
    },
    quickActions: 'छिटो काम',
  },

  common: {
    notStated: 'उल्लेख छैन',
    loading: 'लोड हुँदै…',
    saving: 'सेभ हुँदै…',
  },
};
