# Firebase website acceptance checks

Use test accounts and test listings in the same Firebase project as the Android app. Review the proposed rules in `firebase/` against deployed rules before updating production.

| Account | Check | Expected result |
| --- | --- | --- |
| Guest | Open home, rental details, `/agents` and an agent profile | Active rentals and public agent text load; private profiles, inquiries, and contacts remain inaccessible. |
| Guest | Open the navbar and click Sign In or a posting/inquiry prompt | Navbar shows Sign In without Post a Property or Saved; `/sign-in` offers Google and email/password without starting either automatically. |
| New email user | Create an email/password account with a photo and no phone number, sign out and back in | The photo and profile return under the same Firebase UID; phone stays optional and passwords are never stored in Firestore. |
| Existing Google user | Open profile, add email/password, sign out and sign in by email | Both methods return the same Firebase UID and existing rentals, favorites, and chats. |
| Email user | Request a password reset for a known email/password account | The request succeeds, a reset message arrives in the test mailbox, and the page does not reveal whether other addresses have accounts. |
| Mobile guest | Open home at 320–390px | Language control sits beside Sign In, no horizontal overflow or separate language bar, and rental controls fit the screen. |
| Rental feed | Browse two or more listings with and without an active sponsor | If present, a labeled Sponsored tile occupies slot three after two Listing cards. Without an ad, cards flow in one equal grid. |
| Customer | Save a filtered search, then create a matching rental from another account | The saved search shows one new match; opening it applies every filter and marks it viewed. |
| Customer | Save a rental, inquire, and chat after acceptance | Favorites and messages match Android for the same Firebase UID. |
| Owner | Post with separate call and WhatsApp numbers; edit to hide one | Only the selected public methods appear on details. Profile phone is never a fallback. |
| Owner | Add, remove, and reorder photos after posting | The first photo is the cover on web and Android; the listing returns to pending review. |
| Verified agent | Post for an owner, edit profile introduction | The real owner's contact remains in `ownerContact`; the public directory shows only agent information. |
| Superadmin | Approve/reject agent and rental, suspend a user | Only the superadmin can decide; the decision appears in `adminDecisions`, and directory entries track approval/suspension. |
| All accounts | Switch to Nepali on posting, editing, dashboard, chat, and admin screens | Main controls and labels change and the choice survives a reload. |

Before release, backfill directory profiles for verified agents using **Publish agent profile** in the admin user list. Verify that a real `superAdmin` account exists and that the deployed rules permit the new collections. Saved-search match counts work while the website is open; background push alerts are a separate future service.
