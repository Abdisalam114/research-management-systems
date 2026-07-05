import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";

import { PageHeader } from "../components/PageHeader";

export function FinanceReportsPage() {
  const { accessToken } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    analyticsApi
      .financeReport(accessToken)
      .then(setReport)
      .catch((e) => setError(e?.response?.data?.message || "Failed to load finance report"));
  }, [accessToken]);

  if (error) {
    return (
      <div>
        <PageHeader title="Finance reports" subtitle="Budget utilization and grant financial summary." />
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>{error}</div>
      </div>
    );
  }
  if (!report) {
    return (
      <div>
        <PageHeader title="Finance reports" subtitle="Budget utilization and grant financial summary." />
        <p className="muted">Loading financial report…</p>
      </div>
    );
  }

  const s = report.summary;

  return (
    <div>
      <PageHeader title="Finance reports" subtitle="Budget utilization and grant financial summary." />

      <div className="overviewGrid" style={{ marginTop: 12 }}>
        <div className="overviewTile">
          <div className="label">Budgets</div>
          <div className="value">{s.budgets}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Allocated</div>
          <div className="value">${s.totalAllocated?.toLocaleString()}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Paid</div>
          <div className="value">${s.totalPaid?.toLocaleString()}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Utilization</div>
          <div className="value">{s.utilizationPercent}%</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Grant financial summary</div>
        <table className="dashTable">
          <thead>
            <tr>
              <th>Grant</th>
              <th>Source</th>
              <th>Status</th>
              <th>Awarded</th>
            </tr>
          </thead>
          <tbody>
            {(report.grantSummary || []).map((g) => (
              <tr key={g.title + g.status}>
                <td>{g.title}</td>
                <td>{g.fundingSource}</td>
                <td>{g.status}</td>
                <td>${(g.amountAwarded || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
