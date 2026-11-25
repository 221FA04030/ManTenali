import mongoose from 'mongoose';

/**
 * Event statuses (spec: draft | published | cancelled | hidden, extended for
 * community submissions - see DECISIONS.md Step 6).
 * Public: published, and cancelled (with a label) until endAt.
 */
export const EVENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending_review',
  CHANGES: 'changes_requested',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  HIDDEN: 'hidden',
  ARCHIVED: 'archived',
});
export const PUBLIC_STATUSES = Object.freeze([EVENT_STATUS.PUBLISHED, EVENT_STATUS.CANCELLED]);
/** Statuses in which the submitter may still edit, change evidence or withdraw. */
export const SUBMITTER_EDITABLE = Object.freeze([EVENT_STATUS.PENDING, EVENT_STATUS.CHANGES]);
export const MAX_EVENT_DAYS = 90;

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false },
);

const logSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    at: { type: Date, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    description: { type: String, trim: true, maxlength: 2000 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    venue: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      address: { type: String, required: true, trim: true, maxlength: 200 },
      area: { type: String, required: true, trim: true, maxlength: 80 },
    },
    location: {
      type: new mongoose.Schema(
        { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
        { _id: false },
      ),
      default: undefined,
    },
    bannerImage: { type: imageSchema, default: undefined },
    bookingUrl: { type: String, trim: true, maxlength: 300 },
    priceInfo: { type: String, trim: true, maxlength: 100 },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
    organizerName: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: Object.values(EVENT_STATUS), default: EVENT_STATUS.DRAFT },
    isSeed: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Community submission + moderation (never in public responses).
    source: { type: String, enum: ['admin', 'community'], default: 'admin' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    lastSubmittedAt: { type: Date },
    revision: { type: Number, default: 0 },
    review: {
      type: new mongoose.Schema(
        {
          outcome: { type: String, enum: ['approved', 'rejected', 'changes_requested'] },
          note: { type: String, maxlength: 1000 },
          reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          reviewedAt: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 300 }, // shown publicly with the "Cancelled" label
    moderationLog: { type: [logSchema], default: [] },
  },
  { timestamps: true },
);

// Spec section 7 indexes.
eventSchema.index({ status: 1, startAt: 1 });
eventSchema.index({ location: '2dsphere' });
eventSchema.index({ categoryId: 1 });
eventSchema.index({ title: 'text', description: 'text' }, { name: 'event_text' });
// Step 6 additions.
eventSchema.index({ slug: 1 }, { unique: true });
eventSchema.index({ status: 1, endAt: 1 });
eventSchema.index({ status: 1, submittedAt: 1 }); // moderation queue
eventSchema.index({ submittedBy: 1, status: 1, updatedAt: -1 }); // "my submissions"

export const Event = mongoose.models.Event ?? mongoose.model('Event', eventSchema);
