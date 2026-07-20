import { useAuth } from "../hooks/useAuth";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";
import { PageHeader } from "../components/PageHeader";
import { Link, useSearchParams } from "react-router-dom";

/**
 * Own page / own list — data always comes from project-linked publications.
 */
export function ResearchWorkflowPage() {
  const { accessToken, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
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
        subtitle={
          user?.role === "researcher"
            ? "Publication pipeline-kaaga (project-linked). Optional: filter by one project from Projects."
            : "Faculty publication workflow: submission → in process → pipeline → published (from Projects)."
        }
        actions={
          <>
            <Link className="btn" to="/projects">
              Projects
            </Link>
            <Link className="btn" to="/publications">
              Publications
            </Link>
            {projectIdFromUrl ? (
              <Link className="btn" to={`/projects/${projectIdFromUrl}`}>
                Open project
              </Link>
            ) : null}
          </>
        }
      />

      <FacultyResearchWorkflowModule
        accessToken={accessToken}
        departmentLabel={departmentLabel}
        canManage={canManage}
        embedded
        projectId={projectIdFromUrl}
      />
    </div>
  );
}
