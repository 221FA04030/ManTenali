import mongoose from 'mongoose';

/**
 * News imported from a public Instagram account (S News Tenali) through Apify.
 *
 * One NewsImport per Instagram post: the unique postId (and postUrl) is what
 * stops a post being imported twice. Each import owns a news DRAFT that an
 * admin reviews; nothing is published automatically. The record keeps the
 * source metadata needed to audit where a news item came from.
 *
 * We never store the video or a copy of the image: only the post link,
 * caption and post details. Imported drafts use the app's placeholder image.
 */
export const IMPORT_STATUS = Object.freeze({
  NEEDS_REVIEW: 'needs_review', // a news draft exists and waits for an admin
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  FAILED: 'failed', // the post was read but no draft could be made (retried on the next fetch)
});

export const MEDIA_TYPES = Object.freeze(['reel', 'video', 'image', 'carousel', 'unknown']);

/**
 * Transcript of the spoken audio. Speech-to-text is not set up yet, so reels
 * and videos are `not_transcribed`; posts without audio are `not_applicable`.
 */
export const TRANSCRIPT_STATUS = Object.freeze({
  NOT_TRANSCRIBED: 'not_transcribed',
  NOT_APPLICABLE: 'not_applicable',
  TRANSCRIBED: 'transcribed',
  FAILED: 'failed',
});

const transcriptSchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(TRANSCRIPT_STATUS), required: true },
    text: { type: String, maxlength: 20000 },
    language: { type: String, maxlength: 10 }, // e.g. 'te'
    method: { type: String, maxlength: 60 }, // e.g. 'elevenlabs-scribe'
    note: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const importSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['instagram'], default: 'instagram' },
    account: { type: String, required: true, maxlength: 30 }, // Instagram username
    sourceName: { type: String, required: true, maxlength: 100 },
    postId: { type: String, required: true, maxlength: 40 }, // Instagram media pk
    shortCode: { type: String, required: true, maxlength: 40 },
    postUrl: { type: String, required: true, maxlength: 200 }, // canonical https://www.instagram.com/p/<code>/
    caption: { type: String, maxlength: 5000 },
    postedAt: { type: Date },
    mediaType: { type: String, enum: MEDIA_TYPES, default: 'unknown' },
    durationSec: { type: Number, min: 0 },
    transcript: { type: transcriptSchema, required: true },
    status: { type: String, enum: Object.values(IMPORT_STATUS), required: true },
    error: { type: String, maxlength: 300 }, // why it failed (never contains credentials)
    newsId: { type: mongoose.Schema.Types.ObjectId, ref: 'News' },
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'NewsImportRun' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectReason: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);
importSchema.index({ postId: 1 }, { unique: true }); // never import the same post twice
importSchema.index({ postUrl: 1 }, { unique: true });
importSchema.index({ status: 1, createdAt: -1 }); // review list

export const RUN_STATUS = Object.freeze({ RUNNING: 'running', SUCCEEDED: 'succeeded', FAILED: 'failed' });

/** One Fetch News operation (manual button or scheduled Apify task), for progress and counts. */
const runSchema = new mongoose.Schema(
  {
    trigger: { type: String, enum: ['manual', 'schedule'], required: true },
    status: { type: String, enum: Object.values(RUN_STATUS), default: RUN_STATUS.RUNNING },
    account: { type: String, required: true, maxlength: 30 },
    requested: { type: Number, min: 0 }, // posts asked for
    checked: { type: Number, default: 0, min: 0 },
    imported: { type: Number, default: 0, min: 0 },
    duplicates: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 },
    error: { type: String, maxlength: 300 },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
  },
  { timestamps: false },
);
runSchema.index({ startedAt: -1 });
runSchema.index({ status: 1, startedAt: -1 });

export const NewsImport = mongoose.models.NewsImport ?? mongoose.model('NewsImport', importSchema, 'news_imports');
export const NewsImportRun = mongoose.models.NewsImportRun ?? mongoose.model('NewsImportRun', runSchema, 'news_import_runs');
