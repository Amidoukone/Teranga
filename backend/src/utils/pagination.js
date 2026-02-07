'use strict';

/**
 * Pagination robuste et retro-compatible.
 * - Supporte page/limit et offset/limit
 * - Si page est fourni, il prime sur offset
 * - Retourne toujours { limit, offset, page }
 */
function getPagination(req, defaultLimit = 50, maxLimit = 200) {
  const q = req?.query || {};

  const rawLimit = parseInt(q.limit ?? defaultLimit, 10);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : defaultLimit, 1),
    maxLimit
  );

  const hasPage = q.page !== undefined && q.page !== null && q.page !== '';
  const rawPage = parseInt(q.page ?? 1, 10);
  const page =
    hasPage && Number.isFinite(rawPage) && rawPage > 0 ? rawPage : null;

  const rawOffset = parseInt(q.offset ?? 0, 10);
  const offset = page
    ? (page - 1) * limit
    : Number.isFinite(rawOffset) && rawOffset >= 0
      ? rawOffset
      : 0;

  return { limit, offset, page: page || Math.floor(offset / limit) + 1 };
}

module.exports = {
  getPagination,
};
