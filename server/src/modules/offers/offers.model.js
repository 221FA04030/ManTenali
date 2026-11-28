import mongoose from 'mongoose';
import { moderationField } from '../../common/utils/moderation.js';

/**
 * Stored statuses. "live", "scheduled" and "expired" are NOT stored: they are
 * derived from a published offer's validity dates (spec: expiry is computed).
 */
export const OFFER_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published', HIDDEN: 'hidden' });
export const OFFER_LIMIT_PER_BUSINESS = 10; // live + scheduled offers

const offerSchema = new mongoose.Schema(
  {
    // The ONLY business reference: names, categories and areas come from the businesses module.
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    discountLabel: { type: String, required: true, trim: true, maxlength: 40 },
    couponCode: { type: String, trim: true, maxlength: 30 },
    terms: { type: String, required: true, trim: true, maxlength: 1000 },
    redemptionInstructions: { type: String, trim: true, maxlength: 500 },
    image: {
      type: new mongoose.Schema({ url: { type: String, required: true }, publicId: { type: String, required: true } }, { _id: false }),
      default: undefined,
    },
    validFrom: { type: Date, required: true }, // 00:00 IST of the start date, stored in UTC
    validTo: { type: Date, required: true }, // 23:59:59.999 IST of the end date, stored in UTC
    status: { type: String, enum: Object.values(OFFER_STATUS), default: OFFER_STATUS.DRAFT },
    isSeed: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderation: moderationField, // admin archive record (never public)
  },
  { timestamps: true },
);

// Spec section 7 indexes + list helpers.
offerSchema.index({ status: 1, validTo: 1 }); // public feed, "ending soon"
offerSchema.index({ businessId: 1 });
offerSchema.index({ title: 'text', description: 'text' }, { name: 'offer_text' });
offerSchema.index({ businessId: 1, status: 1, validTo: 1 }); // business offers + limit count
offerSchema.index({ status: 1, createdAt: -1 }); // "newest"

export const Offer = mongoose.models.Offer ?? mongoose.model('Offer', offerSchema);
