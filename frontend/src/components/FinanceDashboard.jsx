import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as analyticsApi from "../services/analyticsApi";
import * as grantApi from "../services/grantApi";
import { SystemModulesGrid } from "./SystemModulesGrid";
import {
  DASH_AXIS_TICK,
  DASH_CHART_TOOLTIP,
  DASH_COLORS,
  DASH_ERROR_BORDER,
  DASH_PIE,
  DASH_WARNING_BG,
  DASH_WARNING_BORDER,
} from "../constants/dashboardTheme";
import "../pages/dashboard.css";

const PIE_COLORS = DASH_PIE;

function formatMoney(n) {
  if (!n && n !== 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export function FinanceDashboard() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [report, setReport] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [pendingFinanceCount, setPendingFinanceCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const [res, m, grantsRes] = await Promise.all([
          analyticsApi.financeReport(accessToken),
          analyticsApi.dashboardMetrics(accessToken).catch(() => null),
          grantApi.listGrants(accessToken).catch(() => ({ grants: [] })),
        ]);
        if (!cancelled) {
          setReport(res);
          if (m?.metrics) setMetrics(m.metrics);
          const pending = (grantsRes.grants || []).filter((g) => g.status === "pending_finance").length;
          setPendingFinanceCount(pending);
          // #region agent log
          fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
            body: JSON.stringify({
              sessionId: "f558f7",
              runId: "finance-grant-queue",
              hypothesisId: "F1",
              location: "FinanceDashboard.jsx:load",
              message: "finance dashboard pending funding count",
              data: { pendingFinanceCount: pending },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Failed to load finance report");
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [accessToken, programTier]);

  const utilizationPie = useMemo(() => {
    if (!report) return [];
    const items = report.budgetItems || [];
    const pending = items.filter((i) => i.status === "pending").length;
    const approved = items.filter((i) => i.status === "approved").length;
    const paid = items.filter((i) => i.status === "paid").length;
    return [
      { name: "Pending", value: pending },
      { name: "Approved", value: approved },
      { name: "Paid", value: paid },
    ];
  }, [report]);

  const grantBars = useMemo(() => {
    if (!report) return [];
    const buckets = { active: 0, approved: 0, closed: 0, pending: 0, rejected: 0 };
    (report.grantSummary || []).forEach((g) => {
      if (buckets[g.status] !== undefined) buckets[g.status] += 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [report]);

  if (error) {
    return (
      <div className="dashboardPage">
        <div className="card" style={{ borderColor: DASH_ERROR_BORDER }}>{error}</div>
      </div>
    );
  }

  if (!report) return <div className="dashboardLoading">Loading finance dashboard…</div>;

  const s = report.summary || {};

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <div className="dashWelcomeCard">
          <h1 className="dashWelcomeTitle">💼 Finance Office</h1>
          <p className="dashWelcomeSub">
            Welcome {user?.fullName} — manage budgets, payments, purchase orders, and grant funding.
          </p>
        </div>
      </header>

      {metrics ? (
        <section className="dashboardSection">
          <SystemModulesGrid role="finance_officer" metrics={metrics} title="Finance modules" />
        </section>
      ) : null}

      <div
        className="card"
        style={{
          marginBottom: 16,
          borderColor: pendingFinanceCount ? DASH_WARNING_BORDER : "rgba(148,163,184,0.25)",
          background: pendingFinanceCount ? DASH_WARNING_BG : undefined,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800 }}>Grant funding approval (Funding Calls)</div>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
              {pendingFinanceCount
                ? `${pendingFinanceCount} award(s) waiting for budget authorization (allocation only — not a payment).`
                : "No funding-call awards waiting. New ones appear here after Director acceptance."}
            </p>
          </div>
          <Link className="btn primary" to="/finance/grant-approvals">
            {pendingFinanceCount ? `Authorize budgets (${pendingFinanceCount})` : "Open funding approvals"}
          </Link>
        </div>
      </div>

      <div className="overviewGrid">
        <Link to="/finance/grant-approvals" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Awaiting finance</div>
          <div className="value" style={{ color: pendingFinanceCount ? DASH_COLORS.warning : undefined }}>
            {pendingFinanceCount}
          </div>
        </Link>
        <Link to="/budgets" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Budgets</div>
          <div className="value">{s.budgets ?? 0}</div>
        </Link>
        <Link to="/budgets" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Total allocated</div>
          <div className="value">{formatMoney(s.totalAllocated)}</div>
        </Link>
        <Link to="/budgets?filter=disbursed" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Total paid</div>
          <div className="value">{formatMoney(s.totalPaid)}</div>
        </Link>
        <Link to="/budgets" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Remaining</div>
          <div className="value">
            {formatMoney(Math.max(0, Number(s.totalAllocated || 0) - Number(s.totalPaid || 0)))}
          </div>
        </Link>
        <Link to="/budgets" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Utilization</div>
          <div className="value">{s.utilizationPercent ?? 0}%</div>
        </Link>
        <Link to="/grants?filter=active" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Active grants</div>
          <div className="value">{s.activeGrants ?? 0}</div>
        </Link>
        <Link to="/grants?filter=awarded" className="overviewTile" style={{ textDecoration: "none" }}>
          <div className="label">Awarded total</div>
          <div className="value">{formatMoney(s.awardedTotal)}</div>
        </Link>
      </div>

      <section className="dashChartsRow">
        <div className="dashCard dashChartCard">
          <div className="dashCardTitle">Budget item status</div>
          <div className="dashChartBlock">
            <div className="dashChartPlot">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={utilizationPie} innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                    {utilizationPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={DASH_CHART_TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dashChartLegend">
              {utilizationPie.map((entry, i) => (
                <span key={entry.name} className="dashLegendItem">
                  <span className="dashLegendDot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="dashLegendName">{entry.name}</span>
                  <strong className="dashLegendValue">{entry.value}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="dashCard dashChartCard">
          <div className="dashCardTitle">Grants by status</div>
          <div className="dashChartBlock">
            <div className="dashChartPlot dashChartPlotBars">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={grantBars} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                  <XAxis type="number" tick={DASH_AXIS_TICK} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={{ ...DASH_AXIS_TICK, fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={DASH_CHART_TOOLTIP} />
                  <Bar dataKey="value" fill={DASH_COLORS.accent} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="dashCard dashChartCard">
          <div className="dashCardTitle">Key finance metrics</div>
          <div className="metricList">
            <div className="metricRow">
              <span>💰 Active grant funds</span>
              <strong>{formatMoney(s.awardedTotal)}</strong>
            </div>
            <div className="metricRow">
              <span>📊 Total budgets</span>
              <strong>{s.budgets ?? 0}</strong>
            </div>
            <div className="metricRow">
              <span>🧾 Allocated</span>
              <strong>{formatMoney(s.totalAllocated)}</strong>
            </div>
            <div className="metricRow">
              <span>✅ Paid out</span>
              <strong>{formatMoney(s.totalPaid)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashGrid">
        <div className="dashCard dashSpan8">
          <div className="dashCardTitle">Recent budget items</div>
          <table className="dashTable">
            <thead>
              <tr>
                <th>Budget</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(report.budgetItems || []).slice(0, 8).map((i, idx) => (
                <tr key={idx}>
                  <td>{i.budgetTitle}</td>
                  <td>{i.description || "—"}</td>
                  <td>{i.type || "—"}</td>
                  <td>{formatMoney(i.amount)}</td>
                  <td>{i.status}</td>
                </tr>
              ))}
              {(report.budgetItems || []).length === 0 ? (
                <tr><td colSpan={5} className="muted">No budget items yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="dashCard dashSpan4">
          <div className="dashCardTitle">Grants overview</div>
          <div style={{ display: "grid", gap: 8 }}>
            {(report.grantSummary || []).slice(0, 6).map((g, i) => (
              <div key={i} className="metricRow">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{g.title}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{g.fundingSource || "—"} • {g.status}</div>
                </div>
                <strong>{formatMoney(g.amountAwarded)}</strong>
              </div>
            ))}
            {(report.grantSummary || []).length === 0 ? <span className="muted">No grants yet.</span> : null}
          </div>
        </div>
      </section>

      <div className="dashboardQuickLinks">
        <Link className="btn primary" to="/finance/reviews">
          Proposal finance review
        </Link>
        <Link className="btn" to="/finance/grant-approvals">
          Grant funding approval
        </Link>
        <Link className="btn" to="/budgets">
          Open Finance &amp; Budgets
        </Link>
        <Link className="btn" to="/finance/closures">
          Project closure
        </Link>
        <Link className="btn" to="/grants?filter=pending_finance">
          Grants pending finance
        </Link>
      </div>
    </div>
  );
}
