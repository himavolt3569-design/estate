/**
 * English copy.
 *
 * Written for readers whose first language is Nepali. That means short
 * sentences, everyday words, and no industry vocabulary. "Append-only ledger"
 * became "a record nobody can change". "Ownership certificate" became
 * "lalpurja", because that is the word every buyer in Nepal already knows.
 *
 * This file is the shape all other locales must satisfy.
 */
export const en = {
  nav: {
    buy: 'Buy',
    rent: 'Rent',
    land: 'Land',
    commercial: 'Shops and offices',
    signIn: 'Sign in',
    listProperty: 'Post your property',
    dashboard: 'My account',
    browseListings: 'See properties',
    home: 'Kitta home',
    language: 'Language',
  },

  hero: {
    eyebrow: 'Nepal · all seven provinces',
    titleLight: 'Houses and land',
    titleBold: 'you can trust.',
    searchLabel: 'Search by city, area or district',
    searchPlaceholder: 'Budhanilkantha, Pokhara, Bhaktapur…',
    nearMe: 'Near me',
    locating: 'Finding you…',
    search: 'Search',
    locationBlocked:
      'Your browser is not sharing your location. Turn it on in browser settings, or type a place name above.',
    locationFailed: 'We could not find your location. Please type a place name above.',
    chips: {
      checked: 'Checked only',
      under1cr: 'Under 1 crore',
      land: 'Land',
      rent: 'For rent',
    },
  },

  verified: {
    eyebrow: 'Checked by our team',
    title: 'Recently checked',
    seeAll: 'See all',
    emptyTitle: 'Nothing here yet',
    emptyBody:
      'Properties show up here after our team looks at the lalpurja and visits the place to make sure it is real.',
    browseAll: 'See all properties',
  },

  types: {
    eyebrow: 'Start here',
    title: 'What are you looking for?',
    house: { label: 'Houses', note: 'Full houses and joined houses' },
    apartment: { label: 'Apartments', note: 'Flats and studios' },
    residentialLand: { label: 'Land to build on', note: 'Empty plots for a new house' },
    farmLand: { label: 'Farm land', note: 'Fields and orchards' },
    shop: { label: 'Shops', note: 'Shop space facing the road' },
    warehouse: { label: 'Godowns', note: 'Storage and small industry' },
  },

  converter: {
    eyebrow: 'Ropani, aana, bigha, kattha',
    title: 'Land size calculator',
    intro:
      'Nepal uses two different ways to measure land. Type a size in one and see it in the other.',
    plotSize: 'Land size',
    unit: 'Measure',
    inBoth: 'The same land, both ways',
    hills: 'Hills and valley',
    terai: 'Terai',
    squareFeet: 'Square feet',
    squareMetres: 'Square metres',
    findSimilar: 'Find land about this size',
    browseLand: 'See all land',
    units: {
      ropani: 'Ropani',
      aana: 'Aana',
      bigha: 'Bigha',
      kattha: 'Kattha',
      paisa: 'Paisa',
      daam: 'Daam',
      dhur: 'Dhur',
      sqft: 'Square feet',
      sqm: 'Square metres',
    },
  },

  provinces: {
    eyebrow: 'All seven provinces',
    title: 'Search by province',
  },

  /*
   * The old "search by price" bands are gone. Nobody shops by band; they shop
   * by what the monthly payment does to their salary, and until now they had to
   * work that out on a bank's website and come back.
   */
  emi: {
    eyebrow: 'Before you visit a bank',
    title: 'Work out the monthly payment',
    intro:
      'Put in the price of the property and what you can pay upfront. This shows the instalment, the interest you will pay over the whole loan, and what changes if you pay a little extra each month.',
    price: 'Price of the property',
    downPayment: 'You pay upfront',
    loanAmount: 'You borrow',
    rate: 'Interest rate',
    tenure: 'Loan length',
    years: 'years',
    perYear: 'per year',
    monthly: 'Monthly instalment',
    totalInterest: 'Interest over the whole loan',
    totalPaid: 'Total you repay',
    paidOffIn: 'Paid off in',
    principalShare: 'Amount borrowed',
    interestShare: 'Interest',
    payExtra: 'Pay a bit extra',
    payExtraHint: 'Optional. See what paying more does to the loan.',
    extraMonthly: 'Extra every month',
    lumpSum: 'One-off payment',
    lumpSumMonth: 'Paid in month',
    saved: 'By paying extra you save',
    savedInterest: 'in interest',
    savedTime: 'and finish',
    earlier: 'earlier',
    income: 'Your monthly income',
    incomeHint: 'Optional. Banks usually want the instalment under half of it.',
    fits: 'This instalment fits the usual limit.',
    tight: 'This is above the usual limit of half your income. A bank will likely ask for a longer term or a bigger deposit.',
    ltvWarning:
      'Most Nepali banks lend up to 80% of the value. With this deposit you are asking for {ltv}%, so expect to put in more.',
    yearByYear: 'Year by year',
    showSchedule: 'Show the year-by-year breakdown',
    hideSchedule: 'Hide the breakdown',
    year: 'Year',
    balance: 'Still owed',
    paidThisYear: 'Paid this year',
    disclaimer:
      'An estimate, to help you plan. Your bank sets the real rate and may add service charges.',
    findWithin: 'See properties in this range',
  },

  card: {
    forSale: 'For sale',
    forRent: 'For rent',
    forLease: 'On lease',
    shortStay: 'Short stay',
    bed: 'bedroom',
    beds: 'bedrooms',
    bath: 'bathroom',
    baths: 'bathrooms',
    plot: 'land',
    checked: 'Checked',
    noPhoto: 'No photo',
  },

  auth: {
    signInTitle: 'Sign in',
    signInSubtitle: 'New here?',
    createAccount: 'Open an account',
    registerTitle: 'Open your account',
    registerSubtitle: 'Already have one?',
    googleSignIn: 'Continue with Google',
    googleSignUp: 'Open account with Google',
    orUseEmail: 'or use your email',
    email: 'Email address',
    password: 'Password',
    forgotPassword: 'Forgot your password?',
    terms: 'Terms',
    privacy: 'Privacy',
    signingIn: 'Signing in…',
    signInButton: 'Sign in',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    signInNote:
      'We keep a note of the time, device and rough location of every sign-in, so you can check them later under Settings.',
    creatingAccount: 'Opening your account…',
    createAccountButton: 'Open account',
    checkEmailTitle: 'Check your email',
    contact: 'Contact us',
  },

  footer: {
    about:
      'Houses and land across Nepal. Every property here shows who posted it and what our team checked.',
    search: 'Search',
    housesForSale: 'Houses for sale',
    rentals: 'For rent',
    land: 'Land',
    commercial: 'Shops and offices',
    posting: 'Posting',
    listProperty: 'Post your property',
    howChecking: 'How we check',
    yourAccount: 'My account',
    platform: 'About us',
    aboutUs: 'About',
    report: 'Report a property',
    mapCredit: 'Map information from',
    contributors: 'contributors',
  },

  dashboard: {
    greeting: 'Namaste',
    greetingBack: 'Welcome back',
    today: 'Today',
    secureTitle: 'Add a second step when you sign in',
    secureBody: 'A 6-digit code from your phone, so nobody can get in with just your password. Takes a minute.',
    secureCta: 'Set it up',
    yourProperties: 'Your properties',
    liveNow: 'Live now',
    beingChecked: 'Being checked by us',
    notFinished: 'Not finished yet',
    peopleLooked: 'People who looked',
    messagesTitle: 'Messages from buyers',
    openInbox: 'Open messages',
    totalMessages: 'Messages in total',
    newMessages: 'New, not read yet',
    noMessagesTitle: 'No messages yet',
    noMessagesBody: 'When somebody is interested in your property, their message shows up here.',
    noListingsTitle: 'You have not added a property yet',
    noListingsBody: 'You will need photos, the location, and the lalpurja. Nothing goes public until our team has checked it.',
    addFirst: 'Add your first property',
    addProperty: 'Add a property',
    savedProperties: 'Properties you saved',
    savedSearches: 'Searches you saved',
    startTitle: 'Start by looking around',
    startBody: 'Save the ones you like. We will tell you if the price drops or something similar comes up nearby.',
    startCta: 'Look at properties',
    sellingTitle: 'Want to sell or rent out?',
    sellingBody: 'You can add a property from this same account. We will ask for the lalpurja before it goes public.',
    charts: {
      days: 'days',
      period: 'in the last {n} days',
      vsBefore: 'vs the {n} days before',
      viewsTitle: 'People looking at your properties',
      viewsSubtitle: 'One person on one day counts once, so refreshing a page does not inflate it.',
      enquiriesTitle: 'Enquiries you received',
      enquiriesSubtitle: 'Every message a buyer sent you, by the day it arrived.',
      platformViewsTitle: 'Property views across Kitta',
      newListingsTitle: 'New properties added',
      newPeopleTitle: 'New people joining',
      pipelineTitle: 'Where your properties stand',
      pipelineSubtitle: 'Tap a row to open that part of your list.',
      topTitle: 'Your best performers',
      topSubtitle: 'Most looked at first. Open one to see who has been looking.',
      attentionTitle: 'Needs your attention',
      noViewsYet: 'No views yet',
      noEnquiriesYet: 'No enquiries yet',
      lookingFor: 'What you are looking at',
      recentlySaved: 'Recently saved',
      saved: 'saved',
      views: 'views',
    },
    nav: {
      overview: 'Home',
      myProperties: 'My properties',
      messages: 'Messages',
      saved: 'Saved',
      savedSearches: 'Saved searches',
      admin: 'Admin',
      settings: 'Settings',
      profile: 'My details',
      security: 'Sign-in and safety',
      payments: 'Payment details',
      signOut: 'Sign out',
      emailNotConfirmed: 'Email not confirmed',
      suspended: 'Suspended',
      twoFactorOn: '2-step on',
      confirmEmailBody: 'Confirm your email address before you add a property or send a message. Check your inbox for the link we sent you.',
    },
    quickActions: 'Quick things',
  },

  common: {
    notStated: 'Not stated',
    loading: 'Loading…',
    saving: 'Saving…',
  },
};

// Note: deliberately NOT `as const`. A const assertion would type every leaf as
// its own string literal, and then no other locale could ever satisfy the shape.
// Widening to `string` is what makes this a translation contract rather than a
// description of the English copy.
export type Dictionary = typeof en;
