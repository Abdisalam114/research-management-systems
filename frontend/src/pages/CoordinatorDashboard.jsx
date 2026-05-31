import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";
import * as proposalApi from "../services/proposalApi";
import { ActiveProjectsPanel } from "../components/ActiveProjectsPanel";
import { SystemModulesGrid } from "../components/SystemModulesGrid";
import "./dashboard.css";

export function CoordinatorDashboardPage() {
  const { accessToken, user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [facultyReport, setFacultyReport] = useState(null);
  const [queue, setQueue] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [m, p, fr] = await Promise.all([
          analyticsApi.dashboardMetrics(accessToken),
          proposalApi.listProposals(accessToken),
          analyticsApi.facultyReport(accessToken).catch(() => null),
        ]);
        setMetrics(m.metrics);
        setFacultyReport(fr);
        const dept = user?.department;
        setQueue((p.proposals || []).filter((x) => !dept || x.department === dept));
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load faculty dashboard");
      }
    })();
  }, [accessToken, user?.department]);

  async function downloadFacultyPdf() {
    try {
      setDownloading(true);
      const blob = await analyticsApi.downloadFacultyReportPdf(accessToken);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Faculty-Report-${(user?.department || "all").replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to download faculty report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <h1 className="dashPageTitle">Faculty research monitoring</h1>
        <p className="dashPageSub">Faculty Coordinator — {user?.department || "your faculty"}</p>
      </header>

      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>{error}</div> : null}

      {metrics ? (
        <>
          <section className="dashboardSection">
            <SystemModulesGrid role="faculty_coordinator" metrics={metrics} title="System modules" />
          </section>
          <div className="overviewGrid">
            <Link to="/proposals?filter=submitted" className="overviewTile" style={{ textDecoration: "none" }}>
              <div className="label">Proposals (queue)</div>
              <div className="value">{queue.length}</div>
            </Link>
          </div>
        </>
      ) : (
        <div className="dashboardLoading">Loading dashboard…</div>
      )}

      <section className="dashboardSection">
        <div className="dashCard">
          <div className="dashCardTitle">Proposal pre-review queue</div>
        {queue.length === 0 ? (
          <p className="muted">No proposals awaiting review in your faculty.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {queue.map((p) => (
              <Link key={p.id} to={`/proposals/${p.id}/review`} className="card" style={{ textDecoration: "none" }}>
                <strong>{p.title}</strong>
                <div className="muted">
                  {p.status} • {p.department} • ethics: {p.ethicsStatus || "—"}
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </section>

      {facultyReport ? (
        <section className="dashboardSection">
          <ActiveProjectsPanel
            projects={(facultyReport.projects || []).map((p) => ({
              ...p,
              principalInvestigator: p.pi,
            }))}
            totalActive={facultyReport.counts?.activeProjects}
            title="Active Projects (Faculty)"
          />
        </section>
      ) : null}

      {facultyReport ? (
        <section className="dashboardSection">
          <div className="dashCard">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>Faculty research report — {facultyReport.department}</div>
            <button type="button" className="btn primary" onClick={downloadFacultyPdf} disabled={downloading}>
              {downloading ? "Generating PDF…" : "Download PDF"}
            </button>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Researchers: <strong>{facultyReport.counts.researchers}</strong> • Proposals:{" "}
            <strong>{facultyReport.counts.proposals}</strong> • Projects:{" "}
            <strong>{facultyReport.counts.projects}</strong> • Publications:{" "}
            <strong>{facultyReport.counts.publications}</strong> • Citations:{" "}
            <strong>{facultyReport.counts.citations}</strong>
          </div>
          </div>
        </section>
      ) : null}

      <div className="dashboardQuickLinks">
        <Link className="btn primary" to="/proposals">
          Proposals
        </Link>
        <Link className="btn" to="/publications">
          Validate publications
        </Link>
        <Link className="btn" to="/groups">
          Research groups
        </Link>
      </div>
    </div>
  );
}
