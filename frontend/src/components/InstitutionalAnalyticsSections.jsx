import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { DASH_AXIS_TICK, DASH_CHART_TOOLTIP, DASH_COLORS } from "../constants/dashboardTheme";

export function InstitutionalAnalyticsSections({ data }) {
  if (!data) return null;

  const budgetChart = [
    { name: "Pending", value: data.budgets.itemsPending },
    { name: "Approved", value: data.budgets.itemsApproved },
    { name: "Paid", value: data.budgets.itemsPaid },
  ];

  const groupPreview = data.preview?.groups;
  const pubPreview = data.preview?.publications;
  const repoPreview = data.preview?.repository;

  return (
    <section id="institutional-analytics" className="dashAnalyticsSection">
      <h2 className="dashSectionTitle">Institutional analytics</h2>
      <p className="muted dashSectionSub">
        Budget workflow, research groups, publications, and repository — counts from database; tables show the most recent records.
      </p>

      {data.kpiMetrics ? (
        <div className="dashGrid" style={{ marginTop: 12 }}>
          {[
            { label: "Grant success rate", value: `${data.kpiMetrics.grantSuccessRate}%` },
            { label: "Proposal approval rate", value: `${data.kpiMetrics.proposalApprovalRate}%` },
            { label: "Open funding calls", value: data.kpiMetrics.openFundingCalls },
            { label: "Pending finance grants", value: data.kpiMetrics.pendingFinanceGrants },
            { label: "Projects closing", value: data.kpiMetrics.projectsClosing },
            { label: "Projects archived", value: data.kpiMetrics.projectsClosed },
          ].map((k) => (
            <div key={k.label} className="dashCard dashSpan4">
              <div className="muted" style={{ fontSize: 12 }}>{k.label}</div>
              <div style={{ fontWeight: 900, fontSize: 22 }}>{k.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="dashGrid" style={{ marginTop: 12 }}>
        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">Budget workflow</div>
          <div className="dashChartPlot">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ ...DASH_AXIS_TICK, fontSize: 11 }} />
                <YAxis tick={{ ...DASH_AXIS_TICK, fontSize: 11 }} width={36} />
                <Tooltip contentStyle={DASH_CHART_TOOLTIP} />
                <Bar dataKey="value" fill={DASH_COLORS.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">
            Research groups
            {groupPreview ? ` (${groupPreview.shown} of ${groupPreview.total})` : ""}
          </div>
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
          <div className="dashCardTitle">
            Recent publications
            {pubPreview ? ` (${pubPreview.shown} of ${pubPreview.total})` : ""}
          </div>
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
              {data.publications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No publications yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">
            Repository uploads
            {repoPreview ? ` (${repoPreview.shown} of ${repoPreview.total})` : ""}
          </div>
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
            {data.repository.length === 0 ? <span className="muted">No repository items yet.</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
