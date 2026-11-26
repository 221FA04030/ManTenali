# Images to supply

Mana Tenali never shows stock or made-up photos as a real Tenali business,
event or person. Every screen works without photos: cards fall back to the
category icon, and a business page without photos shows a plain "No photos yet"
cover (owners and admins see an **Add photos** button there). When you upload
real photos, they appear everywhere automatically. No code changes are needed.

All uploads go straight from the browser to Cloudinary through the app's
signed upload (JPEG, PNG or WebP). Cloudinary resizes and compresses them, so
upload the original photo.

## 1. Content photos (upload in the app)

| What | Where to upload | Who can upload | Max size | Best shape | Shown on |
|---|---|---|---|---|---|
| Business photos (up to 8; the first is the cover) | Manage → your business → the "Photos" field of the form (admins: Admin → Businesses → Edit) | Owner of the listing, admins | 5 MB | Landscape 16:9, at least 1280 × 720 | Business cards (square crop), business page gallery, Home sections, search, saved items |
| Offer image | Manage → business → Offers → New/Edit | Owner, admins | 5 MB | Square 1:1, at least 800 × 800 | Offer cards and offer page |
| Event banner | Admin → Events → New/Edit, or when approving a submission | Admins | 5 MB | Landscape 16:9, at least 1280 × 720 | Event page banner, event card thumbnail, Home banner |
| News cover | Admin → News → New/Edit | Admins | 5 MB | Landscape 16:9, at least 1280 × 720 | News page |
| Community post photo | Community → Write a post | Any signed-in user | 5 MB | Any; landscape works best | Feed card and post page |
| Profile photo | Profile → "Profile photo" | Any signed-in user | 2 MB | Square, at least 400 × 400 | Profile, posts and comments |

### Most useful first

For launch, the photos that make the biggest difference are:

1. **A cover photo for every published business**: the shop front with its
   name board visible, in daylight. Add one inside photo, such as the counter,
   the menu board or the products.
2. **Food places**: one photo of a signature dish, alongside the shop front.
3. **Upcoming events**: the official poster or a photo of the venue as the banner.
4. **Pinned news and notices**: a relevant local photo (for example the
   municipal office or the affected road), only if you have one.

## 2. App and brand images (files in the code)

These are optional and only you can provide them (they need your branding):

| File | Size | Purpose | Status |
|---|---|---|---|
| `client/public/favicon.svg` | vector | Browser tab icon | Present |
| `client/public/apple-touch-icon.png` | 180 × 180 PNG | Icon when added to an iPhone home screen | Not yet supplied |
| `client/public/icon-192.png`, `icon-512.png` | 192 × 192 and 512 × 512 PNG | Android home-screen icon (needs a web app manifest) | Not yet supplied |
| `client/public/og-image.png` | 1200 × 630 PNG | Preview picture when a link is shared on WhatsApp or Facebook | Not yet supplied |

Send these files, or add them to `client/public/`, and the matching
`<link>`/`<meta>` tags can then be added to `client/index.html`.

## 3. Rules for every photo

- **Real and current.** Photos must show the actual business, event or place.
  Do not use photos from Google, other websites or stock libraries.
- **Permission.** Only upload photos you took or have the owner's permission to use.
- **People.** Avoid close-ups of customers or children. Blur faces or car
  number plates when they are not the subject.
- **No text-only images.** Phone numbers, prices and timings belong in the
  listing fields, where they can be searched and kept up to date.
- **Sample data.** Listings marked **Sample** are demo content. Do not add
  real photos to them; delete them before launch, or replace them with real
  listings.
