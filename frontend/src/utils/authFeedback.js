import { normalizeFeedbackType } from "./feedback";

function normalizeMessage(message) {
  return String(message || "").trim();
}

export function buildAuthFeedbackState(message, type = "info") {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) return {};

  return {
    feedbackMsg: normalizedMessage,
    feedbackType: normalizeFeedbackType(type),
  };
}

export function readAuthFeedbackState(state) {
  if (!state || typeof state !== "object") return null;

  const feedbackMessage = normalizeMessage(state.feedbackMsg);
  if (feedbackMessage) {
    return {
      type: normalizeFeedbackType(state.feedbackType || "info"),
      message: feedbackMessage,
    };
  }

  const successMessage = normalizeMessage(state.successMsg);
  if (successMessage) {
    return { type: "success", message: successMessage };
  }

  const infoMessage = normalizeMessage(state.infoMsg);
  if (infoMessage) {
    return { type: "info", message: infoMessage };
  }

  const errorMessage = normalizeMessage(state.errorMsg);
  if (errorMessage) {
    return { type: "error", message: errorMessage };
  }

  return null;
}
