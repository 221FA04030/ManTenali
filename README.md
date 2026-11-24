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
npm run seed -- --samples   # also adds demo businesses labelled "Sample data" (development only)
```

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

The first server test run downloads a MongoDB binary for `mongodb-memory-server` (cached afterwards).

## Project layout

```
server/   Express API - modular monolith (src/modules/<feature>/<feature>.{routes,controller,service,model,validation,test}.js)
client/   React + Vite SPA (src/app, src/features, src/components/ui, src/lib, src/locales)
DECISIONS.md   implementation decisions
```

API base path: `/api/v1`. Health check: `GET /api/v1/health`.
