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
        ? "My outputs"
        : user?.department;

  const subtitle =
    user?.role === "researcher"
      ? "Track your full research pipeline and where each publication sits before publication."
      : "Track researcher pipelines and faculty publication outputs in one place.";

  return (
    <div>
      <PageHeader
        title="Research Workflow Status"
        subtitle={subtitle}
        actions={
          <Link className="btn" to="/publications">
            Publications
          </Link>
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
