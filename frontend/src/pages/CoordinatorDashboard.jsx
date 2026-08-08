import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as analyticsApi from "../services/analyticsApi";
import * as proposalApi from "../services/proposalApi";
import { ActiveProjectsPanel } from "../components/ActiveProjectsPanel";
import { SystemModulesGrid } from "../components/SystemModulesGrid";
import { DASH_ERROR_BORDER } from "../constants/dashboardTheme";
import "./dashboard.css";

export function CoordinatorDashboardPage() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [metrics, setMetrics] = useState(null);
  const [facultyReport, setFacultyReport] = useState(null);
  const [queue, setQueue] = useState([]);
  const [committeeQueue, setCommitteeQueue] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setError("");
      let queueLen = 0;
      let metricsOk = false;
      let facultyOk = false;
      // Isolate each load so one failure does not wipe the queue
      try {
        const p = await proposalApi.listProposals(accessToken);
        const list = p.proposals || [];
        setQueue(list);
        queueLen = list.length;
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load proposal queue");
        setQueue([]);
      }
      try {
        const c = await proposalApi.listMyCommitteeAssignments(accessToken);
        setCommitteeQueue(c.assignments || []);
      } catch {
        setCommitteeQueue([]);
      }
      try {
        const m = await analyticsApi.dashboardMetrics(accessToken);
        setMetrics(m.metrics);
        metricsOk = true;
      } catch {
        setMetrics(null);
      }
      try {
        const fr = await analyticsApi.facultyReport(accessToken);
        setFacultyReport(fr);
        facultyOk = true;
      } catch {
        setFacultyReport(null);
      }
})();
  }, [accessToken, user?.department, programTier]);

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

      {error ? <div className="card" style={{ borderColor: DASH_ERROR_BORDER }}>{error}</div> : null}

      {metrics ? (
        <>
          <section className="dashboardSection">
            <SystemModulesGrid role="faculty_coordinator" metrics={metrics} title="System modules" />
          </section>
          <div className="overviewGrid">
            <Link to="/proposals?filter=all" className="overviewTile" style={{ textDecoration: "none" }}>
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
                  {p.researcherName ? ` • PI: ${p.researcherName}` : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </section>

      <section className="dashboardSection">
        <div className="dashCard">
          <div className="dashCardTitle">Committee review assignments</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Proposals the Research Director assigned to you for committee review.
          </p>
          {committeeQueue.filter((a) => a.actionRequired).length === 0 ? (
            <p className="muted">No pending committee reviews.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {committeeQueue
                .filter((a) => a.actionRequired)
                .map((a) => (
                  <Link key={a.id} to={`/proposals/${a.id}/review`} className="card" style={{ textDecoration: "none" }}>
                    <strong>{a.title}</strong>
                    <div className="muted">
                      {a.status} • {a.department || "—"}
                      {a.researcherName ? ` • PI: ${a.researcherName}` : ""}
                    </div>
                  </Link>
                ))}
            </div>
          )}
          <Link className="btn" to="/committee-assignments" style={{ marginTop: 12, display: "inline-block" }}>
            Open Committee Reviews
          </Link>
        </div>
      </section>

      <section className="dashboardSection">
        <div className="dashCard">
          <div className="dashCardTitle">Thesis supervision (information only)</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            When supervisors update thesis titles, chapters, or meetings, you receive a notification — no accept/reject step.
          </p>
          <Link className="btn" to="/thesis" style={{ marginTop: 8, display: "inline-block" }}>
            Open Thesis groups
          </Link>
          <Link className="btn" to="/notifications" style={{ marginTop: 8, marginLeft: 8, display: "inline-block" }}>
            Notifications
          </Link>
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
