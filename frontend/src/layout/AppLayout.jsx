import { useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { getPageTitle } from "../utils/navigation";
import { logScrollProbe, scrollAppContainerToTop } from "../utils/scrollContainer";
import "./layout.css";

function scrollAfterPaint() {
  scrollAppContainerToTop();
  requestAnimationFrame(() => {
    scrollAppContainerToTop();
  });
}

export function AppLayout() {
  const location = useLocation();
  const contentRef = useRef(null);
  const title = getPageTitle(location.pathname);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    document.body.classList.add("appShellActive");
    return () => document.body.classList.remove("appShellActive");
  }, []);

  useLayoutEffect(() => {
    scrollAfterPaint();
    requestAnimationFrame(() => {
      logScrollProbe(`${location.pathname}${location.search}`, "B");
    });
  }, [location.pathname, location.search]);

  return (
    <div className="appShell">
      <Sidebar onNavigate={scrollAfterPaint} />
      <div className="appContent" ref={contentRef}>
        <TopBar title={title} />
        <main className="appMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
