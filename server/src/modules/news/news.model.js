import mongoose from 'mongoose';
import { moderationField } from '../../common/utils/moderation.js';

/**
 * News item statuses (spec: draft | published | hidden). `archived` is the
 * soft-delete state used by DELETE (record kept), as for events (DECISIONS D7.3).
 * Public: published and not past validUntil.
 */
export const NEWS_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
  ARCHIVED: 'archived',
});

/** FR-NEWS-1 types. Every type except `news` is a time-sensitive "Today in Tenali" notice. */
export const NEWS_TYPES = Object.freeze(['news', 'traffic', 'weather', 'power', 'water', 'announcement']);
export const NOTICE_TYPES = Object.freeze(NEWS_TYPES.filter((t) => t !== 'news'));

/** At most this many published, unexpired pinned items (they feed the home banner, which shows up to 5). */
export const MAX_PINNED = 5;

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false },
);

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, trim: true, maxlength: 5000 },
    type: { type: String, enum: NEWS_TYPES, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    coverImage: { type: imageSchema, default: undefined },
    sourceName: { type: String, required: true, trim: true, maxlength: 100 }, // trust requirement
    sourceUrl: { type: String, trim: true, maxlength: 300 },
    publishedAt: { type: Date },
    validUntil: { type: Date }, // time-limited notices stop showing after this
    contentUpdatedAt: { type: Date }, // last CONTENT edit (shown as "Updated"); pin/status changes don't touch it
    isPinned: { type: Boolean, default: false },
    isSeed: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(NEWS_STATUS), default: NEWS_STATUS.DRAFT },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderation: moderationField, // admin archive record (never public)
  },
  { timestamps: true },
);

// Spec section 7 indexes.
newsSchema.index({ status: 1, type: 1, publishedAt: -1 });
newsSchema.index({ title: 'text', summary: 'text' }, { name: 'news_text' });
// Step 7 additions: unique slug; default public order (pinned first, newest next).
newsSchema.index({ slug: 1 }, { unique: true });
newsSchema.index({ status: 1, isPinned: -1, publishedAt: -1 });

export const News = mongoose.models.News ?? mongoose.model('News', newsSchema, 'news');
