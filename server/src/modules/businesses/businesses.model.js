import mongoose from 'mongoose';
import { isOvernight } from '../../common/utils/hours.js';

export const BUSINESS_KINDS = Object.freeze(['shop', 'food', 'service']);
export const BUSINESS_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
  ARCHIVED: 'archived',
});
export const MAX_PHOTOS = 8;

const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false },
);

// Embedded: hours are always read with their business.
const hoursSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    open: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    close: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closed: { type: Boolean, default: false },
    overnight: { type: Boolean, default: false }, // derived: close <= open
  },
  { _id: false },
);

const businessSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    kind: { type: String, enum: BUSINESS_KINDS, required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    tags: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    address: {
      line: { type: String, trim: true, maxlength: 200, required: true },
      area: { type: String, trim: true, maxlength: 80, required: true },
      pincode: { type: String, trim: true, match: /^\d{6}$/ },
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    contact: {
      phone: { type: String, trim: true, maxlength: 20 },
      whatsapp: { type: String, trim: true, maxlength: 20 },
      email: { type: String, trim: true, lowercase: true, maxlength: 254 },
      website: { type: String, trim: true, maxlength: 300 },
    },
    openingHours: { type: [hoursSchema], default: [] },
    photos: {
      type: [imageSchema],
      default: [],
      validate: [(v) => v.length <= MAX_PHOTOS, `At most ${MAX_PHOTOS} photos`],
    },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    status: { type: String, enum: Object.values(BUSINESS_STATUS), default: BUSINESS_STATUS.DRAFT },
    isSeed: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 }, // denormalised, owned by reviews (Step 9)
    ratingCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

businessSchema.pre('validate', function deriveOvernight(next) {
  for (const slot of this.openingHours ?? []) slot.overnight = !slot.closed && isOvernight(slot);
  next();
});

// Indexes from spec section 7 (+ sort helpers).
businessSchema.index({ slug: 1 }, { unique: true });
businessSchema.index({ location: '2dsphere' });
businessSchema.index(
  { name: 'text', tags: 'text', description: 'text' },
  { weights: { name: 5, tags: 3, description: 1 }, name: 'business_text' },
);
businessSchema.index({ status: 1, categoryId: 1, 'address.area': 1 });
businessSchema.index({ ownerId: 1 });
businessSchema.index({ status: 1, kind: 1 });
businessSchema.index({ status: 1, updatedAt: -1 });
businessSchema.index({ status: 1, ratingAvg: -1 });

export const Business = mongoose.models.Business ?? mongoose.model('Business', businessSchema);
