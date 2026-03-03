let notifyHandler = null;

function normalizeMessage(message) {
  if (typeof message === "string") return message;
  if (message === null || message === undefined) return "";
  if (message instanceof Error) return message.message || "Erreur inconnue";
  return String(message);
}

export function setNotifyHandler(handler) {
  notifyHandler = typeof handler === "function" ? handler : null;
}

export function notify(message, options = {}) {
  const text = normalizeMessage(message);
  if (!text) return;

  if (notifyHandler) {
    notifyHandler(text, options);
    return;
  }

  // Fallback safe si le provider n'est pas encore monte.
  // Evite les boites natives bloquantes.
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn("Notify fallback warning:", text);
  }
}

notify.success = (message, options = {}) =>
  notify(message, { ...options, type: "success" });
notify.error = (message, options = {}) =>
  notify(message, { ...options, type: "error" });
notify.info = (message, options = {}) =>
  notify(message, { ...options, type: "info" });
notify.warning = (message, options = {}) =>
  notify(message, { ...options, type: "warning" });
