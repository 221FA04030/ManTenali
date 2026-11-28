import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/index.js';
import {
  getCloudinaryConfig,
  signParams,
  uploadUrl,
  deliveryPrefix,
  destroyAsset,
} from '../../common/integrations/cloudinary.js';
import { ROLES } from '../../config/constants.js';

export const ROOT_FOLDER = 'mana-tenali';
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * What each upload is for, who may request it, and its limits (FR-MED-1).
 * The incoming transformation caps stored dimensions on Cloudinary's side.
 */
export const UPLOAD_PURPOSES = Object.freeze({
  avatar: { folder: 'avatars', roles: [ROLES.USER, ROLES.OWNER, ROLES.ADMIN], maxBytes: 2 * 1024 * 1024, maxDim: 600 },
  business_photo: { folder: 'businesses', roles: [ROLES.OWNER, ROLES.ADMIN], maxBytes: 5 * 1024 * 1024, maxDim: 1600 },
  offer_image: { folder: 'offers', roles: [ROLES.OWNER, ROLES.ADMIN], maxBytes: 5 * 1024 * 1024, maxDim: 1600 },
  event_banner: { folder: 'events', roles: [ROLES.ADMIN], maxBytes: 5 * 1024 * 1024, maxDim: 1600 },
  news_cover: { folder: 'news', roles: [ROLES.ADMIN], maxBytes: 5 * 1024 * 1024, maxDim: 1600 },
  post_photo: { folder: 'posts', roles: [ROLES.USER, ROLES.OWNER, ROLES.ADMIN], maxBytes: 5 * 1024 * 1024, maxDim: 1600 },
});
/**
 * PRIVATE evidence for event submissions (Step 6). Stored with Cloudinary's
 * "private" delivery type: never reachable through public image URLs, only via
 * short-lived signed download links issued by the events module. Each user
 * uploads into their own folder with a random file id.
 */
export const EVIDENCE = Object.freeze({
  purpose: 'event_evidence',
  folder: 'evidence',
  roles: [ROLES.USER, ROLES.OWNER, ROLES.ADMIN],
  formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maxImageBytes: 5 * 1024 * 1024,
  maxPdfBytes: 10 * 1024 * 1024,
  maxPdfPages: 20,
});

/** Folder that holds one user's private evidence uploads. */
export const evidenceFolderFor = (userId) => `${ROOT_FOLDER}/${EVIDENCE.folder}/u_${userId}`;

export const PURPOSE_LIST = Object.freeze([...Object.keys(UPLOAD_PURPOSES), EVIDENCE.purpose]);

const PUBLIC_ID_RX = /^[A-Za-z0-9/_-]{1,200}$/;

function requireConfig() {
  const config = getCloudinaryConfig();
  if (!config) throw new AppError('SERVICE_UNAVAILABLE', 'Image uploads are not configured yet.');
  return config;
}

export const folderFor = (purpose) => `${ROOT_FOLDER}/${UPLOAD_PURPOSES[purpose].folder}`;

/**
 * Return signed parameters for a direct browser -> Cloudinary upload.
 * The file never passes through our API.
 */
export function signUpload(user, purpose, now = Date.now()) {
  if (purpose === EVIDENCE.purpose) return signEvidenceUpload(user, now);
  const rule = UPLOAD_PURPOSES[purpose];
  if (!rule) throw AppError.validation('Unknown upload purpose.');
  if (!rule.roles.includes(user.role)) throw AppError.forbidden('You cannot upload this kind of image.');
  const { cloudName, apiKey, apiSecret } = requireConfig();

  const params = {
    timestamp: Math.floor(now / 1000),
    folder: folderFor(purpose),
    allowed_formats: ALLOWED_FORMATS.join(','),
    transformation: `c_limit,w_${rule.maxDim},h_${rule.maxDim}`,
  };
  return {
    uploadUrl: uploadUrl(cloudName),
    cloudName,
    apiKey,
    params,
    signature: signParams(params, apiSecret),
    maxBytes: rule.maxBytes,
    allowedTypes: ALLOWED_TYPES,
  };
}

/** Signed parameters for a PRIVATE evidence upload into the caller's own folder. */
function signEvidenceUpload(user, now) {
  if (!EVIDENCE.roles.includes(user.role)) throw AppError.forbidden('You cannot upload evidence.');
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const params = {
    timestamp: Math.floor(now / 1000),
    folder: evidenceFolderFor(user.id),
    public_id: randomUUID().replace(/-/g, ''),
    type: 'private',
    allowed_formats: EVIDENCE.formats.join(','),
  };
  return {
    uploadUrl: uploadUrl(cloudName),
    cloudName,
    apiKey,
    params,
    signature: signParams(params, apiSecret),
    maxBytes: EVIDENCE.maxPdfBytes,
    maxImageBytes: EVIDENCE.maxImageBytes,
    allowedTypes: EVIDENCE.types,
  };
}

function invalidImage(field) {
  return AppError.validation('Image must be uploaded through Mana Tenali.', [
    { field, message: 'Image is not from this project’s image storage' },
  ]);
}

/**
 * Accept an image reference only if it lives in this project's Cloudinary
 * account and in the folder for its purpose (spec security checklist).
 */
export function assertOwnImage(image, purpose, field = 'body.image') {
  if (!image) return image;
  const config = getCloudinaryConfig();
  if (!config) throw invalidImage(field);
  const { url, publicId } = image;
  if (typeof url !== 'string' || typeof publicId !== 'string') throw invalidImage(field);
  if (!PUBLIC_ID_RX.test(publicId) || publicId.includes('..')) throw invalidImage(field);
  if (!publicId.startsWith(`${folderFor(purpose)}/`)) throw invalidImage(field);
  if (!url.startsWith(deliveryPrefix(config.cloudName))) throw invalidImage(field);
  const path = new URL(url).pathname;
  if (!path.includes(`/${publicId}.`) && !path.endsWith(`/${publicId}`)) throw invalidImage(field);
  return { url, publicId };
}

/** Same check for fields that store only a URL (users.avatarUrl). */
export function assertOwnImageUrl(url, purpose, field = 'body.avatarUrl') {
  if (!url) return url;
  const config = getCloudinaryConfig();
  if (!config || typeof url !== 'string' || !url.startsWith(deliveryPrefix(config.cloudName))) {
    throw invalidImage(field);
  }
  if (!new URL(url).pathname.includes(`/${folderFor(purpose)}/`)) throw invalidImage(field);
  return url;
}

/** Validate a list of images (e.g. business photos) and enforce a maximum count. */
export function assertOwnImages(images, purpose, { max, field = 'body.photos' } = {}) {
  if (!images) return images;
  if (max && images.length > max) {
    throw AppError.validation(`At most ${max} images are allowed.`, [{ field, message: `Max ${max} images` }]);
  }
  return images.map((img, i) => assertOwnImage(img, purpose, `${field}.${i}`));
}

/**
 * Admin permanent delete: remove no-longer-used public images from Cloudinary.
 * Only ids inside this project's public folders are touched (never evidence,
 * never another account's files). Best effort: a failure never blocks the
 * deletion of the record. Returns { removed, failed, skipped } counts.
 */
export async function releaseImages(publicIds, { destroy = destroyAsset } = {}) {
  const folders = Object.keys(UPLOAD_PURPOSES).map((p) => `${folderFor(p)}/`);
  const ids = [...new Set(publicIds)].filter(
    (id) => typeof id === 'string' && PUBLIC_ID_RX.test(id) && !id.includes('..') && folders.some((f) => id.startsWith(f)),
  );
  const result = { removed: 0, failed: 0, skipped: publicIds.length - ids.length };
  if (!ids.length) return result;
  if (!getCloudinaryConfig()) return { ...result, skipped: publicIds.length };
  for (const publicId of ids) {
    const ok = await destroy({ publicId, type: 'upload' }).catch(() => false);
    if (ok) result.removed += 1;
    else result.failed += 1;
  }
  return result;
}
