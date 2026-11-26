import mongoose from 'mongoose';

/** FR-FAV-1 targets. News is not saveable in Phase 1 (spec section 7). */
export const FAVORITE_TYPES = Object.freeze(['business', 'offer', 'event', 'post']);
/** Most saved items per user (keeps GET /favorites one small request). */
export const MAX_FAVORITES = 200;

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: FAVORITE_TYPES, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Spec section 7: unique (userId, targetType, targetId), plus (targetType, targetId) on polymorphic collections.
favoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
favoriteSchema.index({ targetType: 1, targetId: 1 });
favoriteSchema.index({ userId: 1, createdAt: -1 });

export const Favorite = mongoose.models.Favorite ?? mongoose.model('Favorite', favoriteSchema);
