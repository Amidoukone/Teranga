import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
} from "lucide-react";
import { normalizeFeedbackType } from "../utils/feedback";

const TONE_CLASSES = {
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  success:
    "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  error:
    "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

export default function AuthFeedbackBanner({
  type = "info",
  message,
  className = "",
}) {
  const text = String(message || "").trim();
  if (!text) return null;

  const normalizedType = normalizeFeedbackType(type);
  const Icon = ICONS[normalizedType] || Info;
  const toneClasses = TONE_CLASSES[normalizedType] || TONE_CLASSES.info;
  const role = normalizedType === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`rounded-xl border px-3 py-3 text-sm shadow-sm ${toneClasses} ${className}`.trim()}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="leading-5">{text}</span>
      </div>
    </div>
  );
}
