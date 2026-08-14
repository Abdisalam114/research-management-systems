import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as analyticsApi from "../services/analyticsApi";
import { PageHeader } from "../components/PageHeader";
import "../pages/dashboard.css";

function kpiRoutesForRole(role) {
  const canFinance = ["research_director", "finance_officer"].includes(role);
  const canProjects = ["research_director", "faculty_coordinator", "researcher"].includes(role);
  return [
    { key: "grantSuccessRate", label: "Grant success rate", format: (v) => `${v ?? 0}%`, to: "/grants" },
    { key: "proposalApprovalRate", label: "Proposal approval", format: (v) => `${v ?? 0}%`, to: "/proposals?filter=approved" },
    {
      key: "totalFundingAwarded",
      label: "Funding awarded",
      format: (v) => `$${Number(v || 0).toLocaleString()}`,
      to: canFinance ? "/finance-reports" : "/grants?filter=awarded",
    },
    {
      key: "activeProjects",
      label: "Active projects",
      format: (v) => v ?? 0,
      to: canProjects ? "/projects?filter=active" : "/system-reports",
    },
    {
      key: "projectsArchived",
      label: "Archived projects",
      format: (v) => v ?? 0,
      to: canProjects ? "/projects?filter=completed" : "/system-reports",
    },
    {
      key: "publicationsValidated",
      label: "Validated publications",
      format: (v) => v ?? 0,
      to: canProjects ? "/publications?filter=validated" : "/system-reports",
    },
    {
      key: "openFundingCalls",
      label: "Open funding calls",
      format: (v) => v ?? 0,
      sub: (kpis) => `Internal ${kpis.internalFundingCalls ?? 0} · External ${kpis.externalFundingCalls ?? 0}`,
      to: "/funding-calls?filter=open",
    },
  ];
}

function KpiCard({ label, value, sub, to }) {
  const inner = (
    <>
      <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 22, marginTop: 6 }}>{value}</div>
      {sub ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
      {to ? (
        <div className="muted" style={{ fontSize: 11, marginTop: 8, fontWeight: 700 }}>
          Open module →
        </div>
      ) : null}
    </>
  );

  if (!to) {
    return (
      <div className="card" style={{ padding: 14 }}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="card"
      style={{
        padding: 14,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        transition: "border-color 0.15s ease",
      }}
    >
      {inner}
    </Link>
  );
}

export function KpiDashboardPage() {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState(null);
  const kpiRoutes = useMemo(() => kpiRoutesForRole(user?.role), [user?.role]);

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
            Generated {new Date(data.generatedAt).toLocaleString()} — click a card to open the related module.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {kpiRoutes.map((k) => (
              <KpiCard
                key={k.key}
                label={k.label}
                value={k.format(kpis[k.key])}
                sub={k.sub ? k.sub(kpis) : null}
                to={k.to}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
