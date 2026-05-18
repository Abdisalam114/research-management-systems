import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import "./layout.css";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/analytics": "Analytics & Reporting",
  "/pending-users": "Pending Users",
  "/proposals": "Proposals",
  "/projects": "Projects",
  "/grants": "Grants & Funding",
  "/budgets": "Finance & Budget",
  "/publications": "Publications",
  "/repository": "Repository",
  "/groups": "Collaboration Groups",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/profile": "Profile",
};

export function AppLayout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || "Dashboard";

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

