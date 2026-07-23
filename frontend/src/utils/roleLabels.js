const ROLE_LABELS = {
  research_director: "Research Director (Research Office)",
  faculty_coordinator: "Faculty Coordinator (Department)",
  finance_officer: "Finance Officer",
  hr_officer: "HR Officer",
  leadership: "University Leadership",
  donor_agency: "Donor / External Agency",
  researcher: "Researcher / PI",
};

export function formatRole(role) {
  return ROLE_LABELS[role] || role || "—";
}
