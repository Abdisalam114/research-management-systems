import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import logo from "../assets/jamhuriya-logo.png";

const MENU = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/analytics", label: "Analytics", icon: "📊", roles: ["research_director"] },
  { to: "/pending-users", label: "Director", icon: "🎓", roles: ["research_director"] },
  { to: "/proposals", label: "Proposals", icon: "📄", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/projects", label: "Projects", icon: "📁", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/grants", label: "Grants", icon: "💰", roles: ["research_director", "finance_officer", "faculty_coordinator", "researcher"] },
  { to: "/budgets", label: "Budgets", icon: "🧾", roles: ["research_director", "finance_officer", "researcher"] },
  { to: "/publications", label: "Publications", icon: "📚", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { to: "/repository", label: "Repository", icon: "🗄️", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/groups", label: "Groups", icon: "🤝", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/messages", label: "Messages", icon: "💬", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/notifications", label: "Notifications", icon: "🔔", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { to: "/profile", label: "Profile", icon: "⚙️", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const items = MENU.filter((i) => !i.roles || i.roles.includes(user?.role));

  return (
    <aside className="appSidebar">
      <img src={logo} alt="JUST" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 8 }} title="Jamhuriya RMS" />

      <nav className="nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) => (isActive ? "navItem active" : "navItem")}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="navLabel">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebarFooter">
        <button
          className="navItem"
          type="button"
          title="Logout"
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
        >
          🚪
        </button>
      </div>
    </aside>
  );
}
