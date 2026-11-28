import bcrypt from 'bcrypt';
import { User, USER_STATUS } from './users.model.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { ROLES } from '../../config/constants.js';
import { escapeRegex } from '../../common/utils/validators.js';
import { assertOwnImageUrl } from '../media/media.service.js';

const BCRYPT_COST = 12;


/** Shape returned to the user themselves. Never includes passwordHash or googleId. */
export function toSelf(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email ?? null,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    preferredArea: user.preferredArea ?? null,
    language: user.language,
    status: user.status,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleId),
    createdAt: user.createdAt,
  };
}

/** Shape shown to admins in user management. */
export function toAdminView(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email ?? null,
    role: user.role,
    status: user.status,
    preferredArea: user.preferredArea ?? null,
    signIn: [user.googleId ? 'google' : null, user.passwordHash ? 'password' : null].filter(Boolean),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Public summary used when other modules show who wrote something. */
export function toPublicSummary(user) {
  if (!user) return null;
  return { id: String(user._id), name: user.name, avatarUrl: user.avatarUrl ?? null };
}

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);

export async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export async function findById(id) {
  return User.findById(id).lean();
}

/** Loaded on every authenticated request: the current role and status. */
export async function findSessionUser(id) {
  const user = await User.findById(id).select('+passwordHash').lean();
  return user ?? null;
}

export async function getSelf(id) {
  const user = await findSessionUser(id);
  if (!user) throw AppError.notFound('User not found.');
  return toSelf(user);
}

export async function findByEmailWithPassword(email) {
  return User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash').lean();
}

/** Registration always creates role "user" (no public path to owner/admin). */
export async function createWithPassword({ name, email, password }) {
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw AppError.conflict('An account with this email already exists.', [{ field: 'body.email', message: 'Email already registered' }]);
  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: ROLES.USER });
  return user.toObject();
}

/**
 * Google sign-in: find by googleId, else link to an existing account with the
 * same verified email, else create a new "user" account.
 */
export async function findOrCreateFromGoogle({ googleId, email, emailVerified, name, picture }) {
  const user = await User.findOne({ googleId }).select('+passwordHash').lean();
  if (user) return user;

  if (email && emailVerified) {
    const byEmail = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== googleId) {
        throw AppError.conflict('This email is linked to a different Google account.');
      }
      byEmail.googleId = googleId;
      if (!byEmail.avatarUrl && picture) byEmail.avatarUrl = picture;
      await byEmail.save();
      return byEmail.toObject();
    }
  }

  const created = await User.create({
    name: name || (email ? email.split('@')[0] : 'Tenali user'),
    email: email && emailVerified ? email : undefined,
    googleId,
    avatarUrl: picture,
    role: ROLES.USER,
  });
  return created.toObject();
}

export async function updateSelf(id, changes) {
  // Avatars must be uploaded through our signed Cloudinary flow (spec security checklist).
  if (changes.avatarUrl) assertOwnImageUrl(changes.avatarUrl, 'avatar');
  const update = {};
  const unset = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') unset[key] = 1;
    else update[key] = value;
  }
  const user = await User.findByIdAndUpdate(
    id,
    { ...(Object.keys(update).length ? { $set: update } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true, runValidators: true },
  )
    .select('+passwordHash')
    .lean();
  if (!user) throw AppError.notFound('User not found.');
  return toSelf(user);
}

/** Admin: list and search users. */
export async function listUsers({ q, role, status, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const p = getPagination({ page, limit });
  const [items, total] = await Promise.all([
    User.find(filter).select('+passwordHash').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items: items.map(toAdminView), meta: buildMeta({ ...p, total }) };
}

/**
 * Admin: change role or block status. Admins cannot demote or block
 * themselves, so the system can never lose its last working admin by accident.
 */
export async function adminUpdateUser(actor, targetId, { role, status }) {
  if (String(actor.id) === String(targetId)) {
    if ((role && role !== ROLES.ADMIN) || status === USER_STATUS.BLOCKED) {
      throw AppError.forbidden('You cannot remove your own admin role or block yourself.');
    }
  }
  const update = {};
  if (role) update.role = role;
  if (status) update.status = status;
  const user = await User.findByIdAndUpdate(targetId, { $set: update }, { new: true, runValidators: true })
    .select('+passwordHash')
    .lean();
  if (!user) throw AppError.notFound('User not found.');
  return toAdminView(user);
}

/** Used by other services (e.g. assigning a business owner). */
export async function assertUserExists(id) {
  const user = await User.findById(id).lean();
  if (!user) throw AppError.validation('User does not exist.', [{ field: 'body.ownerId', message: 'Unknown user' }]);
  return user;
}

/** Promote a plain user to owner when an admin assigns them a business. */
export async function ensureOwnerRole(id) {
  await User.updateOne({ _id: id, role: ROLES.USER }, { $set: { role: ROLES.OWNER } });
}

export async function getSummariesByIds(ids) {
  const users = await User.find({ _id: { $in: ids } }).select('name avatarUrl').lean();
  return new Map(users.map((u) => [String(u._id), toPublicSummary(u)]));
}

/**
 * Local bootstrap only (npm run seed:admin): upsert one admin account.
 * Never reachable over HTTP.
 */
export async function upsertAdmin({ email, password, name = 'Mana Tenali Admin' }) {
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: { role: ROLES.ADMIN, status: USER_STATUS.ACTIVE, passwordHash },
      $setOnInsert: { name, email: email.toLowerCase(), language: 'en' },
    },
    { upsert: true, new: true, runValidators: true },
  ).lean();
  return { id: String(user._id), email: user.email, role: user.role };
}

export async function countUsers() {
  return User.countDocuments();
}

/** Admin-only contact details (name + email) for moderation screens. Never use in public responses. */
export async function getAdminContactsByIds(ids) {
  const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
  return new Map(users.map((u) => [String(u._id), { id: String(u._id), name: u.name, email: u.email ?? null }]));
}

/** Moderation dashboard author filter: ids of users whose name or email contains `q` (at most 200). */
export async function findIdsMatching(q, limit = 200) {
  const rx = new RegExp(escapeRegex(q.trim()), 'i');
  return (await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').limit(limit).lean()).map((u) => u._id);
}
