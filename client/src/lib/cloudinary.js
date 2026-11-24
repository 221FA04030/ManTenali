/**
 * Delivery helper: ask Cloudinary for a resized, auto-format, auto-quality
 * version of an image (spec NFR: "Cloudinary resizing (width and format auto)").
 * Non-Cloudinary URLs (e.g. a Google avatar) are returned unchanged.
 */
export function cldUrl(url, { w, h, crop = 'fill' } = {}) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  const parts = ['f_auto', 'q_auto'];
  if (w || h) parts.push(`c_${crop}`);
  if (w) parts.push(`w_${Math.round(w)}`);
  if (h) parts.push(`h_${Math.round(h)}`);
  return url.replace('/image/upload/', `/image/upload/${parts.join(',')}/`);
}
