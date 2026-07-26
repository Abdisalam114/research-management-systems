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
import * as proposalApi from "../services/proposalApi";
import { DASH_ERROR_BORDER } from "../constants/dashboardTheme";
import "./dashboard.css";

function RoleDashboard({ role, user }) {
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [peerAssignments, setPeerAssignments] = useState([]);

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
  }, [accessToken, programTier, role]);

  useEffect(() => {
    if (role !== "leadership" || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await proposalApi.listMyReviewAssignments(accessToken);
        if (!cancelled) setPeerAssignments(res.assignments || []);
      } catch {
        if (!cancelled) setPeerAssignments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, accessToken, programTier]);

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
  const pendingPeer = peerAssignments.filter((a) => !a.peerReviewSubmitted);

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

      {role === "leadership" ? (
        <section className="dashboardSection">
          <div className="dashboardSectionTitle">Peer reviews sent to you</div>
          <div className="card" style={{ marginTop: 8 }}>
            {pendingPeer.length === 0 && peerAssignments.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                No assignments yet. When the Research Director sends a proposal to you as reviewer, it appears here and under Peer Reviews.
              </p>
            ) : (
              <>
                <p style={{ marginTop: 0, fontSize: 14 }}>
                  <strong>{pendingPeer.length}</strong> pending ·{" "}
                  <strong>{peerAssignments.length - pendingPeer.length}</strong> submitted
                  {metrics?.modules?.reviews != null ? (
                    <span className="muted"> · Dashboard tile: {metrics.modules.reviews}</span>
                  ) : null}
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {pendingPeer.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.title}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          Sent to reviewer · {a.status} · {a.currentReviewStage}
                        </div>
                      </div>
                      <Link className="btn primary" to={`/proposals/${a.id}/review`}>
                        Open review
                      </Link>
                    </div>
                  ))}
                </div>
                <Link className="btn" to="/review-assignments" style={{ marginTop: 12, display: "inline-block" }}>
                  All peer reviews
                </Link>
              </>
            )}
          </div>
        </section>
      ) : null}

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
