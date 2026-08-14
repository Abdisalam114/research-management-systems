import { useEffect } from "react";
import { findAppForm, onAppFormKeyDown, revealAndFocusForm } from "../utils/formFocus";

/** System-wide: new forms scroll into view + focus first field; Enter/Tab work. */
export function useAppFormBehavior(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    function revealFromNode(node) {
      const form = findAppForm(node);
      if (!form || !root.contains(form)) return;
      revealAndFocusForm(form);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) revealFromNode(node);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("keydown", onAppFormKeyDown);

    const main = root.querySelector(".appMain") || root;
    main.querySelectorAll("form, [data-app-form]").forEach((form) => revealAndFocusForm(form));

    return () => {
      observer.disconnect();
      root.removeEventListener("keydown", onAppFormKeyDown);
    };
  }, [containerRef]);
}
