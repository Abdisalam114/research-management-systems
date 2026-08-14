import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";
import { ResearchJourneyPanel } from "../components/ResearchJourneyPanel";
import { PageHeader } from "../components/PageHeader";
import * as analyticsApi from "../services/analyticsApi";
import { FACULTY_WORKFLOW_STAGES } from "../constants/facultyWorkflow";

const TABS = [
  { id: "ops", label: "All jobs (ops board)" },
  { id: "lifecycle", label: "Lifecycle per researcher" },
  { id: "publications", label: "Publication pipeline" },
];

export function ResearchWorkflowPage() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const urlFilter = searchParams.get("filter") || "";
  const workflowStageIds = FACULTY_WORKFLOW_STAGES.map((s) => s.id);
  const tabFromUrl = searchParams.get("tab");
  const tab = TABS.some((t) => t.id === tabFromUrl)
    ? tabFromUrl
    : workflowStageIds.includes(urlFilter)
      ? "publications"
      : "ops";
  const canManage = ["faculty_coordinator", "research_director"].includes(user?.role);
  const departmentLabel =
    user?.role === "research_director"
      ? "All faculties"
      : user?.role === "researcher"
        ? "My research"
        : user?.department;

  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab !== "ops") return;
    setLoading(true);
    setError("");
    analyticsApi
      .workflowOverview(accessToken)
      .then(setOverview)
      .catch((e) => setError(e?.response?.data?.message || "Failed to load workflow overview"))
      .finally(() => setLoading(false));
  }, [accessToken, programTier, tab]);

  function setTab(next) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", next);
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <div>
      <PageHeader
        title="Research Workflow"
        subtitle="Full institutional pipeline: proposals → ethics → review → projects → grants/finance → publications → thesis. Use tabs below."
        actions={
          <>
            <Link className="btn" to="/projects">
              Projects
            </Link>
            <Link className="btn" to="/proposals">
              Proposals
            </Link>
            <Link className="btn" to="/publications">
              Publications
            </Link>
            {projectIdFromUrl ? (
              <Link className="btn" to={`/projects/${projectIdFromUrl}`}>
                Open project
              </Link>
            ) : null}
          </>
        }
      />

      <div className="btnGroup" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn${tab === t.id ? " primary" : ""}`}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ops" ? (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            Live queues across every major job in the portal
            {overview?.scope ? ` (${overview.scope})` : ""}. Click a card or item to open the module.
          </p>
          {error ? (
            <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
              {error}
            </div>
          ) : null}
          {loading && !overview ? <p className="muted">Loading workflow board…</p> : null}
          {overview ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {Object.entries(overview.totals || {}).map(([k, v]) => (
                  <div key={k} className="card" style={{ padding: 12 }}>
                    <div className="muted" style={{ fontSize: 12, textTransform: "capitalize" }}>
                      {k}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {(overview.stages || []).map((stage) => (
                  <div key={stage.key} className="card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 800 }}>{stage.label}</div>
                      <div style={{ fontWeight: 800, color: "#38bdf8" }}>{stage.count}</div>
                    </div>
                    <Link className="btn sm" to={stage.link} style={{ marginTop: 10 }}>
                      Open module
                    </Link>
                    <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none" }}>
                      {(stage.items || []).length === 0 ? (
                        <li className="muted" style={{ fontSize: 13 }}>
                          No open items
                        </li>
                      ) : (
                        stage.items.map((item) => (
                          <li key={item.id} className="workflowItemRow">
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                              <div style={{ fontWeight: 700 }}>{item.title}</div>
                              <span className="muted">{item.status}</span>
                            </div>
                            <Link className="btn sm primary" to={item.link}>
                              Open
                            </Link>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "lifecycle" ? <ResearchJourneyPanel /> : null}

      {tab === "publications" ? (
        <FacultyResearchWorkflowModule
          accessToken={accessToken}
          departmentLabel={departmentLabel}
          canManage={canManage}
          embedded
          projectId={projectIdFromUrl}
        />
      ) : null}
    </div>
  );
}
