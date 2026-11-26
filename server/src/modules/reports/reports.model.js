import mongoose from 'mongoose';

/**
 * Reports (spec section 7, FR-REP-1) and suggestions from the "Suggest" button
 * (decision U1 / D0.13: "stored as a report for admins ... needs a general targetType").
 */
export const CONTENT_TARGETS = Object.freeze(['business', 'review', 'offer', 'event', 'news', 'post', 'comment']);
export const REPORT_TARGETS = Object.freeze([...CONTENT_TARGETS, 'suggestion']);

export const CONTENT_REASONS = Object.freeze(['wrong_info', 'closed', 'spam', 'offensive', 'fraud', 'duplicate', 'other']);
export const SUGGESTION_REASONS = Object.freeze(['new_business', 'new_event', 'correction', 'idea']);

export const REPORT_STATUS = Object.freeze({ OPEN: 'open', REVIEWED: 'reviewed', ACTIONED: 'actioned', DISMISSED: 'dismissed' });
export const REPORT_ACTIONS = Object.freeze(['dismiss', 'mark_reviewed', 'hide_target', 'block_user', 'hide_and_block']);

const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId }, // absent for suggestions
    reason: { type: String, enum: [...CONTENT_REASONS, ...SUGGESTION_REASONS], required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: Object.values(REPORT_STATUS), default: REPORT_STATUS.OPEN },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date },
    resolution: {
      type: new mongoose.Schema({ action: { type: String, enum: REPORT_ACTIONS }, note: { type: String, maxlength: 500 } }, { _id: false }),
      default: undefined,
    },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Spec section 7: (status, createdAt) for the queue; (targetType, targetId) on polymorphic collections.
reportSchema.index({ status: 1, createdAt: 1 });
reportSchema.index({ targetType: 1, targetId: 1, status: 1 });
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 }); // duplicate-report check

export const Report = mongoose.models.Report ?? mongoose.model('Report', reportSchema);
