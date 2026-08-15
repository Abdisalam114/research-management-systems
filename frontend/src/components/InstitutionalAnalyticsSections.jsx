import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { DashChart } from "./DashChart";
import { DASH_AXIS_TICK, DASH_CHART_TOOLTIP, DASH_COLORS } from "../constants/dashboardTheme";

export function InstitutionalAnalyticsSections({ data }) {
  if (!data) return null;

  const budgets = data.budgets || { itemsPending: 0, itemsApproved: 0, itemsPaid: 0 };
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const publications = Array.isArray(data.publications) ? data.publications : [];
  const repository = Array.isArray(data.repository) ? data.repository : [];

  const budgetChart = [
    { name: "Pending", value: Number(budgets.itemsPending) || 0 },
    { name: "Approved", value: Number(budgets.itemsApproved) || 0 },
    { name: "Paid", value: Number(budgets.itemsPaid) || 0 },
  ];

  const groupPreview = data.preview?.groups;
  const pubPreview = data.preview?.publications;
  const repoPreview = data.preview?.repository;

  return (
    <section id="institutional-analytics" className="dashAnalyticsSection">
      <h2 className="dashSectionTitle">Institutional analytics</h2>
      <p className="muted dashSectionSub">
        Budget workflow, research groups, publications, and repository — counts from database; tables show the most
        recent records.
      </p>

      {data.kpiMetrics ? (
        <div className="dashGrid" style={{ marginTop: 12 }}>
          {[
            { label: "Grant success rate", value: `${data.kpiMetrics.grantSuccessRate ?? 0}%` },
            { label: "Proposal approval rate", value: `${data.kpiMetrics.proposalApprovalRate ?? 0}%` },
            { label: "Open funding calls", value: data.kpiMetrics.openFundingCalls ?? 0 },
            { label: "Pending finance grants", value: data.kpiMetrics.pendingFinanceGrants ?? 0 },
            { label: "Projects closing", value: data.kpiMetrics.projectsClosing ?? 0 },
            { label: "Projects archived", value: data.kpiMetrics.projectsClosed ?? 0 },
          ].map((k) => (
            <div key={k.label} className="dashCard dashSpan4">
              <div className="muted" style={{ fontSize: 12 }}>
                {k.label}
              </div>
              <div style={{ fontWeight: 900, fontSize: 22 }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="dashGrid" style={{ marginTop: 12 }}>
        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">Budget workflow</div>
          <div className="dashChartPlot">
            <DashChart>
              <BarChart data={budgetChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ ...DASH_AXIS_TICK, fontSize: 11 }} />
                <YAxis tick={{ ...DASH_AXIS_TICK, fontSize: 11 }} width={36} />
                <Tooltip contentStyle={DASH_CHART_TOOLTIP} />
                <Bar dataKey="value" fill={DASH_COLORS.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </DashChart>
          </div>
        </div>

        <div className="dashCard dashSpan6">
          <div className="dashCardTitle">
            Research groups
            {groupPreview ? ` (${groupPreview.shown} of ${groupPreview.total})` : ""}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {groups.map((g) => (
              <div key={g.id} className="metricRow">
                <span>{g.name}</span>
                <strong>{g.members} members</strong>
              </div>
            ))}
            {groups.length === 0 ? <span className="muted">No groups yet.</span> : null}
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
              {publications.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.type}</td>
                  <td>{p.year}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
              {publications.length === 0 ? (
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
            {repository.map((r) => (
              <div key={r._id || r.id} className="activityItem">
                <span>🗄️</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.title}</div>
                  <div className="muted">
                    {r.type} • {r.access}
                  </div>
                </div>
              </div>
            ))}
            {repository.length === 0 ? <span className="muted">No repository items yet.</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
