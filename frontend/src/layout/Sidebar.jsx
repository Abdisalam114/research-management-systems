import { useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SYSTEM_ROLES } from "../constants/systemRoles";
import logo from "../assets/jamhuriya-logo.png";

const MENU = [
  { to: "/dashboard", label: "Dashboard & Analytics", icon: "🏠", roles: [...SYSTEM_ROLES] },
  { to: "/projects", label: "Projects", icon: "📁", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/research-workflow", label: "Research Workflow Status", icon: "🔄", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/publications", label: "Publications & Outputs", icon: "📚", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/ethics", label: "Ethics", icon: "📋", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/proposals", label: "Proposals", icon: "📄", roles: ["research_director", "faculty_coordinator", "researcher", "leadership"] },
  { to: "/finance/reviews", label: "Proposal finance review", icon: "🧮", roles: ["finance_officer"] },
  { to: "/finance/grant-approvals", label: "Grant funding approval", icon: "💵", roles: ["finance_officer"] },
  { to: "/finance/closures", label: "Project closure (Finance)", icon: "📁", roles: ["finance_officer"] },
  { to: "/review-assignments", label: "Peer Reviews", icon: "✍️", roles: ["research_director", "leadership"] },
  { to: "/thesis", label: "Thesis", icon: "🎓", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/funding-calls", label: "Funding Calls", icon: "📢", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher", "leadership"] },
  { to: "/policies", label: "Policies (Siyaasada)", icon: "📜", roles: [...SYSTEM_ROLES] },
  { to: "/grants", label: "Grants", icon: "💰", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher", "leadership"] },
  { to: "/budgets", label: "Finance & Budgets", icon: "🧾", roles: ["research_director", "finance_officer", "researcher"] },
  { to: "/finance-reports", label: "Finance Reports", icon: "📊", roles: ["research_director", "finance_officer"] },
  { to: "/kpi-dashboard", label: "KPI Dashboard", icon: "📈", roles: ["research_director", "faculty_coordinator", "leadership"] },
  { to: "/search", label: "Search", icon: "🔍", roles: ["research_director", "faculty_coordinator", "researcher", "leadership"] },
  { to: "/donor-reports", label: "Donor Reports", icon: "🌍", roles: ["research_director", "finance_officer"] },
  { to: "/audit-trail", label: "Audit Trail", icon: "📝", roles: ["research_director", "faculty_coordinator"] },
  { to: "/repository", label: "Repository", icon: "🗄️", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/collaboration", label: "Collaboration", icon: "🤝", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/groups", label: "Groups", icon: "🧑‍🤝‍🧑", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/messages", label: "Messages", icon: "💬", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/notifications", label: "Notifications", icon: "🔔", roles: [...SYSTEM_ROLES] },
  { to: "/pending-users", label: "Users", icon: "👥", roles: ["research_director"] },
  { to: "/departments", label: "Departments", icon: "🏛️", roles: ["research_director"] },
  { to: "/profile", label: "Profile", icon: "⚙️", roles: [...SYSTEM_ROLES] },
];

export function Sidebar({ onNavigate }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

  const items = MENU.filter((i) => !i.roles || i.roles.includes(user?.role));

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector(".navItem.active");
    active?.scrollIntoView({ block: "nearest", behavior: "instant" });
}, [location.pathname]);

  function handleNavClick() {
    onNavigate?.();
  }

  return (
    <aside className="appSidebar">
      <div className="sidebarBrand" title="Jamhuriya RMS">
        <img src={logo} alt="JUST" className="sidebarLogo" />
        <span className="sidebarBrandText">JUST RMS</span>
      </div>

      <nav ref={navRef} className="nav" aria-label="Main navigation">
        {items.map((item) => (
          <NavLink
            key={`${item.to}:${item.label}`}
            to={item.to}
            title={item.label}
            className={({ isActive }) => (isActive ? "navItem active" : "navItem")}
            onClick={handleNavClick}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="navLabel">{item.label}</span>
          </NavLink>
        ))}
        <button
          className="navItem navItemLogout"
          type="button"
          title="Logout"
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
        >
          <span aria-hidden="true">🚪</span>
          <span className="navLabel">Logout</span>
        </button>
      </nav>
    </aside>
  );
}
