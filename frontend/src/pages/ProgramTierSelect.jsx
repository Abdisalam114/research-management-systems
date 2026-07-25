import { Navigate } from "react-router-dom";

/** Portal picker retired — shared staff see UG + PG together. */
export function ProgramTierSelectPage() {
  return <Navigate to="/dashboard" replace />;
}
