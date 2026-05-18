import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../services/analyticsApi";
import "./dashboard.css";

export function AnalyticsDashboardPage() {
  const { accessToken, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const isDirector = user?.role === "research_director";

  useEffect(() => {
    if (!isDirector) return undefined;
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const res = await analyticsApi.institutionalAnalytics(accessToken);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || "Failed to load analytics");
      }
    }
    load();
    const t = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [accessToken, isDirector]);

  if (!isDirector) {
    return (
      <div className="card">
        <div style={{ fontWeight: 800 }}>Institutional analytics</div>
        <p className="muted" style={{ marginTop: 8 }}>
          This report is available to the Research Director only.
        </p>
        <Link className="btn primary" to="/dashboard" style={{ marginTop: 12, display: "inline-block" }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (error) {
    return <div className="card" style={{ borderColor: "rgba(239,68,68,0.5)" }}>{error}</div>;
  }

  if (!data) return <p className="muted">Loading institutional analytics…</p>;

  const budgetChart = [
    { name: "Pending", value: data.budgets.itemsPending },
    { name: "Approved", value: data.budgets.itemsApproved },
    { name: "Paid", value: data.budgets.itemsPaid },
  ];

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Institutional overview — publications, projects, budgets, repository & groups
      </p>

      <div className="overviewGrid">
        {[
          ["Proposals", data.overview.proposals],
          ["Projects", data.overview.projects],
          ["Grants", data.overview.grants],
          ["Budgets", data.overview.budgets],
          ["Publications", data.overview.publications],
          ["Repository", data.overview.repository],
          ["Groups", data.overview.groups],
        ].map(([label, value]) => (
          <div key={label} className="overviewTile">
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>

      <div className="dashGrid" style={{ marginTop: 16 }}>
        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">Budget workflow</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetChart}>
              <XAxis dataKey="name" tick={{ fill: "#94a3b8" }} />
              <YAxis tick={{ fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">Research groups</div>
          <div style={{ display: "grid", gap: 8 }}>
            {data.groups.map((g) => (
              <div key={g.id} className="metricRow">
                <span>{g.name}</span>
                <strong>{g.members} members</strong>
              </div>
            ))}
            {data.groups.length === 0 ? <span className="muted">No groups yet.</span> : null}
          </div>
        </div>

        <div className="dashCard dashSpan6">
          <div>
            <div className="dashCardTitle">Recent publications</div>
            <table className="dashTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Year</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.publications.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.type}</td>
                    <td>{p.year}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">Repository uploads</div>
          <div style={{ display: "grid", gap: 8 }}>
            {data.repository.map((r) => (
              <div key={r._id} className="activityItem">
                <span>🗄️</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div className="muted">
                    {r.type} • {r.access}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link className="btn" to="/dashboard">
          ← Dashboard
        </Link>
      </div>
    </>
  );
}
