import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as publicationApi from "../services/publicationApi";
import { FACULTY_WORKFLOW_STAGES, nextWorkflowStage, workflowStageMeta } from "../constants/facultyWorkflow";
import { publicationTypeLabel } from "../constants/publicationTypes";

export function FacultyResearchWorkflowModule({ accessToken, departmentLabel, canManage }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [stageFilter, setStageFilter] = useState(null);

  const load = useCallback(async () => {
    const res = await publicationApi.getFacultyWorkflow(accessToken);
    setData(res);
  }, [accessToken]);

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

  if (!data && !error) return <p className="muted">Loading Kulliyad workflow…</p>;

  const filteredStage = stageFilter ? data?.stages?.find((s) => s.id === stageFilter) : null;

  return (
    <div className="card" style={{ marginTop: 16, borderColor: "rgba(56,189,248,0.35)" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Kulliyad research workflow status</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {departmentLabel || data?.department} — track outputs from submission to publication.
      </div>

      {error ? <div style={{ color: "#f87171", marginTop: 8 }}>{error}</div> : null}

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
              onClick={() => setStageFilter((f) => (f === stage.id ? null : stage.id))}
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
                  {stage.items.slice(0, 4).map((p) => (
                    <WorkflowRow key={p.id} pub={p} canManage={canManage} busyId={busyId} onAdvance={advance} />
                  ))}
                  {stage.items.length > 4 ? (
                    <button type="button" className="btn" onClick={() => setStageFilter(stage.id)}>
                      View all {stage.items.length} in {stage.label}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Link className="btn" to="/publications">
          Open publications
        </Link>
      </div>
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
