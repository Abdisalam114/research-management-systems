import { useAuth } from "../hooks/useAuth";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";

export function ResearchWorkflowPage() {
  const { accessToken, user } = useAuth();
  const canManage = ["faculty_coordinator", "research_director"].includes(user?.role);
  const departmentLabel =
    user?.role === "research_director"
      ? "All faculties"
      : user?.role === "researcher"
        ? "My outputs"
        : user?.department;

  return (
    <FacultyResearchWorkflowModule
      accessToken={accessToken}
      departmentLabel={departmentLabel}
      canManage={canManage}
      standalone
    />
  );
}
