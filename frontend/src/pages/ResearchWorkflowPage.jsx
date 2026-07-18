import { ProjectsListPage } from "./ProjectsList";

/** Research Workflow Status = projects only (no journey / faculty panels). */
export function ResearchWorkflowPage() {
  return (
    <ProjectsListPage
      pageTitle="Research Workflow Status"
      pageSubtitle="Projects only — guji project si aad u aragto meesha workflow-ku joogo."
      showExtraActions={false}
    />
  );
}
