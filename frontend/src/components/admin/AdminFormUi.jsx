import { cloneElement, isValidElement, useId } from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function AdminPanelCard({ className = "", children }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-border bg-surface-card shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminFilterBar({ className = "", children }) {
  return (
    <div
      className={cx(
        "bg-surface-main/80 border border-border rounded-xl p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminFormPanel({
  onSubmit,
  className = "",
  children,
  ...props
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cx(
        "grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface-main p-6 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </form>
  );
}

export function AdminStepForm({
  title,
  onSubmit,
  className = "",
  titleClassName = "",
  children,
}) {
  return (
    <form onSubmit={onSubmit} className={cx("space-y-4", className)}>
      {title ? (
        <h2 className={cx("text-xl font-medium", titleClassName)}>{title}</h2>
      ) : null}
      {children}
    </form>
  );
}

export function AdminField({
  label,
  htmlFor,
  children,
  className = "",
  labelClassName = "",
}) {
  const generatedId = useId();
  const fieldId = htmlFor || generatedId;
  const control =
    label && isValidElement(children)
      ? cloneElement(children, { id: children.props.id || fieldId })
      : children;

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={fieldId}
          className={cx(
            "mb-1 block text-xs font-medium text-text-secondary",
            labelClassName
          )}
        >
          {label}
        </label>
      ) : null}
      {control}
    </div>
  );
}

export function AdminActionsRow({ className = "", children }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

export function AdminRowActions({
  actions = [],
  className = "",
  itemClassName = "",
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {actions.map((action, index) => {
        const {
          key,
          label,
          onClick,
          disabled = false,
          title,
          type = "button",
          buttonClassName = "",
        } = action || {};

        if (!label) return null;

        return (
          <button
            key={key || `${label}-${index}`}
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cx(itemClassName, buttonClassName)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminPageHeader({
  children = null,
  title,
  subtitle = null,
  meta = null,
  actions = null,
  className = "",
  leftClassName = "",
  actionsClassName = "",
  titleClassName = "",
  subtitleClassName = "",
}) {
  if (children) {
    return (
      <div
        className={cx(
          "mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className={cx("min-w-0", leftClassName)}>
        {title ? (
          <h1
            className={cx(
              "text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary break-words",
              titleClassName
            )}
          >
            {title}
          </h1>
        ) : null}

        {subtitle ? (
          <p
            className={cx(
              "mt-1 text-sm text-text-secondary break-words",
              subtitleClassName
            )}
          >
            {subtitle}
          </p>
        ) : null}

        {meta}
      </div>

      {actions ? (
        <div className={cx("flex flex-wrap gap-2", actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
