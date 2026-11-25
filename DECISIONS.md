# Decisions log

Decisions taken while implementing the Phase 1 specification
(`DOCS/Mana_Tenali_Phase1_Technical_Spec_v1.1 copy.pdf`). Newest at the bottom of each step.

## Step 0 - Foundation

| # | Decision | Reason |
|---|----------|--------|
| D0.1 | The spec PDF lives in `DOCS/` and that folder is **git-ignored**. | The GitHub repository is public; the spec stays local unless the owner chooses to publish it. |
| D0.2 | UI reference = Figure 5 embedded in the PDF (page 20). | The standalone `docs/mana-tenali-green-ui.png` was not supplied; the owner confirmed the embedded figure is the visual guide. |
| D0.3 | **Express 4** (not 5). | `express-mongo-sanitize` (named in the spec) is not compatible with Express 5's read-only `req.query`. |
| D0.4 | **React 18.3** pinned through root `overrides`. | The spec names React 18; some libraries otherwise pulled a second React 19 copy into the workspace. |
| D0.5 | **React Router 7** (library mode) instead of 6. | React Router 6.x has open security advisories (open redirect); 7.18.7 is patched and supports React 18. The spec only says "React Router". |
| D0.6 | **Zod 4** on server and client. | Zod 3.x has a high-severity advisory (GHSA-mrhx-c7xc-m3w5); 4.6.7 is fixed. |
| D0.7 | **Vitest** for server and client tests; **Tailwind CSS 3** with tokens in `client/tailwind.config.js`. | Spec allows Vitest or Jest and asks for tokens "in the Tailwind config". |
| D0.8 | npm workspaces (`server`, `client`) with root scripts `dev`, `lint`, `test`, `build`. | One repository with client/ and server/ folders (spec assumption). |
| D0.9 | Origin/Referer check on every non-GET request; requests with **neither** header are allowed only if they carry no cookies. | CSRF needs an ambient credential (the cookie). Cookie-less clients (curl, health monitors) can't be forged into acting as a user. |
| D0.10 | `/health` returns 200 `{status:'ok', db:'up'}` or **503** `SERVICE_UNAVAILABLE` when the DB ping fails. | Uptime monitors key on status codes. `SERVICE_UNAVAILABLE` added to the error-code list. |
| D0.11 | Env validation requires only the variables the built steps use; later variables become required in their step. | Keeps the server startable during development while still failing fast. Error messages name variables, never values. |
| D0.12 | Unexpected 500s include `details.requestId` (and only that). | Lets support correlate a user report with logs without leaking internals. |
| D0.13 | Bottom-nav centre button = **"Suggest"** (spec open decision U1, recommended option). Until Step 9 it shows a "being built" placeholder. | Community posts are Phase 2; a suggestion form stored as a report for admins reuses the reports module. |
| D0.14 | Skyline and banner art = original vector placeholders (spec U3) until the owner supplies images. | The mockup image itself must not ship in the app. |
| D0.15 | Coming-soon features are driven by one list: `client/src/config/comingSoon.js` (spec U2: shown dimmed with a badge). | Enabling a Phase 2 feature later is a one-line change. |
| D0.16 | Explore route `/explore` added (not in the section-10 route list). | The Explore screen is part of the UI reference and the "More" tile opens it. `/saved`, `/suggest`, `/about`, `/offers/:id` added for the same reason (bottom nav, drawer, offer detail FR-OFF-2). |
| D0.17 | Only Latin + Telugu font subsets are bundled (`@fontsource`, self-hosted). | Smaller payload; no third-party font CDN (privacy). |
| D0.18 | Shorter Telugu bottom-nav labels (అన్వేషణ, సూచన, సేవ్). | Full phrases overflow at 360 px width. |
| D0.19 | Git: local repo initialised, `origin` = GitHub repo, `main` tracks `origin/main`, work on `step-N-*` branches. No commits/pushes without owner approval. | Owner's working agreement. |

## Step 1 - Auth and profiles

| # | Decision | Reason |
|---|----------|--------|
| D1.1 | Session = HS256 JWT (7 days) in the httpOnly, SameSite=Lax cookie `mt_session`; `Secure` in production; optional `COOKIE_DOMAIN`. | Spec section 6. |
| D1.2 | `authenticate` re-loads the user from MongoDB on every request (one indexed lookup). | Role changes and blocks take effect immediately rather than after the token expires. |
| D1.3 | Blocked users get **403** on login and on any authenticated request. | Spec: "Blocked users cannot log in or write content." |
| D1.4 | Wrong password and unknown email return the same 401 message, and unknown emails still pay the bcrypt cost. | Avoids revealing which emails are registered. |
| D1.5 | Google sign-in links to an existing account only when Google reports the email as **verified**. | Prevents account takeover through unverified emails. |
| D1.6 | Admins cannot demote or block **themselves**. | Prevents accidentally locking out the only admin. |
| D1.7 | `GET/PATCH /admin/users` built in Step 1 (API only); the admin screen comes in Step 10. | FR-AUTH-4 is a Step 1 must-have, and Step 3 needs owners. |
| D1.8 | `seed:admin` reads `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` (12–72 chars) from `server/.env`, refuses production without `--confirm-production`, never prints the password. | Spec admin bootstrap. |
| D1.9 | Auth endpoints are rate limited to 20 requests per 15 minutes per IP (global limit 600). | Spec: stricter limits on login. |
| D1.10 | `?next=` after login accepts only same-app relative paths. | Prevents open redirects. |
| D1.11 | The language chosen in the drawer is also saved to the profile when logged in; on login the UI switches to the user's saved language. | FR-PRO-1 (language preference). |
| D1.12 | `avatarUrl` accepts any https URL in Step 1; Step 2 restricts it to the project's Cloudinary account. | Upload signing arrives in Step 2. |

## Step 2 - Categories and media

| # | Decision | Reason |
|---|----------|--------|
| D2.1 | Category `name` is bilingual `{ en, te }` (English required). `slug` and `type` never change after creation; admins deactivate instead of deleting. | Spec data model; references and links stay stable. |
| D2.2 | `GET /categories` returns active categories only; admins can pass `includeInactive=true` for the management screen. | Public lists must show only active data. |
| D2.3 | `npm run seed` seeds the reference categories (business, event and news) with English and Telugu names. It is idempotent and never overwrites admin edits, and it refuses production without `--confirm-production`. | Spec seed script; safe to re-run. |
| D2.4 | Cloudinary signing is implemented with Node `crypto` (SHA-1 per Cloudinary docs) in `common/integrations/cloudinary.js`; no SDK dependency. | Thin wrapper, smaller dependency surface; the secret never leaves the server. |
| D2.5 | `CLOUDINARY_*` variables are **optional**. Until all three are set, `POST /media/sign` returns 503 `SERVICE_UNAVAILABLE` and the UI says uploads aren't available yet. | The owner has not configured Cloudinary yet; everything else must keep working. |
| D2.6 | Upload purposes decide the role, folder and limits. `avatar`: any logged-in user, 2 MB, stored at most 600 px. `business_photo` / `offer_image`: owner or admin, 5 MB. `event_banner` / `news_cover`: admin only, 5 MB. All purposes: JPG/PNG/WebP only, stored at most 1600 px. | FR-MED-1, plus the authorization matrix. Cloudinary's signed upload has no per-upload byte limit, so the signed `allowed_formats` and a `c_limit` incoming transformation cap what is stored, and the client checks the byte size before uploading. |
| D2.7 | Services accept an image only if its URL is on our Cloudinary account **and** its `publicId` is in the folder for that purpose (`assertOwnImage`). Avatars set through `PATCH /users/me` follow the same rule; a Google profile photo is only stored at Google sign-in. | Spec: "rejects URLs that are not on the configured Cloudinary account". |
| D2.8 | Images are delivered through `cldUrl()` with `f_auto,q_auto` and a width. | Spec performance NFR. |
| D2.9 | Admin category **screens** come with the other admin tools in Step 10; Step 2 delivers the API, seed and upload component. | Matches the Step 2 deliverables in section 12. |
| D2.10 | Missing Cloudinary configuration is reported, never bypassed. At startup the server logs `image uploads disabled` with the missing **names**, and `npm run check:media` reports missing names and then verifies the credentials with Cloudinary's authenticated `/ping`. The public 503 message stays generic. | A repeated `POST /media/sign` 503 was caused by `server/.env` having no `CLOUDINARY_*` lines. Diagnosis should not require reading code, and secrets are never printed. |

## Step 3 - Businesses

| # | Decision | Reason |
|---|----------|--------|
| D3.1 | Food fields (cuisines, menu, price range, veg-friendly) are left out of Step 3 and added in Step 4. Rating fields exist but stay 0 until reviews (Step 9). | The spec puts the food work in Step 4. |
| D3.2 | Owners may edit only `description`, `tags`, `contact`, `openingHours` and `photos`. Name, category, kind, address, location, status and owner are admin-only. This is enforced by a strict schema per role **and** again in the service. | FR-BUS-5 ("details, hours and photos"), plus the spec rule that role and ownership are checked in services. |
| D3.3 | `DELETE /businesses/:id` (archive) is admin-only; admins hide or publish through `PATCH status`. Archived listings can be restored by setting a status again. | FR-BUS-4 gives archiving to admins; soft delete only. |
| D3.4 | Draft or hidden businesses return **404** (not 403) to the public and to other owners; their owner and admins can open them. | Avoids revealing hidden content (spec: "Resource missing or not visible to caller"). |
| D3.5 | The slug is set at creation and never changes, even when the name changes. Reserved words (`mine`, `new`, `manage`, `admin`, `search`) are never used as slugs. | Stable links; `/businesses/mine` sits alongside `/businesses/:slug`. |
| D3.6 | Added `GET /businesses/mine` (owner dashboard) and `GET /admin/businesses` (admin list, any status, search). | The owner and admin screens in Step 3's deliverables need them; the spec's API table has no list for non-published businesses. |
| D3.7 | "Near me" uses `$geoNear` with a radius (API default 5 km, max 25; the app asks for 10 km) and returns `distanceM`. Distance sort requires coordinates. | FR-BUS-2 and the spec's location parameters. |
| D3.8 | Opening hours are local "HH:MM" per weekday, evaluated in IST; slots past midnight are supported through a derived `overnight` flag so `openNow` can be an indexed query. | The spec stores times in UTC and displays them in IST; open-now must be correct late at night. |
| D3.9 | Assigning an owner requires an active user and promotes a plain `user` to `owner`. Sample (seed) businesses can never be verified. | FR-BUS-4, plus the spec rule that seed content is always unverified. |
| D3.10 | The map point is shown as an address with "View on map" and Directions links (Google Maps URL); no embedded map. | No extra infrastructure or API keys (spec section 13). |
| D3.11 | `npm run seed -- --samples` adds 8 fictional sample businesses (`isSeed`, unverified, published) with dummy `+91 90000 0000x` numbers. Plain `npm run seed` adds categories only. | Spec: seed is for development and demos only and must not leak into production by accident. |
| D3.12 | The Vite dev/preview proxy target can be overridden with `API_PROXY_TARGET` (a Node-side variable, never exposed to the browser). | Lets a second local API (tests, demos) run without disturbing the main dev server. |

## Feature - Business self-submission and admin review (approved spec change)

The owner approved adding business self-submission to Phase 1, overriding spec §1 ("business self-signup" out of scope) and decision U1.

| # | Decision | Reason |
|---|----------|--------|
| F1.1 | Any signed-in user can submit a business (`POST /businesses/submissions`). The server always sets `ownerId`, `createdBy`, `status` and `submittedAt`; the strict schema rejects `status`, `ownerId`, `isVerified`, review fields and roles sent by the client. | Approved scope change; never trust client-supplied ownership or approval. |
| F1.2 | Statuses add `pending` and `rejected`. **Approved = `published`**, so every existing "published only" public rule (lists, detail, category filters, `assertPublished`, `getPublishedIds`) already hides draft, pending, rejected, hidden and archived listings. The UI shows `published` as "Approved" to owners. | Reuses the spec's visibility rule instead of adding a parallel one. |
| F1.3 | Approval (`POST /admin/submissions/:id/approve`) works only from `pending`. It sets `published`, `reviewedBy`, `reviewedAt` and promotes the submitter from `user` to `owner`. Rejection requires a 5–500 character reason, which is stored as `rejectionReason` and shown only to the owner (`/businesses/mine/:id`) and admins. | Owner requirement; audit trail via `reviewedBy`/`reviewedAt`. |
| F1.4 | Owners edit everything while a listing is draft, pending or rejected. Once approved (published or hidden), name, category, subcategory, kind, address and location are admin-only (403); description, tags, contact, hours and photos stay directly editable. | Owner decision: material changes can't skip review. |
| F1.5 | Non-owners get **404** for another user's listing on edit, submit and `mine/:id` (not 403). | Prevents probing IDs to find out which listings exist. |
| F1.6 | Duplicate guard: a normalised name (`nameKey`: lowercase, letters and digits only, any script) must be unique per area among listings that are not rejected or archived (409). A user may have at most 3 pending and 10 open (draft, pending or rejected) submissions, and submissions are rate-limited to 20 per hour. | Prevents accidental duplicate listings and spam. |
| F1.7 | Business categories are two-level (`parentId`); events and news stay flat. Businesses store `categoryId` (main) and `subcategoryId`, and the server checks that the subcategory is active and belongs to that main category. `slug`, `type` and `parentId` never change after creation; categories are deactivated, never deleted. | Owner requirement; referenced categories stay valid. |
| F1.8 | The original Step 2 flat categories are reused as subcategories (for example Restaurants, Tiffin Centres, Sweets & Bakery, Grocery & Kirana); nothing is duplicated. `Electricians & Plumbers` and `Salons & Beauty` are superseded by more specific subcategories and are deactivated by the migration only if no business uses them. | "Extend existing categories instead of duplicating". |
| F1.9 | Health & Medical and Education are directory categories (clinics, pharmacies, schools and so on), but the Explore "Health & Hospitals" and "Education" tiles stay "Coming soon". | Owner decision: those tiles stand for later-phase modules. |
| F1.10 | When the submitter doesn't give a `kind`, it is derived from the main category (Food & Dining → food, Shopping → shop, otherwise service). | Spares users a technical field; admins can still set it. |
| F1.11 | Verifying a listing requires it to be published. | A pending or rejected listing must not carry a trust badge. |
| F1.12 | `npm run migrate:categories` is a dry run by default (`-- --apply` writes). It moves old flat category references into `subcategoryId`, backfills `nameKey`, and deactivates unused superseded subcategories. It never deletes anything, and production needs `--confirm-production`. | Safe upgrade of existing data. |
| F1.13 | Offers (Step 5), search (Step 8) and reviews (Step 9) don't exist yet. When they are built they must use `assertPublished` / `getPublishedIds`; tests already cover those guards for every non-published status. | Keeps offer and review visibility tied to approval. |
| F1.14 | Shared `Modal` keeps `onClose` in a ref so its focus effect runs only on open/close. | Bug found by the new tests: typing in a modal lost focus after the first character. |

## Step 4 - Food

| # | Decision | Reason |
|---|----------|--------|
| D4.1 | `step-4-food` was branched from `feature-business-submissions` (`10177cd`) because that pull request was not yet merged into `step-3-businesses`, and the owner said to go ahead. Once it is merged, `step-4-food` contains only the Step 4 changes on top. | Step 4 changes the same files; branching from the older Step 3 would have caused conflicts. |
| D4.2 | Cuisines are a **fixed list** (10 keys, with English and Telugu labels), at most 5 per business. | Owner choice (recommended): keeps the cuisine filter reliable. |
| D4.3 | `priceRange` (1–3) is a top-level field, as in the spec ("mainly food"); `food { cuisines, isVegFriendly, menu }` is accepted only for businesses of kind `food`, and is removed if an admin changes the kind. | Spec §7. |
| D4.4 | The menu is embedded: up to 20 sections, 60 items per section, 200 items in total; prices are whole rupee amounts from 0 to 100,000; each item has a veg/non-veg flag. Sections need a name and at least one item. | Spec rule to embed small data read with its parent; limits keep the business document and the API response small. |
| D4.5 | Owners edit price range, cuisines, veg-friendly and the menu **directly**, including on approved listings (no re-review). | Owner choice (recommended); the spec lists the menu as an owner-editable detail. |
| D4.6 | `/food` = businesses of kind `food` (spec), using the same directory component as `/businesses` with cuisine, price range and veg-friendly filters. The `cuisine` and `isVegFriendly` filters imply `kind = food`. Hotels & Stay listings stay under Local Shops & Businesses. | Spec routes and filters; no duplicated list code. |
| D4.7 | For submissions, food fields are shown when the main category is Food & Dining (whose submissions get `kind = food`); admins see them when kind is `food`; owners when their listing is a food business. | Keeps the form consistent with the server's kind rule. |
| D4.8 | List cards carry only a food summary (cuisines, veg-friendly, price range); the menu appears only on the detail page. | Spec NFR: list payloads under 100 KB. |
| D4.9 | Contact buttons wrap onto a second line when all three (call, WhatsApp, directions) don't fit at 360 px. | Found during the 360 px check. |
| D4.10 | Sample data is **never** seeded into production, with no override. `npm run seed -- --samples` fails when `NODE_ENV=production` (even with `--confirm-production`), and `seedBusinesses()` itself refuses to run in production. In production only reference categories can be seeded, and that still requires `--confirm-production`. | Owner instruction: dummy and sample data are for local development and testing only. |

## Step 5 - Offers & deals

| # | Decision | Reason |
|---|----------|--------|
| D5.1 | Owners publish offers directly; admins can manage and hide offers for any business. | Owner decision (spec FR-OFF-3). |
| D5.2 | Stored statuses are `draft`, `published` and `hidden`. **Live, scheduled and expired are derived** from a published offer's dates (`displayStatus`); the client can never set them. | Spec: "Expiry is computed, not stored". |
| D5.3 | Dates are date-only and interpreted in IST: `validFrom` = 00:00:00 IST on the start date, `validTo` = 23:59:59.999 IST on the end date, stored in UTC. The end date can be the same as the start date (a one-day offer), must be before the same date one year later, and a new or changed end date can't be in the past. | Owner decision; avoids offers disappearing 5½ hours early. |
| D5.4 | At most **10 live or scheduled** offers per business (drafts, hidden and expired don't count). The count is checked before and again after each write; a write that crosses the limit is undone and returns 409. | Owner decision; the re-check stops simultaneous requests from getting past the limit without needing a MongoDB transaction. |
| D5.5 | Only published businesses can receive new offers or publish offers; offers of a business that isn't published can still be edited as drafts. Public reads check business status at request time, so hiding or archiving a business hides its offers immediately. | Owner decision; spec §6. |
| D5.6 | Offers store only `businessId`. Category, subcategory, area and Near me filters are resolved by the new read-only `businessesService.findPublishedIds()`; business names come from `getSummariesByIds`. The offers module depends on businesses, never the reverse. | Module boundaries (spec §5–6). |
| D5.7 | The offers service turns `assertCanManage`'s 403 for another owner's business into **404**; users get 403 from the role check, visitors 401. `assertCanManage` itself is unchanged. | Requirement: no probing of other owners' businesses. |
| D5.8 | The business page loads offers from `GET /businesses/:id/offers` (default 5, maximum 20; the page asks for 3). The business detail response does not include offers. | Requirement; avoids a circular dependency and keeps the page light. |
| D5.9 | Added `GET /offers/mine?businessId=` (owner or admin management list); `GET /offers/:id` also serves owners and admins their non-public offers with management fields. | The owner and admin workspaces need every status. |
| D5.10 | Coupon codes are 3–30 letters, digits or dashes, stored in upper case. Images must use the existing `offer_image` upload type. | Validation and image-origin requirements. |
| D5.11 | `npm run seed -- --samples` adds 3 sample offers (dates relative to the run day); `seedOffers()` refuses production with no override. | Owner rule: sample data stays in local development and testing. |
| D5.12 | Not included here: claim or "show offer" tracking and analytics (Step 9), Home and search integration (Step 8). | Owner scope instruction. |
| D5.13 | **Review fix:** the "end date can't be in the past" rule applies only when the end date **changes**. Before the fix, an expired offer couldn't be edited (for example to fix a typo), because the form re-sends its unchanged end date; the server now agrees with the client. | Found in the final Step 5 review; covered by a regression test that fails without the fix. |
| D5.14 | **Why the limit is concurrency-safe:** every write that would add a live or scheduled offer is saved first, then the business's offers are counted, and the write is undone if the count is over 10. For any set of accepted offers, consider the one whose count ran last: by then every accepted offer had been written and none had been undone, so its count was at least the number accepted, and it was ≤ 10. So more than 10 can never be accepted. The worst case is a few simultaneous requests all being refused near the limit (safe). Tested with 20 simultaneous creates, 15 simultaneous publishes and mixed requests. A MongoDB transaction isn't needed, so the same code works on the in-memory test database and on Atlas. | Requirement: the limit must be safe against simultaneous requests. |
