import mongoose from 'mongoose';
import { isOvernight } from '../../common/utils/hours.js';

export const BUSINESS_KINDS = Object.freeze(['shop', 'food', 'service']);
/**
 * draft     - saved but not submitted (or created by an admin, not yet live)
 * pending   - submitted by a user, waiting for admin review
 * published - approved / live (the ONLY status visible to the public)
 * rejected  - review rejected with a reason; the owner may edit and resubmit
 * hidden    - taken down by an admin
 * archived  - soft deleted
 */
export const BUSINESS_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  HIDDEN: 'hidden',
  ARCHIVED: 'archived',
});
export const MAX_PHOTOS = 8;

/**
 * Fixed cuisine list (FR-FOOD-1/2). A fixed list keeps the cuisine filter
 * reliable; labels (English/Telugu) live in the client locale files.
 */
export const FOOD_CUISINES = Object.freeze([
  'south-indian',
  'andhra',
  'north-indian',
  'chinese',
  'biryani',
  'bakery-sweets',
  'snacks-chaat',
  'juices-beverages',
  'cafe',
  'multi-cuisine',
]);
export const MENU_LIMITS = Object.freeze({ sections: 20, itemsPerSection: 60, totalItems: 200, maxPrice: 100_000 });

// Embedded: the menu is always read with its business (spec section 7).
const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 0, max: MENU_LIMITS.maxPrice }, // INR
    isVeg: { type: Boolean, default: false },
  },
  { _id: false },
);
const menuSectionSchema = new mongoose.Schema(
  {
    section: { type: String, required: true, trim: true, maxlength: 60 },
    items: { type: [menuItemSchema], default: [] },
  },
  { _id: false },
);

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
    // Normalised name used to detect duplicate listings in the same area.
    nameKey: { type: String, required: true },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }, // main category
    subcategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // must belong to categoryId
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
    // Price range 1-3 (cheap / moderate / expensive) - mainly for food.
    priceRange: { type: Number, min: 1, max: 3 },
    // Only when kind = food (FR-FOOD-1).
    food: {
      type: new mongoose.Schema(
        {
          cuisines: { type: [{ type: String, enum: FOOD_CUISINES }], default: [] },
          isVegFriendly: { type: Boolean, default: false },
          menu: { type: [menuSectionSchema], default: [] },
        },
        { _id: false },
      ),
      default: undefined,
    },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    status: { type: String, enum: Object.values(BUSINESS_STATUS), default: BUSINESS_STATUS.DRAFT },
    isSeed: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 }, // denormalised, owned by reviews (Step 9)
    ratingCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Self-submission review trail (never exposed on public endpoints).
    submittedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

/** "Sri  Krishna Sweets!" -> "srikrishnasweets" (letters/digits in any script). */
export function normaliseName(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

businessSchema.pre('validate', function derive(next) {
  for (const slot of this.openingHours ?? []) slot.overnight = !slot.closed && isOvernight(slot);
  if (this.isModified('name') || !this.nameKey) this.nameKey = normaliseName(this.name);
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
businessSchema.index({ status: 1, subcategoryId: 1, 'address.area': 1 });
businessSchema.index({ nameKey: 1, 'address.area': 1 });
businessSchema.index({ ownerId: 1, status: 1 });
businessSchema.index({ status: 1, submittedAt: 1 });
// Food filters (FR-FOOD-2): cuisine, price range, veg-friendly within published food businesses.
businessSchema.index({ status: 1, kind: 1, 'food.cuisines': 1 });
businessSchema.index({ status: 1, kind: 1, priceRange: 1 });

export const Business = mongoose.models.Business ?? mongoose.model('Business', businessSchema);
