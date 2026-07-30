import type { Locale } from './config';

/*
 * Terms, privacy and contact content, kept out of the main dictionary because
 * it is long-form prose rather than interface labels.
 *
 * Written in plain language on purpose. Most people who sign a property
 * agreement in Nepal have never read the terms attached to it, and dense legal
 * English is a large part of why. Short sentences, no Latin, and the words
 * people already use (lalpurja, not "certificate of title").
 *
 * IMPORTANT: this is honest, readable plain-language content, not legal advice.
 * A Nepali lawyer must review both languages before launch, and the placeholder
 * contact details below must be replaced with real ones.
 */

export type LegalSection = { heading: string; body: string[] };

export type LegalPage = {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
};

export type ContactChannel = {
  label: string;
  value: string;
  href?: string;
  note?: string;
};

export type LegalContent = {
  terms: LegalPage;
  privacy: LegalPage;
  contact: {
    title: string;
    intro: string;
    channels: ContactChannel[];
    quickTitle: string;
    quick: Array<{ label: string; href: string; note: string }>;
    responseNote: string;
  };
};

/* -------------------------------------------------------------------------- */
/* Contact details                                                             */
/* -------------------------------------------------------------------------- */
/* PLACEHOLDERS. Replace with real details before this page goes live. */
export const CONTACT = {
  email: 'hello@kitta.example',
  support: 'support@kitta.example',
  phone: '+977 1 000 0000',
  address: 'Kathmandu, Nepal',
} as const;

const LAST_UPDATED_EN = 'Last updated: 29 July 2026';
const LAST_UPDATED_NE = 'अन्तिम अपडेट: २०२६ जुलाई २९';

const en: LegalContent = {
  terms: {
    title: 'Terms of use',
    updated: LAST_UPDATED_EN,
    intro:
      'These are the rules for using Kitta. We have kept them short and in plain words. If anything here is unclear, please ask us before you use the site.',
    sections: [
      {
        heading: 'What Kitta is',
        body: [
          'Kitta is a place where people post houses, land, shops and offices, and where buyers and renters can find them.',
          'We are not the owner, the seller or the agent of any property on this site. We do not take part in the deal between you and the other person. We are the noticeboard, not the broker.',
        ],
      },
      {
        heading: 'Who can use it',
        body: [
          'You must be 18 or older to open an account.',
          'The name, phone number and email you give us must be your own and must be correct. Accounts using someone else’s details will be closed.',
        ],
      },
      {
        heading: 'Posting a property',
        body: [
          'You may only post a property if you own it, or if the owner has allowed you to post it.',
          'Everything you write must be true: the price, the size, the location and the condition. Photos must be of that property and taken by you or with permission.',
          'You need at least five photos. Our team looks at the lalpurja and may visit the place before your listing goes live.',
        ],
      },
      {
        heading: 'What we check, and what we do not',
        body: [
          'We check the documents that are shown to us and we confirm the location. When we do this, it is written on the listing so you can see it.',
          'We do not guarantee that a property is a good deal, that the price is fair, or that the ownership is free of dispute. Checking those things is still your job, and you should use your own lawyer before you pay anything.',
        ],
      },
      {
        heading: 'Money',
        body: [
          'No money passes through Kitta. We do not hold, send or receive payments.',
          'If a seller shows eSewa, Khalti or bank details on a listing, that is the seller’s own account. We do not control it.',
          'Never send money for a property you have not seen and checked yourself. If someone pressures you to pay quickly, stop and report them to us.',
        ],
      },
      {
        heading: 'Things you must not do',
        body: [
          'Do not post false information, another person’s photos, or a property that is not available.',
          'Do not post the same property many times to push it up the list.',
          'Do not use the site to send unwanted messages, to harass anyone, or to collect phone numbers for other purposes.',
        ],
      },
      {
        heading: 'If you break these rules',
        body: [
          'We may hide or remove a listing, and we may suspend or close an account. Where we can, we will tell you the reason.',
          'Serious cases, especially fraud, may be reported to the police.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'If we change these terms in an important way, we will tell you on the site before the change takes effect.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy',
    updated: LAST_UPDATED_EN,
    intro:
      'This page explains what information we keep about you, why we keep it, and who can see it.',
    sections: [
      {
        heading: 'What we keep',
        body: [
          'Your name, email address and phone number, and anything else you choose to add to your profile.',
          'The properties you post, save or ask about.',
          'A record of every sign-in: the time, the device and the rough area you signed in from. This is so you can spot someone else using your account.',
        ],
      },
      {
        heading: 'Who can see your phone number and email',
        body: [
          'Nobody, unless you turn it on for a listing. Your contact details are not in the page until someone asks to see them.',
          'When someone does look at your number, we record who and when, and you can see that list. This protects you from people collecting numbers in bulk.',
        ],
      },
      {
        heading: 'Your location',
        body: [
          'We only ask for your location when you tap "Near me". You can say no, and the site still works.',
          'We use it to sort properties by distance at that moment. We do not save where you were.',
        ],
      },
      {
        heading: 'Cookies',
        body: [
          'We use a small number of cookies: one to keep you signed in, and one to remember whether you chose English or Nepali.',
          'We do not use cookies to follow you around other websites.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'While your account is open, and for a period afterwards where the law requires it.',
          'Sign-in records and listing history are kept as a safety record and cannot be edited, including by us.',
        ],
      },
      {
        heading: 'Your choices',
        body: [
          'You can see and correct your details at any time in Settings.',
          'You can ask us to delete your account. Write to us and we will explain what can be removed and what we must keep.',
        ],
      },
    ],
  },

  contact: {
    title: 'Contact us',
    intro:
      'Questions about a property, your account, or something that looks wrong on the site. Write to us and a person will read it.',
    channels: [
      { label: 'General questions', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
      { label: 'Account help', value: CONTACT.support, href: `mailto:${CONTACT.support}` },
      { label: 'Phone', value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, '')}`, note: 'Sunday to Friday, 10am to 5pm' },
      { label: 'Office', value: CONTACT.address },
    ],
    quickTitle: 'Common things',
    quick: [
      {
        label: 'Report a property',
        href: '/report',
        note: 'Wrong price, wrong place, already sold, or someone else’s photos.',
      },
      {
        label: 'Post your property',
        href: '/register',
        note: 'Open an account and add your house, land or shop.',
      },
      {
        label: 'How we check',
        href: '/how-verification-works',
        note: 'What our team looks at before a listing goes live.',
      },
    ],
    responseNote:
      'We usually reply within two working days. If a listing looks like fraud, tell us straight away and we will look at it first.',
  },
};

const ne: LegalContent = {
  terms: {
    title: 'प्रयोगका सर्तहरू',
    updated: LAST_UPDATED_NE,
    intro:
      'कित्ता प्रयोग गर्ने नियमहरू यहाँ छन्। हामीले छोटो र सजिलो भाषामा लेखेका छौं। केही कुरा बुझ्न गाह्रो भए प्रयोग गर्नुअघि हामीलाई सोध्नुहोस्।',
    sections: [
      {
        heading: 'कित्ता के हो',
        body: [
          'कित्ता एउटा ठाउँ हो जहाँ मानिसहरूले घर, जग्गा, पसल र अफिस राख्छन्, र किन्ने वा भाडामा बस्न खोज्नेले ती भेट्टाउँछन्।',
          'यहाँ भएको कुनै पनि घरजग्गाको मालिक, बिक्रेता वा एजेन्ट हामी होइनौं। तपाईं र अर्को पक्षबीचको कारोबारमा हामी हुँदैनौं। हामी सूचना राख्ने ठाउँ हौं, बिचौलिया होइनौं।',
        ],
      },
      {
        heading: 'कसले प्रयोग गर्न सक्छ',
        body: [
          'खाता खोल्न तपाईंको उमेर १८ वर्ष वा माथि हुनुपर्छ।',
          'तपाईंले दिने नाम, फोन नम्बर र इमेल आफ्नै र सही हुनुपर्छ। अरूको विवरण प्रयोग गरेको खाता बन्द गरिन्छ।',
        ],
      },
      {
        heading: 'घरजग्गा राख्दा',
        body: [
          'तपाईं आफैं मालिक हुनुहुन्छ भने वा मालिकले अनुमति दिएको छ भने मात्र घरजग्गा राख्न सक्नुहुन्छ।',
          'तपाईंले लेखेको सबै कुरा सही हुनुपर्छ: मूल्य, नाप, ठाउँ र अवस्था। फोटो त्यही घरजग्गाको र आफैंले खिचेको वा अनुमति लिएको हुनुपर्छ।',
          'कम्तीमा पाँचवटा फोटो चाहिन्छ। तपाईंको विज्ञापन देखिनुअघि हाम्रो टोलीले लालपुर्जा हेर्छ र ठाउँमै पनि जान सक्छ।',
        ],
      },
      {
        heading: 'हामी के जाँच्छौं, के जाँच्दैनौं',
        body: [
          'हामीलाई देखाइएका कागजात हामी हेर्छौं र ठाउँ पक्का गर्छौं। यसो गरेपछि त्यो कुरा विज्ञापनमै लेखिन्छ, तपाईंले हेर्न सक्नुहुन्छ।',
          'तर मूल्य ठीक छ कि छैन, राम्रो सौदा हो कि होइन, वा स्वामित्वमा विवाद छैन भन्ने हामी ग्यारेन्टी गर्दैनौं। यी कुरा तपाईं आफैंले जाँच्नुपर्छ, र पैसा तिर्नुअघि आफ्नो वकिलसँग सल्लाह लिनुहोस्।',
        ],
      },
      {
        heading: 'पैसाको कुरा',
        body: [
          'कित्ताबाट कुनै पैसा जाँदैन। हामी पैसा राख्दैनौं, पठाउँदैनौं र लिँदैनौं।',
          'विज्ञापनमा eSewa, Khalti वा बैंकको विवरण देखिएको छ भने त्यो बिक्रेताको आफ्नै खाता हो। त्यसमा हाम्रो नियन्त्रण छैन।',
          'नदेखेको र आफैंले नजाँचेको घरजग्गाका लागि कहिल्यै पैसा नपठाउनुहोस्। कसैले छिटो पैसा तिर्न दबाब दिन्छ भने रोकिनुहोस् र हामीलाई खबर गर्नुहोस्।',
        ],
      },
      {
        heading: 'यी कुरा गर्नु हुँदैन',
        body: [
          'झूटो जानकारी, अरूको फोटो, वा बिक्री भइसकेको घरजग्गा नराख्नुहोस्।',
          'माथि देखियोस् भनेर एउटै घरजग्गा पटक-पटक नराख्नुहोस्।',
          'अनावश्यक सन्देश पठाउन, कसैलाई दुःख दिन, वा फोन नम्बर जम्मा गर्न यो साइट प्रयोग नगर्नुहोस्।',
        ],
      },
      {
        heading: 'नियम तोडेमा',
        body: [
          'हामीले विज्ञापन लुकाउन वा हटाउन सक्छौं, र खाता रोक्न वा बन्द गर्न सक्छौं। सकेसम्म कारण पनि बताउँछौं।',
          'ठगीजस्ता गम्भीर विषय प्रहरीलाई जानकारी गराउन सकिन्छ।',
        ],
      },
      {
        heading: 'परिवर्तन',
        body: [
          'यी सर्तहरूमा ठूलो परिवर्तन गर्नुपरे लागू हुनुअघि नै साइटमा जानकारी दिनेछौं।',
        ],
      },
    ],
  },

  privacy: {
    title: 'गोपनीयता',
    updated: LAST_UPDATED_NE,
    intro:
      'तपाईंको कस्तो जानकारी हामी राख्छौं, किन राख्छौं र कसले हेर्न सक्छ भन्ने कुरा यहाँ लेखिएको छ।',
    sections: [
      {
        heading: 'हामी के राख्छौं',
        body: [
          'तपाईंको नाम, इमेल र फोन नम्बर, अनि प्रोफाइलमा तपाईंले थप्नुभएको अरू कुरा।',
          'तपाईंले राख्नुभएको, सेभ गर्नुभएको वा सोध्नुभएको घरजग्गा।',
          'हरेक पटक लगइन गर्दाको समय, डिभाइस र अन्दाजी ठाउँ। यो तपाईंकै खातामा अरू कसैले छिरेको थाहा पाउन हो।',
        ],
      },
      {
        heading: 'तपाईंको फोन र इमेल कसले देख्छ',
        body: [
          'तपाईंले विज्ञापनमा खोलिदिनुभएन भने कसैले देख्दैन। कसैले हेर्न नखोजेसम्म तपाईंको सम्पर्क विवरण पेजमै हुँदैन।',
          'कसैले तपाईंको नम्बर हेर्दा कसले र कहिले हेर्‍यो भन्ने हामी राख्छौं, र तपाईं त्यो सूची हेर्न सक्नुहुन्छ। धेरै नम्बर जम्मा गर्नेबाट यसले जोगाउँछ।',
        ],
      },
      {
        heading: 'तपाईंको लोकेसन',
        body: [
          '"मेरो नजिक" थिच्नुभयो भने मात्र हामी लोकेसन माग्छौं। नदिनु भए पनि साइट चल्छ।',
          'त्यति बेला दूरी अनुसार घरजग्गा मिलाउन मात्र प्रयोग हुन्छ। तपाईं कहाँ हुनुहुन्थ्यो भन्ने हामी सेभ गर्दैनौं।',
        ],
      },
      {
        heading: 'कुकिज',
        body: [
          'हामी थोरै कुकिज मात्र प्रयोग गर्छौं: एउटा तपाईंलाई लगइन राख्न, अर्को तपाईंले अङ्ग्रेजी रोज्नुभयो कि नेपाली भन्ने सम्झन।',
          'अरू वेबसाइटमा तपाईंलाई पछ्याउन हामी कुकिज प्रयोग गर्दैनौं।',
        ],
      },
      {
        heading: 'कति समय राख्छौं',
        body: [
          'तपाईंको खाता चलिरहेसम्म, र कानुनले माग गरेमा त्यसपछि केही समय।',
          'लगइनको रेकर्ड र विज्ञापनको इतिहास सुरक्षाका लागि राखिन्छ र त्यो हामीले पनि परिवर्तन गर्न सक्दैनौं।',
        ],
      },
      {
        heading: 'तपाईंको अधिकार',
        body: [
          'सेटिङमा गएर जुनसुकै बेला आफ्नो विवरण हेर्न र सच्याउन सक्नुहुन्छ।',
          'खाता मेटाउन भन्न सक्नुहुन्छ। हामीलाई लेख्नुहोस्, के हटाउन सकिन्छ र के राख्नैपर्छ भनेर बताउनेछौं।',
        ],
      },
    ],
  },

  contact: {
    title: 'सम्पर्क गर्नुहोस्',
    intro:
      'कुनै घरजग्गा, तपाईंको खाता, वा साइटमा गडबड देखिएको कुराबारे हामीलाई लेख्नुहोस्। मान्छेले नै पढ्छ।',
    channels: [
      { label: 'सामान्य प्रश्न', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
      { label: 'खाता सम्बन्धी सहयोग', value: CONTACT.support, href: `mailto:${CONTACT.support}` },
      { label: 'फोन', value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, '')}`, note: 'आइतबारदेखि शुक्रबार, बिहान १० बजे देखि साँझ ५ बजेसम्म' },
      { label: 'कार्यालय', value: 'काठमाडौं, नेपाल' },
    ],
    quickTitle: 'धेरै सोधिने कुरा',
    quick: [
      {
        label: 'घरजग्गाको उजुरी',
        href: '/report',
        note: 'गलत मूल्य, गलत ठाउँ, बिक्री भइसकेको, वा अरूको फोटो।',
      },
      {
        label: 'आफ्नो घरजग्गा राख्नुहोस्',
        href: '/register',
        note: 'खाता खोलेर आफ्नो घर, जग्गा वा पसल थप्नुहोस्।',
      },
      {
        label: 'हामी कसरी जाँच्छौं',
        href: '/how-verification-works',
        note: 'विज्ञापन देखिनुअघि हाम्रो टोलीले के हेर्छ।',
      },
    ],
    responseNote:
      'हामी सामान्यतया दुई कार्यदिनभित्र जवाफ दिन्छौं। कुनै विज्ञापन ठगी जस्तो लागे तुरुन्तै भन्नुहोस्, हामी पहिले त्यही हेर्छौं।',
  },
};

const CONTENT: Record<Locale, LegalContent> = { en, ne };

export function getLegalContent(locale: Locale): LegalContent {
  return CONTENT[locale];
}
