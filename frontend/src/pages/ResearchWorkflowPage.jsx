import { useAuth } from "../hooks/useAuth";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";
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

  return (
    <div>
      <PageHeader
        title="Research Workflow Status"
        subtitle="Track publication outputs from submission through in process, pipeline, and published."
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

      <FacultyResearchWorkflowModule
        accessToken={accessToken}
        departmentLabel={departmentLabel}
        canManage={canManage}
        embedded
      />
    </div>
  );
}
