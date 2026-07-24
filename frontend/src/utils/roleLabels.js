const ROLE_LABELS = {
  research_director: "Research Director (Research Office)",
  faculty_coordinator: "Faculty Coordinator (Department)",
  finance_officer: "Finance Officer",
  leadership: "University Leadership",
  researcher: "Researcher / PI",
  // Legacy (removed logins — kept for historic audit labels)
  hr_officer: "HR Officer (removed)",
  donor_agency: "Donor / External Agency (removed)",
  procurement_officer: "Procurement Officer (removed)",
};

export function formatRole(role) {
  return ROLE_LABELS[role] || role || "—";
}
