import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as publicationApi from "../services/publicationApi";
import { PageHeader } from "./PageHeader";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { statFilterLabel } from "../utils/pageHeaderFilters";
import { FACULTY_WORKFLOW_STAGES, nextWorkflowStage, workflowStageMeta } from "../constants/facultyWorkflow";
import { publicationTypeLabel } from "../constants/publicationTypes";

export function FacultyResearchWorkflowModule({
  accessToken,
  departmentLabel,
  canManage,
  standalone = false,
  embedded = false,
  projectId: projectIdProp = "",
}) {
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = projectIdProp || searchParams.get("projectId") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [internalStageFilter, setInternalStageFilter] = useState(null);
  const [urlStageFilter, setUrlStageFilter] = useUrlStatFilter("all");

  const stageFilter = standalone ? (urlStageFilter === "all" ? null : urlStageFilter) : internalStageFilter;
  const setStageFilter = standalone
    ? (key) => setUrlStageFilter(key || "all")
    : setInternalStageFilter;

  const load = useCallback(async () => {
    const res = await publicationApi.getFacultyWorkflow(
      accessToken,
      projectIdFromUrl ? { projectId: projectIdFromUrl } : {}
    );
    setData(res);
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        runId: "project-hub",
        hypothesisId: "PH1",
        location: "FacultyResearchWorkflowModule.jsx:load",
        message: "Workflow UI — project-linked data only (look unchanged)",
        data: {
          projectIdFromUrl: projectIdFromUrl || null,
          viaProp: Boolean(projectIdProp),
          total: Object.values(res?.counts || {}).reduce((a, b) => a + Number(b || 0), 0),
          stagesWithItems: (res?.stages || []).filter((s) => (s.items || []).length).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [accessToken, projectIdFromUrl, projectIdProp]);

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load faculty workflow"));
  }, [load]);

  async function advance(pub) {
    const next = nextWorkflowStage(pub.workflowStage);
    if (!next) return;
    setBusyId(pub.id);
    setError("");
    try {
      await publicationApi.updateWorkflowStage(accessToken, pub.id, next);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to update workflow");
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const total = FACULTY_WORKFLOW_STAGES.reduce((acc, s) => acc + (data?.counts?.[s.id] ?? 0), 0);
    return [
      { label: "Total in workflow", value: total, filterKey: "all" },
      ...FACULTY_WORKFLOW_STAGES.map((s) => ({
        label: s.label,
        value: data?.counts?.[s.id] ?? 0,
        filterKey: s.id,
        accent: s.accent,
      })),
    ];
  }, [data]);

  const filteredStage = stageFilter ? data?.stages?.find((s) => s.id === stageFilter) : null;

  if (!data && !error) {
    if (embedded) {
      return (
        <div className="card" style={{ marginTop: 16, borderColor: "rgba(56,189,248,0.35)" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Faculty publication workflow</div>
          <p className="muted" style={{ marginTop: 8 }}>Loading publication workflow…</p>
        </div>
      );
    }
    return standalone ? (
      <div>
        <PageHeader
          title="Research Workflow Status"
          subtitle="Track outputs from submission → in process → pipeline → published."
          stats={stats}
          activeFilter={urlStageFilter}
          onFilterChange={setUrlStageFilter}
        />
        <p className="muted">Loading workflow…</p>
      </div>
    ) : (
      <p className="muted">Loading faculty workflow…</p>
    );
  }

  const showStageTiles = !standalone || embedded;
  const listLimit = standalone || embedded ? 20 : 4;

  const body = (
    <>
      {error ? <div style={{ color: "#f87171", marginTop: standalone ? 0 : 8 }}>{error}</div> : null}

      {projectIdFromUrl ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Filtered to project: <strong>{data?.projectFilter?.title || "selected"}</strong> —{" "}
          <Link to="/research-workflow">show all</Link>
        </p>
      ) : null}

      {showStageTiles ? (
        <div className="overviewGrid pubCategoryGrid" style={{ marginTop: 12 }}>
          {(data?.stages || FACULTY_WORKFLOW_STAGES).map((stage) => {
            const meta = workflowStageMeta(stage.id);
            const count = stage.count ?? data?.counts?.[stage.id] ?? 0;
            return (
              <button
                key={stage.id}
                type="button"
                className="overviewTile"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  borderColor: stageFilter === stage.id ? meta.accent : undefined,
                }}
                onClick={() => setStageFilter(stageFilter === stage.id ? null : stage.id)}
              >
                <div className="label">
                  {meta.icon} {stage.label || meta.label}
                </div>
                <div className="value" style={{ color: meta.accent }}>
                  {count}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {stageFilter && filteredStage ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {filteredStage.label} ({filteredStage.items?.length || 0})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {(filteredStage.items || []).map((p) => (
              <WorkflowRow key={p.id} pub={p} canManage={canManage} busyId={busyId} onAdvance={advance} />
            ))}
            {(filteredStage.items || []).length === 0 ? <div className="muted">No items in this stage.</div> : null}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {(data?.stages || []).map((stage) =>
            (stage.items || []).length ? (
              <div key={stage.id}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{stage.label}</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {stage.items.slice(0, listLimit).map((p) => (
                    <WorkflowRow key={p.id} pub={p} canManage={canManage} busyId={busyId} onAdvance={advance} />
                  ))}
                  {!showStageTiles && stage.items.length > listLimit ? (
                    <button type="button" className="btn" onClick={() => setStageFilter(stage.id)}>
                      View all {stage.items.length} in {stage.label}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null
          )}
          {(data?.stages || []).every((s) => !(s.items || []).length) ? (
            <div className="muted">No publications in the pipeline yet.</div>
          ) : null}
        </div>
      )}

      {standalone ? (
        <div style={{ marginTop: 12 }}>
          <Link className="btn" to="/publications">
            Open publications
          </Link>
        </div>
      ) : null}

      {!standalone && !embedded ? (
        <div style={{ marginTop: 12 }}>
          <Link className="btn" to="/research-workflow">
            Open research workflow
          </Link>
        </div>
      ) : null}
    </>
  );

  if (standalone) {
    return (
      <div>
        <PageHeader
          title="Research Workflow Status"
          subtitle={`${departmentLabel || data?.department || "Faculty"} — track outputs from submission to publication.`}
          stats={stats}
          activeFilter={urlStageFilter}
          onFilterChange={setUrlStageFilter}
          actions={
            <Link className="btn" to="/publications">
              Publications
            </Link>
          }
        />
        {urlStageFilter !== "all" ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Showing: <strong>{statFilterLabel(stats, urlStageFilter)}</strong>
          </p>
        ) : null}
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.35)" }}>
          {body}
        </div>
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="card" style={{ marginTop: 16, borderColor: "rgba(56,189,248,0.35)" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Faculty publication workflow</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {departmentLabel || data?.department} — submitted → in process → pipeline → published.
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Faculty research workflow status</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {departmentLabel || data?.department} — track outputs from submission to publication.
      </div>
      {body}
    </div>
  );
}

function WorkflowRow({ pub, canManage, busyId, onAdvance }) {
  const next = nextWorkflowStage(pub.workflowStage);
  const meta = workflowStageMeta(pub.workflowStage);

  return (
    <div
      className="card"
      style={{ padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>{pub.title}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {publicationTypeLabel(pub.type)} • {pub.year} • validation: {pub.status}
          {pub.projectId ? (
            <>
              {" "}
              • Project:{" "}
              <Link to={`/projects/${pub.projectId}`}>
                {pub.projectTitle || "Open linked project"}
              </Link>
            </>
          ) : (
            <> • <span style={{ color: "#f87171" }}>No project linked</span></>
          )}
        </div>
        <div style={{ fontSize: 12, marginTop: 4, color: meta.accent }}>
          {meta.icon} {pub.workflowStageLabel || meta.label}
        </div>
      </div>
      {canManage && next ? (
        <button type="button" className="btn primary" disabled={busyId === pub.id} onClick={() => onAdvance(pub)}>
          {busyId === pub.id ? "…" : `→ ${workflowStageMeta(next).label}`}
        </button>
      ) : null}
    </div>
  );
}
