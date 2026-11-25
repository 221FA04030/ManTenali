# ManTenali
Mana Tenali is a local discovery and community platform designed for Tenali, Andhra Pradesh. Discover nearby businesses, restaurants, offers, events, and local news in one place. Built with React, Vite, Node.js, Express, and MongoDB Atlas, with a vision to connect the people and businesses of Tenali through a single digital platform.

## Getting started

Requirements: Node.js 20+ (developed on Node 24) and npm 10+.

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
npm run seed -- --samples   # also adds demo businesses, offers and events labelled "Sample data" (local dev/test only; always refused in production)
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
| Admin | `admin@demo.example` | `DemoAdmin#2026` | Admin pages: business and event review, categories, events, verify |
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

The first server test run downloads a MongoDB binary for `mongodb-memory-server` (cached afterwards).

## Project layout

```
server/   Express API - modular monolith (src/modules/<feature>/<feature>.{routes,controller,service,model,validation,test}.js)
client/   React + Vite SPA (src/app, src/features, src/components/ui, src/lib, src/locales)
DECISIONS.md   implementation decisions
```

API base path: `/api/v1`. Health check: `GET /api/v1/health`.
