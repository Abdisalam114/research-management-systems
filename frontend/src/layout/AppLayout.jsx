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
