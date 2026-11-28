import { z } from 'zod';
import { NewsImport, NewsImportRun, IMPORT_STATUS, RUN_STATUS, TRANSCRIPT_STATUS } from './newsImport.model.js';
import * as apify from './apify.client.js';
import { ApifyError } from './apify.client.js';
import * as newsService from '../news/news.service.js';
import { AppError } from '../../common/errors/index.js';
import { getPagination, buildMeta } from '../../common/utils/pagination.js';
import { createLogger } from '../../common/utils/logger.js';
import { getEnv } from '../../config/env.js';

const S = IMPORT_STATUS;
/** A run still "running" after this long was interrupted (for example a server restart). */
const STALE_RUN_MS = 15 * 60_000;
const TITLE_MAX = 140;
const SUMMARY_MAX = 300;

/**
 * Used when a post has no usable caption: the admin must write a summary
 * before publishing (publish() refuses this text).
 */
export const SUMMARY_PLACEHOLDER = 'సారాంశం రాయాలి: మూల పోస్ట్ చూసి వివరాలు జోడించండి.';

let logger;
const log = () => (logger ??= createLogger({ level: getEnv().isTest ? 'silent' : (getEnv().LOG_LEVEL ?? 'info') }));

/* ----------------------------- reading Apify items ----------------------------- */

/**
 * The fields we use from the scraper's output (sones/instagram-posts-scraper-lowcost),
 * checked on arrival: anything else is ignored, and video/image URLs are never stored.
 */
const apifyItem = z.object({
  pk: z.union([z.string(), z.number()]).optional(),
  id: z.string().optional(),
  code: z.string().regex(/^[A-Za-z0-9_-]{5,40}$/),
  taken_at: z.number().int().positive().optional(),
  media_type: z.number().int().optional(),
  product_type: z.string().optional(),
  video_duration: z.number().nonnegative().nullable().optional(),
  video_url: z.string().nullable().optional(),
  caption: z.object({ text: z.string().nullable().optional() }).nullable().optional(),
  user: z.object({ username: z.string() }).partial().nullable().optional(),
  scraped_username: z.string().optional(),
});

function mediaTypeOf(item) {
  if (item.media_type === 2) return item.product_type === 'clips' ? 'reel' : 'video';
  if (item.media_type === 1) return 'image';
  if (item.media_type === 8) return 'carousel';
  return 'unknown';
}

/** A post's facts we keep, or { error } when the item can't be used. */
export function readPost(raw, expectedAccount) {
  const parsed = apifyItem.safeParse(raw);
  if (!parsed.success) return { error: 'The post data from Apify was incomplete.' };
  const item = parsed.data;
  const postId = String(item.pk ?? item.id?.split('_')[0] ?? '');
  if (!/^\d{5,30}$/.test(postId)) return { error: 'The post had no Instagram id.' };
  const account = (item.user?.username ?? item.scraped_username ?? '').toLowerCase();
  if (account !== expectedAccount) return { error: `The post is from another account (@${account || 'unknown'}).` };
  const mediaType = mediaTypeOf(item);
  const hasAudio = mediaType === 'reel' || mediaType === 'video';
  return {
    post: {
      postId,
      shortCode: item.code,
      postUrl: `https://www.instagram.com/p/${item.code}/`,
      account,
      caption: (item.caption?.text ?? '').trim().slice(0, 5000),
      postedAt: item.taken_at ? new Date(item.taken_at * 1000) : undefined,
      mediaType,
      durationSec: hasAudio && item.video_duration ? Math.round(item.video_duration) : undefined,
      // Speech-to-text is not set up yet: say so instead of pretending.
      transcript: hasAudio
        ? { status: TRANSCRIPT_STATUS.NOT_TRANSCRIBED, note: 'Speech-to-text is not set up yet. Listen to the post before publishing.' }
        : { status: TRANSCRIPT_STATUS.NOT_APPLICABLE, note: 'This post has no audio.' },
    },
  };
}

const oneLine = (s) => s.replace(/\s+/g, ' ').trim();
function cut(text, max) {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > max * 0.6 ? head.slice(0, space) : head).trim()}…`;
}

/**
 * The draft's starting headline and summary, taken only from the caption (no
 * AI, no added facts). The admin edits both before publishing.
 */
export function draftText(post, sourceName) {
  const lines = post.caption.split('\n').map(oneLine).filter(Boolean);
  const firstLine = lines[0] ?? '';
  const date = post.postedAt
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(post.postedAt)
    : null;
  const title = firstLine.length >= 3 ? cut(firstLine, TITLE_MAX) : cut(`${sourceName} పోస్ట్${date ? ` (${date})` : ''}`, TITLE_MAX);
  const all = oneLine(post.caption);
  const summary = all.length >= 10 ? cut(all, SUMMARY_MAX) : SUMMARY_PLACEHOLDER;
  return { title, summary };
}

/* ----------------------------- importing ----------------------------- */

const isDuplicateKey = (err) => err?.code === 11000;

/** Make (or, after an earlier failure, retry) the news draft for one post. */
async function importPost(post, { run, sourceName, createdBy }) {
  const existing = await NewsImport.findOne({ $or: [{ postId: post.postId }, { postUrl: post.postUrl }] });
  if (existing && existing.status !== S.FAILED) return 'duplicate';
  let record = existing;
  if (!record) {
    try {
      record = await NewsImport.create({ ...post, sourceName, status: S.FAILED, error: 'Draft not created yet.', runId: run._id });
    } catch (err) {
      if (isDuplicateKey(err)) return 'duplicate'; // imported by another run at the same moment
      throw err;
    }
  }
  try {
    const { title, summary } = draftText(post, sourceName);
    const news = await newsService.createImportedDraft({ title, summary, sourceName, sourceUrl: post.postUrl, createdBy });
    Object.assign(record, { ...post, sourceName, status: S.NEEDS_REVIEW, error: undefined, newsId: news.id, runId: run._id });
    await record.save();
    return 'imported';
  } catch (err) {
    log().error({ err: { name: err?.name, message: err?.message }, postId: post.postId }, 'news import: could not create the draft');
    record.status = S.FAILED;
    record.error = 'The news draft could not be created. It will be retried on the next fetch.';
    record.runId = run._id;
    await record.save();
    return 'failed';
  }
}

/** Import a list of Apify items into drafts, counting as we go (visible to the progress poll). */
export async function processItems(items, run, { createdBy } = {}) {
  const env = getEnv();
  const sourceName = env.NEWS_IMPORT_SOURCE_NAME;
  for (const raw of items) {
    const { post, error } = readPost(raw, env.NEWS_IMPORT_INSTAGRAM_USERNAME);
    let outcome;
    if (error) {
      log().warn({ reason: error }, 'news import: skipped an unusable post');
      outcome = 'failed';
    } else {
      outcome = await importPost(post, { run, sourceName, createdBy });
    }
    const counter = { imported: 'imported', duplicate: 'duplicates', failed: 'failed' }[outcome];
    await NewsImportRun.updateOne({ _id: run._id }, { $inc: { checked: 1, [counter]: 1 } });
  }
}

/* ----------------------------- runs ----------------------------- */

function runDTO(r) {
  return {
    id: String(r._id),
    trigger: r.trigger,
    status: r.status,
    account: r.account,
    requested: r.requested ?? null,
    checked: r.checked ?? 0,
    imported: r.imported ?? 0,
    duplicates: r.duplicates ?? 0,
    failed: r.failed ?? 0,
    error: r.error ?? null,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
  };
}

/** Only one fetch at a time. A run left "running" for too long was interrupted. */
async function assertNoRunInProgress() {
  const now = Date.now();
  await NewsImportRun.updateMany(
    { status: RUN_STATUS.RUNNING, startedAt: { $lt: new Date(now - STALE_RUN_MS) } },
    { $set: { status: RUN_STATUS.FAILED, error: 'The fetch was interrupted. Start it again.', finishedAt: new Date(now) } },
  );
  const running = await NewsImportRun.findOne({ status: RUN_STATUS.RUNNING }).lean();
  if (running) throw AppError.conflict('A news fetch is already running. Wait for it to finish.', { runId: String(running._id) });
}

const safeMessage = (err) => (err instanceof ApifyError ? err.message : 'The fetch failed unexpectedly. Try again later.');

/** Run `load` (which returns Apify items), import them, and close the run. Never throws. */
async function execute(run, load, { createdBy } = {}) {
  try {
    const items = await load();
    await processItems(items, run, { createdBy });
    await NewsImportRun.updateOne({ _id: run._id }, { $set: { status: RUN_STATUS.SUCCEEDED, finishedAt: new Date() } });
  } catch (err) {
    log().error({ err: { name: err?.name, message: safeMessage(err), kind: err?.kind } }, 'news import: fetch failed');
    await NewsImportRun.updateOne({ _id: run._id }, { $set: { status: RUN_STATUS.FAILED, error: safeMessage(err), finishedAt: new Date() } }).catch(() => {});
  }
}

/** Running jobs, so tests (and a graceful shutdown) can wait for them. */
const inFlight = new Set();
function track(promise) {
  inFlight.add(promise);
  promise.finally(() => inFlight.delete(promise));
}
export const settleRunsForTests = () => Promise.all([...inFlight]);

/**
 * Admin "Fetch News": start fetching the newest posts in the background and
 * return the run at once; the page polls getRun() for progress and counts.
 */
export async function startManualFetch(admin) {
  const env = getEnv();
  if (!env.APIFY_TOKEN) throw new AppError('SERVICE_UNAVAILABLE', 'Fetch News is not set up on the server yet (APIFY_TOKEN is missing).');
  await assertNoRunInProgress();
  const limit = env.NEWS_IMPORT_MAX_POSTS;
  const run = await NewsImportRun.create({ trigger: 'manual', account: env.NEWS_IMPORT_INSTAGRAM_USERNAME, requested: limit, startedBy: admin.id });
  track(execute(run, () => apify.fetchRecentPosts({ username: env.NEWS_IMPORT_INSTAGRAM_USERNAME, limit }), { createdBy: admin.id }));
  return runDTO(run);
}

/** Scheduled Apify task finished: import the posts in its dataset. */
export async function startScheduledImport(datasetId) {
  const env = getEnv();
  if (!env.APIFY_TOKEN) throw new AppError('SERVICE_UNAVAILABLE', 'APIFY_TOKEN is missing on the server.');
  await assertNoRunInProgress();
  const limit = env.NEWS_IMPORT_MAX_POSTS;
  const run = await NewsImportRun.create({ trigger: 'schedule', account: env.NEWS_IMPORT_INSTAGRAM_USERNAME, requested: limit });
  track(execute(run, () => apify.fetchDatasetItems(datasetId, limit)));
  return runDTO(run);
}

export async function getRun(id) {
  const run = await NewsImportRun.findById(id).lean();
  if (!run) throw AppError.notFound('Fetch not found.');
  return runDTO(run);
}

export async function latestRun() {
  const run = await NewsImportRun.findOne().sort({ startedAt: -1, _id: -1 }).lean();
  return run ? runDTO(run) : null;
}

/* ----------------------------- review ----------------------------- */

function importDTO(r, news) {
  return {
    id: String(r._id),
    status: r.status,
    source: r.source,
    account: r.account,
    sourceName: r.sourceName,
    postId: r.postId,
    shortCode: r.shortCode,
    postUrl: r.postUrl,
    caption: r.caption ?? '',
    postedAt: r.postedAt ?? null,
    mediaType: r.mediaType,
    durationSec: r.durationSec ?? null,
    transcript: {
      status: r.transcript?.status ?? TRANSCRIPT_STATUS.NOT_TRANSCRIBED,
      text: r.transcript?.text ?? null,
      language: r.transcript?.language ?? null,
      method: r.transcript?.method ?? null,
      note: r.transcript?.note ?? null,
    },
    error: r.error ?? null,
    rejectReason: r.rejectReason ?? null,
    news: r.newsId ? (news.get(String(r.newsId)) ?? null) : null,
    importedAt: r.createdAt,
    reviewedAt: r.reviewedAt ?? null,
  };
}

async function withNews(records) {
  return newsService.adminSummariesByIds(records.map((r) => r.newsId).filter(Boolean));
}

export async function list({ status, page, limit }) {
  const p = getPagination({ page, limit });
  const filter = status ? { status } : {};
  const [items, total, counts] = await Promise.all([
    NewsImport.find(filter).sort({ createdAt: -1, _id: -1 }).skip(p.skip).limit(p.limit).lean(),
    NewsImport.countDocuments(filter),
    NewsImport.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const news = await withNews(items);
  const byStatus = Object.fromEntries(Object.values(S).map((s) => [s, 0]));
  for (const c of counts) byStatus[c._id] = c.n;
  return { items: items.map((r) => importDTO(r, news)), meta: { ...buildMeta({ ...p, total }), counts: byStatus } };
}

export async function get(id) {
  const r = await NewsImport.findById(id).lean();
  if (!r) throw AppError.notFound('Imported post not found.');
  return importDTO(r, await withNews([r]));
}

async function loadForReview(id) {
  const r = await NewsImport.findById(id);
  if (!r) throw AppError.notFound('Imported post not found.');
  if (r.status !== S.NEEDS_REVIEW || !r.newsId) {
    throw AppError.conflict(r.status === S.FAILED ? 'This post has no draft yet. Fetch News again to retry it.' : 'This post was already reviewed.');
  }
  return r;
}

/** Save the admin's headline and summary on the draft (still a draft). */
export async function saveDraft(admin, id, { title, summary }) {
  const r = await loadForReview(id);
  await newsService.update(admin, r.newsId, { title, summary });
  return get(id);
}

/** Publish the reviewed draft with the admin's final headline and summary. Attribution stays. */
export async function publish(admin, id, { title, summary }) {
  const r = await loadForReview(id);
  if (summary.trim() === SUMMARY_PLACEHOLDER) {
    throw AppError.validation('Write the summary before publishing.', [{ field: 'body.summary', message: 'Write a summary from the source' }]);
  }
  await newsService.update(admin, r.newsId, { title, summary, status: 'published' });
  Object.assign(r, { status: S.PUBLISHED, reviewedBy: admin.id, reviewedAt: new Date() });
  await r.save();
  return get(id);
}

/**
 * Reject: the draft is removed (archived, never public) and the post stays
 * recorded, so it is not imported again.
 */
export async function reject(admin, id, { reason }) {
  const r = await loadForReview(id);
  await newsService.remove(admin, r.newsId);
  Object.assign(r, { status: S.REJECTED, reviewedBy: admin.id, reviewedAt: new Date(), rejectReason: reason || undefined });
  await r.save();
  return get(id);
}
