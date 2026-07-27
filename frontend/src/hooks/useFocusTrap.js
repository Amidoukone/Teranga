import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Piège le focus clavier à l'intérieur de containerRef tant que `active` est vrai :
 * Tab/Shift+Tab bouclent parmi les éléments focusables, Escape déclenche onEscape,
 * et le focus initial/retour au déclencheur sont gérés par l'appelant via initialFocusRef.
 */
export default function useFocusTrap({ active, containerRef, onEscape, initialFocusRef }) {
  const triggerElementRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    triggerElementRef.current = document.activeElement;

    const container = containerRef.current;
    const focusables = () =>
      container ? Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) : [];

    const toFocus = initialFocusRef?.current || focusables()[0];
    if (toFocus) toFocus.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusables();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (triggerElementRef.current instanceof HTMLElement) {
        triggerElementRef.current.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
