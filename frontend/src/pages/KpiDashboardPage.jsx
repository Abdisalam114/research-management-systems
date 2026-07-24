import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as analyticsApi from "../services/analyticsApi";
import { PageHeader } from "../components/PageHeader";
import {
  DASH_SUCCESS_BG,
  DASH_SUCCESS_BORDER,
  DASH_WARNING_BG,
  DASH_WARNING_BORDER,
} from "../constants/dashboardTheme";
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
  const coverage = data?.coverageScore || {};

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
          <div
            className="card"
            style={{
              borderColor: data.thesisReady ? DASH_SUCCESS_BORDER : DASH_WARNING_BORDER,
              background: data.thesisReady ? DASH_SUCCESS_BG : DASH_WARNING_BG,
            }}
          >
            <div style={{ fontWeight: 800 }}>
              System coverage: <strong>{coverage.overall || 0}%</strong>
              {data.thesisReady ? " — Thesis-ready (90%+)" : ""}
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
              Generated {new Date(data.generatedAt).toLocaleString()} · Portal: {data.programTier}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <KpiCard label="Grant success rate" value={`${kpis.grantSuccessRate ?? 0}%`} />
            <KpiCard label="Proposal approval" value={`${kpis.proposalApprovalRate ?? 0}%`} />
            <KpiCard label="Funding awarded" value={`$${Number(kpis.totalFundingAwarded || 0).toLocaleString()}`} />
            <KpiCard label="Active projects" value={kpis.activeProjects ?? 0} />
            <KpiCard label="Archived projects" value={kpis.projectsArchived ?? 0} />
            <KpiCard label="Validated publications" value={kpis.publicationsValidated ?? 0} />
            <KpiCard label="Citations" value={kpis.totalCitations ?? 0} />
            <KpiCard label="Open funding calls" value={kpis.openFundingCalls ?? 0} sub={`Internal ${kpis.internalFundingCalls ?? 0} · External ${kpis.externalFundingCalls ?? 0}`} />
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Coverage by area</div>
            <table className="dashTable">
              <thead>
                <tr>
                  <th>Area</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(coverage)
                  .filter(([k]) => k !== "overall")
                  .map(([k, v]) => (
                    <tr key={k}>
                      <td>{k.replace(/([A-Z])/g, " $1").replace(/^phase/, "Phase ")}</td>
                      <td>{v}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
