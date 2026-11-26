# Deploying Mana Tenali (Vercel + Render)

Spec section 13: the web app is a static site on **Vercel**, the API is one always-on Node service on
**Render**, data is in **MongoDB Atlas**, images in **Cloudinary**. Errors go to **Sentry** (optional) and
uptime is watched by **UptimeRobot**.

Nothing secret is stored in the repository. Every secret is typed once into the Vercel or Render dashboard.

## 0. Before you start: choose how the app reaches the API

The session cookie is `SameSite=Lax`, so the browser must see the app and the API as the **same site**.
There are two supported setups:

- **A. One address, API proxied by Vercel (the current deployment).** The app is served from one
  address (today `https://manatenali.vercel.app`) and `client/vercel.json` rewrites every `/api/...`
  request to the Render service. The browser only ever talks to the Vercel address, so the cookie is a
  plain first-party cookie and no custom domain is needed. See section 8.
- **B. Your own domain for both.** For example `manatenali.in` (app) and `api.manatenali.in` (API). The
  default `*.vercel.app` and `*.onrender.com` addresses are different sites, so with this setup sign-in only
  works once both use the same registrable domain. Sections 2 to 4 describe this setup, with
  `manatenali.in` standing for your domain.

## 1. MongoDB Atlas

1. Create a project and a cluster (M0 is fine for testing; spec: M10 for production traffic, which also turns on
   automated backups).
2. **Database Access:** create a user with `readWrite` on the `mana_tenali` database only.
3. **Network Access:** allow Render's outbound addresses (Render dashboard > service > *Outbound IPs*), or
   `0.0.0.0/0` if your plan has no fixed outbound IPs. The strong password then becomes the main protection.
4. Copy the connection string (`mongodb+srv://...`). It goes into Render as `MONGODB_URI` and nowhere else.

## 2. API on Render

1. Render > **New > Blueprint** > pick this GitHub repository. Render reads `render.yaml`
   (service `mana-tenali-api`: Node 22, Singapore region, `starter` plan, health check `/api/v1/health`).
   Use an always-on plan: the free plan sleeps, which breaks the uptime target.
2. Fill in the values Render asks for:

   | Variable | Value |
   |----------|-------|
   | `MONGODB_URI` | the Atlas connection string |
   | `JWT_SECRET` | a long random value: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `CLIENT_ORIGIN` | `https://manatenali.in,https://www.manatenali.in` (https only, comma-separated) |
   | `COOKIE_DOMAIN` | `.manatenali.in` |
   | `GOOGLE_CLIENT_ID` | from Google Cloud (optional; Google sign-in is off without it) |
   | `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | from Cloudinary (optional; uploads are off without them) |
   | `SENTRY_DSN` | from Sentry (optional) |

   `NODE_ENV=production` and `TRUST_PROXY=1` are already set by the Blueprint.
   In production the API **refuses to start** with an `http://` origin, a malformed cookie domain or a local
   database, and says which variable is wrong (never its value).
3. **Settings > Custom Domains:** add `api.manatenali.in` and create the DNS record Render shows.
4. Check: `https://api.manatenali.in/api/v1/health` returns `{"status":"ok","db":"up"}`.

## 3. First data (once)

From your own computer, with a `server/.env` that points at the **production** database (keep that file
private and delete the admin password from it afterwards):

```bash
npm run seed -- --confirm-production      # reference categories only (sample data is always refused in production)
npm run seed:admin -- --confirm-production # the first admin, from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD
npm run check:launch                       # read-only readiness report (see LAUNCH.md)
```

Real listings, offers, events and news are then entered by admins in the app.

## 4. Web app on Vercel

1. Vercel > **Add New > Project** > import this repository.
2. **Root Directory: `client`**. Vercel detects the npm workspace and installs from the repository root;
   `client/vercel.json` sets the build (`npm run build`, output `dist`), the single-page-app rewrite, long caching
   for `/assets`, and the security headers (CSP, HSTS, no framing).
3. Environment variables (Production). These are public values; none of them are secrets:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://api.manatenali.in/api/v1` |
   | `VITE_GOOGLE_CLIENT_ID` | same as the API's `GOOGLE_CLIENT_ID` (optional) |
   | `VITE_CLOUDINARY_CLOUD_NAME` | your cloud name (optional) |
   | `VITE_SENTRY_DSN` | the browser project's DSN (optional) |

4. **Settings > Domains:** add `manatenali.in` (and `www.manatenali.in` redirecting to it).
5. **Tighten the CSP** once the API domain is known: in `client/vercel.json`, change `connect-src 'self' https:`
   to `connect-src 'self' https://api.manatenali.in https://api.cloudinary.com https://accounts.google.com`
   (add your Sentry ingest host if you use Sentry). The shipped value allows any https endpoint so a first
   deployment can't break on an unknown domain.

## 5. Google sign-in (optional)

Google Cloud Console > APIs & Services > Credentials > OAuth client (Web): add `https://manatenali.in` to
**Authorized JavaScript origins**. Use the client id for both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.

## 6. Monitoring

- **Sentry (optional):** create two projects (Node, React). Put the DSNs in `SENTRY_DSN` (Render) and
  `VITE_SENTRY_DSN` (Vercel). Only unexpected errors are sent, with the route and request id; no cookies,
  headers, bodies, query strings, user details or breadcrumbs. Nothing is sent while the DSN is empty, and the
  browser SDK is not even downloaded.
- **UptimeRobot:** an HTTP(s) monitor on `https://api.manatenali.in/api/v1/health` every 5 minutes. It returns
  503 when the database is unreachable, so database outages alert too.

## 7. Continuous integration

`.github/workflows/ci.yml` runs lint, all tests, the build and a dependency audit on every pull request and on
`main`. In GitHub > Settings > Branches, protect `main` and require the **CI** check (spec section 13).

## 8. Current deployment: Vercel proxy in front of Render (setup A)

This is how the live app is set up (commit `1f5a329`):

```
browser --https--> manatenali.vercel.app --(Vercel rewrite)--> mantenali-3.onrender.com --> API
                   /api/* only                                  Render's own proxy
```

- `client/vercel.json` rewrites `/api/:path*` to `https://mantenali-3.onrender.com/api/:path*`; every other
  path serves the single-page app. If the Render address changes, update that rewrite.
- **Vercel environment:** leave `VITE_API_URL` **unset**, so the app calls the default `/api/v1` on its own
  address. Setting it to the Render address would bypass the proxy and break sign-in.
- **Render environment:**
  - `CLIENT_ORIGIN=https://manatenali.vercel.app`: the address people open. The API rejects writes whose
    `Origin` is not in this list.
  - `COOKIE_DOMAIN` **empty**: the cookie then belongs to the Vercel address only. A value such as
    `.vercel.app` is a public suffix and browsers refuse it.
- **CSP:** the API is same-origin here, so `connect-src 'self'` already covers it. Only Cloudinary uploads,
  Google sign-in and Sentry need extra `connect-src` hosts (see section 4, step 5).
- **Google sign-in:** add `https://manatenali.vercel.app` to the OAuth client's authorised JavaScript origins.
- **Health check through the proxy:** `https://manatenali.vercel.app/api/v1/health`. UptimeRobot can watch
  this address, or the Render address directly.

### `TRUST_PROXY` with two proxies: not yet verified

`render.yaml` sets `TRUST_PROXY=1`, which was correct when browsers called Render directly (Render runs one
proxy in front of the service). With the Vercel rewrite there are two proxies, and the right value depends on
what Vercel sends to Render in `X-Forwarded-For`. Neither Vercel nor Render documents this for external
rewrites, so it has **not** been verified:

- If Vercel sends the visitor's address and Render appends Vercel's, the right value is `2`.
- If Vercel does not pass the visitor's address on, the API cannot see it. Every visitor then shares Vercel's
  few outgoing addresses.

Why it matters: per-address rate limits (sign-in, sign-up, posting, reports) use this value. With `1` behind
the Vercel proxy, the API probably sees Vercel's address, so busy periods could throttle unrelated people
together. A value that is too high lets a visitor fake their address and get round the limits. **Do not change
it by guessing.**

To verify it safely, without touching production:

1. Deploy a throwaway Render web service (not the production one) that responds with its request headers.
2. Point a Vercel **preview** deployment's `/api/:path*` rewrite at it, and open the preview from a phone on
   mobile data.
3. Read `X-Forwarded-For`: count the addresses after the phone's public address. That count, plus one, is
   the hop count. Set `TRUST_PROXY` to that number in the Render dashboard, then delete the throwaway service.

If the phone's address does not appear at all, keep `TRUST_PROXY=1`. Per-person limits would then need a
different key, such as the signed-in user, or setup B.

## Updating

Merge to `main`: Render redeploys the API (it waits for the health check before switching traffic) and Vercel
rebuilds the app. Both happen automatically on every push to `main` (`autoDeploy: true` in `render.yaml`, and
Vercel's Git integration). Run `npm run check:launch` against production after changes to categories or admins.
