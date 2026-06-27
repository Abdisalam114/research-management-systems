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
import { InstitutionalAnalyticsSections } from "./InstitutionalAnalyticsSections";
import { FacultyAnalyticsSection } from "./FacultyAnalyticsSection";
import { ActiveProjectsPanel } from "./ActiveProjectsPanel";
import { MetricProvenanceBar } from "./MetricProvenanceBar";
import { SystemModulesGrid } from "./SystemModulesGrid";
import "../pages/dashboard.css";

const PIE_COLORS = ["#0ea5e9", "#334155", "#f59e0b"];

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export function DirectorDashboard() {
  const { accessToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  async function handleDownloadAnnualReport() {
    try {
      setDownloadingPdf(true);
      const blob = await analyticsApi.downloadAnnualReportPdf(accessToken);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JUST-RMS-Annual-Report-${data?.annualReport?.year ?? new Date().getFullYear()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to download annual report PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  useEffect(() => {
    if (!data || window.location.hash !== "#institutional-analytics") return;
    document.getElementById("institutional-analytics")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);


  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const res = await analyticsApi.institutionalAnalytics(accessToken);
        if (!cancelled) {
          setData(res);
          // #region agent log
          fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
            body: JSON.stringify({
              sessionId: "6113cc",
              location: "DirectorDashboard.jsx:load",
              message: "director active projects rendered",
              data: {
                totalActive: res?.projectStatus?.active,
                tableLength: res?.activeProjects?.length ?? 0,
                titles: (res?.activeProjects || []).map((p) => p.title),
              },
              timestamp: Date.now(),
              hypothesisId: "C",
              runId: "active-projects",
            }),
          }).catch(() => {});
          // #endregion
        }
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
    const { active, completed, onHold } = data.projectStatus;
    const slices = [
      { name: "Active", value: active },
      { name: "Completed", value: completed },
    ];
    if (onHold > 0) slices.push({ name: "On hold", value: onHold });
    return slices.filter((s) => s.value > 0);
  }, [data]);

  const outputBars = useMemo(() => {
    if (!data) return [];
    const t = data.researchOutput.byType || {};
    return [
      { name: "Papers", value: t.paper || 0 },
      { name: "Conference", value: t.conference || 0 },
      { name: "Review", value: t.review || 0 },
      { name: "Case studies", value: t.case_study || 0 },
      { name: "Letter", value: t.letter_to_editor || 0 },
      { name: "Journal", value: t.journal_article || 0 },
      { name: "Books", value: (t.book || 0) + (t.book_chapter || 0) },
      { name: "Patents", value: t.patent || 0 },
      { name: "Thesis", value: t.thesis || 0 },
      { name: "Community", value: t.community_research_impact || 0 },
    ];
  }, [data]);

  if (error) {
    return (
      <div className="dashboardPage">
        <div className="card" style={{ borderColor: "rgba(239, 68, 68, 0.5)" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="dashboardLoading">Loading institutional dashboard…</div>;

  const topFaculty = (data.facultyAnalytics || []).slice(0, 1)[0];

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <h1 className="dashPageTitle">Institutional Dashboard</h1>
        <p className="dashPageSub">All Jamhuriya RMS modules — live, consistent counts across the system.</p>
      </header>

      <section className="dashboardSection">
        <SystemModulesGrid
          role="research_director"
          overview={data.overview}
          title="System modules"
        />
      </section>

      <MetricProvenanceBar data={data} />

      <section className="dashboardKpiStrip">
        <div className="dashboardKpiItem">
          <div className="dashboardKpiLabel">🏆 Grant success rate</div>
          <div className="dashboardKpiValue">{data.grantSuccessRate ?? 0}%</div>
        </div>
        <div className="dashboardKpiItem">
          <div className="dashboardKpiLabel">💰 Funding awarded</div>
          <div className="dashboardKpiValue">{formatMoney(data.keyMetrics.activeGrantsValue)}</div>
        </div>
        <div className="dashboardKpiItem">
          <div className="dashboardKpiLabel">📚 Total citations</div>
          <div className="dashboardKpiValue">{data.researchOutput.citations.toLocaleString()}</div>
        </div>
        <div className="dashboardKpiItem">
          <div className="dashboardKpiLabel">🥇 Top faculty (pubs)</div>
          <div className="dashboardKpiValue dashboardKpiValueSm">
            {topFaculty ? `${topFaculty.department} (${topFaculty.publications})` : "—"}
          </div>
        </div>
        <div className="dashboardKpiAction">
          <button
            type="button"
            className="btn primary"
            onClick={handleDownloadAnnualReport}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? "Generating PDF…" : "📄 Annual report (PDF)"}
          </button>
        </div>
      </section>

      <section className="dashChartsRow">
        <div className="dashCard dashChartCard">
          <div className="dashCardTitle">Project Status</div>
          <div className="dashChartBlock">
            <div className="dashChartPlot">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dashPieSummary">
              <span className="dashPiePercent">{data.projectStatus.activePercent}%</span>
              <span className="dashPiePercentLabel">Active projects</span>
            </div>
            <div className="dashChartLegend">
              {pieData.map((entry, i) => (
                <span key={entry.name} className="dashLegendItem">
                  <span className="dashLegendDot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="dashLegendName">{entry.name}</span>
                  <strong className="dashLegendValue">{entry.value}</strong>
                </span>
              ))}
            </div>
            <div className="dashStatRow dashStatRowSplit">
              <span>
                Total <strong>{data.projectStatus.total}</strong>
              </span>
              <span>
                Active <strong>{data.projectStatus.active}</strong>
              </span>
              <span>
                Done <strong>{data.projectStatus.completed}</strong>
              </span>
              {data.projectStatus.onHold > 0 ? (
                <span>
                  On hold <strong>{data.projectStatus.onHold}</strong>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="dashCard dashChartCard">
          <div className="dashCardTitle">Grant Funding Trends</div>
          <div className="dashChartBlock">
            <div className="dashChartMeta">
              <span className="dashChartMetaLabel">Active funds</span>
              <span className="dashChartMetaValue">{formatMoney(data.grantFunding.activeFunds)}</span>
            </div>
            <div className="dashChartPlot">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.grantFunding.trends} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={44} />
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
          </div>
        </div>

        <div className="dashCard dashChartCard">
          <div className="dashCardTitle">Research Output</div>
          <div className="dashChartBlock">
            <div className="dashChartPlot dashChartPlotBars">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={outputBars} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={84}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                    }}
                  />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="dashStatRow dashStatRowSplit">
              <span>
                Pubs <strong>{data.researchOutput.publications}</strong>
              </span>
              <span>
                Citations <strong>{data.researchOutput.citations}</strong>
              </span>
              <span>
                Papers <strong>{data.researchOutput.papers ?? 0}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashGrid dashGridProjectsRow">
        <ActiveProjectsPanel
          projects={data.activeProjects}
          totalActive={data.projectStatus.active}
          previewMeta={data.preview?.activeProjects}
        />

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
                <span>🏆 Grant success rate</span>
                <strong>{data.grantSuccessRate ?? 0}%</strong>
              </div>
              <div className="metricRow">
                <span>📚 Citations</span>
                <strong>{data.researchOutput.citations.toLocaleString()}</strong>
              </div>
              <div className="metricRow">
                <span>🏛️ Faculties tracked</span>
                <strong>{data.facultyAnalytics?.length ?? 0}</strong>
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
      </section>

      <FacultyAnalyticsSection
        data={data}
        downloading={downloadingPdf}
        onDownloadReport={handleDownloadAnnualReport}
      />
      <InstitutionalAnalyticsSections data={data} />
    </div>
  );
}
