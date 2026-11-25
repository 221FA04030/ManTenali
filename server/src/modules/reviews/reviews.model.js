import mongoose from 'mongoose';

/** Reviews (spec section 7): published | hidden. Users delete their own; admins hide. */
export const REVIEW_STATUS = Object.freeze({ PUBLISHED: 'published', HIDDEN: 'hidden' });

const reviewSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: Object.values(REVIEW_STATUS), default: REVIEW_STATUS.PUBLISHED },
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hiddenAt: { type: Date },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Spec section 7: one review per user per business.
reviewSchema.index({ businessId: 1, userId: 1 }, { unique: true });
// Public list (newest first) and rating aggregation.
reviewSchema.index({ businessId: 1, status: 1, createdAt: -1 });
// "My reviews" on the profile.
reviewSchema.index({ userId: 1, createdAt: -1 });

export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema);
