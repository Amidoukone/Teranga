const VARIANT_CLASSES = {
  default: "surface-card",
  muted: "surface-card-muted",
  glass: "glass-panel",
};

export default function Card({ variant = "default", className = "", children, ...props }) {
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.default;
  return (
    <div className={`${variantClass} ${className}`} {...props}>
      {children}
    </div>
  );
}
