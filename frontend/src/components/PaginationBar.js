import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const ELLIPSIS = "…";

function buildPageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items = new Set([1, total, current]);
  if (current - 1 > 1) items.add(current - 1);
  if (current + 1 < total) items.add(current + 1);

  const sorted = Array.from(items).sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i];
    const prev = sorted[i - 1];
    if (prev && n - prev > 1) result.push(ELLIPSIS);
    result.push(n);
  }

  return result;
}

export default function PaginationBar({
  page = 1,
  pageSize = 10,
  totalItems = 0,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  showPageSize = true,
  className = "",
}) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  const items = useMemo(
    () => buildPageItems(safePage, totalPages),
    [safePage, totalPages]
  );

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-border/70 bg-white/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${className}`}
    >
      <div className="text-xs text-text-secondary sm:text-sm">
        {totalItems > 0 ? (
          <>{t("pagination.range", { start, end, total: totalItems })}</>
        ) : (
          <>{t("pagination.empty")}</>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={safePage <= 1}
          aria-label={t("pagination.prev")}
          className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition ${
            safePage <= 1
              ? "cursor-not-allowed border-border/80 bg-slate-100 text-slate-400"
              : "border-border/80 bg-white text-text-primary hover:bg-surface-main/70"
          }`}
        >
          {t("pagination.prev")}
        </button>

        <div className="flex items-center gap-1">
          {items.map((it, idx) =>
            it === ELLIPSIS ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                {ELLIPSIS}
              </span>
            ) : (
              <button
                key={it}
                type="button"
                onClick={() => onPageChange?.(it)}
                aria-label={`Page ${it}`}
                className={`h-8 min-w-[2rem] px-2 rounded-full border text-xs sm:text-sm font-medium transition ${
                  it === safePage
                    ? "border-primary bg-primary text-white"
                    : "border-border/80 bg-white text-text-secondary hover:bg-surface-main/70"
                }`}
              >
                {it}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label={t("pagination.next")}
          className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition ${
            safePage >= totalPages
              ? "cursor-not-allowed border-border/80 bg-slate-100 text-slate-400"
              : "border-border/80 bg-white text-text-primary hover:bg-surface-main/70"
          }`}
        >
          {t("pagination.next")}
        </button>

        {showPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="ml-1 rounded-full border border-border/80 bg-white px-3 py-1.5 text-xs text-text-secondary sm:text-sm"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {t("pagination.perPage", { count: n })}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
