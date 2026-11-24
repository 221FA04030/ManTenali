import { Category } from './categories.model.js';
import { AppError } from '../../common/errors/index.js';
import { slugify } from '../../common/utils/slug.js';

export function toDTO(c) {
  return {
    id: String(c._id),
    name: { en: c.name.en, te: c.name.te ?? null },
    slug: c.slug,
    type: c.type,
    icon: c.icon ?? null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  };
}

/** Small summary embedded in other modules' responses. */
export const toSummary = (c) =>
  c ? { id: String(c._id), name: { en: c.name.en, te: c.name.te ?? null }, slug: c.slug, icon: c.icon ?? null } : null;

/**
 * Public: active categories of a type. Admins may ask for inactive ones too
 * (for the management screen); everyone else always gets active only.
 */
export async function listCategories({ type, includeInactive }, user) {
  const filter = {};
  if (type) filter.type = type;
  if (!(includeInactive && user?.role === 'admin')) filter.isActive = true;
  const items = await Category.find(filter).sort({ type: 1, sortOrder: 1, 'name.en': 1 }).limit(500).lean();
  return items.map(toDTO);
}

export async function createCategory(input) {
  const slug = input.slug ?? slugify(input.name.en);
  if (await Category.exists({ type: input.type, slug })) {
    throw AppError.conflict('A category with this name already exists for this type.', [
      { field: 'body.slug', message: 'Slug already used for this type' },
    ]);
  }
  const created = await Category.create({ ...input, slug });
  return toDTO(created.toObject());
}

/** Slug and type never change after creation (links and references stay stable). */
export async function updateCategory(id, changes) {
  const set = {};
  const unset = {};
  for (const [k, v] of Object.entries(changes)) {
    if (k === 'name') {
      set['name.en'] = v.en;
      if (v.te) set['name.te'] = v.te;
      else unset['name.te'] = 1;
    } else if (v === null) unset[k] = 1;
    else set[k] = v;
  }
  const updated = await Category.findByIdAndUpdate(
    id,
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) throw AppError.notFound('Category not found.');
  return toDTO(updated);
}

/**
 * Used by other services (businesses, events, news) before saving a
 * categoryId: it must exist, be active and belong to the right type.
 */
export async function assertActiveCategory(id, type, field = 'body.categoryId') {
  const category = await Category.findOne({ _id: id, type, isActive: true }).lean();
  if (!category) {
    throw AppError.validation('Choose a valid category.', [{ field, message: `Unknown or inactive ${type} category` }]);
  }
  return toSummary(category);
}

export async function getSummariesByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const items = await Category.find({ _id: { $in: unique } }).lean();
  return new Map(items.map((c) => [String(c._id), toSummary(c)]));
}

/** Resolve a category slug (used by friendly list filters). */
export async function findIdBySlug(type, slug) {
  const c = await Category.findOne({ type, slug }).select('_id').lean();
  return c ? c._id : null;
}

/**
 * Seed reference categories. Idempotent: existing (type, slug) pairs are left
 * untouched so admin edits are never overwritten.
 */
export async function seedCategories(list) {
  let created = 0;
  for (const item of list) {
    const res = await Category.updateOne(
      { type: item.type, slug: item.slug },
      { $setOnInsert: { ...item, isActive: true } },
      { upsert: true },
    );
    if (res.upsertedCount) created += 1;
  }
  return { created, existing: list.length - created };
}
