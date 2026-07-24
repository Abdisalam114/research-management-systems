import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { DirectorDashboard } from "../components/DirectorDashboard";
import { FinanceDashboard } from "../components/FinanceDashboard";
import { CoordinatorDashboardPage } from "./CoordinatorDashboard";
import { ActiveProjectsPanel } from "../components/ActiveProjectsPanel";
import { SystemModulesGrid } from "../components/SystemModulesGrid";
import * as analyticsApi from "../services/analyticsApi";
import { DASH_ERROR_BORDER } from "../constants/dashboardTheme";
import "./dashboard.css";

function RoleDashboard({ role, user }) {
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
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
  }, [accessToken, programTier]);

  const roleHints = {
    faculty_coordinator: { title: "Department (Faculty Coordinator)", focus: "Support and approve internal department priority." },
    finance_officer: { title: "Finance Office", focus: "Budgets, payments, purchase-order review, grant funding, and financial reports." },
    researcher: { title: "Researcher / PI", focus: "Apply for grants via funding calls, proposals, projects, reports." },
    research_director: { title: "Research Director", focus: "Approve proposals, ethics, users, funding calls (internal & external), donor reports, and overall system oversight." },
    leadership: {
      title: "University Leadership",
      focus: "Peer review assignments, approve funding calls, grant awards, KPIs, and institutional policy (siyaasada guud).",
    },
  };

  const quickLinksByRole = {
    leadership: [
      { to: "/review-assignments", label: "Peer review assignments", primary: true },
      { to: "/funding-calls", label: "Approve funding calls" },
      { to: "/policies", label: "Institutional policies" },
      { to: "/grants", label: "Grant awards" },
      { to: "/kpi-dashboard", label: "KPI dashboard" },
    ],
    researcher: [
      { to: "/funding-calls", label: "Apply via Funding Calls", primary: true },
      { to: "/proposals", label: "Proposals" },
      { to: "/projects", label: "Projects" },
      { to: "/grants", label: "My grants" },
    ],
    finance_officer: [
      { to: "/finance/grant-approvals", label: "Grant funding approval", primary: true },
      { to: "/finance/closures", label: "Project closure" },
      { to: "/budgets", label: "Finance & budgets" },
      { to: "/grants?filter=pending_finance", label: "Grants pending finance" },
      { to: "/finance-reports", label: "Finance reports" },
    ],
  };

  const quickLinks = quickLinksByRole[role] || [
    { to: "/research-workflow", label: "Research Workflow Status", primary: true },
    { to: "/proposals", label: "Proposals" },
    { to: "/projects", label: "Projects" },
    { to: "/publications", label: "Publications" },
  ];

  const hint = roleHints[role] || { title: role, focus: "" };

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <div className="dashWelcomeCard">
          <h1 className="dashWelcomeTitle">Welcome, {user?.fullName}</h1>
          <p className="dashWelcomeSub">
            {hint.title} — {hint.focus}
          </p>
        </div>
      </header>

      {error ? <div className="card" style={{ borderColor: DASH_ERROR_BORDER }}>{error}</div> : null}

      {metrics ? (
        <>
          <section className="dashboardSection">
            <SystemModulesGrid role={role} metrics={metrics} title="System modules" />
          </section>
          {metrics.activeProjects?.length || metrics.projects?.active ? (
            <section className="dashboardSection">
                <ActiveProjectsPanel
                  projects={metrics.activeProjects || []}
                  totalActive={metrics.projects?.active}
                  title="My Active Projects"
                />
            </section>
          ) : null}
        </>
      ) : (
        <div className="dashboardLoading">Loading dashboard…</div>
      )}

      <div className="dashboardQuickLinks">
        {quickLinks.map((link) => (
          <Link key={link.to} className={link.primary ? "btn primary" : "btn"} to={link.to}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
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
