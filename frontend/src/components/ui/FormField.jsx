import { cloneElement, isValidElement, useId } from "react";

export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className = "",
  labelClassName = "",
  children,
}) {
  const generatedId = useId();
  const fieldId = htmlFor || generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control =
    isValidElement(children)
      ? cloneElement(children, {
          id: children.props.id || fieldId,
          "aria-invalid": error ? true : children.props["aria-invalid"],
          "aria-describedby":
            [children.props["aria-describedby"], describedBy].filter(Boolean).join(" ") ||
            undefined,
        })
      : children;

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={fieldId}
          className={`mb-1 block text-sm font-medium text-text-primary ${labelClassName}`}
        >
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {control}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
