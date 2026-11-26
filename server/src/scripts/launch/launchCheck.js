import mongoose from 'mongoose';
import { Category } from '../../modules/categories/categories.model.js';
import { User } from '../../modules/users/users.model.js';
import { Business } from '../../modules/businesses/businesses.model.js';
import { Offer } from '../../modules/offers/offers.model.js';
import { Event } from '../../modules/events/events.model.js';
import { News } from '../../modules/news/news.model.js';
import { Review } from '../../modules/reviews/reviews.model.js';
import { Report } from '../../modules/reports/reports.model.js';
import '../../modules/events/evidence.model.js';
import '../../modules/favorites/favorites.model.js';
import '../../modules/analytics/analytics.model.js';
import { missingCloudinaryVars } from '../../common/integrations/cloudinary.js';

/** Content types that can carry demo/sample data (isSeed). Production must have none (D4.10). */
const SEEDABLE = { businesses: Business, offers: Offer, events: Event, news: News, reviews: Review, reports: Report };

/**
 * Read-only launch readiness report (Step 10, "seed content"): reference data,
 * an admin, no sample data, indexes in place, optional services configured.
 * Returns { checks: [{ name, ok, level, detail }], ok } - names and counts only,
 * never configuration values or personal data.
 */
export async function launchReport(env) {
  const checks = [];
  const add = (name, ok, detail, level = 'error') => checks.push({ name, ok, level: ok ? 'ok' : level, detail });

  // Reference categories (npm run seed -- --confirm-production)
  const [mainBiz, subBiz, eventCats, newsCats] = await Promise.all([
    Category.countDocuments({ type: 'business', parentId: null, isActive: true }),
    Category.countDocuments({ type: 'business', parentId: { $ne: null }, isActive: true }),
    Category.countDocuments({ type: 'event', isActive: true }),
    Category.countDocuments({ type: 'news', isActive: true }),
  ]);
  add('reference categories', mainBiz > 0 && subBiz > 0 && eventCats > 0 && newsCats > 0, `business ${mainBiz} main / ${subBiz} sub, event ${eventCats}, news ${newsCats}`);

  // At least one active admin (npm run seed:admin)
  const admins = await User.countDocuments({ role: 'admin', status: 'active' });
  add('active admin account', admins > 0, `${admins} active admin(s)`);

  // No sample data in production (it is refused there anyway; this proves it)
  const samples = Object.fromEntries(await Promise.all(Object.entries(SEEDABLE).map(async ([k, M]) => [k, await M.countDocuments({ isSeed: true })])));
  const sampleTotal = Object.values(samples).reduce((a, b) => a + b, 0);
  const sampleDetail = Object.entries(samples).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
  add('no sample data', sampleTotal === 0, sampleDetail, env.isProduction ? 'error' : 'warn');

  // Indexes declared in the models exist in the database (created automatically on startup)
  const missing = [];
  for (const model of Object.values(mongoose.models)) {
    const diff = await model.diffIndexes().catch(() => ({ toCreate: [] }));
    if (diff.toCreate.length) missing.push(`${model.collection.collectionName} (${diff.toCreate.length})`);
  }
  add('indexes', missing.length === 0, missing.length ? `missing: ${missing.join(', ')} - start the API once to build them` : 'all present', 'warn');

  // Optional services: report which are off (names only)
  const media = missingCloudinaryVars(env);
  add('image uploads (Cloudinary)', media.length === 0, media.length ? `not set: ${media.join(', ')}` : 'configured', 'warn');
  add('Google sign-in', Boolean(env.GOOGLE_CLIENT_ID), env.GOOGLE_CLIENT_ID ? 'configured' : 'GOOGLE_CLIENT_ID not set', 'warn');
  add('error reporting (Sentry)', Boolean(env.SENTRY_DSN), env.SENTRY_DSN ? 'configured' : 'SENTRY_DSN not set', 'warn');
  if (env.isProduction) {
    add('proxy setting', env.TRUST_PROXY >= 1, env.TRUST_PROXY >= 1 ? `TRUST_PROXY=${env.TRUST_PROXY}` : 'TRUST_PROXY is 0: rate limits would see the proxy, not visitors', 'error');
  }

  return { checks, ok: checks.every((c) => c.ok || c.level !== 'error') };
}
