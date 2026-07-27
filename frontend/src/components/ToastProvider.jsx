import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { setNotifyHandler } from "../utils/notify";
import { getFeedbackIcon, normalizeFeedbackType } from "../utils/feedback";

const DEFAULT_DURATION_MS = 4200;

function toneClasses(type) {
  if (type === "success") return "app-alert-success";
  if (type === "error") return "app-alert-error";
  if (type === "warning") return "app-alert-warning";
  return "border-border bg-surface-card text-text-primary";
}

export default function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message, options = {}) => {
      const text = String(message || "").trim();
      if (!text) return;

      const id =
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
      const type = normalizeFeedbackType(options.type || "info");
      const durationMs = Number(options.durationMs || DEFAULT_DURATION_MS);

      setToasts((prev) => [...prev, { id, text, type }]);
      const ttl = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : DEFAULT_DURATION_MS;
      window.setTimeout(() => removeToast(id), ttl);
    },
    [removeToast]
  );

  useEffect(() => {
    setNotifyHandler(pushToast);
    return () => setNotifyHandler(null);
  }, [pushToast]);

  // Compat backwards: transforme les alert() existants en toast non bloquant.
  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (message) => pushToast(message, { type: "info" });
    return () => {
      window.alert = nativeAlert;
    };
  }, [pushToast]);

  const rendered = useMemo(
    () =>
      toasts.map((toast) => {
        const icon = getFeedbackIcon(toast.type);
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-md backdrop-blur-sm ${toneClasses(toast.type)}`}
          >
            <div className="flex items-start gap-3">
              {icon ? (
                <span
                  aria-hidden="true"
                  className="mt-[1px] inline-flex min-w-[1.5rem] justify-center rounded-full border border-current/20 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase"
                >
                  {icon}
                </span>
              ) : null}
              <p className="text-sm leading-5">{toast.text}</p>
              <button
                type="button"
                className="ml-auto text-xs opacity-70 hover:opacity-100"
                onClick={() => removeToast(toast.id)}
                aria-label={t("common.toast.close")}
              >
                {t("common.toast.close")}
              </button>
            </div>
          </div>
        );
      }),
    [removeToast, t, toasts]
  );

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[1200] flex w-[min(92vw,420px)] flex-col gap-2">
        {rendered}
      </div>
    </>
  );
}



