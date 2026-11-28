import mongoose from 'mongoose';
import { moderationField } from '../../common/utils/moderation.js';

/**
 * Community posts (owner decision, building the spec's Phase 2 feature early):
 * local recommendations, questions and updates, with likes and comments.
 * Published immediately; moderated through reports and admin hiding.
 */
export const POST_KINDS = Object.freeze(['recommendation', 'question', 'update']);
export const CONTENT_STATUS = Object.freeze({ PUBLISHED: 'published', HIDDEN: 'hidden', REMOVED: 'removed' });
export const POST_LIMITS = Object.freeze({ textMax: 1000, commentMax: 500, perDay: 10 });

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false },
);

const postSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: POST_KINDS, required: true },
    text: { type: String, required: true, trim: true, maxlength: POST_LIMITS.textMax },
    photo: { type: imageSchema, default: undefined },
    area: { type: String, trim: true, maxlength: 80 },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' }, // a recommended business
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    editedAt: { type: Date },
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderation: moderationField, // admin archive record (never public)
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
postSchema.index({ status: 1, createdAt: -1 }); // public feed
postSchema.index({ status: 1, kind: 1, createdAt: -1 });
postSchema.index({ authorId: 1, createdAt: -1 }); // my posts, daily limit
postSchema.index({ businessId: 1, status: 1 });

const likeSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
likeSchema.index({ postId: 1, userId: 1 }, { unique: true }); // one like per person
likeSchema.index({ userId: 1, postId: 1 });

const commentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: POST_LIMITS.commentMax },
    status: { type: String, enum: Object.values(CONTENT_STATUS), default: CONTENT_STATUS.PUBLISHED },
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderation: moderationField, // admin archive record (never public)
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
commentSchema.index({ postId: 1, status: 1, createdAt: 1 });
commentSchema.index({ authorId: 1, createdAt: -1 });

export const Post = mongoose.models.Post ?? mongoose.model('Post', postSchema);
export const PostLike = mongoose.models.PostLike ?? mongoose.model('PostLike', likeSchema);
export const PostComment = mongoose.models.PostComment ?? mongoose.model('PostComment', commentSchema);
