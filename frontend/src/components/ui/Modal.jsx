import { useRef } from "react";
import { createPortal } from "react-dom";
import useFocusTrap from "../../hooks/useFocusTrap";

export default function Modal({
  open,
  onClose,
  title,
  titleId,
  labelledBy,
  closeOnOverlayClick = true,
  initialFocusRef,
  className = "",
  children,
}) {
  const containerRef = useRef(null);
  const generatedTitleId = useRef(
    titleId || `modal-title-${Math.random().toString(36).slice(2)}`
  ).current;

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: onClose,
    initialFocusRef,
  });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/45 p-4"
      onMouseDown={(event) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? generatedTitleId : undefined)}
        className={`w-full max-w-md rounded-2xl border border-border bg-surface-card p-5 shadow-xl ${className}`}
      >
        {title ? (
          <h3 id={generatedTitleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h3>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  );
}
