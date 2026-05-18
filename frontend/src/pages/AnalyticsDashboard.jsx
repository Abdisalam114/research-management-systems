import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function AnalyticsDashboardPage() {
  const { user } = useAuth();
  const isDirector = user?.role === "research_director";

  if (isDirector) {
    return <Navigate to="/dashboard#institutional-analytics" replace />;
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 800 }}>Institutional analytics</div>
      <p className="muted" style={{ marginTop: 8 }}>
        This report is available to the Research Director only.
      </p>
      <Link className="btn primary" to="/dashboard" style={{ marginTop: 12, display: "inline-block" }}>
        Back to dashboard
      </Link>
    </div>
  );
}
