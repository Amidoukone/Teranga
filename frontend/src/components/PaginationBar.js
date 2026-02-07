import { useMemo } from "react";

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
    if (prev && n - prev > 1) result.push("…");
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
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}
    >
      <div className="text-xs sm:text-sm text-slate-500">
        {totalItems > 0 ? (
          <>
            Affichage {start}–{end} sur {totalItems}
          </>
        ) : (
          <>Aucun résultat</>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={safePage <= 1}
          className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition ${
            safePage <= 1
              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
          }`}
        >
          Précédent
        </button>

        <div className="flex items-center gap-1">
          {items.map((it, idx) =>
            it === "…" ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={it}
                type="button"
                onClick={() => onPageChange?.(it)}
                className={`h-8 min-w-[2rem] px-2 rounded-full border text-xs sm:text-sm font-medium transition ${
                  it === safePage
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
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
          className={`px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium transition ${
            safePage >= totalPages
              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
          }`}
        >
          Suivant
        </button>

        {showPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="ml-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
