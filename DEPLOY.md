# Deploying Mana Tenali (Vercel + Render)

Spec section 13: the web app is a static site on **Vercel**, the API is one always-on Node service on
**Render**, data is in **MongoDB Atlas**, images in **Cloudinary**. Errors go to **Sentry** (optional) and
uptime is watched by **UptimeRobot**.

Nothing secret is stored in the repository. Every secret is typed once into the Vercel or Render dashboard.

## 0. Before you start: one domain

The app and the API **must share one registrable domain**, for example `manatenali.in` (app) and
`api.manatenali.in` (API). The session cookie is `SameSite=Lax`, and browsers only send it between sites under
the same domain. The default `*.vercel.app` and `*.onrender.com` addresses are different sites, so **sign-in will
not work across them**. Buy the domain first and use it for both.

Below, `manatenali.in` stands for your domain.

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

## Updating

Merge to `main`: Render redeploys the API (it waits for the health check before switching traffic) and Vercel
rebuilds the app. Run `npm run check:launch` against production after changes to categories or admins.
