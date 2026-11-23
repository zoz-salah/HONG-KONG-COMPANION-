# Hong Kong Companion acceptance

Run date 22 November 2026, Cairo time. The production Next.js build ran on Node 24 with a migrated SQLite database, Poppler and local Tesseract `eng` and `chi_tra`. Chromium ran the browser checks. The live translation leg used local Ollama with `qwen2.5:7b`. Browser automation used synthetic accounts, documents and trip records. The starter data excludes those fixtures. Seven core tests and eleven browser scenarios passed. The share-preview scenario was rerun separately after the main run reached the sign-in rate limit.

| Capability | Verdict | Observed evidence |
| --- | --- | --- |
| Node production build and TypeScript checks | PASS | Generated Prisma Client, compiled Next.js and checked TypeScript. |
| Clean SQLite migration | PASS | Applied committed initial migration to a new empty SQLite file with the setup script. |
| Second account and private sessions | PASS | Registered separate accounts and exercised session-scoped reads and writes. |
| Plans start unconfirmed | PASS | A new account had June 30–July 31, 2027 planned dates, unknown admission, and no accommodation, flights or saved places. |
| PDF parsing and citation | PASS | Parsed `registration.pdf` with Poppler, asked about its registration code, opened the page 1 cite and checked the excerpt. |
| DOCX parsing and citation | PASS | Parsed `arrival.docx` with Mammoth, asked about pickup, opened the section cite and checked the excerpt. |
| Image parsing and citation | PASS | Parsed `locker.png` with Tesseract, asked about luggage locker code, opened the section cite and checked the excerpt. |
| Text parsing and citation | PASS | Parsed `embedded.txt` as UTF-8 and cited its safe factual sentence. |
| Arabic trip questions | PASS | Core tests queried the registration code and first-arrival question in Egyptian Arabic and found the relevant fixtures. |
| Out-of-corpus abstention and no general knowledge | PASS | Tested a visa-fee question, a partially overlapping expiry question and the Arabic abstention text in the browser. |
| Embedded instruction handling | PASS | Injection fixture’s directive and marker were excluded from indexed chunks. A prompt to follow the directive abstained. Document Q&A used no model. |
| Document upload validation | PASS | Core tests rejected a renamed invalid PDF and a file above 8 MiB. |
| Document and chunk deletion | PASS | Deleted the PDF, counted zero associated chunks and confirmed its question then abstained. |
| Cross-account document access | PASS | Account B got 404 on A’s document metadata, source chunk and delete route. |
| Traditional Chinese and English OCR | PASS | Real image upload ran Tesseract and returned English locker text plus Traditional Chinese characters. |
| Live Egyptian Arabic translation | PASS | The camera flow ran local Ollama. An additional direct smoke test retained `MAPLE83` and translated 香港大學 as جامعة هونغ كونغ. This result covers the tested fixture. |
| Low-confidence camera regions | PASS | Real OCR fixture yielded word boxes below 65%. Chromium showed highlighted words and overlaid boxes. The model receives an unclear marker in place of low-confidence words. |
| Camera denied and camera absent | PASS | Chromium fault fixtures produced the distinct permission-denied and no-camera messages. |
| OCR operation failure and retry | PASS | An endpoint fault fixture showed the OCR error, then retry ran the actual OCR and translation pipeline. |
| Physical camera capture | BLOCKED | No physical camera was available in the cloud test device. Upload used the same processing route. |
| Missing OCR language packs | PASS | A second server without language data returned configuration disabled and HTTP 503 with `ocrSetup`. |
| Missing translation configuration | PASS | OCR-only server showed config disabled and returned real OCR text with `translationSetup`. |
| Places create, edit and delete | PASS | Exercised authenticated create/edit/delete and observed confirmation metadata. |
| Directions from saved coordinates | PASS | Browser rendered the saved-place directions action. The app uses Google’s universal destination URL and has no routing engine. |
| Accommodation unconfirmed, confirmation and driver view | PASS | Created an unconfirmed test record, confirmed it and checked the date stamp. Chromium opened the fullscreen view with Traditional Chinese address text. |
| Program plan edits and confirmation | PASS | Patched initial dates and checked server confirmation timestamp. |
| Timeline create, edit and delete | PASS | Exercised class-event writes and observed the saved event after an offline reload. |
| Checklists, defaults and progress | PASS | Verified seeded tasks, created/edited/deleted a new task, checked a task in Chromium and preserved its checked state offline. |
| Manual flights and times | PASS | Created, edited, confirmed and deleted a test flight. New accounts shipped no flight data. |
| Cairo and Hong Kong countdown | PASS | Tests covered Cairo summer and winter offsets and the outbound-to-return transition in Hong Kong time. |
| Reminders create, edit and delete | PASS | Exercised future due dates, update and scoped deletion. |
| Scheduled reminder worker | PASS | Ran the real worker with a due fixture and generated VAPID keys. It claimed the due reminder and kept it pending with zero subscriptions. |
| Push missing-key setup | PASS | VAPID-absent server returned 503 and Chromium displayed the schedule/key setup message. |
| Push denied and unsupported | PASS | Chromium fault fixtures rendered both messages and the iOS Home Screen guidance. |
| Live scheduled Web Push with app closed | BLOCKED | Generated ephemeral VAPID keys and attempted actual registration in Chromium. Its push service returned `AbortError: Registration failed - permission denied` after browser notification permission was granted. No closed-app notification was observed. |
| Online reminder calendar export | PASS | Download endpoint returned `text/calendar` with a UTC start and a DISPLAY alarm. Test asserted CRLF and escaping. |
| Offline reminder calendar export | PASS | Downloaded an ICS file while Chromium was offline and checked its Hong Kong-to-UTC start time. |
| Expense create, edit and delete | PASS | Chromium added a HKD expense, changed its amount, saw the recalculated total and deleted it. |
| Expense receipt upload and preview | PASS | Chromium attached an image to an expense and opened the saved receipt preview. |
| Expense day/category breakdown | PASS | Browser run loaded the period and category breakdown for the saved expense and observed the updated total. |
| Live HKD-to-EGP without credentials | PASS | The app fetched the public HKD endpoint and displayed a dated rate. Provider date and app fetch date are separate. |
| Exchange-rate fetch failure | PASS | Automated failure test kept the dated last value, marked it stale and returned no numeric fallback when no rate was cached. Browser verified the stale warning with a fixture. |
| Manual exchange-rate override | PASS | Entered a HKD-to-EGP rate with its own date and observed that date replace the stale live rate label. |
| Phrasebook search and favorites | PASS | Chromium found a matching phrase, saved it, toggled favorites and excluded nonfavorites. |
| Phrase review provenance | PASS | Every seeded phrase has unverified status. Browser showed the unverified wording notice. |
| Qualified human phrase review | BLOCKED | No qualified Cantonese reviewer took part. The unverified notice is intentional. |
| Emergency and consular data provenance | PASS | Checked the HK government emergency line, Hospital Authority contacts and Egyptian MFA consulate address, plus the Hong Kong Protocol Division phone listing. Data and dates are in the source. |
| One-tap calling and directions | PASS | Browser confirmed the emergency `tel:999` link and rendered verified contact and direction actions. No emergency call was placed. |
| Editing practical-resource verification dates | PASS | Chromium saved the account’s consulate verification date and displayed it alongside the official date. |
| Official MTR docs, cadence and coverage | PASS | Checked API v1.7, station pairs, data.gov.hk terms and 10-second source update cadence. No separate published numeric quota found. Server cache is 15 seconds and client polling is 30 seconds. |
| Live MTR retrieval and data time | PASS | Called official feed through the app without credentials and observed real arrivals for EAL–TAW and source timestamp. |
| Pinned and unsupported stations | PASS | Chromium pinned Tai Wai. Unsupported line showed the unavailable message, and the API rejected an unsupported line–station pair. |
| Share only selected timeline and places | PASS | Guest read exactly the selected event and place. A forged selection including private records or another account’s place was rejected. |
| Exact sharing preview and link controls | PASS | Chromium selected an event, inspected the exact preview, created the link, read its notes and revoked the link. An unselected place stayed out of the preview. |
| Share revocation and account ownership | PASS | B could not revoke A’s link. After owner revocation the public API and page returned 404. |
| Private content through share links | PASS | Before and after revocation, guest and B requests to private paths returned 401 or 404. A share token as a bearer header did not authorize a private resource. |
| Offline shell, places, accommodation, itinerary, phrasebook and checklists | PASS | Chromium entered browser offline mode and reloaded from the service worker. Synced data and bundled phrases remained available. |
| Offline public contacts | PASS | After offline reload Chromium rendered the 999 contact. |
| Online-only states | PASS | Offline banner named Q&A, translation, live train data and exchange refresh. Chromium observed the disabled chat input. |
| Sensitive expense cache opt-in and last sync | PASS | Expense was absent from storage before opt-in, present after opt-in and visible on an offline reload. |
| Account cache purge on logout | PASS | Browser inserted synthetic account caches, then inspected local storage, Cache Storage and IndexedDB account namespaces after logout. Session endpoint returned null. |
| Sign-in form and account switch on one device | PASS | Registered A and B through the same browser, signed out and back into A, verified distinct account IDs and checked B’s offline snapshot for A’s place. |
| Installable PWA metadata and service worker | PASS | Chromium found the valid standalone manifest and active controlling worker. The standard automated profile reports only its incognito installation restriction. |
| Native Home Screen installation | BLOCKED | iOS and Android hardware installation was unavailable in this environment. |
| Arabic RTL at 360 px, 390 px and 1280 px | PASS | Chromium checked full-width overflow and visible primary nav, and produced screenshots. Reviewed mobile and desktop screenshots. |
| Dark mode and primary contrast | PASS | Chromium toggled dark mode. Calculated sampled text and button contrasts ranged from 6.14:1 to 15.95:1. |
| Keyboard and screen-reader check | PASS | Chromium resolved controls by Arabic and English accessible names. The keyboard smoke test passed initial dialog focus, Tab order, Escape and focus return. |
| Full assistive technology audit | BLOCKED | A production screen-reader/device audit was unavailable. |
| Initial loading performance budget | PASS | Production HTML referenced approximately 219 KiB gzip JavaScript and 6 KiB gzip CSS, below 250 KiB and 20 KiB respectively. Hero was approximately 113 KiB, below 150 KiB. |
| Managed preview and hosted deployment | BLOCKED | The managed relay timed out and the shared browser sandbox failed to start. Managed Sites hosting is incompatible with the required Node/native-tool and persistent SQLite runtime. The Node production build ran locally. |

The repeated test suites are in `tests/core.test.ts` and `tests/acceptance.spec.ts`. The live push attempt is reproducible with `tests/push-live.mjs`. External dependency cost and configuration are in `README.md` and `.env.example`.
