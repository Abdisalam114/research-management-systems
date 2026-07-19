import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";
import { ResearchJourneyPanel } from "../components/ResearchJourneyPanel";
import { PageHeader } from "../components/PageHeader";

export function ResearchWorkflowPage() {
  const { accessToken, user } = useAuth();
  const canManage = ["faculty_coordinator", "research_director"].includes(user?.role);
  const isResearcher = user?.role === "researcher";
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
          isResearcher
            ? "Raac project-kasta aad sameysay — meesha workflow-ku joogo (proposal → project → grant → publication → repository)."
            : "Track each researcher’s projects through the full research workflow."
        }
        actions={
          <>
            <Link className="btn primary" to="/projects">
              Projects
            </Link>
            <Link className="btn" to="/publications">
              Publications
            </Link>
          </>
        }
      />

      {/* Primary: project-scoped research workflow (follows projects you created) */}
      <ResearchJourneyPanel />

      {/* Secondary: faculty publication pipeline (staff / optional) */}
      {canManage || !isResearcher ? (
        <div style={{ marginTop: 20 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            Faculty publication pipeline (outputs only)
          </div>
          <FacultyResearchWorkflowModule
            accessToken={accessToken}
            departmentLabel={departmentLabel}
            canManage={canManage}
            embedded
          />
        </div>
      ) : (
        <details style={{ marginTop: 16 }}>
          <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
            Show publication pipeline (optional)
          </summary>
          <FacultyResearchWorkflowModule
            accessToken={accessToken}
            departmentLabel={departmentLabel}
            canManage={false}
            embedded
          />
        </details>
      )}
    </div>
  );
}
