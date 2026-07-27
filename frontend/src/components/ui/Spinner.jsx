import { Loader2 } from "lucide-react";

const SIZE_CLASSES = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export default function Spinner({ size = "md", label, className = "" }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center ${className}`}>
      <Loader2 aria-hidden="true" className={`animate-spin ${sizeClass}`} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
