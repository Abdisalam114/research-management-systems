import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";
import { PageHeader } from "../components/PageHeader";

export function DonorReportsPage() {
  const { accessToken } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    analyticsApi
      .donorReport(accessToken)
      .then(setReport)
      .catch((e) => setError(e?.response?.data?.message || "Failed to load donor report"));
  }, [accessToken]);

  if (error) {
    return (
      <div>
        <PageHeader title="Donor reports" subtitle="External funding accountability summary." />
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.55)", marginTop: 12 }}>{error}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div>
        <PageHeader title="Donor reports" subtitle="External funding accountability summary." />
        <p className="muted">Loading donor report…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Donor reports"
        subtitle={`Generated ${new Date(report.generatedAt).toLocaleString()} · ${report.donors?.length || 0} donor references`}
      />

      <div className="overviewGrid" style={{ marginTop: 12 }}>
        <div className="overviewTile">
          <div className="label">Donor references</div>
          <div className="value">{report.donors?.length || 0}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Total awarded</div>
          <div className="value">${(report.totals?.awarded || 0).toLocaleString()}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Open calls</div>
          <div className="value">{report.totals?.openCalls || 0}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Grants by donor reference</div>
        <table className="dashTable">
          <thead>
            <tr>
              <th>Donor ref</th>
              <th>Grants</th>
              <th>Awarded</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {(report.donors || []).map((d) => (
              <tr key={d.donorRef}>
                <td>{d.donorRef}</td>
                <td>{d.grantCount}</td>
                <td>${(d.totalAwarded || 0).toLocaleString()}</td>
                <td>${(d.totalRequested || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Funding calls</div>
        <table className="dashTable">
          <thead>
            <tr>
              <th>Title</th>
              <th>Donor ref</th>
              <th>Source</th>
              <th>Cap</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(report.fundingCalls || []).map((c) => (
              <tr key={c.id || c.title}>
                <td>{c.title}</td>
                <td>{c.donorRef || "—"}</td>
                <td>{c.fundingSource || "—"}</td>
                <td>${(c.amountCap || 0).toLocaleString()}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
