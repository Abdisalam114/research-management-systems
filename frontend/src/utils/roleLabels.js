const ROLE_LABELS = {
  research_director: "Research Director (Research Office)",
  faculty_coordinator: "Faculty Coordinator",
  finance_officer: "Finance Officer",
  leadership: "University Leadership",
  researcher: "Researcher / PI",
};

export function formatRole(role) {
  return ROLE_LABELS[role] || role || "—";
}
