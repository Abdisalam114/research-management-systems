import { useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/jamhuriya-logo.png";

const MENU = [
  { to: "/dashboard", label: "Dashboard & Analytics", icon: "🏠", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/research-workflow", label: "Research Workflow Status", icon: "🔄", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/ethics", label: "Ethics", icon: "📋", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/proposals", label: "Proposals", icon: "📄", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/projects", label: "Projects", icon: "📁", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/publications", label: "Publications & Outputs", icon: "📚", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/thesis", label: "Thesis", icon: "🎓", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/grants", label: "Grants", icon: "💰", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/budgets", label: "Finance & Budgets", icon: "🧾", roles: ["research_director", "finance_officer", "researcher"] },
  { to: "/repository", label: "Repository", icon: "🗄️", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/collaboration", label: "Collaboration", icon: "🤝", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/groups", label: "Groups", icon: "🧑‍🤝‍🧑", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/messages", label: "Messages", icon: "💬", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/notifications", label: "Notifications", icon: "🔔", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/pending-users", label: "Users", icon: "👥", roles: ["research_director"] },
  { to: "/departments", label: "Departments", icon: "🏛️", roles: ["research_director"] },
  { to: "/profile", label: "Profile", icon: "⚙️", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
];

export function Sidebar({ onNavigate }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const navRef = useRef(null);

  const items = MENU.filter((i) => !i.roles || i.roles.includes(user?.role));

  function handleNavClick() {
    navRef.current?.scrollTo(0, 0);
    onNavigate?.();
  }

  return (
    <aside className="appSidebar">
      <div className="sidebarBrand" title="Jamhuriya RMS">
        <img src={logo} alt="JUST" className="sidebarLogo" />
        <span className="sidebarBrandText">JUST RMS</span>
      </div>

      <nav ref={navRef} className="nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
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
