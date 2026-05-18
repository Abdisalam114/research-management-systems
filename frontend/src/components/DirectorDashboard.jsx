import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";
import "../pages/dashboard.css";

const PIE_COLORS = ["#0ea5e9", "#334155"];

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export function DirectorDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const res = await analyticsApi.institutionalAnalytics(accessToken);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Failed to load institutional dashboard");
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [accessToken]);

  const pieData = useMemo(() => {
    if (!data) return [];
    const { active, completed } = data.projectStatus;
    return [
      { name: "Active", value: active },
      { name: "Completed", value: completed },
    ];
  }, [data]);

  const outputBars = useMemo(() => {
    if (!data) return [];
    const t = data.researchOutput.byType;
    return [
      { name: "Journal", value: t.journal },
      { name: "Conference", value: t.conference },
      { name: "Patents", value: t.patent },
    ];
  }, [data]);

  if (error) {
    return (
      <div className="card" style={{ borderColor: "rgba(239, 68, 68, 0.5)" }}>
        {error}
      </div>
    );
  }

  if (!data) return <div>Loading institutional dashboard…</div>;

  return (
    <div>
      <div className="overviewGrid">
        {[
          ["Proposals", data.overview.proposals, "/proposals"],
          ["Projects", data.overview.projects, "/projects"],
          ["Publications", data.overview.publications, "/publications"],
          ["Budgets", data.overview.budgets, "/budgets"],
          ["Repository", data.overview.repository, "/repository"],
          ["Groups", data.overview.groups, "/groups"],
        ].map(([label, value, to]) => (
          <Link key={label} to={to} className="overviewTile" style={{ textDecoration: "none" }}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </Link>
        ))}
      </div>

      <div className="dashChartsRow">
        <div className="dashCard">
          <div className="dashCardTitle">Project Status</div>
          <div style={{ height: 200, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 22,
                color: "var(--rms-accent)",
              }}
            >
              {data.projectStatus.activePercent}% Active
            </div>
          </div>
          <div className="dashStatRow">
            <span>
              Total <strong>{data.projectStatus.total}</strong>
            </span>
            <span>
              Active <strong>{data.projectStatus.active}</strong>
            </span>
            <span>
              Done <strong>{data.projectStatus.completed}</strong>
            </span>
          </div>
        </div>

        <div className="dashCard">
          <div className="dashCardTitleRow">
            <div className="dashCardTitle">Grant Funding Trends</div>
            <span className="muted" style={{ fontWeight: 600 }}>
              ACTIVE FUNDS: {formatMoney(data.grantFunding.activeFunds)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.grantFunding.trends}>
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                }}
              />
              <Line type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="dashCard">
          <div className="dashCardTitle">Research Output</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart layout="vertical" data={outputBars} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="dashStatRow">
            <span>
              Pubs <strong>{data.researchOutput.publications}</strong>
            </span>
            <span>
              Citations <strong>{data.researchOutput.citations}</strong>
            </span>
            <span>
              Patents <strong>{data.researchOutput.patents}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="dashGrid">
        <div className="dashCard dashSpan8">
          <div className="dashCardTitle">Active Projects</div>
          <table className="dashTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Principal Investigator</th>
                <th>Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.activeProjects.map((p) => (
                <tr key={p.id + p.title}>
                  <td>{p.id}</td>
                  <td>{p.title}</td>
                  <td>{p.principalInvestigator}</td>
                  <td style={{ minWidth: 120 }}>
                    <div className="progressBar">
                      <span style={{ width: `${p.progressPercent}%` }} />
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {p.progressPercent}%
                    </span>
                  </td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dashSpan4 dashSideCol">
          <div className="dashCard">
            <div className="dashCardTitle">Recent Activity</div>
            {data.recentActivity.map((a, i) => (
              <div key={i} className="activityItem">
                <span>📌</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.title}</div>
                  <div className="muted">
                    {a.type} • {a.subtitle}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="dashCard">
            <div className="dashCardTitle">Key Metrics</div>
            <div className="metricList">
              <div className="metricRow">
                <span>💰 Active Grants</span>
                <strong>{formatMoney(data.keyMetrics.activeGrantsValue)}</strong>
              </div>
              <div className="metricRow">
                <span>🔬 Ongoing Studies</span>
                <strong>{data.keyMetrics.ongoingStudies}</strong>
              </div>
              <div className="metricRow">
                <span>👥 Researchers</span>
                <strong>{data.keyMetrics.researchers}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "right" }}>
        <Link className="btn primary" to="/analytics">
          View full analytics →
        </Link>
      </div>
    </div>
  );
}
