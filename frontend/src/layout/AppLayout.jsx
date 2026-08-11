import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { getPageTitle } from "../utils/navigation";
import { logScrollProbe } from "../utils/scrollContainer";
import { scrollToTopNow, useScrollToTop } from "../hooks/useScrollToTop";
import "./layout.css";

export function AppLayout() {
  const location = useLocation();
  const contentRef = useRef(null);
  const title = getPageTitle(location.pathname);
  const routeKey = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    document.body.classList.add("appShellActive");
    return () => document.body.classList.remove("appShellActive");
  }, []);

  useScrollToTop([location.pathname, location.search, location.hash, location.key]);

  useEffect(() => {
    requestAnimationFrame(() => {
      logScrollProbe(`${location.pathname}${location.search}`, "B");
    });
  }, [location.pathname, location.search, location.key]);

  return (
    <div className="appShell">
      <Sidebar onNavigate={scrollToTopNow} />
      <div className="appContent" ref={contentRef}>
        <TopBar title={title} />
        <main className="appMain">
          <ErrorBoundary resetKey={routeKey}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
