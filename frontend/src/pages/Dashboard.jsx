import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { DirectorDashboard } from "../components/DirectorDashboard";
import { FinanceDashboard } from "../components/FinanceDashboard";
import { CoordinatorDashboardPage } from "./CoordinatorDashboard";
import { ActiveProjectsPanel } from "../components/ActiveProjectsPanel";
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
    faculty_coordinator: { title: "Department (Faculty Coordinator)", focus: "Support and approve internal department priority." },
    finance_officer: { title: "Finance Office", focus: "Approve budgets, track expenses, financial reports." },
    researcher: { title: "Researcher / PI", focus: "Apply for grants via funding calls, proposals, projects, reports." },
    ethics_committee: { title: "Ethics Committee (REC)", focus: "Review and approve ethics applications." },
    procurement_officer: { title: "Procurement Office", focus: "Purchase orders and budget-linked procurement." },
    peer_reviewer: { title: "Peer Reviewer", focus: "Evaluate proposal quality and scientific merit." },
    hr_officer: { title: "HR Office", focus: "Project teams, thesis groups, and staff coordination." },
    leadership: { title: "University Leadership", focus: "Final approval of grant awards and KPI oversight." },
    donor_agency: { title: "Donor / External Agency", focus: "Monitor funded grants and periodic reports." },
  };

  const quickLinksByRole = {
    ethics_committee: [
      { to: "/ethics", label: "Ethics applications", primary: true },
      { to: "/notifications", label: "Notifications" },
    ],
    procurement_officer: [
      { to: "/budgets", label: "Budgets & procurement", primary: true },
      { to: "/grants", label: "Funded grants" },
      { to: "/funding-calls", label: "Funding calls" },
    ],
    peer_reviewer: [
      { to: "/review-assignments", label: "Peer review assignments", primary: true },
      { to: "/notifications", label: "Notifications" },
    ],
    hr_officer: [
      { to: "/projects", label: "Projects", primary: true },
      { to: "/thesis", label: "Thesis supervision" },
      { to: "/groups", label: "Research groups" },
    ],
    leadership: [
      { to: "/grants", label: "Grant awards", primary: true },
      { to: "/kpi-dashboard", label: "KPI dashboard" },
      { to: "/funding-calls", label: "Funding calls" },
    ],
    donor_agency: [
      { to: "/donor-reports", label: "Donor reports", primary: true },
      { to: "/grants", label: "Funded grants" },
      { to: "/funding-calls", label: "Funding calls" },
    ],
    researcher: [
      { to: "/funding-calls", label: "Apply via Funding Calls", primary: true },
      { to: "/proposals", label: "Proposals" },
      { to: "/projects", label: "Projects" },
      { to: "/grants", label: "My grants" },
    ],
    finance_officer: [
      { to: "/budgets", label: "Finance & budgets", primary: true },
      { to: "/grants", label: "Grants" },
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

      {error ? <div className="card" style={{ borderColor: "rgba(239,68,68,0.5)" }}>{error}</div> : null}

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
