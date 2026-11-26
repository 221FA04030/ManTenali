import mongoose from 'mongoose';

/** FR-ANA-1 activity types and what each one is about. `search` has no target. */
export const ACTIVITY_TARGETS = Object.freeze({
  view: ['business', 'event', 'news'],
  offer_view: ['offer'],
  contact_click: ['business'],
  share: ['business', 'offer', 'event', 'news', 'post'],
  search: [],
});
export const ACTIVITY_TYPES = Object.freeze(Object.keys(ACTIVITY_TARGETS));
export const ACTIVITY_TARGET_TYPES = Object.freeze([...new Set(Object.values(ACTIVITY_TARGETS).flat())]);
export const RETENTION_DAYS = 180;

/**
 * Anonymous by design (D9.6): a random device id (`sessionId`) and no user id,
 * no IP address and no coordinates (spec NFR). Deleted automatically after 180 days.
 */
const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    targetType: { type: String, enum: ACTIVITY_TARGET_TYPES },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    sessionId: { type: String, required: true, maxlength: 64 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// Spec section 7: optional TTL of 180 days; (targetType, targetId) on polymorphic collections.
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86_400 });
activitySchema.index({ targetType: 1, targetId: 1 });
activitySchema.index({ type: 1, createdAt: -1 }); // summary counts by type and date
activitySchema.index({ sessionId: 1, createdAt: 1 }); // sessions, search -> contact joins

export const ActivityEvent = mongoose.models.ActivityEvent ?? mongoose.model('ActivityEvent', activitySchema, 'activityEvents');
