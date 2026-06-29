import { Navigate } from "react-router-dom";

/** Legacy route — project workflow lives on each project page. */
export function ResearchJourneyPage() {
  return <Navigate to="/projects" replace />;
}
