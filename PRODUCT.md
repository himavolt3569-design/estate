# MeroKotha

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People looking for rentals or properties to buy in Nepal, property owners and verified agents posting properties, and super admins managing moderation and advertisements. The Flutter Android app shares Firebase with this website.

## Product Purpose

Find a suitable rental or property for sale by budget, type and location; inspect its photos and details; save it or contact its lister. Promote the client's other websites through clearly identified advertisements.

## Capabilities and Constraints

Retain the existing Next.js, React, Poppins, Firebase Auth, Firestore and Storage implementation. Preserve rental, inquiry, chat, verification and saved-search workflows. Only super admins may manage campaigns and ad settings. Public listing dates and aggregate engagement are visible without sign-in. Saved searches/matches start collapsed on each page visit. All Rentals, Rooms, Flats and Apartments sit below See my matches. Home replaces Explore in navigation, EMI and land tools share a dropdown, and property search sits between Messages and language controls. Rent/Sell is available for every existing property type except flats, which remain rental-only; browsing uses Rent/Buy. Missing transaction types mean legacy rentals. Ad links supplied by the user are himavolt.com, pitambari-vercel.app and floor-cleaner.vercel.app. The Pitambari address was explicitly confirmed on October 30, 2026. Flutter source is outside scope and must remain unchanged.

## Brand Commitments

MeroKotha name and the established royal blue, crimson and white identity. Use the existing Poppins family and English/Nepali switching. The user delegated implementation and motion design, including GSAP.

## Evidence on Hand

Existing public property imagery and Android banner assets; live records come from Firebase. Do not invent listings, popularity counts, testimonials or partner offers. QA screenshots use clearly named disposable demo fixtures. The Firebase configuration was audited read-only; new local rules and functions have not been deployed. Current released Android support for sale records remains unverified.

## Product Principles

- Advertising is prominent, controllable and visibly labeled.
- Map browsing and public property facts help renters decide.
- Keep shared Firebase contracts compatible with current permissions; native client feature parity requires its own release verification.
- Mobile controls are usable with touch; motion respects reduced-motion preferences.
