import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as publicationApi from "../services/publicationApi";
import { useProgramTier } from "../hooks/useProgramTier";
import { FacultyResearchWorkflowModule } from "./FacultyResearchWorkflowModule";
import { publicationTypeLabel } from "../constants/publicationTypes";

/**
 * Project hub: outputs + comments + review decisions for ONE recognized project.
 * Keeps Publication Tracking tied to Projects (notifications deep-link here).
 */
export function ProjectOutputsHub({
  projectId,
  accessToken,
  canManage = false,
  canAddOutput = false,
  canDeleteOutput = false,
  canComment = false,
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
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load project outputs");
      setPubs([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, projectId, programTier]);

  async function afterChange(res) {
    await load();
    setWorkflowKey((k) => k + 1);
    onPublicationValidated?.(res);
  }

  async function decidePublication(pub, decision) {
    const prompts = {
      accept: "Accept comment (required):",
      revise: "Revision request — what must the author fix? (required):",
      reject: "Rejection reason (required):",
    };
    const comment = window.prompt(prompts[decision] || "Comment (required):");
    if (!comment?.trim()) return;
    setBusyId(pub.id);
    setError("");
    try {
      const res = await publicationApi.validatePublication(accessToken, pub.id, {
        decision,
        comment: comment.trim(),
      });
      await afterChange(res);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save decision");
    } finally {
      setBusyId(null);
    }
  }

  async function addComment(pub) {
    const comment = window.prompt("Add a review comment (visible on this project):");
    if (!comment?.trim()) return;
    setBusyId(pub.id);
    setError("");
    try {
      const res = await publicationApi.addPublicationComment(accessToken, pub.id, comment.trim());
      await afterChange(res);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to add comment");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const canDecide = (p) =>
    canManage && (p.status === "submitted" || p.status === "revision_requested");

  return (
    <div id="project-outputs" style={{ marginTop: 16, scrollMarginTop: 88 }}>
      <div className="card" style={{ borderColor: "rgba(56,189,248,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Publication outputs — this project</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Full details, review comments, and decisions live here (notifications open this section).
            </div>
          </div>
          {canAddOutput && pubs.length === 0 ? (
            <Link className="btn primary" to={`/publications?projectId=${projectId}`}>
              + Research output
            </Link>
          ) : (
            <Link className="btn" to={`/publications?projectId=${projectId}`}>
              {pubs.length ? "Open in Publications" : "Open outputs"}
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

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {pubs.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{ padding: 12, background: "rgba(15,23,42,0.03)", borderColor: "rgba(148,163,184,0.25)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {publicationTypeLabel(p.type)} • {p.year} •{" "}
                    <strong>{p.statusLabel || p.status}</strong>
                    {p.venue ? ` • ${p.venue}` : ""}
                    {p.workflowStageLabel ? ` • ${p.workflowStageLabel}` : ""}
                  </div>
                  {p.journalDecision && p.journalDecision !== "pending" ? (
                    <div style={{ fontSize: 12, marginTop: 4, color: "#fbbf24" }}>
                      Journal decision: <strong>{p.journalDecisionLabel || p.journalDecision}</strong>
                      {p.journalDecisionNote ? ` — ${p.journalDecisionNote}` : ""}
                    </div>
                  ) : null}
                  {p.validationComment ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Latest review note: {p.validationComment}
                    </div>
                  ) : null}
                  {Array.isArray(p.authors) && p.authors.length ? (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Authors: {p.authors.join(", ")}
                    </div>
                  ) : null}
                  {p.doi ? <div className="muted" style={{ fontSize: 12 }}>DOI: {p.doi}</div> : null}

                  {Array.isArray(p.reviewerComments) && p.reviewerComments.length ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: "rgba(14,165,233,0.08)",
                        border: "1px solid rgba(56,189,248,0.25)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                        Comments & decisions ({p.reviewerComments.length})
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {p.reviewerComments.map((c) => (
                          <li key={c.id || `${c.at}-${c.comment}`} style={{ marginBottom: 6 }}>
                            <strong>{c.authorName || c.authorRole || "Reviewer"}</strong>
                            {c.decisionLabel ? ` [${c.decisionLabel}]` : ""}: {c.comment}
                            {c.at ? (
                              <span className="muted"> · {new Date(c.at).toLocaleString()}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : p.status !== "draft" ? (
                    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      No comments yet — Accept / Revise / Reject or Add comment to start the thread.
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "start" }}>
                  {p.status === "validated" ? (
                    <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>
                      ✓ Accepted / complete
                    </span>
                  ) : null}
                  {canDecide(p) ? (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busyId === p.id}
                        onClick={() => decidePublication(p, "accept")}
                      >
                        {busyId === p.id ? "…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ borderColor: "rgba(245,158,11,0.6)", color: "#fbbf24" }}
                        disabled={busyId === p.id}
                        onClick={() => decidePublication(p, "revise")}
                      >
                        Revise
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={busyId === p.id}
                        onClick={() => decidePublication(p, "reject")}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {(canComment || canManage) && p.status !== "draft" ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === p.id}
                      onClick={() => addComment(p)}
                    >
                      Add comment
                    </button>
                  ) : null}
                  {canDeleteOutput &&
                  (p.status === "draft" ||
                    p.status === "rejected" ||
                    p.status === "revision_requested" ||
                    canManage) ? (
                    <button
                      type="button"
                      className="btn"
                      style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171" }}
                      onClick={async () => {
                        const ok = window.confirm(`Delete output "${p.title}"?`);
                        if (!ok) return;
                        setError("");
                        try {
                          await publicationApi.deletePublication(accessToken, p.id);
                          await afterChange();
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
