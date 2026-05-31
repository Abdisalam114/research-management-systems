import { useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { getPageTitle } from "../utils/navigation";
import "./layout.css";

function scrollAppToTop(contentEl) {
  const targets = [
    contentEl,
    document.querySelector(".appContent"),
    document.querySelector(".appMain"),
    document.documentElement,
    document.body,
  ].filter(Boolean);

  for (const el of targets) {
    el.scrollTop = 0;
  }
  window.scrollTo(0, 0);

  // #region agent log
  fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
    body: JSON.stringify({
      sessionId: "6113cc",
      location: "AppLayout.jsx:scrollAppToTop",
      message: "scroll to top",
      data: {
        contentScrollTop: contentEl?.scrollTop ?? null,
        windowScrollY: window.scrollY,
        docScrollTop: document.documentElement.scrollTop,
      },
      timestamp: Date.now(),
      hypothesisId: "H-scroll",
      runId: "scroll-fix",
    }),
  }).catch(() => {});
  // #endregion
}

function scrollAfterPaint(contentEl) {
  scrollAppToTop(contentEl);
  requestAnimationFrame(() => {
    scrollAppToTop(contentEl);
    requestAnimationFrame(() => scrollAppToTop(contentEl));
  });
}

export function AppLayout() {
  const location = useLocation();
  const contentRef = useRef(null);
  const title = getPageTitle(location.pathname);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    scrollAfterPaint(contentRef.current);
  }, [location.pathname, location.search]);

  return (
    <div className="appShell">
      <Sidebar onNavigate={() => scrollAfterPaint(contentRef.current)} />
      <div className="appContent" ref={contentRef}>
        <TopBar title={title} />
        <main className="appMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
