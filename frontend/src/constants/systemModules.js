/** System modules aligned with sidebar — used on dashboard overview grids. */
export const SYSTEM_MODULES = [
  { key: "users", to: "/pending-users", label: "Users", icon: "👥", roles: ["research_director"] },
  { key: "departments", to: "/departments", label: "Departments", icon: "🏛️", roles: ["research_director"] },
  { key: "policies", to: "/policies", label: "Research Policies", icon: "📜", roles: ["research_director"] },
  { key: "ethics", to: "/ethics", label: "Ethics (REC)", icon: "📋", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "proposals", to: "/proposals", label: "Proposals", icon: "📄", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "projects", to: "/projects", label: "Projects", icon: "📁", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "grants", to: "/grants", label: "Grants", icon: "💰", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
  { key: "budgets", to: "/budgets", label: "Finance & Budgets", icon: "🧾", roles: ["research_director", "finance_officer", "researcher"] },
  { key: "publications", to: "/publications", label: "Publications & Outputs", icon: "📚", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "repository", to: "/repository", label: "Repository", icon: "🗄️", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "groups", to: "/groups", label: "Groups", icon: "🤝", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "thesis", to: "/thesis", label: "Thesis", icon: "🎓", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "messages", to: "/messages", label: "Messages", icon: "💬", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "notifications", to: "/notifications", label: "Notifications", icon: "🔔", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher"] },
];

export function modulesForRole(role) {
  return SYSTEM_MODULES.filter((m) => m.roles.includes(role));
}

export function countForModule(key, metrics = {}, overview = {}) {
  const m = metrics.modules || overview.modules || metrics;
  const o = overview;
  switch (key) {
    case "users":
      return m.users ?? o.users ?? 0;
    case "departments":
      return m.departments ?? o.departments ?? 0;
    case "policies":
      return m.policies ?? o.policies ?? 0;
    case "ethics":
      return m.ethics ?? o.ethics ?? metrics.ethics?.total ?? 0;
    case "proposals":
      return m.proposals ?? o.proposals ?? metrics.proposals?.total ?? 0;
    case "projects":
      return m.projects ?? o.projects ?? metrics.projects?.total ?? 0;
    case "grants":
      return m.grants ?? o.grants ?? metrics.grants?.total ?? 0;
    case "budgets":
      return m.budgets ?? o.budgets ?? metrics.budgets?.total ?? 0;
    case "publications":
      return m.publications ?? o.publications ?? metrics.publications?.total ?? 0;
    case "repository":
      return m.repository ?? o.repository ?? metrics.repository?.total ?? 0;
    case "groups":
      return m.groups ?? o.groups ?? metrics.groups?.total ?? 0;
    case "thesis":
      return m.thesis ?? o.thesis ?? 0;
    case "messages":
      return m.messages ?? o.messages ?? "—";
    case "notifications":
      return m.notificationsUnread ?? metrics.notifications?.unread ?? 0;
    default:
      return 0;
  }
}
