import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as analyticsApi from "../services/analyticsApi";
import { PageHeader } from "../components/PageHeader";
import "../pages/dashboard.css";

function KpiCard({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 22, marginTop: 6 }}>{value}</div>
      {sub ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export function KpiDashboardPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await analyticsApi.kpiDashboard(accessToken);
    setData(res);
  }, [accessToken]);

  const { loading, error } = useModuleLoad(accessToken, load, []);

  const kpis = data?.kpis || {};

  return (
    <div className="dashboardPage">
      <PageHeader
        title="KPI Dashboard"
        subtitle="Leadership metrics — grant success, funding, projects, publications"
        actions={
          <Link className="btn" to="/dashboard">
            ← Dashboard
          </Link>
        }
      />
      {error ? <div className="bannerErr">{error}</div> : null}
      {loading ? <p className="muted">Loading KPIs…</p> : null}

      {data ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Generated {new Date(data.generatedAt).toLocaleString()}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <KpiCard label="Grant success rate" value={`${kpis.grantSuccessRate ?? 0}%`} />
            <KpiCard label="Proposal approval" value={`${kpis.proposalApprovalRate ?? 0}%`} />
            <KpiCard label="Funding awarded" value={`$${Number(kpis.totalFundingAwarded || 0).toLocaleString()}`} />
            <KpiCard label="Active projects" value={kpis.activeProjects ?? 0} />
            <KpiCard label="Archived projects" value={kpis.projectsArchived ?? 0} />
            <KpiCard label="Validated publications" value={kpis.publicationsValidated ?? 0} />
            <KpiCard label="Citations" value={kpis.totalCitations ?? 0} />
            <KpiCard
              label="Open funding calls"
              value={kpis.openFundingCalls ?? 0}
              sub={`Internal ${kpis.internalFundingCalls ?? 0} · External ${kpis.externalFundingCalls ?? 0}`}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
