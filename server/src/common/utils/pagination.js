import { z } from 'zod';
import { PAGINATION } from '../../config/constants.js';

/** Zod fields to spread into any list query schema. */
export const paginationFields = {
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
};

/** Normalise page/limit (clamped) and compute skip. */
export function getPagination({ page, limit } = {}) {
  const p = Math.max(1, Number.parseInt(page, 10) || PAGINATION.DEFAULT_PAGE);
  const rawLimit = Number.parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT;
  const l = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, rawLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function buildMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
}
