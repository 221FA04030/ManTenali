import mongoose from 'mongoose';
import { MODERATION_REASON_MAX } from '../../common/utils/moderation.js';

/** Content an admin can archive, restore or delete permanently (same names as reports). */
export const MODERATION_TYPES = Object.freeze(['business', 'offer', 'event', 'news', 'post', 'comment', 'review']);
export const MODERATION_ACTIONS = Object.freeze(['archive', 'restore', 'delete']);

/**
 * Moderation audit log: one entry per admin action. Written only by the server
 * (no API creates, edits or deletes entries) and readable only by admins.
 * `title` is a short snapshot so a deleted item can still be identified.
 */
const auditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contentType: { type: String, enum: MODERATION_TYPES, required: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, enum: MODERATION_ACTIONS, required: true },
    reason: { type: String, trim: true, maxlength: MODERATION_REASON_MAX },
    title: { type: String, trim: true, maxlength: 160 },
    source: { type: String, enum: ['moderation', 'report'], default: 'moderation' },
    // Only for deletions: how many related records went with it (offers, reviews, comments, saves...).
    related: { type: mongoose.Schema.Types.Mixed, default: undefined },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false, strict: 'throw' },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ contentType: 1, contentId: 1, createdAt: -1 });
auditSchema.index({ adminId: 1, createdAt: -1 });

export const ModerationAudit = mongoose.models.ModerationAudit ?? mongoose.model('ModerationAudit', auditSchema, 'moderation_audit');
