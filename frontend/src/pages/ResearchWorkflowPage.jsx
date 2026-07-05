import { useAuth } from "../hooks/useAuth";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";
import { ResearchJourneyPanel } from "../components/ResearchJourneyPanel";
import { PageHeader } from "../components/PageHeader";
import { Link } from "react-router-dom";

export function ResearchWorkflowPage() {
  const { accessToken, user } = useAuth();
  const canManage = ["faculty_coordinator", "research_director"].includes(user?.role);
  const departmentLabel =
    user?.role === "research_director"
      ? "All faculties"
      : user?.role === "researcher"
        ? "My research"
        : user?.department;

  return (
    <div>
      <PageHeader
        title="Research Workflow Status"
        subtitle="Full research pipeline (proposal → ethics → project → grant → publication → repository) plus faculty publication workflow stages."
        actions={
          <>
            <Link className="btn" to="/projects">
              Projects
            </Link>
            <Link className="btn" to="/publications">
              Publications
            </Link>
          </>
        }
      />

      <ResearchJourneyPanel />

      <FacultyResearchWorkflowModule
        accessToken={accessToken}
        departmentLabel={departmentLabel}
        canManage={canManage}
        embedded
      />
    </div>
  );
}
