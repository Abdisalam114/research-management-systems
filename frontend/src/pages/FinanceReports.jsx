import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as analyticsApi from "../services/analyticsApi";

import { PageHeader } from "../components/PageHeader";

export function FinanceReportsPage() {
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    analyticsApi
      .financeReport(accessToken)
      .then(setReport)
      .catch((e) => setError(e?.response?.data?.message || "Failed to load finance report"));
  }, [accessToken, programTier]);

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
  const grantRows = report.grantSummary || [];
  const totalAwarded = grantRows.reduce((acc, g) => acc + Number(g.amountAwarded || 0), 0);
  const totalRequested = grantRows.reduce((acc, g) => acc + Number(g.amountRequested || 0), 0);

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
          <div className="value">${Number(s.totalAllocated || 0).toLocaleString()}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Paid</div>
          <div className="value">${Number(s.totalPaid || 0).toLocaleString()}</div>
        </div>
        <div className="overviewTile">
          <div className="label">Utilization</div>
          <div className="value">{s.utilizationPercent ?? 0}%</div>
        </div>
        <div className="overviewTile">
          <div className="label">Grants awarded (total)</div>
          <div className="value">${Number(s.awardedTotal ?? totalAwarded).toLocaleString()}</div>
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
              <th>Requested</th>
              <th>Awarded</th>
            </tr>
          </thead>
          <tbody>
            {grantRows.map((g) => (
              <tr key={g.title + g.status}>
                <td>{g.title}</td>
                <td>{g.fundingSource}</td>
                <td>{g.status}</td>
                <td>${Number(g.amountRequested || 0).toLocaleString()}</td>
                <td>${Number(g.amountAwarded || 0).toLocaleString()}</td>
              </tr>
            ))}
            {grantRows.length ? (
              <tr style={{ fontWeight: 800, background: "rgba(14,165,233,0.06)" }}>
                <td colSpan={3}>Total</td>
                <td>${totalRequested.toLocaleString()}</td>
                <td>${totalAwarded.toLocaleString()}</td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="muted">
                  No grant financial records in this portal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
