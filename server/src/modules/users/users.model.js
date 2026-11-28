import mongoose from 'mongoose';
import { ROLE_LIST, ROLES } from '../../config/constants.js';

export const USER_STATUS = Object.freeze({ ACTIVE: 'active', BLOCKED: 'blocked' });
export const LANGUAGES = Object.freeze(['en', 'te']);
/** Bounds for the Home shortcut engagement record (see featureEngagement below). */
export const ENGAGEMENT_LIMITS = Object.freeze({ features: 40, mergedIds: 20 });

/**
 * How much this person uses each Home feature, so Home can put their favourite
 * features first. Only a decayed score per feature key, when it last changed
 * and an opaque session id (to notice a return visit): no content, no history.
 * The client computes the scores; the server keeps the newest entry per feature.
 */
const engagementEntrySchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, required: true },
    updatedAt: { type: Date, required: true },
    lastSession: { type: String, maxlength: 40 },
  },
  { _id: false },
);
const featureEngagementSchema = new mongoose.Schema(
  {
    features: { type: Map, of: engagementEntrySchema, default: undefined },
    // Ids of anonymous (signed-out) records already added, so one is never counted twice.
    mergedIds: { type: [String], default: undefined },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 }, // optional, not used for login yet
    passwordHash: { type: String, select: false }, // absent for Google-only users
    googleId: { type: String },
    role: { type: String, enum: ROLE_LIST, default: ROLES.USER },
    avatarUrl: { type: String, trim: true, maxlength: 500 },
    preferredArea: { type: String, trim: true, maxlength: 80 },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    featureEngagement: { type: featureEngagementSchema, select: false, default: undefined },
  },
  { timestamps: true },
);

// Unique but sparse: Google-only users have no password; email users have no googleId.
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
