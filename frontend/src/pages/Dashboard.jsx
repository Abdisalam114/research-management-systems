import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { DirectorDashboard } from "../components/DirectorDashboard";
import { FinanceDashboard } from "../components/FinanceDashboard";
import { CoordinatorDashboardPage } from "./CoordinatorDashboard";
import { SystemModulesGrid } from "../components/SystemModulesGrid";
import * as analyticsApi from "../services/analyticsApi";
import "./dashboard.css";

function RoleDashboard({ role, user }) {
  const { accessToken } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await analyticsApi.dashboardMetrics(accessToken);
        if (!cancelled) setMetrics(res.metrics);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Failed to load metrics");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const roleHints = {
    faculty_coordinator: { title: "Faculty Coordinator", focus: "Review proposals and validate publications." },
    finance_officer: { title: "Finance Officer", focus: "Manage budgets, grants, and payment workflows." },
    researcher: { title: "Researcher", focus: "Manage your proposals, projects, and publications." },
  };

  const hint = roleHints[role] || { title: role, focus: "" };

  return (
    <>
      <div>
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 18 }}>Welcome, {user?.fullName}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {hint.title} — {hint.focus}
          </div>
        </div>

        {error ? <div className="card" style={{ marginTop: 12, borderColor: "rgba(239,68,68,0.5)" }}>{error}</div> : null}

        {metrics ? (
          <SystemModulesGrid role={role} metrics={metrics} title="Jamhuriya RMS — dhammaan qaybaha system-ka" />
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading…
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn primary" to="/proposals">
            Proposals
          </Link>
          <Link className="btn" to="/projects">
            Projects
          </Link>
          {role === "finance_officer" ? (
            <Link className="btn" to="/budgets">
              Budgets
            </Link>
          ) : null}
          {role !== "finance_officer" ? (
            <Link className="btn" to="/publications">
              Publications
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === "research_director") {
    return <DirectorDashboard />;
  }

  if (user?.role === "faculty_coordinator") {
    return <CoordinatorDashboardPage />;
  }

  if (user?.role === "finance_officer") {
    return <FinanceDashboard />;
  }

  return <RoleDashboard role={user?.role} user={user} />;
}
