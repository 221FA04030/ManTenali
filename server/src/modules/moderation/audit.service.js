import { ModerationAudit } from './audit.model.js';
import * as usersService from '../users/users.service.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';

/** Append one entry. There is deliberately no update or delete function. */
export async function record({ admin, contentType, contentId, action, reason, title, source = 'moderation', related }) {
  await ModerationAudit.create({
    adminId: admin.id,
    contentType,
    contentId,
    action,
    reason: reason || undefined,
    title: title ? String(title).slice(0, 160) : undefined,
    source,
    related: related && Object.keys(related).length ? related : undefined,
  });
}

/** Admin: newest first, optionally for one type or one item. */
export async function list({ contentType, contentId, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = {};
  if (contentType) filter.contentType = contentType;
  if (contentId) filter.contentId = contentId;
  const [items, total] = await Promise.all([
    ModerationAudit.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit).lean(),
    ModerationAudit.countDocuments(filter),
  ]);
  const admins = await usersService.getSummariesByIds([...new Set(items.map((a) => String(a.adminId)))]);
  return {
    items: items.map((a) => ({
      id: String(a._id),
      admin: admins.get(String(a.adminId))?.name ?? null,
      contentType: a.contentType,
      contentId: String(a.contentId),
      action: a.action,
      reason: a.reason ?? null,
      title: a.title ?? null,
      source: a.source,
      related: a.related ?? null,
      createdAt: a.createdAt,
    })),
    meta: buildMeta({ ...p, total }),
  };
}
