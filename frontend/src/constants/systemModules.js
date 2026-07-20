/** Dashboard overview module tiles — active institutional roles. */
import { SYSTEM_ROLES } from "./systemRoles";

export const SYSTEM_MODULES = [
  { key: "ethics", to: "/ethics", label: "Ethics (REC)", icon: "📋", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "finance_grant_approvals", to: "/finance/grant-approvals", label: "Grant funding approval", icon: "💵", roles: ["finance_officer"] },
  { key: "finance_closures", to: "/finance/closures", label: "Project closure", icon: "📁", roles: ["finance_officer"] },
  { key: "proposals_staff", to: "/proposals", label: "Proposals", icon: "📄", roles: ["research_director", "faculty_coordinator", "researcher", "leadership"] },
  { key: "reviews", to: "/review-assignments", label: "Peer Reviews", icon: "✍️", roles: ["research_director", "faculty_coordinator", "researcher", "leadership"] },
  { key: "projects_staff", to: "/projects", label: "Projects", icon: "📁", roles: ["research_director", "faculty_coordinator", "researcher", "hr_officer"] },
  { key: "funding_calls", to: "/funding-calls", label: "Funding Calls", icon: "📢", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher", "leadership", "procurement_officer", "donor_agency"] },
  { key: "policies", to: "/policies", label: "Policies", icon: "📜", roles: [...SYSTEM_ROLES] },
  { key: "grants", to: "/grants", label: "Grants", icon: "💰", roles: ["research_director", "faculty_coordinator", "finance_officer", "researcher", "leadership", "procurement_officer", "donor_agency"] },
  { key: "budgets", to: "/budgets", label: "Finance & Budgets", icon: "🧾", roles: ["research_director", "finance_officer", "researcher", "procurement_officer"] },
  { key: "finance_reports", to: "/finance-reports", label: "Finance Reports", icon: "📊", roles: ["research_director", "finance_officer"] },
  { key: "publications", to: "/publications", label: "Publications & Outputs", icon: "📚", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "workflow", to: "/research-workflow", label: "Research Workflow Status", icon: "🔄", roles: ["research_director", "faculty_coordinator", "researcher"] },
  { key: "groups", to: "/groups", label: "Groups", icon: "🧑‍🤝‍🧑", roles: ["research_director", "faculty_coordinator", "researcher", "hr_officer"] },
  { key: "thesis", to: "/thesis", label: "Thesis", icon: "🎓", roles: ["research_director", "faculty_coordinator", "researcher", "hr_officer"] },
  { key: "kpi", to: "/kpi-dashboard", label: "KPI Dashboard", icon: "📈", roles: ["research_director", "faculty_coordinator", "leadership"] },
  { key: "donor", to: "/donor-reports", label: "Donor Reports", icon: "🌍", roles: ["research_director", "finance_officer", "donor_agency"] },
];

export function modulesForRole(role) {
  return SYSTEM_MODULES.filter((m) => m.roles.includes(role));
}

export function countForModule(key, metrics = {}, overview = {}) {
  const m = metrics.modules || overview.modules || metrics;
  const o = overview;
  switch (key) {
    case "ethics":
      return m.ethics ?? o.ethics ?? metrics.ethics?.total ?? 0;
    case "proposals":
    case "proposals_staff":
    case "finance_grant_approvals":
      return m.grantsPendingFinance ?? o.grantsPendingFinance ?? metrics.grants?.pendingFinance ?? m.grants ?? 0;
    case "reviews":
      return m.reviews ?? o.reviews ?? metrics.reviewAssignments ?? 0;
    case "projects":
    case "projects_staff":
    case "finance_closures":
      return m.projects ?? o.projects ?? metrics.projects?.total ?? 0;
    case "funding_calls":
      return m.fundingCalls ?? o.fundingCalls ?? metrics.fundingCalls?.total ?? 0;
    case "policies":
      return m.policies ?? o.policies ?? "—";
    case "grants":
      return m.grants ?? o.grants ?? metrics.grants?.total ?? 0;
    case "budgets":
      return m.budgets ?? o.budgets ?? metrics.budgets?.total ?? 0;
    case "finance_reports":
      return m.financeReports ?? o.financeReports ?? "—";
    case "publications":
      return m.publications ?? o.publications ?? metrics.publications?.total ?? 0;
    case "workflow":
      return (
        m.workflow ??
        o.workflow ??
        (Number(metrics.publications?.submitted ?? 0) + Number(metrics.publications?.validated ?? 0))
      );
    case "groups":
      return m.groups ?? o.groups ?? metrics.groups?.total ?? 0;
    case "thesis":
      return m.thesis ?? o.thesis ?? metrics.thesis?.total ?? 0;
    case "kpi":
      return m.kpi ?? o.kpi ?? "—";
    case "donor":
      return m.donor ?? o.donor ?? "—";
    default:
      return "—";
  }
}
