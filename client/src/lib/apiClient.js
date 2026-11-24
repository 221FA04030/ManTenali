/**
 * The single API client. Every request goes to the Express API (never to
 * MongoDB or Cloudinary secrets). Cookies are always sent; the standard error
 * envelope is mapped to ApiError so screens can show friendly messages.
 */
const BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message = 'Network error', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Map of field -> message for forms (from VALIDATION_ERROR details). */
  get fieldErrors() {
    const out = {};
    for (const d of Array.isArray(this.details) ? this.details : []) {
      if (d?.field) out[d.field.replace(/^(body|query|params)\./, '')] = d.message;
    }
    return out;
  }
}

let unauthorizedHandler = null;
/** Registered by the auth provider: called on 401 so the app can redirect to login. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export function buildUrl(path, query) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiRequest(path, { method = 'GET', body, query, signal, skipAuthRedirect } = {}) {
  const init = { method, credentials: 'include', headers: { Accept: 'application/json' }, signal };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Could not reach the server.' });
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || !json || json.success !== true) {
    const error = new ApiError({
      status: response.status,
      code: json?.error?.code ?? (response.ok ? 'INTERNAL_ERROR' : `HTTP_${response.status}`),
      message: json?.error?.message ?? 'Unexpected server response.',
      details: json?.error?.details,
    });
    if (response.status === 401 && !skipAuthRedirect && unauthorizedHandler) unauthorizedHandler(error);
    throw error;
  }

  return { data: json.data, meta: json.meta };
}

export const api = {
  get: (path, opts) => apiRequest(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiRequest(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => apiRequest(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => apiRequest(path, { ...opts, method: 'DELETE' }),
};

/** i18n key for an error (falls back to a generic message). */
export function errorMessageKey(error) {
  const code = error?.code;
  const known = [
    'VALIDATION_ERROR',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'NETWORK_ERROR',
    'SERVICE_UNAVAILABLE',
  ];
  return known.includes(code) ? `errors.${code}` : 'errors.INTERNAL_ERROR';
}
