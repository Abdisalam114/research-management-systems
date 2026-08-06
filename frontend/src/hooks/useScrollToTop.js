import { useLayoutEffect } from "react";
import { scrollAppContainerToTop } from "../utils/scrollContainer";

/** Run scroll immediately and again after paint so async content does not leave the user mid-page. */
export function scrollToTopNow() {
  scrollAppContainerToTop();
  requestAnimationFrame(() => {
    scrollAppContainerToTop();
    requestAnimationFrame(scrollAppContainerToTop);
  });
}

/** Scroll app content to top when route params or local form state changes. */
export function useScrollToTop(deps = []) {
  useLayoutEffect(() => {
    scrollToTopNow();
    const t = setTimeout(scrollToTopNow, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
