/** Scroll helpers for the app shell — main content scrolls in `.appContent`, not `window`. */

export function getAppScrollContainer() {
  return document.querySelector(".appContent");
}

export function scrollAppContainerToTop() {
  const container = getAppScrollContainer();
  if (container) container.scrollTop = 0;
  window.scrollTo(0, 0);
}

export function scrollElementIntoAppView(
  element,
  { behavior = "smooth", block = "start", offset = 72 } = {}
) {
  if (!element) return;
  const container = getAppScrollContainer();
  if (!container) {
    element.scrollIntoView({ behavior, block });
    return;
  }

  const elRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  let top = container.scrollTop + (elRect.top - containerRect.top) - offset;

  if (block === "center") {
    top =
      container.scrollTop +
      (elRect.top - containerRect.top) -
      container.clientHeight / 2 +
      element.offsetHeight / 2;
  }

  container.scrollTo({ top: Math.max(0, top), behavior });
}

export function probeScrollMetrics() {
  const nav = document.querySelector(".nav");
  const content = getAppScrollContainer();
  const sidebar = document.querySelector(".appSidebar");
  const navStyle = nav ? getComputedStyle(nav) : null;
  const contentStyle = content ? getComputedStyle(content) : null;

  return {
    viewportH: window.innerHeight,
    windowScrollY: window.scrollY,
    docScrollTop: document.documentElement.scrollTop,
    nav: nav
      ? {
          scrollHeight: nav.scrollHeight,
          clientHeight: nav.clientHeight,
          scrollTop: nav.scrollTop,
          canScroll: nav.scrollHeight > nav.clientHeight + 1,
          overflowY: navStyle?.overflowY,
        }
      : null,
    content: content
      ? {
          scrollHeight: content.scrollHeight,
          clientHeight: content.clientHeight,
          scrollTop: content.scrollTop,
          canScroll: content.scrollHeight > content.clientHeight + 1,
          overflowY: contentStyle?.overflowY,
        }
      : null,
    sidebar: sidebar
      ? { scrollHeight: sidebar.scrollHeight, clientHeight: sidebar.clientHeight }
      : null,
  };
}

export function logScrollProbe(location, hypothesisId, runId = "pre-fix") {
  // #region agent log
  fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "15a9cf" },
    body: JSON.stringify({
      sessionId: "15a9cf",
      location: "scrollContainer.js:logScrollProbe",
      message: "scroll metrics",
      data: { path: location, ...probeScrollMetrics() },
      timestamp: Date.now(),
      hypothesisId,
      runId,
    }),
  }).catch(() => {});
  // #endregion
}
