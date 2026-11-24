import mongoose from 'mongoose';
import { Category, NESTED_TYPES } from './categories.model.js';
import { AppError } from '../../common/errors/index.js';
import { slugify } from '../../common/utils/slug.js';

export function toDTO(c) {
  return {
    id: String(c._id),
    name: { en: c.name.en, te: c.name.te ?? null },
    slug: c.slug,
    type: c.type,
    parentId: c.parentId ? String(c.parentId) : null,
    icon: c.icon ?? null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  };
}

/** Small summary embedded in other modules' responses. */
export const toSummary = (c) =>
  c ? { id: String(c._id), name: { en: c.name.en, te: c.name.te ?? null }, slug: c.slug, icon: c.icon ?? null } : null;

/**
 * Public: active categories of a type, as a flat list with parentId (clients
 * build the tree). Subcategories of an inactive main category are hidden too.
 * Admins may ask for inactive ones (management screen).
 */
export async function listCategories({ type, includeInactive }, user) {
  const filter = {};
  if (type) filter.type = type;
  const admin = includeInactive && user?.role === 'admin';
  if (!admin) filter.isActive = true;
  const items = await Category.find(filter).sort({ type: 1, sortOrder: 1, 'name.en': 1 }).limit(1000).lean();
  if (admin) return items.map(toDTO);
  const activeIds = new Set(items.map((c) => String(c._id)));
  return items.filter((c) => !c.parentId || activeIds.has(String(c.parentId))).map(toDTO);
}

/** A parent must exist, be the same type, support nesting, and be a main category itself. */
async function assertValidParent(parentId, type) {
  if (!NESTED_TYPES.includes(type)) {
    throw AppError.validation('Only business categories can have subcategories.', [
      { field: 'body.parentId', message: 'Subcategories are only for business categories' },
    ]);
  }
  const parent = await Category.findById(parentId).lean();
  if (!parent || parent.type !== type || parent.parentId) {
    throw AppError.validation('Choose a valid main category.', [
      { field: 'body.parentId', message: 'Parent must be a main category of the same type' },
    ]);
  }
  return parent;
}

export async function createCategory(input) {
  if (input.parentId) await assertValidParent(input.parentId, input.type);
  const slug = input.slug ?? slugify(input.name.en);
  if (await Category.exists({ type: input.type, slug })) {
    throw AppError.conflict('A category with this name already exists for this type.', [
      { field: 'body.slug', message: 'Slug already used for this type' },
    ]);
  }
  const created = await Category.create({ ...input, parentId: input.parentId ?? null, slug });
  return toDTO(created.toObject());
}

/**
 * Slug, type and parent never change after creation, so businesses that
 * reference a category keep a consistent main/sub pair. Admins organise with
 * names, icons, sortOrder and isActive (deactivate instead of delete).
 */
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
 * Used by events/news before saving a categoryId: it must exist, be active
 * and belong to the right type.
 */
export async function assertActiveCategory(id, type, field = 'body.categoryId') {
  const category = await Category.findOne({ _id: id, type, isActive: true }).lean();
  if (!category) {
    throw AppError.validation('Choose a valid category.', [{ field, message: `Unknown or inactive ${type} category` }]);
  }
  return toSummary(category);
}

/**
 * Used by businesses: categoryId must be an active MAIN business category and
 * subcategoryId an active subcategory OF THAT main category.
 */
export async function assertCategoryPair(categoryId, subcategoryId) {
  const [main, sub] = await Promise.all([
    Category.findOne({ _id: categoryId, type: 'business', isActive: true, parentId: null }).lean(),
    Category.findOne({ _id: subcategoryId, type: 'business', isActive: true }).lean(),
  ]);
  const details = [];
  if (!main) details.push({ field: 'body.categoryId', message: 'Choose an active main category' });
  if (!sub || !sub.parentId) details.push({ field: 'body.subcategoryId', message: 'Choose an active subcategory' });
  else if (main && String(sub.parentId) !== String(main._id)) {
    details.push({ field: 'body.subcategoryId', message: 'Subcategory does not belong to the chosen main category' });
  }
  if (details.length) throw AppError.validation('Choose a valid category and subcategory.', details);
  return { category: toSummary(main), subcategory: toSummary(sub) };
}

export async function getSummariesByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const items = await Category.find({ _id: { $in: unique } }).lean();
  return new Map(items.map((c) => [String(c._id), toSummary(c)]));
}

/** Resolve a category slug (used by seed and friendly list filters). */
export async function findIdBySlug(type, slug) {
  const c = await Category.findOne({ type, slug }).select('_id').lean();
  return c ? c._id : null;
}

/** For data migrations: { id -> parentId|null } for the given category ids. */
export async function getParentMap(ids) {
  const items = await Category.find({ _id: { $in: ids } }).select('parentId').lean();
  return new Map(items.map((c) => [String(c._id), c.parentId ? String(c.parentId) : null]));
}

export async function setActive(id, isActive) {
  await Category.updateOne({ _id: id }, { $set: { isActive } });
}

/**
 * Seed flat (event/news) categories. Idempotent: existing (type, slug) pairs
 * are left untouched so admin edits are never overwritten.
 */
export async function seedCategories(list) {
  let created = 0;
  for (const item of list) {
    const res = await Category.updateOne(
      { type: item.type, slug: item.slug },
      { $setOnInsert: { ...item, parentId: null, isActive: true } },
      { upsert: true },
    );
    if (res.upsertedCount) created += 1;
  }
  return { created, existing: list.length - created };
}

/**
 * Seed the two-level business tree. Idempotent and non-destructive:
 * - missing main categories and subcategories are created;
 * - an existing category that has NO parent yet (e.g. from the original flat
 *   seed) is attached to its main category - nothing else is changed;
 * - names, icons, order and active flags edited by admins are never overwritten.
 */
export async function seedCategoryTree(tree) {
  const stats = { createdMain: 0, createdSub: 0, attached: 0 };
  for (const main of tree) {
    const mainRes = await Category.findOneAndUpdate(
      { type: 'business', slug: main.slug },
      {
        $setOnInsert: {
          type: 'business',
          slug: main.slug,
          name: main.name,
          icon: main.icon,
          sortOrder: main.sortOrder,
          parentId: null,
          isActive: true,
        },
      },
      { upsert: true, new: true, includeResultMetadata: true },
    );
    if (!mainRes.lastErrorObject?.updatedExisting) stats.createdMain += 1;
    const parentId = mainRes.value._id;

    for (const sub of main.children) {
      const res = await Category.updateOne(
        { type: 'business', slug: sub.slug },
        { $setOnInsert: { type: 'business', slug: sub.slug, name: sub.name, icon: sub.icon, sortOrder: sub.sortOrder, parentId, isActive: true } },
        { upsert: true },
      );
      if (res.upsertedCount) {
        stats.createdSub += 1;
        continue;
      }
      const attach = await Category.updateOne(
        { type: 'business', slug: sub.slug, parentId: null, _id: { $ne: parentId } },
        { $set: { parentId } },
      );
      stats.attached += attach.modifiedCount;
    }
  }
  return stats;
}

export const isValidObjectId = (id) => mongoose.isValidObjectId(id);
