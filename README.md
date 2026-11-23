# 🇭🇰 Hong Kong Companion

**A private, Arabic-first trip companion (PWA) for a student attending a summer programme at The Education University of Hong Kong (EdUHK).**

Hong Kong Companion brings your own documents, saved places, schedule, expenses, and practical Hong Kong resources into one mobile-first app. The interface is in Egyptian Arabic (with an English toggle) and works fully right-to-left.

> **Honest by design.** Every trip fact (admission status, dates, flights, accommodation) is user-entered, editable, and unconfirmed until *you* confirm it. The app ships with **no invented addresses, flights, or admission claims**. Features that need an external service show a clear setup state instead of fake data.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
  - [Linux / macOS / WSL](#linux--macos--wsl)
  - [Windows (native, core app only)](#windows-native-core-app-only)
- [Optional integrations](#optional-integrations)
- [Environment variables](#environment-variables)
- [Deploying](#deploying)
- [Migrating to Postgres](#migrating-to-postgres)
- [Testing](#testing)
- [External dependencies and sources](#external-dependencies-and-sources)
- [Privacy](#privacy)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Area | What it does |
| --- | --- |
| **Trip-document Q&A** | Upload PDF, DOCX, TXT, or images. Ask questions in Egyptian Arabic and get answers **only** from your documents, with inline source citations. If the answer isn't in your files, the app says so instead of guessing. |
| **Camera reader** | Photograph a sign, menu, or notice. Local OCR (English + Traditional Chinese) extracts the text, and an optional local model translates it into Egyptian Arabic. Low-confidence text is highlighted as uncertain. |
| **Saved places** | Your own places with Arabic / English / Traditional Chinese names, notes, and coordinates. "Directions" opens your device's maps app. |
| **"Take me home" card** | A large, high-contrast card with your accommodation name and address in Traditional Chinese and English, made to show a taxi driver. Shows an *unverified* warning until you confirm the address. |
| **Schedule, checklists, reminders** | Editable timeline, pre-departure and arrival checklists, and server-side scheduled Web Push reminders, with a `.ics` calendar export for every reminder. |
| **Flights and countdown** | Manually entered flight details and a countdown with correct `Africa/Cairo` and `Asia/Hong_Kong` timezone handling. |
| **Expenses** | Full CRUD in HKD, per-day and per-category totals, optional receipt photos, and an EGP equivalent with a **dated** exchange rate and manual override. |
| **Phrasebook** | Everyday Cantonese phrases with pronunciation and Arabic explanations. Every phrase carries a review status, and all shipped phrases are **unverified**. |
| **Emergency resources** | Emergency numbers, hospitals, and consular contacts with source URLs and "last verified" dates. One-tap call and directions. |
| **Live MTR times** | Official MTR next-train data for covered lines and stations, with pinned stations and a visible data timestamp. |
| **Scoped sharing** | Read-only, revocable share links for **itinerary + saved places only**. Documents, expenses, chat, and checklists are never shareable (enforced server-side). |
| **Offline (PWA)** | Installable, with offline access to places, the home card, phrasebook, emergency numbers, checklists, and cached itinerary. Sensitive caching is opt-in and purged on logout. |

---

## Tech stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Prisma** + **SQLite** (with a documented Postgres migration path)
- **PWA**: service worker and web app manifest
- **Local processing**: Poppler (`pdftotext`), Mammoth (DOCX), Sharp, Tesseract OCR
- **Optional**: Ollama (local translation), Web Push (VAPID)
- **Testing**: custom test runner and Playwright

---

## Project structure

```
.
├── app/            # Next.js App Router pages and API routes
├── data/           # Curated data (e.g. resources.json, phrasebook, checklists)
├── evidence/       # Acceptance evidence (screenshots, etc.)
├── lib/            # Shared server and client logic
├── prisma/         # Prisma schema and migrations
├── public/         # Static assets, manifest, PWA files
├── scripts/        # Utility scripts (e.g. reminder worker)
├── tests/          # Automated tests and fixtures
├── ACCEPTANCE.md   # Verified acceptance matrix (PASS / FAIL / BLOCKED)
├── Dockerfile
├── .env.example    # Every environment variable, documented
└── README.md
```

---

## Quick start

### Linux / macOS / WSL

Install **Node.js 24**, npm, **Poppler**, and **Tesseract** with English and Traditional Chinese language data. On Debian or Ubuntu:

```sh
sudo apt-get update
sudo apt-get install poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-tra
npm ci
cp .env.example .env
npm run migrate
npm run dev
```

Open <http://localhost:3000> and create an account from the sign-in dialog. **No sample account or password is shipped.** To test two-account sharing, sign up with a different email in a separate browser profile.

The service worker and install manifest are best tested with the production build:

```sh
npm run build
npm start
```

### Windows (native, core app only)

You only need Node.js to run the core app. OCR, PDF text extraction, translation, and push need extra tools (see [Optional integrations](#optional-integrations)); the app still runs without them and shows a setup state for those features.

1. Install **Node.js 24** from <https://nodejs.org> and confirm with `node -v`.
2. Open a terminal in the project folder (the one containing `package.json`).
3. Run:
   ```bat
   npm ci
   copy .env.example .env
   npm run migrate
   npm run dev
   ```
4. Open <http://localhost:3000>.

> **Want everything working on Windows?** Use [WSL2](https://learn.microsoft.com/windows/wsl/install) (`wsl --install`) and follow the Linux steps above inside Ubuntu.

---

## Optional integrations

### Translation (Ollama)

1. Install [Ollama](https://ollama.com/download) and run `ollama serve`.
2. Run `ollama pull qwen2.5:7b`.
3. In `.env`, set:
   ```env
   OLLAMA_URL=http://127.0.0.1:11434
   OLLAMA_MODEL=qwen2.5:7b
   ```
4. Restart the app.

Use a private connection between the app and Ollama. With Ollama unset, image OCR is still available. Check language packs with `tesseract --list-langs` (you should see `eng` and `chi_tra`). If you downloaded language data manually, set `TESSDATA_PREFIX` to its parent directory.

### Scheduled push reminders

1. Generate keys: `npx web-push generate-vapid-keys`
2. Put the values in `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, and set `VAPID_SUBJECT` to a `mailto:` address or HTTPS URL.
3. Restart the app.
4. Run the reminder worker **every minute** (cron, systemd timer, or a scheduled container) using the same database and environment as the app:
   ```sh
   npm run reminders
   ```

The worker claims due reminders atomically, retries failures on later runs, removes expired subscriptions, and records when a push service accepts a delivery. Every reminder can also be exported as a `.ics` calendar file with an alarm.

> **iOS:** Web Push requires adding the app to the Home Screen on a supported Safari version. Browser permissions, OS settings, and push services all affect delivery.

---

## Environment variables

Every variable is documented in [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Database connection (required for local setup) |
| `APP_ORIGIN` | Public origin of the deployment, no trailing slash |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS |
| `TESSDATA_PREFIX` | Location of Tesseract language data (if not on the host default path) |
| `OLLAMA_URL`, `OLLAMA_MODEL` | Enable local translation |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Enable scheduled Web Push |
| `NEXT_TELEMETRY_DISABLED` | Disable framework telemetry |

**Behind an outbound proxy?** Export `NODE_USE_ENV_PROXY=1` *before* starting Node, plus your standard `HTTPS_PROXY`, `HTTP_PROXY`, and `NO_PROXY`. Keep loopback and private Ollama hosts in `NO_PROXY`.

---

## Deploying

This app needs a **Node runtime** with a writable database and native executables (Prisma, Poppler, Tesseract). It is a self-hostable Node app, not a static or edge-only site.

- Serve it behind **HTTPS** with `COOKIE_SECURE=true` and set `APP_ORIGIN`.
- Provision a **persistent SQLite volume** and back it up.
- Run migrations before starting the web process and the scheduler (`npm run migrate`).
- With Docker, build the supplied `Dockerfile` and give the runtime `node` user write access to the database volume (and to the Next cache if you enable revalidation). Run the migration once against the mounted database.
- If Ollama runs as a separate service, use its private network address rather than the app container's loopback.

The process-local rate limiter and SQLite setup are intended for a **small, single-instance** service.

---

## Migrating to Postgres

1. Back up SQLite and freeze writes for the cutover.
2. Change the Prisma datasource provider to `postgresql`, point `DATABASE_URL` at a new database, and move the existing SQLite migrations out of Prisma's active migrations directory.
3. Create the initial Postgres migration in a disposable dev database with `npx prisma migrate dev --name initial_postgres`. Commit it and apply in production with `npm run migrate`.
4. Transfer users, documents, link hashes, and settings using a one-time export/import with a generated Prisma client for each provider. Preserve primary and foreign keys and binary document bytes, and insert parents before children. Sessions and push subscriptions can be omitted if you restart sign-in and push enrolment.
5. Repeat ownership, share, upload, date, and deletion tests against Postgres before switching traffic.

---

## Testing

```sh
npm test
npm run build
npx playwright install chromium
npm start -- --port 4380
```

In a second terminal (with Tesseract and Ollama enabled):

```sh
npm run test:browser
```

Test runner settings:

| Variable | Purpose |
| --- | --- |
| `HK_TEST_URL` | Main server (default `http://127.0.0.1:4380`) |
| `HK_SETUP_URL` | Second instance **without** optional integrations (e.g. port 4381, with Ollama and VAPID unset and `TESSDATA_PREFIX` pointing at a directory with no language packs) |
| `HK_OCR_ONLY_URL` | Instance with OCR enabled and Ollama unset |
| `CHROMIUM_PATH` | Optional path to an installed Chromium |

> ⚠️ Use **disposable test databases only**. Tests create and remove synthetic accounts and records. Shipped fixtures contain synthetic text and are never seeded into user accounts.

See [`ACCEPTANCE.md`](ACCEPTANCE.md) for the verified results, with each capability marked PASS, FAIL, or BLOCKED.

---

## External dependencies and sources

Costs and terms last checked **22 November 2026 (Cairo time)**. Verify again before relying on them.

| Dependency | Cost, data, and sources |
| --- | --- |
| Next.js, Tailwind, Prisma, SQLite | Open source, no account or API keys. Hosting is separate. [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Tailwind](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [Prisma + SQLite](https://www.prisma.io/docs/orm/overview/databases/sqlite), [SQLite](https://www.sqlite.org/copyright.html) |
| Text parsing and images | Local Poppler, Mammoth, Sharp, Tesseract. No service keys. [Poppler](https://poppler.freedesktop.org/), [Mammoth](https://github.com/mwilliamson/mammoth.js), [Sharp](https://sharp.pixelplumbing.com/), [Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html), [language data](https://github.com/tesseract-ocr/tessdata_fast) |
| Document Q&A | Local lexical embeddings and extracts. No general-knowledge mode, no LLM, no embedding API. A narrow alias list bridges some English and Arabic terms. Incomplete matches abstain. Source quotes keep their original language. |
| Camera translation (Ollama) | Free local runtime and model download, no API key. Compute and storage are your own. [API](https://docs.ollama.com/api/chat), [model](https://ollama.com/library/qwen2.5), [pricing for optional cloud services](https://ollama.com/pricing) |
| ExchangeRate-API | Open endpoint, no key, attribution displayed. Daily source update, with at least an hour between successful fetches. The source rate date and last-fetched date are shown separately, and the last known rate keeps its date after failures. [Docs](https://www.exchangerate-api.com/docs/free), [terms](https://www.exchangerate-api.com/terms) |
| Official MTR next-train feed | Public, no key. Verified against spec v1.7 for AEL, TCL, TML, TKL, EAL, SIL, TWL, ISL, KTL, DRL (documented combinations only). Official update cadence is 10 seconds; no separate numeric rate limit was found. The app uses a 15 s fetch cache and 30 s client polling, shows feed time, and credits MTR. [Dataset](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data), [spec](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf), [dictionary](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf), [terms](https://data.gov.hk/en/terms-and-conditions) |
| Web Push and calendar | VAPID keys are generated free and locally. Calendar export needs no account or key. [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [VAPID](https://datatracker.ietf.org/doc/html/rfc8292), [iOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [iCalendar](https://datatracker.ietf.org/doc/html/rfc5545) |
| Maps | A universal directions link. Opening it shares the destination with the map service. No key and no routing API in this app. [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) |

Official emergency and consular sources and their verification dates live in `data/resources.json`. The app distinguishes **official verification** from **the student's own verification date**. Phrasebook content is **unverified**, and every shipped phrase has that status.

---

## Privacy

- **Documents:** The app server receives the originals you upload. Originals, extracted text, and vectors belong to your account, and deleting a document cascades to its vectors and text. Q&A **never** sends your files, excerpts, or questions to an external LLM.
- **Camera:** Images are parsed by local Tesseract on the app server. Only the extracted text goes to your configured Ollama host. Scanner requests are not persisted. Translation is model-generated, and OCR uncertainty stays visible next to the source photo.
- **Network requests:** Exchange-rate requests contain currency codes, MTR requests contain station and line codes, and browser push services receive encrypted notification payloads. There is **no analytics integration**.
- **Offline cache:** The snapshot stores synced places, accommodation, itinerary, checklists, reminder details, and preferences on that browser. Expense caching is opt-in (receipt photos included when space allows). Uploaded documents, reference numbers, and chat are **excluded**. Logout and account changes purge account caches and unsubscribe the current device. The PWA caches public shell files separately.
- **Sharing:** Share links are bearer links. Only explicitly selected timeline records and places are returned, via server-side filtering. Everything else stays behind session and ownership checks.
- **Uploaded content is data, never instructions.** Text extracted from your files is treated as content only.

---

## Known limitations

See [`ACCEPTANCE.md`](ACCEPTANCE.md) for the full evidence. Items that could not be verified in the build environment:

- **Closed-app push delivery is unverified.** Chromium's push service refused registration during testing.
- **Physical camera capture** and **native Home Screen installation** were not tested on real devices.
- **Cantonese phrase review:** no qualified human review has been done, so all phrases are marked unverified.
- **Full assistive-technology audit** was not performed.
- **Hosted preview** was blocked in the build environment, so the app ships as a self-hostable Node app.
- Documents containing only raster pages may need to be uploaded as **images** so OCR can read them.
- Local Q&A prioritizes abstention and **may miss paraphrases**.
- Large uploads and machine translation use server resources.
- The in-process rate limiter and SQLite deployment suit a **small single-instance** service.

---

## Contributing

Issues and pull requests are welcome. Please:

1. Run `npm test` before opening a PR.
2. Don't add invented trip facts, Hong Kong facts, or "reviewed" labels. Curated content needs a source URL and a verification date.
3. Keep Arabic copy in natural, colloquial Egyptian Arabic.

---

## License

Add your license here (for example MIT) and include a `LICENSE` file in the repository root.

---

<div dir="rtl">

### بالعربي

**Hong Kong Companion** تطبيق رحلة خاص بيساعد الطالب في رحلته لمدرسة EdUHK الصيفية في هونج كونج: أسئلة على ملفاتك، قراءة اللافتات بالكاميرا، أماكنك، جدولك، مصاريفك، وجمل جاهزة. كل بيانات الرحلة بتدخلها وتأكدها إنت، والتطبيق مش بيخترع أي معلومة.

</div>
