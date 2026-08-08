import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { PageHeader } from "../components/PageHeader";
import * as analyticsApi from "../services/analyticsApi";

function StatusTable({ title, total, byStatus }) {
  const rows = Object.entries(byStatus || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div style={{ fontWeight: 800, color: "#38bdf8" }}>{total ?? 0}</div>
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          No records
        </p>
      ) : (
        <table className="dashTable">
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([status, count]) => (
              <tr key={status}>
                <td>{status}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function money(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export function SystemReportsPage() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const data = await analyticsApi.systemReport(accessToken);
      setReport(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load system report");
      setReport(null);
    }
  }

  useEffect(() => {
    load();
  }, [accessToken, programTier]);

  async function downloadCsv() {
    setBusy(true);
    setError("");
    try {
      const blob = await analyticsApi.downloadSystemReportCsv(accessToken);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `just-rms-system-report-${programTier || "portal"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.message || "CSV download failed");
    } finally {
      setBusy(false);
    }
  }

  const isDirector = user?.role === "research_director";

  return (
    <div>
      <PageHeader
        title="System Reports"
        subtitle={
          isDirector
            ? "Live counts across Undergraduate and Postgraduate — proposals, ethics, projects, grants, finance, publications, thesis."
            : `Live counts for the active ${programTier === "postgraduate" ? "PG" : "UG"} portal — proposals, ethics, projects, grants, finance, publications, thesis.`
        }
        actions={
          <>
            <button type="button" className="btn primary" disabled={busy || !report} onClick={downloadCsv}>
              {busy ? "Downloading…" : "Download CSV"}
            </button>
            <Link className="btn" to="/finance-reports">
              Finance report
            </Link>
            <Link className="btn" to="/policies">
              Policies
            </Link>
            <Link className="btn" to="/kpi-dashboard">
              KPI dashboard
            </Link>
            {user?.role === "research_director" ? (
              <Link className="btn" to="/donor-reports">
                Donor reports
              </Link>
            ) : null}
          </>
        }
      />

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {!report && !error ? <p className="muted">Loading system report…</p> : null}

      {report ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Generated {new Date(report.generatedAt).toLocaleString()} · scope{" "}
            <strong>{report.scope === "all_programs" ? "All programs (UG + PG — 100%)" : report.scope || "portal"}</strong>
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Proposals</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{report.proposals?.total ?? 0}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Projects</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{report.projects?.total ?? 0}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Grants awarded</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{money(report.grants?.totalAwarded)}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Budget utilization</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{report.finance?.utilizationPercent ?? 0}%</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Publications</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{report.publications?.total ?? 0}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Thesis groups</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{report.thesis?.total ?? 0}</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Policies</div>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{report.policies?.total ?? 0}</div>
            </div>
          </div>

          {report.finance ? (
            <div className="card" style={{ marginBottom: 16, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Finance summary</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14 }}>
                <span>Allocated: <strong>{money(report.finance.allocated)}</strong></span>
                <span>Spent: <strong>{money(report.finance.spent)}</strong></span>
                <span>Paid: <strong>{money(report.finance.paid)}</strong></span>
                <span>POs: <strong>{report.finance.purchaseOrders}</strong></span>
                <span>Payments: <strong>{report.finance.payments}</strong></span>
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            <StatusTable title="Proposals by status" total={report.proposals?.total} byStatus={report.proposals?.byStatus} />
            <StatusTable title="Ethics by status" total={report.ethics?.total} byStatus={report.ethics?.byStatus} />
            <StatusTable title="Projects by status" total={report.projects?.total} byStatus={report.projects?.byStatus} />
            <StatusTable title="Grants by status" total={report.grants?.total} byStatus={report.grants?.byStatus} />
            <StatusTable
              title="Publications by status"
              total={report.publications?.total}
              byStatus={report.publications?.byStatus}
            />
            <StatusTable title="Thesis by status" total={report.thesis?.total} byStatus={report.thesis?.byStatus} />
            {report.users ? (
              <StatusTable title="Users by role" total={report.users.total} byStatus={report.users.byRole} />
            ) : null}
            {report.policies ? (
              <StatusTable title="Policies by status" total={report.policies.total} byStatus={report.policies.byStatus} />
            ) : null}
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Other</div>
              <p style={{ margin: "0 0 6px", fontSize: 14 }}>
                Funding calls: <strong>{report.fundingCalls?.total ?? 0}</strong>
              </p>
              <p style={{ margin: "0 0 6px", fontSize: 14 }}>
                Thesis groups: <strong>{report.thesis?.total ?? 0}</strong>
              </p>
              <p style={{ margin: 0, fontSize: 14 }}>
                Repository items: <strong>{report.repository?.total ?? 0}</strong>
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
