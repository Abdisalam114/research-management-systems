import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { FacultyResearchWorkflowModule } from "../components/FacultyResearchWorkflowModule";
import { ResearchJourneyPanel } from "../components/ResearchJourneyPanel";
import { PageHeader } from "../components/PageHeader";
import * as analyticsApi from "../services/analyticsApi";

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
  const tab = searchParams.get("tab") || "ops";
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
    setSearchParams(nextParams);
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="btn"
            onClick={() => setTab(t.id)}
            style={
              tab === t.id
                ? { background: "rgba(14,165,233,0.25)", borderColor: "rgba(14,165,233,0.7)" }
                : undefined
            }
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
                    <Link className="btn" to={stage.link} style={{ marginTop: 10, fontSize: 12, padding: "4px 10px" }}>
                      Open module
                    </Link>
                    <ul style={{ margin: "12px 0 0", paddingLeft: 18 }}>
                      {(stage.items || []).length === 0 ? (
                        <li className="muted" style={{ fontSize: 13 }}>
                          No open items
                        </li>
                      ) : (
                        stage.items.map((item) => (
                          <li key={item.id} style={{ marginBottom: 6, fontSize: 13 }}>
                            <Link to={item.link}>{item.title}</Link>
                            <span className="muted"> · {item.status}</span>
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
