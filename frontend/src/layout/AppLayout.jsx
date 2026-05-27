import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { getPageTitle } from "../utils/navigation";
import "./layout.css";

export function AppLayout() {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <div className="appShell">
      <Sidebar />
      <div className="appContent">
        <TopBar title={title} />
        <main className="appMain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

