const ROLE_LABELS = {
  research_director: "Research Director",
  faculty_coordinator: "Faculty Coordinator",
  finance_officer: "Finance Officer",
  researcher: "Researcher",
};

export function formatRole(role) {
  return ROLE_LABELS[role] || role || "—";
}
