import { useCallback, useEffect, useMemo, useState } from "react";
import { setNotifyHandler } from "../utils/notify";

const DEFAULT_DURATION_MS = 4200;

function toneClasses(type) {
  if (type === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (type === "error") return "border-rose-200 bg-rose-50 text-rose-900";
  if (type === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-white text-slate-900";
}

export default function ToastProvider({ children }) {
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
      const type = String(options.type || "info");
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
      toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-md backdrop-blur-sm ${toneClasses(t.type)}`}
        >
          <div className="flex items-start gap-3">
            <p className="text-sm leading-5">{t.text}</p>
            <button
              type="button"
              className="ml-auto text-xs opacity-70 hover:opacity-100"
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
            >
              Fermer
            </button>
          </div>
        </div>
      )),
    [removeToast, toasts]
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

