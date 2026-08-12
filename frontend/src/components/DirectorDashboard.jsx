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
import { useProgramTier } from "../hooks/useProgramTier";
import * as analyticsApi from "../services/analyticsApi";
import * as proposalApi from "../services/proposalApi";
import { InstitutionalAnalyticsSections } from "./InstitutionalAnalyticsSections";
import { FacultyAnalyticsSection } from "./FacultyAnalyticsSection";
import { ActiveProjectsPanel } from "./ActiveProjectsPanel";
import { MetricProvenanceBar } from "./MetricProvenanceBar";
import { SystemModulesGrid } from "./SystemModulesGrid";
import { StatusBadge } from "./StatusBadge";
import { triggerBlobDownload } from "../utils/downloadBlob";
import { scrollElementIntoAppView } from "../utils/scrollContainer";
import {
  DASH_AXIS_TICK,
  DASH_CHART_TOOLTIP,
  DASH_COLORS,
  DASH_ERROR_BORDER,
  DASH_PIE,
} from "../constants/dashboardTheme";
import "../pages/dashboard.css";

const PIE_COLORS = DASH_PIE;

function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export function DirectorDashboard() {
  const { accessToken } = useAuth();
  const { programTier, programTierLabel } = useProgramTier();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [peerQueue, setPeerQueue] = useState([]);
  const [peerSummary, setPeerSummary] = useState({ total: 0, awaiting: 0, received: 0 });

  async function handleDownloadAnnualReport() {
    try {
      setDownloadingPdf(true);
      const blob = await analyticsApi.downloadAnnualReportPdf(accessToken);
      triggerBlobDownload(
        blob,
        `JUST-RMS-Annual-Report-${data?.annualReport?.year ?? new Date().getFullYear()}.pdf`
      );
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to download annual report PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  useEffect(() => {
    if (!data || window.location.hash !== "#institutional-analytics") return;
    scrollElementIntoAppView(document.getElementById("institutional-analytics"), { behavior: "smooth", block: "start", offset: 88 });
  }, [data]);


  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        const [res, peer] = await Promise.all([
          analyticsApi.institutionalAnalytics(accessToken),
          proposalApi.listMyReviewAssignments(accessToken).catch(() => ({ assignments: [], summary: null })),
        ]);
        if (!cancelled) {
          const list = peer.assignments || [];
          const summary = peer.summary || {
            total: list.length,
            awaiting: list.filter((a) => a.awaitingLeadership || (a.pendingReviewers || 0) > 0).length,
            received: list.filter((a) => !(a.awaitingLeadership || (a.pendingReviewers || 0) > 0)).length,
          };
          // Single source of truth: Peer Reviews tile = listMyReviewAssignments count
          const aligned = {
            ...res,
            proposalsSentToReviewers: summary.total,
            overview: {
              ...(res.overview || {}),
              modules: {
                ...(res.overview?.modules || {}),
                reviews: summary.total,
              },
            },
          };
          setData(aligned);
          setPeerQueue(list);
          setPeerSummary(summary);
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
  }, [accessToken, programTier]);

  const pieData = useMemo(() => {
    if (!data?.projectStatus) return [];
    const { active = 0, completed = 0, onHold = 0 } = data.projectStatus;
    const slices = [
      { name: "Active", value: active },
      { name: "Completed", value: completed },
    ];
    if (onHold > 0) slices.push({ name: "On hold", value: onHold });
    return slices.filter((s) => s.value > 0);
  }, [data]);

  const outputBars = useMemo(() => {
    if (!data?.researchOutput) return [];
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
        <div className="card" style={{ borderColor: DASH_ERROR_BORDER }}>
          {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="dashboardLoading">Loading institutional dashboard…</div>;

  const topFaculty = (data.facultyAnalytics || []).slice(0, 1)[0];
  const projectStatus = data.projectStatus || {
    total: 0,
    active: 0,
    completed: 0,
    onHold: 0,
    activePercent: 0,
  };
  const researchOutput = data.researchOutput || { publications: 0, papers: 0, byType: {} };
  const grantFunding = data.grantFunding || { activeFunds: 0, trends: [] };
  const keyMetrics = data.keyMetrics || {
    activeGrantsValue: 0,
    ongoingStudies: 0,
    researchers: 0,
  };
  const recentActivity = Array.isArray(data.recentActivity) ? data.recentActivity : [];

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <h1 className="dashPageTitle">Institutional Dashboard</h1>
        <p className="dashPageSub">
          Live module counts for the{" "}
          <strong>{programTierLabel || programTier || "selected"}</strong> portal — proposals, peer reviews,
          projects, funding, and outputs.
        </p>
      </header>

      <section className="dashboardSection">
        <SystemModulesGrid
          role="research_director"
          overview={data.overview}
          title="System modules"
        />
      </section>

      <section className="dashboardSection">
        <div className="dashboardSectionTitle">Peer Reviews — awaiting Leadership</div>
        <div className="card" style={{ marginTop: 8 }}>
          <p style={{ marginTop: 0, fontSize: 14 }}>
            <strong>{peerSummary.total}</strong> awaiting Leadership review
            {peerSummary.awaiting !== peerSummary.total ? (
              <>
                {" "}
                · <strong style={{ color: "#fbbf24" }}>{peerSummary.awaiting}</strong> still pending
              </>
            ) : null}
            {data.overview?.modules?.reviews != null ? (
              <span className="muted"> · Tile: {data.overview.modules.reviews}</span>
            ) : null}
          </p>
          {peerQueue.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0, fontSize: 14 }}>
              No proposals awaiting Leadership. After peer review completes, continue on the proposal Review page (committee).
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {peerQueue.map((a) => {
                const awaiting = a.awaitingLeadership || (a.pendingReviewers || 0) > 0;
                const names = (a.assignedReviewers || [])
                  .map((r) => r.fullName || r.email)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                      paddingBottom: 8,
                      borderBottom: "1px solid rgba(148,163,184,0.2)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{a.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Sent to reviewer{names ? `: ${names}` : ""} ·{" "}
                        <span style={{ color: "#fbbf24", fontWeight: 600 }}>Awaiting Leadership</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <StatusBadge status={a.status} />
                      <Link className="btn primary" to={`/proposals/${a.id}/review`}>
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link className="btn" to="/review-assignments" style={{ marginTop: 12, display: "inline-block" }}>
            Open Peer Reviews
          </Link>
        </div>
      </section>

      <MetricProvenanceBar data={data} />

      <section className="dashboardKpiStrip">
        <div className="dashboardKpiItem">
          <div className="dashboardKpiLabel">🏆 Grant success rate</div>
          <div className="dashboardKpiValue">{data.grantSuccessRate ?? 0}%</div>
        </div>
        <div className="dashboardKpiItem">
          <div className="dashboardKpiLabel">💰 Funding awarded</div>
          <div className="dashboardKpiValue">{formatMoney(keyMetrics.activeGrantsValue)}</div>
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
              {pieData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="muted" style={{ padding: 24, textAlign: "center" }}>
                  No project status data yet.
                </div>
              )}
            </div>
            <div className="dashPieSummary">
              <span className="dashPiePercent">{projectStatus.activePercent ?? 0}%</span>
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
                Total <strong>{projectStatus.total}</strong>
              </span>
              <span>
                Active <strong>{projectStatus.active}</strong>
              </span>
              <span>
                Done <strong>{projectStatus.completed}</strong>
              </span>
              {projectStatus.onHold > 0 ? (
                <span>
                  On hold <strong>{projectStatus.onHold}</strong>
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
              <span className="dashChartMetaValue">{formatMoney(grantFunding.activeFunds || 0)}</span>
            </div>
            <div className="dashChartPlot">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={grantFunding.trends || []} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <XAxis dataKey="month" tick={DASH_AXIS_TICK} interval="preserveStartEnd" />
                  <YAxis tick={DASH_AXIS_TICK} width={44} />
                  <Tooltip contentStyle={DASH_CHART_TOOLTIP} />
                  <Line type="monotone" dataKey="amount" stroke={DASH_COLORS.accent} strokeWidth={2} dot={false} />
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
                  <XAxis type="number" tick={DASH_AXIS_TICK} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={84}
                    tick={{ ...DASH_AXIS_TICK, fontSize: 11 }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={DASH_CHART_TOOLTIP} />
                  <Bar dataKey="value" fill={DASH_COLORS.accent} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="dashStatRow dashStatRowSplit">
              <span>
                Pubs <strong>{researchOutput.publications}</strong>
              </span>
              <span>
                Papers <strong>{researchOutput.papers ?? 0}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashGrid dashGridProjectsRow">
        <ActiveProjectsPanel
          projects={data.activeProjects || []}
          totalActive={projectStatus.active}
          previewMeta={data.preview?.activeProjects}
        />

        <div className="dashSpan4 dashSideCol">
          <div className="dashCard">
            <div className="dashCardTitle">Recent Activity</div>
            {recentActivity.length === 0 ? (
              <div className="muted">No recent activity.</div>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="activityItem">
                  <span>📌</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div className="muted">
                      {a.type} • {a.subtitle}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dashCard">
            <div className="dashCardTitle">Key Metrics</div>
            <div className="metricList">
              <div className="metricRow">
                <span>💰 Active Grants</span>
                <strong>{formatMoney(keyMetrics.activeGrantsValue)}</strong>
              </div>
              <div className="metricRow">
                <span>🏆 Grant success rate</span>
                <strong>{data.grantSuccessRate ?? 0}%</strong>
              </div>
              <div className="metricRow">
                <span>🏛️ Faculties tracked</span>
                <strong>{data.facultyAnalytics?.length ?? 0}</strong>
              </div>
              <div className="metricRow">
                <span>🔬 Ongoing Studies</span>
                <strong>{keyMetrics.ongoingStudies}</strong>
              </div>
              <div className="metricRow">
                <span>👥 Researchers</span>
                <strong>{keyMetrics.researchers}</strong>
              </div>
              <div className="metricRow">
                <span>✍️ Sent to reviewers (active)</span>
                <strong>{peerSummary.total || data.proposalsSentToReviewers || data.overview?.modules?.reviews || 0}</strong>
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
