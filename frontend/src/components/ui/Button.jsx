import { forwardRef } from "react";
import Spinner from "./Spinner";

// Chaque variante mappe vers des classes déjà définies dans src/index.css
// (@layer components) — voir docs/plan de modernisation. Écrites en chaînes
// littérales complètes pour ne pas être purgées par le JIT Tailwind.
const VARIANT_CLASSES = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  neutral: "app-btn-neutral",
  soft: "app-btn-soft",
  warning: "app-btn-warning",
  danger: "app-btn-danger",
  success: "app-btn-success",
  "tonal-success": "app-btn-tonal-success",
  "tonal-danger": "app-btn-tonal-danger",
};

// Variante "primary" compacte (utilisée par la majorité des formulaires/toolbars).
const COMPACT_PRIMARY_CLASS = "app-btn-primary";

function resolveVariantClass(variant, size) {
  if (variant === "primary" && size !== "lg") return COMPACT_PRIMARY_CLASS;
  return VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
}

const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    type = "button",
    className = "",
    children,
    ...props
  },
  ref
) {
  const variantClass = resolveVariantClass(variant, size);
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      className={`inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
});

export default Button;
