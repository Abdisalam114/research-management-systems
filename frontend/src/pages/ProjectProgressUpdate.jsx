import { Navigate, useParams } from "react-router-dom";

/** Manual progress entry is disabled — progress is derived from the workflow. */
export function ProjectProgressUpdatePage() {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}`} replace />;
}
