import { Favorite, MAX_FAVORITES } from './favorites.model.js';
import * as businessesService from '../businesses/businesses.service.js';
import * as offersService from '../offers/offers.service.js';
import * as eventsService from '../events/events.service.js';
import * as communityService from '../community/community.service.js';
import { AppError } from '../../common/errors/index.js';
import { getEnv } from '../../config/env.js';

/** Public cards by id for each saveable type (each module applies its own public rules). */
const PUBLIC_LOOKUP = {
  business: (ids, now) => businessesService.getPublicCardsByIds(ids, now),
  offer: (ids, now) => offersService.getPublicByIds(ids, now),
  event: (ids) => eventsService.getPublicByIds(ids),
  post: (ids) => communityService.getPublicByIds(ids),
};

function toDTO(f, item) {
  return {
    id: String(f._id),
    targetType: f.targetType,
    targetId: String(f.targetId),
    createdAt: f.createdAt,
    // null when the item is no longer public (hidden, expired, removed): shown as "no longer available".
    item: item ?? null,
  };
}

/** FR-FAV-1: my saved items, newest first, each with its current public card (or null). */
export async function listMine(user, now = new Date()) {
  const favorites = await Favorite.find({ userId: user.id }).sort({ createdAt: -1, _id: -1 }).limit(MAX_FAVORITES).lean();
  const idsByType = {};
  for (const f of favorites) (idsByType[f.targetType] ??= []).push(String(f.targetId));
  const lookups = Object.fromEntries(
    await Promise.all(Object.entries(idsByType).map(async ([type, ids]) => [type, await PUBLIC_LOOKUP[type](ids, now)])),
  );
  return favorites.map((f) => toDTO(f, lookups[f.targetType]?.get(String(f.targetId))));
}

/**
 * Save an item. It must be publicly visible right now (404 otherwise, so
 * hidden ids can't be probed). Saving twice is a 409 (spec error list).
 */
export async function add(user, { targetType, targetId }, now = new Date()) {
  const item = (await PUBLIC_LOOKUP[targetType]([targetId], now)).get(String(targetId));
  if (!item) throw AppError.notFound('This item is not available.');
  if ((await Favorite.countDocuments({ userId: user.id })) >= MAX_FAVORITES) {
    throw AppError.conflict(`You can save up to ${MAX_FAVORITES} items. Remove some first.`);
  }
  try {
    const f = await Favorite.create({ userId: user.id, targetType, targetId });
    return toDTO(f.toObject(), item);
  } catch (err) {
    if (err?.code === 11000) throw AppError.conflict('Already saved.');
    throw err;
  }
}

/** Remove one of MY saved items (someone else's id: 404). */
export async function remove(user, id) {
  const f = await Favorite.findOneAndDelete({ _id: id, userId: user.id }).lean();
  if (!f) throw AppError.notFound('Saved item not found.');
  return { id: String(f._id), deleted: true };
}

/** Demo data only (local development); refused in production. Idempotent. */
export async function seedFavorites(list) {
  if (getEnv().isProduction) throw new Error('Sample data cannot be seeded in production.');
  let created = 0;
  for (const f of list) {
    const res = await Favorite.updateOne(f, { $setOnInsert: f }, { upsert: true });
    created += res.upsertedCount;
  }
  return { created, skipped: list.length - created };
}
