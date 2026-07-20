/** Policy module keys → labels & related RMS routes (mirrors backend catalog). */
export const POLICY_MODULE_META = {
  system_overview: { label: "System overview", route: "/dashboard" },
  roles_access: { label: "Roles & access", route: "/dashboard" },
  program_tiers: { label: "Program tiers", route: "/program-tier" },
  audit_notifications: { label: "Audit & notifications", route: "/audit-trail" },
  proposals_voluntary: { label: "Voluntary proposals", route: "/proposals" },
  proposals_grant_call: { label: "Grant-call proposals", route: "/funding-calls" },
  proposal_review: { label: "Proposal review", route: "/proposals" },
  projects: { label: "Projects", route: "/projects" },
  research_workflow: { label: "Research workflow", route: "/research-workflow" },
  publications: { label: "Publications", route: "/publications" },
  repository: { label: "Repository", route: "/repository" },
  collaboration_groups: { label: "Collaboration & groups", route: "/groups" },
  thesis_groups: { label: "Thesis groups", route: "/thesis" },
  peer_review: { label: "Peer review", route: "/review-assignments" },
  funding_calls: { label: "Funding calls", route: "/funding-calls" },
  grants_finance: { label: "Grants & finance approval", route: "/finance/grant-approvals" },
  budgets_procurement: { label: "Budgets & procurement", route: "/budgets" },
  project_closure: { label: "Project closure", route: "/finance/closures" },
  donor_reporting: { label: "Donor reporting", route: "/donor-reports" },
  kpi_analytics: { label: "KPI & analytics", route: "/kpi-dashboard" },
  ethics_application: { label: "Ethics application", route: "/ethics" },
  ethics_certificate: { label: "Ethics certificate", route: "/ethics" },
};

export const POLICY_MODULE_OPTIONS = Object.entries(POLICY_MODULE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const POLICY_CATEGORY_ORDER = ["general", "research", "funding", "ethics"];

export const POLICY_CATEGORY_LABELS = {
  general: "General / Siyaasada guud",
  research: "Research",
  funding: "Funding & Finance",
  ethics: "Ethics (JUREC)",
};

export function policyModuleLabel(moduleKey) {
  return POLICY_MODULE_META[moduleKey]?.label || moduleKey || "—";
}

export function policyModuleRoute(moduleKey) {
  return POLICY_MODULE_META[moduleKey]?.route || null;
}

export function groupPoliciesByCategory(policies) {
  const grouped = {};
  for (const cat of POLICY_CATEGORY_ORDER) grouped[cat] = [];
  for (const p of policies) {
    const cat = p.category || "general";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }
  return grouped;
}
