import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setConfirmHandler } from "../utils/confirm";

function normalizeOptions(options = {}, defaults = {}) {
  return {
    ...defaults,
    ...options,
  };
}

export default function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  const showNext = useCallback(() => {
    setQueue((prev) => {
      if (!prev.length) return prev;
      const [first, ...rest] = prev;
      setActive(first);
      return rest;
    });
  }, []);

  useEffect(() => {
    if (!active && queue.length > 0) {
      showNext();
    }
  }, [active, queue.length, showNext]);

  const resolveActive = useCallback((value) => {
    if (!active) return;
    try {
      active.resolve(Boolean(value));
    } finally {
      setActive(null);
    }
  }, [active]);

  const openConfirm = useCallback((options = {}) => {
    const normalized = normalizeOptions(options, {
      title: t("common.confirmModal.title"),
      message: t("common.confirmModal.message"),
      confirmText: t("common.confirmModal.confirm"),
      cancelText: t("common.confirmModal.cancel"),
      danger: false,
    });
    return new Promise((resolve) => {
      const req = { ...normalized, resolve };
      setQueue((prev) => [...prev, req]);
    });
  }, [t]);

  useEffect(() => {
    setConfirmHandler(openConfirm);
    return () => setConfirmHandler(null);
  }, [openConfirm]);

  return (
    <>
      {children}
      {active && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{active.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{active.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                onClick={() => resolveActive(false)}
              >
                {active.cancelText}
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm text-white ${
                  active.danger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#0a84ff] hover:bg-[#0066cc]"
                }`}
                onClick={() => resolveActive(true)}
              >
                {active.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
