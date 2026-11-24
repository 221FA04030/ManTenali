/** Standard success envelope: { success: true, data, meta? }. */
export function sendSuccess(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data: data ?? null };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export const ok = (res, data, meta) => sendSuccess(res, data, { meta });
export const created = (res, data) => sendSuccess(res, data, { status: 201 });

/** Standard error envelope: { success: false, error: { code, message, details? } }. */
export function errorBody(code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, error };
}
