# ManTenali
Mana Tenali is a local discovery and community platform designed for Tenali, Andhra Pradesh. Discover nearby businesses, restaurants, offers, events, and local news in one place. Built with React, Vite, Node.js, Express, and MongoDB Atlas, with a vision to connect the people and businesses of Tenali through a single digital platform.

## Getting started

Requirements: Node.js 22.9+ (the scripts use `node --env-file-if-exists`; developed on Node 24) and npm 10+.

```bash
npm install                       # installs server + client (npm workspaces)
cp server/.env.example server/.env  # then fill in real values locally (never commit .env)
npm run dev                       # API on http://localhost:4000, app on http://localhost:5173
```

The client proxies `/api` to the API in development, so the session cookie is same-origin.

### MongoDB Atlas

`MONGODB_URI` is read **only** from `server/.env` (git-ignored). It is validated at startup,
never logged and never sent to the client. Tests do not need it - they use an in-memory MongoDB.

### First-time data

```bash
npm run seed:admin   # creates the first admin from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in server/.env
npm run seed         # reference categories (safe to re-run; never overwrites admin edits)
npm run seed -- --samples   # also adds demo businesses, offers, events and news labelled "Sample data" (local dev/test only; always refused in production)
```

### Local demo with sample data (development only)

```bash
npm install
npm run demo                  # in-memory database + demo data, API :4055, web app http://localhost:5174
npm run demo -- --cloudinary  # same, plus uploads and evidence previews via your Cloudinary account
```

`npm run demo` starts a **throwaway in-memory MongoDB** (`mongodb-memory-server`), loads the demo data,
then starts the API and the web app. Stop it with Ctrl+C; every change is lost, and the next run starts fresh.
It runs alongside `npm run dev` (different ports).

Safety:
- It never reads `MONGODB_URI`, `JWT_SECRET` or Google settings from `server/.env`, so it cannot touch MongoDB Atlas.
  The loader also refuses any database that isn't a local `mongodb://127.0.0.1` or `localhost`.
- It refuses to start when `NODE_ENV=production`, in the shell or in `server/.env`. This is an error, not a warning.
- Re-running the loader never duplicates records; it never deletes or overwrites anything.
- `--cloudinary` reads only the three `CLOUDINARY_*` values and uploads the two synthetic fixtures as **private** files
  under fixed names in `mana-tenali/evidence/u_64d0de…` (overwritten on each run, so they don't pile up).

**Demo accounts - development only. Never create these accounts or use these passwords in production.**

| Role | Email | Password | Use it to test |
|------|-------|----------|----------------|
| Admin | `admin@demo.example` | `DemoAdmin#2026` | Admin pages: business and event review, categories, events, news, verify; hide reviews; reports queue, users, metrics |
| Owner | `owner@demo.example` | `DemoOwner#2026` | Padma's businesses (approved, draft), menus, offers in every state |
| Owner | `owner2@demo.example` | `DemoOwner#2026` | Suresh's businesses (approved, hidden, archived); Telugu interface |
| User | `user@demo.example` | `DemoUser#2026` | Pending business submission; event submissions with private evidence |
| User | `user2@demo.example` | `DemoUser#2026` | Rejected business; rejected and withdrawn events; Telugu; no access to others' evidence |
| User (blocked) | `blocked@demo.example` | `DemoUser#2026` | Sign-in is refused for blocked accounts |

What the demo data covers (all names end in "(Demo)" or "(Sample)"; dates are relative to the day you run it):

| Records | Tests |
|---------|-------|
| 8 "(Sample)" businesses, 3 offers, 2 events (same as `npm run seed -- --samples`) | Lists, filters, Near me, contact buttons, the "Sample data" badge |
| Padma Andhra Meals and Padma Juice Corner: approved food businesses with menus, cuisines, price range and veg items; the juice corner is open past midnight | Food filters, menu and veg-only toggle, "open now" across midnight, owner editing |
| Padma Home Bakery (draft), Anil Tea Stall (pending), Lakshmi Mobile Repairs (rejected, with reason), Suresh Cycle Store (hidden), Suresh Photo Studio (archived) | Only approved listings are public; owners see their own; the admin review queue; resubmitting after rejection |
| Offers: live with a coupon, ending today, upcoming, expired, hidden, draft, and a live offer on a hidden business | The offers feed shows only live offers of approved businesses; the owner's offer list groups them by status |
| Events: upcoming with a linked business and booking link, all-day over 2 days, workshop tomorrow, past (10 days ago), cancelled (with reason), hidden, draft | Event filters, "Show past events", the cancelled label, IST times, admin event management |
| Submissions: pending review, changes requested, rejected, withdrawn, and an approved community event, each with private evidence | Submitter and admin moderation flows; evidence is visible only to the submitter and admins |
| News: 3 "(Sample)" items plus pinned water notice, weather alert, announcement, local news, an expired power cut, and hidden, draft and removed items | Type filter, pinned first, "show until" times, the expired label on old links, admin news management |
| Reviews (Padma Andhra Meals 4.5 from 2; one hidden review), Anil's 4 saved items (one hidden business shown as "no longer available"), 3 open reports including a suggestion | Reviews and ratings, Saved page, Report and Suggest, the admin reports API |

Private evidence fixtures are synthetic: a placeholder poster (`demo-poster.png`) and a one-page PDF
(`demo-venue-letter.pdf`) labelled "not a real document", in `server/src/scripts/demo/fixtures/`.
Public pages and APIs never include them. Without `--cloudinary`, preview and download links say uploads are not available.
Images aren't seeded: business and offer cards show the app's built-in placeholders.

### Upgrading an existing database to two-level categories

If you ran `npm run seed` before business submissions were added:

```bash
npm run seed                                # adds main categories, attaches existing ones (non-destructive)
npm run migrate:categories                  # dry run: shows what would change
npm run migrate:categories -- --apply       # moves business category references, backfills keys
```

### Business submissions (API summary)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/v1/businesses/submissions` | Signed in | Submit a business (`submit: true`) or save a draft |
| GET | `/api/v1/businesses/mine` | Signed in | My businesses with status and rejection reason |
| GET | `/api/v1/businesses/mine/:id` | Owner | One of my listings (for editing) |
| PATCH | `/api/v1/businesses/:id` | Owner / Admin | Edit (owners: all fields before approval, details/hours/photos after) |
| POST | `/api/v1/businesses/:id/submit` | Owner | Submit a draft or resubmit a rejected listing |
| GET | `/api/v1/admin/submissions?status=pending\|published\|rejected` | Admin | Review queue |
| GET | `/api/v1/admin/submissions/:id` | Admin | Submission detail with submitter and reviewer |
| POST | `/api/v1/admin/submissions/:id/approve` | Admin | Approve (goes live, submitter becomes owner) |
| POST | `/api/v1/admin/submissions/:id/reject` | Admin | Reject with a required `reason` |
| POST / PATCH | `/api/v1/categories` (`parentId` for subcategories) | Admin | Manage categories (deactivate, never delete) |

Only approved (`published`) businesses appear in public lists, filters and detail pages.

### Offers (API summary)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/v1/offers` | Public | Live offers of published businesses; filters `businessId`, `categoryId`, `subcategoryId`, `area`, `lat`/`lng`/`radiusKm`; `sort=endingSoon\|newest`; paginated |
| GET | `/api/v1/offers/:id` | Public (owner/admin see their non-public offers) | Offer detail with business summary |
| GET | `/api/v1/businesses/:id/offers?limit=` | Public | A business's live offers (default 5, max 20) |
| GET | `/api/v1/offers/mine?businessId=` | Owner / Admin | All offers of a managed business with derived status |
| POST | `/api/v1/offers` | Owner / Admin | Create (`status`: `draft` or `published`) |
| PATCH | `/api/v1/offers/:id` | Owner / Admin | Edit, publish, unpublish or hide |
| DELETE | `/api/v1/offers/:id` | Owner / Admin | Hide (the record is kept) |

Offer dates are date-only and use India time: valid from 00:00 IST on the start date to 23:59 IST on the end date.

### Events (API summary)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/v1/events` | Public | Upcoming published and cancelled events; filters `from`/`to` (IST dates), `categoryId`, `area`, `lat`/`lng`/`radiusKm`, `includePast=true` (last 90 days); paginated |
| GET | `/api/v1/events/:slug` | Public (admins can preview other statuses) | Event detail |
| POST | `/api/v1/events/submissions` | Signed in | Submit an event with 1–5 private evidence files (goes to review) |
| GET | `/api/v1/events/submissions/mine` | Signed in | Your submissions and their status |
| GET / PATCH | `/api/v1/events/submissions/:id` | Submitter | View; edit while pending or changes requested |
| POST | `/api/v1/events/submissions/:id/resubmit` \| `withdraw` | Submitter | Resubmit after changes are requested, or withdraw |
| POST / DELETE | `/api/v1/events/submissions/:id/evidence[/:evidenceId]` | Submitter | Add or remove evidence (at least one file stays) |
| POST | `/api/v1/events/submissions/:id/evidence/:evidenceId/access` | Submitter / Admin | 5-minute private preview (images) and download links |
| GET | `/api/v1/admin/event-submissions[/:id]` | Admin | Review queue (pending oldest first) and full review view |
| POST | `/api/v1/admin/event-submissions/:id/approve` \| `reject` \| `request-changes` | Admin | Decide (`reason` / `note` required for reject and request changes) |
| GET | `/api/v1/admin/events` | Admin | All events, any status |
| POST / PATCH / DELETE | `/api/v1/events[/:id]` | Admin | Create; edit, publish, cancel (with reason) or hide; remove (soft) |

Event times are entered and shown in India time (IST). Evidence files are private: they are never returned by public
endpoints, and only the submitter and admins can open them. Run `npm run cleanup:evidence` (dry run) and
`npm run cleanup:evidence -- --apply` to delete evidence 180 days after the final decision.

### News and notices (API summary)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/v1/news` | Public | Published items that haven't expired, pinned first, newest next; filters `type` (`news`, `traffic`, `weather`, `power`, `water`, `announcement`), `categoryId`; paginated |
| GET | `/api/v1/news/:slug` | Public (admins can preview other statuses) | Detail with source, published and updated times; an expired notice opens labelled "expired" |
| POST | `/api/v1/news` | Admin | Create (`status`: `draft` or `published`; optional `isPinned`, `validUntil`) |
| PATCH | `/api/v1/news/:id` | Admin | Edit, publish, unpublish (draft), hide, pin or unpin |
| DELETE | `/api/v1/news/:id` | Admin | Remove (soft: the record is kept and unpinned) |
| GET | `/api/v1/admin/news[/:id]` | Admin | Management list (any status; filters `status`, `type`, `q`) and editing view |

Every item names its source. "Show until" (`validUntil`) is entered in India time (IST, `YYYY-MM-DDTHH:mm`);
after it passes, the item drops out of lists. At most 5 published, unexpired items can be pinned at once
(pinned drafts and hidden items don't count). "Updated" shows the last content edit, not pinning or status changes.

### Search and Home feed (API summary)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/v1/search?q=` | Public | One query across businesses, offers, events and news. `type=all` (default) returns up to 5 per type with `counts`; `type=business\|offer\|event\|news` returns one page (`page`, `limit`, `meta`). Filters `area`, `lat`/`lng`/`radiusKm`; `sort=relevance\|distance` (distance needs a location) |
| GET | `/api/v1/search/suggest?q=` | Public | Autocomplete: published business names and active business categories |
| GET | `/api/v1/home` | Public | Home feed: `banner` (up to 5: pinned news, next events, offers ending soon), `today` (latest notices + next event), `nearby` businesses (`lat`/`lng` or `area`, falling back to all of Tenali), `offers`, `events`, `news` |

Search matches every word at the start of a word (so "biry" finds "Biryani"), in English or Telugu, and also
matches category names. Only public items are returned, using each module's own rules (approved businesses, live
offers of approved businesses, upcoming published or cancelled events, unexpired news). When nothing matches, it
retries allowing one typo per word and says so (`fuzzy: true`). News is town-wide, so area and Near me filters
don't apply to it. Search has its own rate limit (60 requests per minute per IP).

### Saved items, reviews, reports and analytics (API summary)

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET / POST | `/api/v1/favorites` | Signed in | My saved businesses, offers and events (with their cards; `item: null` once no longer public) / save one (`targetType`, `targetId`) |
| DELETE | `/api/v1/favorites/:id` | Signed in | Remove one of my saved items |
| GET | `/api/v1/businesses/:id/reviews` | Public | Published reviews, newest first, paginated |
| POST | `/api/v1/businesses/:id/reviews` | Signed in | One review per user per business (`rating` 1-5, optional `comment`); not for your own business |
| GET | `/api/v1/businesses/:id/reviews/mine`, `/api/v1/reviews/mine` | Signed in | My review of a business / all my reviews (profile) |
| PATCH / DELETE | `/api/v1/reviews/:id` | Author / Admin | Edit or delete my review; an admin's DELETE hides someone else's review |
| POST | `/api/v1/reports` | Signed in | Report a business, review, offer, event or news item with a reason, or send a suggestion (`targetType: suggestion`) |
| GET / PATCH | `/api/v1/admin/reports[/:id]` | Admin | Moderation queue; `action`: `dismiss`, `mark_reviewed`, `hide_target` (archives the content, restorable), `block_user`, `hide_and_block` |
| POST | `/api/v1/analytics/events` | Public | Anonymous activity event: `view`, `contact_click`, `offer_view`, `share`, `search` (strict rate limit) |
| GET | `/api/v1/admin/analytics/summary?from=&to=` | Admin | Counts by type and IST day, and distinct anonymous sessions (default last 7 days, at most 92) |

Ratings are recalculated from published reviews after every change. Analytics events store only a random
device id kept in the browser (`mt.sid`): no account, IP address, search words or location, and they are deleted
automatically after 180 days. The admin screens for the reports queue and metrics come with Step 10.

### Admin content moderation

Admins can archive (take off the website, restorable), restore and permanently delete businesses, offers,
events, news, community posts, comments and reviews. Admins see a three-dot menu on every card and detail page
(regular users and visitors never see it), and the `/admin/moderation` dashboard lists everything by type.

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/v1/admin/moderation?type=&status=&q=&author=&page=&limit=` | Admin | One content type (`business`, `offer`, `event`, `news`, `post`, `comment`, `review`); `status` `all` (default), `published` or `archived`; `q` searches the title or text; `author` is a name, email or user id |
| GET | `/api/v1/admin/moderation/:type/:id` | Admin | One item's moderation state (the menu uses it to offer Archive or Restore) |
| POST | `/api/v1/admin/moderation/:type/:id/archive` | Admin | Archive, with an optional `reason` (max 500 characters) |
| POST | `/api/v1/admin/moderation/:type/:id/restore` | Admin | Restore to the status it had before archiving |
| DELETE | `/api/v1/admin/moderation/:type/:id` | Admin | Delete permanently; the body must be `{ "confirm": true }` (optional `reason`) |
| GET | `/api/v1/admin/moderation/audit?contentType=&contentId=&page=` | Admin | Audit log of archive, restore and delete actions, newest first |

- **Archive** reuses each content type's existing `hidden` status, which every public query already excludes
  (lists, search, Home, feeds, saved items and the item's own URL, which answers 404). A `moderation`
  record on the item stores `archivedAt`, `archivedBy`, `reason` and the status to restore; it exists only while
  the item is archived and is never sent to the public. Owners and authors cannot publish an archived item again.
- **Delete permanently** removes the record and its dependent data: a business takes its offers and reviews
  with it, a post takes its likes and comments; saves of the item are removed and open reports about it are
  closed as handled. Events and posts that only mention a deleted business keep their text and lose the link.
  Images are deleted from Cloudinary only when no other record uses them (best effort). User accounts are
  never deleted.
- **Security:** every endpoint sits behind `authenticate` + `authorize('admin')`; the role is read from the
  database on every request (a role sent by the browser is ignored, and users cannot change their own role).
  Types, ids and bodies are validated strictly; normal create and edit endpoints reject `moderation` fields.
- **Audit log** (`moderation_audit` collection): admin, content type and id, action, reason, a short title and
  the time. No API can edit or delete entries; only admins can read them.

### Admin tools and launch (Step 10)

| Screen | Path | What it does |
|--------|------|--------------|
| Content moderation | `/admin/moderation` | Every kind of user content by type: published, archived or all; search by title and author; archive, restore and delete permanently; the moderation audit log |
| Reports & suggestions | `/admin/reports` | Moderation queue by status: open the content, dismiss, mark reviewed, hide content, block the author |
| Users | `/admin/users` | Search people, change roles, block and unblock (every change is confirmed; not your own account) |
| Metrics | `/admin/metrics` | Anonymous launch metrics: activity per day, active devices, searches that led to a contact, 7-day return rate, event views and shares, listing freshness |

| Command | What it does |
|---------|--------------|
| `npm run check:launch` | Read-only launch readiness report for the database in `server/.env` (categories, admin, no sample data, indexes, optional services) |

Deployment (Vercel + Render) is described in `DEPLOY.md`; the launch checklist and the Step 10 accessibility and
performance results are in `LAUNCH.md`. CI (`.github/workflows/ci.yml`) runs lint, tests, build and an audit on
every pull request.

### Images (Cloudinary)

Photo uploads use **Cloudinary** (signed direct uploads). Add these three variables to `server/.env`
(values from Cloudinary Console -> Settings -> API Keys; no quotes or spaces):

```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Then restart the server (`npm run dev` reads `server/.env` only when it starts) and verify:

```bash
npm run check:media   # reports missing variable names, then checks the credentials with Cloudinary
```

Until all three are set, everything else works but `POST /api/v1/media/sign` returns
`503 SERVICE_UNAVAILABLE`, the upload button shows "Photo uploads are not available yet", and the server
logs `image uploads disabled` with the missing names at startup. The secret never leaves the server.

### Common commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run API and web app together |
| `npm test` | Server (Vitest + Supertest + mongodb-memory-server) and client (Vitest + Testing Library) tests |
| `npm run lint` | ESLint for server and client |
| `npm run build` | Production build of the web app (`client/dist`) |
| `npm run check:media` | Check the Cloudinary (image upload) configuration |
| `npm run demo` | Local demo stack with in-memory data and demo accounts (development only) |
| `npm run cleanup:evidence` | Evidence retention: dry run; add `-- --apply` to delete files 180 days after the final decision |
| `npm run check:launch` | Read-only launch readiness report (see `LAUNCH.md`) |

The first server test run downloads a MongoDB binary for `mongodb-memory-server` (cached afterwards).

## Project layout

```
server/   Express API - modular monolith (src/modules/<feature>/<feature>.{routes,controller,service,model,validation,test}.js)
client/   React + Vite SPA (src/app, src/features, src/components/ui, src/lib, src/locales)
DECISIONS.md   implementation decisions
DEPLOY.md      deployment (Vercel + Render + Atlas)
LAUNCH.md      launch checklist and Step 10 audit results
```

API base path: `/api/v1`. Health check: `GET /api/v1/health`.
