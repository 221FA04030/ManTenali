import mongoose from 'mongoose';

/**
 * Private supporting evidence for an event submission. Kept in its OWN
 * collection so public event queries can never include it by accident.
 * Files live in Cloudinary with the "private" delivery type.
 */
export const EVIDENCE_KINDS = Object.freeze(['document', 'poster', 'venue_confirmation', 'photo', 'organizer_card', 'other']);
export const MAX_EVIDENCE = 5;

const evidenceSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: EVIDENCE_KINDS, required: true },
    note: { type: String, trim: true, maxlength: 200 },
    storage: {
      publicId: { type: String, required: true },
      resourceType: { type: String, default: 'image' },
      deliveryType: { type: String, default: 'private' },
      format: { type: String, required: true },
      bytes: { type: Number, required: true },
      width: { type: Number },
      height: { type: Number },
      pages: { type: Number },
    },
    originalFilename: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
    removedAt: { type: Date },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

evidenceSchema.index({ eventId: 1, status: 1 });
evidenceSchema.index({ uploadedBy: 1 });
evidenceSchema.index({ 'storage.publicId': 1 }, { unique: true }); // a file can be attached only once

export const EventEvidence = mongoose.models.EventEvidence ?? mongoose.model('EventEvidence', evidenceSchema, 'event_evidence');
