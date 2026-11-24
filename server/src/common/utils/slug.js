import { randomBytes } from 'node:crypto';

/** Turn a name into a URL-safe ASCII slug. Non-Latin names fall back to 'item'. */
export function slugify(input, { maxLength = 60 } = {}) {
  const slug = String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || 'item';
}

/** Short lowercase suffix used to resolve slug collisions. */
export function shortSuffix(length = 5) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Generate a slug that is not taken. `isTaken(slug)` is an async predicate
 * supplied by the owning service (so this helper never touches a model).
 */
export async function generateUniqueSlug(name, isTaken, { attempts = 5 } = {}) {
  const base = slugify(name);
  if (!(await isTaken(base))) return base;
  for (let i = 0; i < attempts; i += 1) {
    const candidate = `${base}-${shortSuffix()}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${shortSuffix(10)}`;
}
