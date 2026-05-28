import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";
import * as proposalApi from "../services/proposalApi";
import { SystemModulesGrid } from "../components/SystemModulesGrid";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";

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
    <div>
      <h2 style={{ marginTop: 0 }}>Faculty research monitoring</h2>
      <p className="muted">Faculty Coordinator — {user?.department || "your faculty"}</p>
      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>{error}</div> : null}

      {metrics ? (
        <>
          <SystemModulesGrid
            role="faculty_coordinator"
            metrics={metrics}
            title="Jamhuriya RMS — dhammaan qaybaha system-ka"
          />
          <div className="overviewGrid" style={{ marginTop: 12 }}>
            <div className="overviewTile">
              <div className="label">Proposals (queue)</div>
              <div className="value">{queue.length}</div>
            </div>
          </div>
        </>
      ) : null}

      {accessToken ? (
        <FacultyResearchWorkflowModule
          accessToken={accessToken}
          departmentLabel={user?.department}
          canManage
        />
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800 }}>Proposal pre-review queue</div>
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

      {facultyReport ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800 }}>Faculty research report — {facultyReport.department}</div>
            <button type="button" className="btn primary" onClick={downloadFacultyPdf} disabled={downloading}>
              {downloading ? "Generating PDF…" : "Download PDF"}
            </button>
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            Researchers: <strong>{facultyReport.counts.researchers}</strong> • Proposals:{" "}
            <strong>{facultyReport.counts.proposals}</strong> • Projects:{" "}
            <strong>{facultyReport.counts.projects}</strong> • Publications:{" "}
            <strong>{facultyReport.counts.publications}</strong> • Citations:{" "}
            <strong>{facultyReport.counts.citations}</strong>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
