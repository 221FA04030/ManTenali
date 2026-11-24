import { api, ApiError } from '../../lib/apiClient.js';

/** Client-side limits mirror the server's purposes (the server re-checks). */
export const UPLOAD_LIMITS = {
  avatar: 2 * 1024 * 1024,
  business_photo: 5 * 1024 * 1024,
  offer_image: 5 * 1024 * 1024,
  event_banner: 5 * 1024 * 1024,
  news_cover: 5 * 1024 * 1024,
};
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const mediaApi = {
  sign: (purpose) => api.post('/media/sign', { purpose }).then((r) => r.data),
};

/** Returns an i18n error key, or null when the file is acceptable. */
export function checkFile(file, purpose, allowedTypes = ALLOWED_TYPES, maxBytes = UPLOAD_LIMITS[purpose]) {
  if (!file) return 'upload.noFile';
  if (!allowedTypes.includes(file.type)) return 'upload.badType';
  if (file.size > maxBytes) return 'upload.tooBig';
  return null;
}

/**
 * Signed direct upload: 1) ask our API for a signature, 2) send the file
 * straight to Cloudinary (the API never handles file bytes, spec section 9),
 * 3) return { url, publicId } for the normal create/update request.
 */
export async function uploadImage(file, purpose, { signal } = {}) {
  const signed = await mediaApi.sign(purpose);
  const problem = checkFile(file, purpose, signed.allowedTypes, signed.maxBytes);
  if (problem) throw new ApiError({ code: 'VALIDATION_ERROR', message: problem });

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('signature', signed.signature);
  for (const [key, value] of Object.entries(signed.params)) form.append(key, String(value));

  let response;
  try {
    response = await fetch(signed.uploadUrl, { method: 'POST', body: form, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Upload failed' });
  }
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.secure_url || !json?.public_id) {
    throw new ApiError({ status: response.status, code: 'UPLOAD_FAILED', message: 'Upload failed' });
  }
  return { url: json.secure_url, publicId: json.public_id };
}
