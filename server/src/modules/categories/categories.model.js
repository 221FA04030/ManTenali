import mongoose from 'mongoose';

export const CATEGORY_TYPES = Object.freeze(['business', 'event', 'news']);
/** Only business categories have two levels (main category -> subcategory). */
export const NESTED_TYPES = Object.freeze(['business']);

const categorySchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true, trim: true, maxlength: 80 },
      te: { type: String, trim: true, maxlength: 80 },
    },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 90 },
    type: { type: String, enum: CATEGORY_TYPES, required: true },
    // null = main category; otherwise the main category this subcategory belongs to.
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    icon: { type: String, trim: true, maxlength: 40 }, // icon key used by the client
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ type: 1, slug: 1 }, { unique: true });
categorySchema.index({ type: 1, isActive: 1, sortOrder: 1 });
categorySchema.index({ parentId: 1, sortOrder: 1 });

export const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);
