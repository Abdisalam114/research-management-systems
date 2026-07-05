const ROLE_LABELS = {
  research_director: "Research Director",
  faculty_coordinator: "Faculty Coordinator",
  finance_officer: "Finance Officer",
  ethics_committee: "Ethics Committee",
  procurement_officer: "Procurement Officer",
  researcher: "Researcher",
};

export function formatRole(role) {
  return ROLE_LABELS[role] || role || "—";
}
