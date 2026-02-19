let confirmHandler = null;

export function setConfirmHandler(handler) {
  confirmHandler = typeof handler === "function" ? handler : null;
}

export function confirmAction(options = {}) {
  if (!confirmHandler) {
    return Promise.resolve(false);
  }
  return confirmHandler(options);
}

