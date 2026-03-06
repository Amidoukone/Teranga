const FEEDBACK_TYPES = new Set(["success", "error", "warning", "info"]);

export function normalizeFeedbackType(type = "info") {
  const normalized = String(type || "").trim().toLowerCase();
  return FEEDBACK_TYPES.has(normalized) ? normalized : "info";
}

export function getFeedbackIcon(type = "info") {
  const normalized = normalizeFeedbackType(type);
  if (normalized === "success") return "ok";
  if (normalized === "error") return "!";
  if (normalized === "warning") return "!";
  return "";
}
