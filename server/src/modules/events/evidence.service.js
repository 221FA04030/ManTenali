import { EventEvidence, MAX_EVIDENCE } from './evidence.model.js';
import { EVIDENCE, evidenceFolderFor } from '../media/media.service.js';
import { getResource, destroyAsset, privateDownloadUrl } from '../../common/integrations/cloudinary.js';
import { AppError } from '../../common/errors/index.js';

/**
 * The ONLY code that touches private evidence. Callers (events.service) decide
 * whether the user may act on the event; this module checks the files.
 * Evidence never appears in public responses, and nothing here logs file ids or links.
 */

const PUBLIC_ID_RX = /^[A-Za-z0-9/_-]{1,200}$/;
const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ACCESS_SECONDS = 300;

function badFile(index, message) {
  return AppError.validation(message, [{ field: `body.evidence.${index}`, message }]);
}

/** Display-only filename: no path, no control characters, at most 120 characters. */
export function cleanFilename(name) {
  const base = String(name ?? '')
    .split(/[\\/]/)
    .pop()
    .replace(/[^\p{L}\p{N} ._()-]/gu, '')
    .trim();
  return base.slice(0, 120) || null;
}

/** Owner/admin view of one evidence record (metadata only - no links). */
export function toEvidenceDTO(e) {
  return {
    id: String(e._id),
    kind: e.kind,
    note: e.note ?? '',
    filename: e.originalFilename ?? null,
    format: e.storage.format,
    bytes: e.storage.bytes,
    pages: e.storage.pages ?? null,
    isImage: IMAGE_FORMATS.has(e.storage.format),
    status: e.status,
    createdAt: e.createdAt,
  };
}

async function discard(publicId) {
  await destroyAsset({ publicId }).catch(() => false);
}

/**
 * Check an uploaded private file before it may be attached: it must be in the
 * caller's own folder, exist on Cloudinary as a PRIVATE file, have an allowed
 * format, size and page count, and not already be attached. Bad files are deleted.
 */
async function verifyUpload(user, item, index) {
  const folder = `${evidenceFolderFor(user.id)}/`;
  if (!PUBLIC_ID_RX.test(item.publicId) || item.publicId.includes('..') || !item.publicId.startsWith(folder)) {
    throw badFile(index, 'This file was not uploaded by you.');
  }
  if (await EventEvidence.exists({ 'storage.publicId': item.publicId })) {
    throw badFile(index, 'This file is already attached.');
  }
  let resource;
  try {
    resource = await getResource({ publicId: item.publicId, type: 'private' });
  } catch (err) {
    if (err?.code === 'CLOUDINARY_NOT_CONFIGURED') throw new AppError('SERVICE_UNAVAILABLE', 'File uploads are not configured yet.');
    throw new AppError('SERVICE_UNAVAILABLE', 'Could not check the uploaded file. Please try again.');
  }
  if (!resource) throw badFile(index, 'Uploaded file not found. Please upload it again.');

  const format = String(resource.format ?? '').toLowerCase();
  let problem = null;
  if (resource.type !== 'private' || resource.resourceType !== 'image') problem = 'This file was not uploaded correctly.';
  else if (!EVIDENCE.formats.includes(format)) problem = 'Only JPG, PNG, WebP or PDF files are allowed.';
  else if (format === 'pdf' && resource.bytes > EVIDENCE.maxPdfBytes) problem = 'PDF files can be at most 10 MB.';
  else if (format !== 'pdf' && resource.bytes > EVIDENCE.maxImageBytes) problem = 'Images can be at most 5 MB.';
  else if (format === 'pdf' && (resource.pages ?? 1) > EVIDENCE.maxPdfPages) problem = 'PDF files can have at most 20 pages.';
  if (problem) {
    await discard(item.publicId);
    throw badFile(index, problem);
  }
  return {
    kind: item.kind,
    note: item.note || undefined,
    originalFilename: cleanFilename(item.filename) ?? undefined,
    storage: {
      publicId: resource.publicId,
      resourceType: 'image',
      deliveryType: 'private',
      format,
      bytes: resource.bytes,
      width: resource.width ?? undefined,
      height: resource.height ?? undefined,
      pages: resource.pages ?? undefined,
    },
  };
}

/** Verify several uploads (all must pass; no duplicates within the request). */
export async function verifyUploads(user, items) {
  if (new Set(items.map((i) => i.publicId)).size !== items.length) {
    throw AppError.validation('Each file can be attached only once.');
  }
  const verified = [];
  for (const [i, item] of items.entries()) verified.push(await verifyUpload(user, item, i));
  return verified;
}

export async function attachVerified(eventId, user, verified) {
  return EventEvidence.insertMany(verified.map((v) => ({ ...v, eventId, uploadedBy: user.id })));
}

export async function listForEvent(eventId, { includeRemoved = false } = {}) {
  const filter = { eventId };
  if (!includeRemoved) filter.status = 'active';
  const items = await EventEvidence.find(filter).sort({ createdAt: 1 }).lean();
  return items.map(toEvidenceDTO);
}

export const countActive = (eventId) => EventEvidence.countDocuments({ eventId, status: 'active' });

/** Add one file to an event (caller has checked the user may edit the event). */
export async function addOne(eventId, user, item) {
  if ((await countActive(eventId)) >= MAX_EVIDENCE) {
    throw AppError.conflict(`At most ${MAX_EVIDENCE} evidence files are allowed.`);
  }
  const [verified] = await verifyUploads(user, [item]);
  const [created] = await attachVerified(eventId, user, [verified]);
  return toEvidenceDTO(created.toObject());
}

/** Remove one file: the stored file is deleted, the record kept for the audit trail. At least one must remain. */
export async function removeOne(eventId, evidenceId, user) {
  const ev = await EventEvidence.findOne({ _id: evidenceId, eventId, status: 'active' });
  if (!ev) throw AppError.notFound('Evidence not found.');
  if ((await countActive(eventId)) <= 1) {
    throw AppError.conflict('Keep at least one evidence file. Add the new file first, then remove this one.');
  }
  ev.status = 'removed';
  ev.removedAt = new Date();
  ev.removedBy = user.id;
  await ev.save();
  await discard(ev.storage.publicId);
  return toEvidenceDTO(ev.toObject());
}

/**
 * Retention cleanup: delete every active file of an event from Cloudinary and
 * mark it removed (metadata is kept for the history). Returns the count.
 */
export async function purgeForEvent(eventId) {
  const items = await EventEvidence.find({ eventId, status: 'active' });
  for (const ev of items) {
    ev.status = 'removed';
    ev.removedAt = new Date();
    ev.removedBy = null;
    await ev.save();
    await discard(ev.storage.publicId);
  }
  return items.length;
}

/** Admin permanent delete of an event: delete its files, then the records themselves. */
export async function deleteForEvent(eventId) {
  const items = await EventEvidence.find({ eventId, status: 'active' }).select('storage.publicId').lean();
  for (const ev of items) await discard(ev.storage.publicId);
  await EventEvidence.deleteMany({ eventId });
  return items.length;
}

/** Event ids that still have active evidence (for retention cleanup). */
export const eventIdsWithActiveEvidence = (eventIds) => EventEvidence.distinct('eventId', { eventId: { $in: eventIds }, status: 'active' });

/**
 * Short-lived (5 minute) links for the submitter or an admin. Images get an
 * inline preview link (shown only as <img>); every file gets an attachment
 * download link. PDFs are never displayed inline.
 */
export async function accessLinks(eventId, evidenceId) {
  const ev = await EventEvidence.findOne({ _id: evidenceId, eventId, status: 'active' }).lean();
  if (!ev) throw AppError.notFound('Evidence not found.');
  try {
    const { publicId, format } = ev.storage;
    const download = privateDownloadUrl({ publicId, format, attachment: true, expiresInSeconds: ACCESS_SECONDS });
    const preview = IMAGE_FORMATS.has(format) ? privateDownloadUrl({ publicId, format, expiresInSeconds: ACCESS_SECONDS }) : null;
    return {
      id: String(ev._id),
      filename: ev.originalFilename ?? null,
      format,
      isImage: Boolean(preview),
      previewUrl: preview?.url ?? null,
      downloadUrl: download.url,
      expiresAt: download.expiresAt,
    };
  } catch (err) {
    if (err?.code === 'CLOUDINARY_NOT_CONFIGURED') throw new AppError('SERVICE_UNAVAILABLE', 'File storage is not configured.');
    throw err;
  }
}
