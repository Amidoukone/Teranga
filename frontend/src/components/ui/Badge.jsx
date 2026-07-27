const TONE_CLASSES = {
  neutral: "app-badge-neutral",
  info: "app-badge-info",
  success: "app-badge-success",
  warning: "app-badge-warning",
  error: "app-badge-error",
  readonly: "app-badge-readonly",
};

export default function Badge({ tone = "neutral", className = "", children, ...props }) {
  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.neutral;
  return (
    <span className={`app-badge ${toneClass} ${className}`} {...props}>
      {children}
    </span>
  );
}
