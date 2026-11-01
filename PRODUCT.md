# MeroKotha

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People looking for rentals or properties to buy in Nepal, property owners and verified agents posting properties, and super admins managing moderation and advertisements. The Flutter Android app shares Firebase with this website.

## Product Purpose

Find a suitable rental or property for sale by budget, type and location; inspect its photos and details; save it or contact its lister. Make the client's family of websites a prominent, clearly identified advertising destination on the homepage, alongside property discovery.

## Capabilities and Constraints

Retain the existing Next.js, React, Poppins, Firebase Auth, Firestore and Storage implementation. Preserve rental, inquiry, chat, verification and saved-search workflows. Only super admins may manage campaigns and ad settings. The verified account himavolt3569@gmail.com already holds that role; access is enforced through the protected Firebase role, not an email check in the browser. Public listing dates and aggregate engagement are visible without sign-in. The homepage presents a compact introduction, a clearly headed From our partners advertising section, all property categories, minimal live search and the listing grid in that order. Partner cards prioritize the brand, destination hostname and filled Visit website action; sliding layouts expose named partner choices. Saved searches/matches start collapsed below the listings on each page visit; the wider-layout See my matches link opens that disclosure. Categories include all properties, houses, apartments, flats, rooms, offices, shops and land. Advanced budget, furnishing, facilities, verified and nearby options start collapsed; the map starts closed on every screen size. Home replaces Explore in navigation, EMI and land tools share a dropdown, and property search sits between Messages and language controls. Rent/Sell is available for every existing property type except flats, which remain rental-only; browsing defaults to All with Rent/Buy choices. Missing transaction types mean legacy rentals. Current user-supplied ad destinations are himavolt.com, pitambari.vercel.app and floor-clearner.vercel.app; these supersede the historical October 30 addresses. Browser lookup verified HimaVolt only; reachability of the two Vercel destinations was not established. Public campaigns and bundled partner ads must remain available after loading settles when the settings read fails. Default settings apply until a successful read; preserve the last loaded settings, explicit master/partner/homepage off switches and paused campaign overrides. Administration still receives read errors. Flutter source is outside scope and must remain unchanged.

## Brand Commitments

MeroKotha name and the established royal blue, crimson and white identity. Use the existing Poppins family and English/Nepali switching. The user delegated implementation and motion design, including GSAP.

## Evidence on Hand

Existing public property imagery and Android banner assets; live records come from Firebase. Do not invent listings, popularity counts, testimonials or partner offers. QA screenshots use clearly named disposable demo fixtures. A read-only anonymous production check found adSettings/public denied (403) while the campaigns query succeeded (200). Local demo-rule regressions verify visible fallback ads and preserved off switches. The November 1 ad-administration follow-up verified himavolt3569@gmail.com as an existing enabled, verified superAdmin and added only the versioned adSettings/public permission block to the current live rules. Twelve access checks passed. The exact deployed source was verified; public reads now reach the absent settings document (404 instead of permission-denied), ready for its first superadmin save. No account roles or production documents were changed. The broader backend candidate, functions and homepage UI deployment remain pending. The Android carousel was inspected read-only for placement and controls; mismatched artwork was not copied. The full local rule candidate and functions have not been deployed. Current released Android support for sale records remains unverified.

## Product Principles

- Advertising is prominent, controllable and visibly labeled.
- Map browsing and public property facts help renters decide.
- Keep shared Firebase contracts compatible with current permissions; native client feature parity requires its own release verification.
- Mobile controls are usable with touch; motion respects reduced-motion preferences.
