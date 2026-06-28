import { Navigate } from "react-router-dom";

/** Legacy route — merged into Research Workflow Status. */
export function ResearchJourneyPage() {
  return <Navigate to="/research-workflow" replace />;
}
