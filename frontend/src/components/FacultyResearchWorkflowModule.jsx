import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as publicationApi from "../services/publicationApi";
import { PageHeader } from "./PageHeader";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useProgramTier } from "../hooks/useProgramTier";
import { statFilterLabel } from "../utils/pageHeaderFilters";
import { FACULTY_WORKFLOW_STAGES, nextWorkflowStage, workflowStageMeta, isPipelineReadyForPublish } from "../constants/facultyWorkflow";
import { publicationTypeLabel } from "../constants/publicationTypes";

export function FacultyResearchWorkflowModule({
  accessToken,
  departmentLabel,
  canManage,
  standalone = false,
  embedded = false,
  projectId: projectIdProp = "",
}) {
  const { programTier } = useProgramTier();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = projectIdProp || searchParams.get("projectId") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [internalStageFilter, setInternalStageFilter] = useState(null);
  const [urlStageFilter, setUrlStageFilter] = useUrlStatFilter("all");

  const useUrlStages = standalone || (embedded && !projectIdProp);
  const stageFilter = useUrlStages
    ? urlStageFilter === "all"
      ? null
      : urlStageFilter
    : internalStageFilter;
  const setStageFilter = useUrlStages
    ? (key) => setUrlStageFilter(key || "all")
    : setInternalStageFilter;

  const load = useCallback(async () => {
    const res = await publicationApi.getFacultyWorkflow(
      accessToken,
      projectIdFromUrl ? { projectId: projectIdFromUrl } : {}
    );
    setData(res);
}, [accessToken, projectIdFromUrl, projectIdProp, programTier]);

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load faculty workflow"));
  }, [load]);

  async function advance(pub) {
    const current = pub.workflowStage && pub.workflowStage !== "null" ? pub.workflowStage : "submitted";
    const next = nextWorkflowStage(current);
    if (!next) return;
    setBusyId(pub.id);
    setError("");
    try {
      await publicationApi.updateWorkflowStage(accessToken, pub.id, next);
      // Follow the item into its new stage so it doesn't look stuck on Submitted
      setStageFilter(next);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to update workflow");
    } finally {
      setBusyId(null);
    }
  }

  async function journalPublish(pub) {
    const note = window.prompt(
      "Journal accept → Publish.\nGeli note / faallo (qasab):",
      pub.journalDecisionNote || "Accepted by journal / venue"
    );
    if (!note?.trim()) return;
    setBusyId(pub.id);
    setError("");
    try {
      await publicationApi.setJournalDecision(accessToken, pub.id, {
        decision: "accept",
        note: note.trim(),
      });
      setStageFilter("published");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to record journal decision");
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

  if (!data && error) {
    return (
      <div className="card" style={{ marginTop: embedded ? 16 : 12, borderColor: "rgba(248,113,113,0.45)" }}>
        <div style={{ fontWeight: 800 }}>Faculty publication workflow</div>
        <p style={{ color: "#f87171", marginTop: 8 }}>{error}</p>
      </div>
    );
  }

  const showStageTiles = !standalone || embedded;
  const listLimit = standalone || embedded ? 20 : 4;

  const body = (
    <>
      {error ? <div style={{ color: "#f87171", marginTop: standalone ? 0 : 8 }}>{error}</div> : null}

      {projectIdFromUrl ? (
        <div className="workflowItemActions" style={{ marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Filtered to project: <strong>{data?.projectFilter?.title || "selected"}</strong>
          </span>
          <Link className="btn sm" to="/research-workflow">
            Show all
          </Link>
        </div>
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
                className={`btn overviewTile${stageFilter === stage.id ? " is-active" : ""}`}
                style={{
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

      {stageFilter ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {filteredStage?.label || stageFilter} ({filteredStage?.items?.length || 0})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {(filteredStage?.items || []).map((p) => (
              <WorkflowRow
                key={p.id}
                pub={p}
                canManage={canManage}
                busyId={busyId}
                onAdvance={advance}
                onJournalPublish={journalPublish}
              />
            ))}
            {!(filteredStage?.items || []).length ? <div className="muted">No items in this stage.</div> : null}
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
                    <WorkflowRow
                      key={p.id}
                      pub={p}
                      canManage={canManage}
                      busyId={busyId}
                      onAdvance={advance}
                      onJournalPublish={journalPublish}
                    />
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
            Showing: <strong>{statFilterLabel(stats, urlStageFilter)}</strong> ({filteredStage?.items?.length || 0})
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
          {departmentLabel || data?.department} — In process → Pipeline → Journal decision → Publish.
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

function WorkflowRow({ pub, canManage, busyId, onAdvance, onJournalPublish }) {
  const current = pub.workflowStage && pub.workflowStage !== "null" ? pub.workflowStage : "submitted";
  const next = nextWorkflowStage(current);
  const meta = workflowStageMeta(current);
  const canJournalPublish = canManage && isPipelineReadyForPublish(current);

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
            <> • Project: {pub.projectTitle || "Linked project"}</>
          ) : (
            <> • <span style={{ color: "#f87171" }}>No project linked</span></>
          )}
        </div>
        <div style={{ fontSize: 12, marginTop: 4, color: meta.accent }}>
          {meta.icon} {pub.workflowStageLabel || meta.label}
          {pub.journalDecision && pub.journalDecision !== "pending" ? (
            <> • Journal: {pub.journalDecisionLabel || pub.journalDecision}</>
          ) : null}
        </div>
      </div>
      <div className="workflowItemActions">
        <Link className="btn sm" to={`/publications?projectId=${pub.projectId || ""}`}>
          View output
        </Link>
        {pub.projectId ? (
          <Link className="btn sm" to={`/projects/${pub.projectId}`}>
            Open project
          </Link>
        ) : null}
        {canManage && next ? (
          <button type="button" className="btn sm primary" disabled={busyId === pub.id} onClick={() => onAdvance(pub)}>
            {busyId === pub.id ? "…" : `→ ${workflowStageMeta(next).label}`}
          </button>
        ) : null}
        {canJournalPublish ? (
          <button
            type="button"
            className="btn sm primary"
            disabled={busyId === pub.id}
            onClick={() => onJournalPublish(pub)}
            title="Journal accept → Published"
          >
            {busyId === pub.id ? "…" : "Journal accept → Publish"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
