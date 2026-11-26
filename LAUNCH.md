# Launch checklist (Phase 1)

Work through this before telling people about Mana Tenali. Deployment steps are in `DEPLOY.md`.

## Content and data

- [ ] Reference categories are in the production database: `npm run seed -- --confirm-production`.
- [ ] One admin exists: `npm run seed:admin -- --confirm-production`, then remove `ADMIN_SEED_PASSWORD` from
      `server/.env`.
- [ ] `npm run check:launch` prints **Ready** against production. It is read-only and checks: reference
      categories, an active admin, **no sample data** (sample data can't be seeded in production, and this
      proves it), indexes, and which optional services are off. It prints names and counts only.
- [ ] Admins have entered real businesses, offers, events and news. Verify businesses you have checked in person
      (the "Verified" badge).
- [ ] Every news item names its source; time-limited notices have a "show until" time.

## Accounts and access

- [ ] Admin accounts belong to people you trust (Admin > Users). Admins see private evidence and can block anyone.
- [ ] Google sign-in works on the real domain (if enabled).
- [ ] Photo upload works: `npm run check:media`, then upload a test photo (if enabled).

## Production settings

- [ ] `https://api.<domain>/api/v1/health` returns `ok` / `up`; UptimeRobot watches it.
- [ ] App and API are on the same domain; signing in on the phone keeps you signed in.
- [ ] `client/vercel.json`: `connect-src` narrowed to the real API domain (see `DEPLOY.md` step 4.5).
- [ ] Atlas automated backups are on (paid tier), and you know how to restore one. `npm run seed` rebuilds
      reference data.
- [ ] `main` is protected on GitHub and requires the CI check.
- [ ] Evidence retention: schedule `npm run cleanup:evidence -- --apply` monthly (deletes event evidence 180 days
      after the final decision). Activity events delete themselves after 180 days.

## Manual check on a real phone (spec section 14)

On a mid-range Android phone over mobile data, in English and in Telugu:

- [ ] Home loads; search finds a business by a partial name and by a misspelling.
- [ ] Call / WhatsApp / Directions open the right apps.
- [ ] Near me asks for location only when tapped; the area picker works without it.
- [ ] Save, Share, Report and writing a review work; the Saved page shows saved items.
- [ ] Submit an event with a photo of a poster; approve it as admin; it appears in Events.
- [ ] Admin > Reports: hide a test report's content; Admin > Metrics shows the visits.

## Step 10 audit results (local, production build)

Measured on the production build served with `client/vercel.json`'s headers, against the demo data, at 360 px.

**Accessibility (axe-core 4.14, WCAG 2.1 A/AA):** 26 screens (visitor, signed-in user, admin):
**0 violations** after these fixes:

- Cancelled-event date block: solid gray instead of 50% opacity (white text contrast).
- Traffic and weather news badges: darker orange and blue text on their light tints (AA 4.5:1).
- Admin events "Restore" button: its accessible name now matches the visible label.

**Content-Security-Policy:** no violations on any screen (Zod's eval-based fast path is turned off on the client).

**Load time** (Lighthouse mobile profile: slow 4G 1.6 Mbps / 150 ms, CPU 4x slower, empty cache, gzip):

| Page | First paint | Largest paint | Content shown | Transferred |
|------|-------------|---------------|---------------|-------------|
| Home | 2.7 s | 3.6 s | 5.0 s (feed) | 299 KB |
| Search | 1.8 s | 3.3 s | 3.5 s | 254 KB |
| Business | 1.8 s | 3.2 s | 3.4 s | 244 KB |

Spec target "first meaningful screen under 3 s on 4G": met (search box and tiles at 2.7 s on the slow profile).
Home's feed arrives after its code loads; prefetching `/home` earlier is a possible later improvement.

**API (local database, 25 requests each):** p95 between 8 and 45 ms (`/home` 45 ms, search with typo fallback
28 ms) against the spec's 500 ms (lists) and 800 ms (search). Atlas adds network time; there is wide headroom.

**Bundle:** first load about 146 KB of compressed JavaScript; routes are code-split; the Sentry browser SDK (153 KB
compressed) is loaded only when `VITE_SENTRY_DSN` is set.
