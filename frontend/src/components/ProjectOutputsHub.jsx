import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as publicationApi from "../services/publicationApi";
import { useProgramTier } from "../hooks/useProgramTier";
import { FacultyResearchWorkflowModule } from "./FacultyResearchWorkflowModule";
import { publicationTypeLabel } from "../constants/publicationTypes";

/**
 * Project hub: outputs + faculty publication pipeline for ONE recognized project.
 * Keeps Publication Tracking / Workflow Status tied to Projects (no separate silo).
 */
export function ProjectOutputsHub({
  projectId,
  accessToken,
  canManage = false,
  canAddOutput = false,
  canDeleteOutput = false,
  departmentLabel = "",
  onPublicationValidated,
}) {
  const { programTier } = useProgramTier();
  const [pubs, setPubs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [workflowKey, setWorkflowKey] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken || !projectId) return;
    setLoading(true);
    setError("");
    try {
      const res = await publicationApi.listPublications(accessToken, { projectId });
      setPubs(res.publications || []);
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          runId: "project-hub",
          hypothesisId: "PH1",
          location: "ProjectOutputsHub.jsx:load",
          message: "project-scoped outputs on project hub",
          data: { projectId, count: (res.publications || []).length, programTier },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load project outputs");
      setPubs([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, programTier]);

  async function approveCompletePublication(pub) {
    const comment = window.prompt("Validation comment (required) — approve as complete publication:");
    if (!comment?.trim()) return;
    setBusyId(pub.id);
    setError("");
    try {
      const res = await publicationApi.validatePublication(accessToken, pub.id, {
        decision: "validated",
        comment: comment.trim(),
      });
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          hypothesisId: "P3",
          location: "ProjectOutputsHub.jsx:approveCompletePublication",
          message: "director validated from project hub",
          data: {
            pubId: pub.id,
            projectId,
            status: res?.publication?.status || null,
            workflowStage: res?.publication?.workflowStage || null,
            projectCompletion: res?.projectCompletion || null,
            programTier,
          },
          timestamp: Date.now(),
          runId: "pub-validate",
        }),
      }).catch(() => {});
      // #endregion
      await load();
      setWorkflowKey((k) => k + 1);
      onPublicationValidated?.(res);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to approve publication");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return (
    <div id="project-outputs" style={{ marginTop: 16, scrollMarginTop: 88 }}>
      <div className="card" style={{ borderColor: "rgba(56,189,248,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Publication outputs — this project</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              One output per project (1:1) — same data as Publications & Outputs menu.
            </div>
          </div>
          {canAddOutput && pubs.length === 0 ? (
            <Link className="btn primary" to={`/publications?projectId=${projectId}`}>
              + Research output
            </Link>
          ) : (
            <Link className="btn" to={`/publications?projectId=${projectId}`}>
              {pubs.length ? "View output" : "Open outputs"}
            </Link>
          )}
        </div>

        {error ? <div style={{ color: "#f87171", marginTop: 10 }}>{error}</div> : null}
        {loading ? <p className="muted" style={{ marginTop: 10 }}>Loading outputs…</p> : null}

        {!loading && pubs.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            No research output registered for this project yet (1:1 — one output per project).
          </p>
        ) : null}

        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {pubs.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{ padding: 10, background: "rgba(15,23,42,0.03)", borderColor: "rgba(148,163,184,0.25)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {publicationTypeLabel(p.type)} • {p.year} • {p.status}
                    {p.workflowStageLabel ? ` • ${p.workflowStageLabel}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "start" }}>
                  {p.status === "validated" ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#22c55e",
                        fontWeight: 700,
                        alignSelf: "start",
                      }}
                    >
                      ✓ Complete publication approved
                    </span>
                  ) : null}
                  {canManage && p.status === "submitted" ? (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={busyId === p.id}
                      onClick={() => approveCompletePublication(p)}
                    >
                      {busyId === p.id ? "…" : "Approve complete publication"}
                    </button>
                  ) : null}
                {canDeleteOutput &&
                (p.status === "draft" || p.status === "rejected" || canManage) ? (
                  <button
                    type="button"
                    className="btn"
                    style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171", alignSelf: "start" }}
                    onClick={async () => {
                      const ok = window.confirm(`Delete output "${p.title}"?`);
                      if (!ok) return;
                      setError("");
                      try {
                        await publicationApi.deletePublication(accessToken, p.id);
                        await load();
                      } catch (e) {
                        setError(e?.response?.data?.message || "Failed to delete output");
                      }
                    }}
                  >
                    Delete
                  </button>
                ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <FacultyResearchWorkflowModule
        key={workflowKey}
        accessToken={accessToken}
        departmentLabel={departmentLabel || "This project"}
        canManage={canManage}
        embedded
        projectId={projectId}
      />
    </div>
  );
}
