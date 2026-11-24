import { AppError } from '../../common/errors/index.js';
import {
  getCloudinaryConfig,
  signParams,
  uploadUrl,
  deliveryPrefix,
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
});
export const PURPOSE_LIST = Object.freeze(Object.keys(UPLOAD_PURPOSES));

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
