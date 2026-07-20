import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";
import * as analyticsApi from "../services/analyticsApi";
import { ProjectWorkflowPanel } from "../components/ProjectWorkflowPanel";
import { ProjectExecutionPanel, CLOSURE_CHECKLIST_ITEMS } from "../components/ProjectExecutionPanel";
import { ProjectOutputsHub } from "../components/ProjectOutputsHub";

const emptyMilestone = { title: "", dueDate: "", completed: false };
const emptyMember = { name: "", role: "member" };

export function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([emptyMilestone]);
  const [teamMembers, setTeamMembers] = useState([emptyMember]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [closureForm, setClosureForm] = useState({
    finalReport: "",
    assetHandover: "",
    lessonsLearned: "",
    checklist: {
      publicationsArchived: false,
      assetsHandedOver: false,
      dataArchived: false,
      financialCleared: false,
      ethicsClosed: false,
    },
  });

  const [saving, setSaving] = useState(false);

  async function saveExecution(body) {
    await projectApi.updateProject(accessToken, id, body);
    setMessage("Work plan and activities saved");
    await load();
  }

  async function logCommunication(body) {
    await projectApi.addCommunicationLog(accessToken, id, body);
    setMessage("Communication logged");
    await load();
  }

  async function load() {
    setError("");
    const res = await projectApi.getProject(accessToken, id);
    const p = res.project;
    setProject(p);
    setMilestones(p.milestones?.length ? p.milestones : [emptyMilestone]);
    setTeamMembers(p.teamMembers?.length ? p.teamMembers : [emptyMember]);
    setStartDate(p.startDate ? p.startDate.slice(0, 10) : "");
    setEndDate(p.endDate ? p.endDate.slice(0, 10) : "");
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load project"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (location.state?.workflowHint === "publication_submitted") {
      setMessage(
        "Publication submitted — workflow, awards visibility, notifications, audit & project activity updated."
      );
      load().catch(() => {});
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.workflowHint]);

  useEffect(() => {
    const hash = location.hash || "";
    if (!hash || !project?.id) return;
    const id = hash.replace(/^#/, "");
    if (!["closure", "project-outputs", "project-workflow", "workflow"].includes(id)) return;
    const el =
      document.getElementById(id) ||
      (id === "workflow" ? document.getElementById("project-workflow") : null);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, project?.id]);

  if (!project) return <div>{error || "Loading..."}</div>;

  const isOwner = String(project.researcherId) === String(user?.id);
  const canEdit = isOwner || user?.role === "research_director";
  const isVoluntary = Boolean(project.isVoluntary || project.proposalKind === "voluntary");
  const closureItems = isVoluntary
    ? CLOSURE_CHECKLIST_ITEMS.filter((item) => item.key !== "financialCleared")
    : CLOSURE_CHECKLIST_ITEMS;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Project Management</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isOwner || user?.role === "research_director" ? (
            <button
              type="button"
              className="btn"
              style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171" }}
              onClick={async () => {
                const ok = window.confirm(
                  `Delete project "${project.title}"?\n\nLinked outputs, repository files, and budgets for this project will be removed. This cannot be undone.`
                );
                if (!ok) return;
                try {
                  setError("");
                  setMessage("");
                  await projectApi.deleteProject(accessToken, id);
                  navigate("/projects", { replace: true });
                } catch (e) {
                  setError(e?.response?.data?.message || "Failed to delete project");
                }
              }}
            >
              Delete project
            </button>
          ) : null}
          <Link className="btn" to="/projects">
            Back
          </Link>
        </div>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginTop: 12 }}>{error}</div> : null}
      {message ? <div className="card" style={{ borderColor: "rgba(45, 212, 191, 0.35)", marginTop: 12 }}>{message}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{project.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>Status: {project.status}</div>
        {project.principalInvestigator ? (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--rms-border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rms-text-secondary)", marginBottom: 4 }}>
              Principal Investigator
            </div>
            <div style={{ fontWeight: 800 }}>{project.principalInvestigator.fullName}</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              {project.principalInvestigator.department || "—"}
              {project.principalInvestigator.email ? ` • ${project.principalInvestigator.email}` : ""}
            </div>
          </div>
        ) : null}

        {project.linkedGrants?.length ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--rms-border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rms-text-secondary)", marginBottom: 8 }}>
              Linked grants & funding
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {project.linkedGrants.map((g) => (
                <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{g.title}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {g.fundingSource} • {g.status}
                      {project.awardsVisible !== false &&
                      Number(g.amountAwarded || 0) > 0 ? (
                        <>
                          {" "}
                          • Awarded {g.currency} {Number(g.amountAwarded).toLocaleString()}
                        </>
                      ) : project.awardsVisible !== false &&
                        Number(g.amountRequested || 0) > 0 ? (
                        <>
                          {" "}
                          • Requested {g.currency} {Number(g.amountRequested).toLocaleString()}
                        </>
                      ) : g.awardsHidden ? (
                        <> • Award amount — visible after publication (director authorized)</>
                      ) : null}
                    </div>
                  </div>
                  <Link className="btn" to={`/grants/${g.id}`}>
                    View grant
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : project.isVoluntary || project.proposalKind === "voluntary" ? null : project.grantsVisible ? (
          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            No funding-call grants linked to this project yet.
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Linked funding will appear here when a grant is accepted for this project.
          </div>
        )}

        {canEdit ? (
          <div className="row" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>
            Timeline: {startDate || "—"} → {endDate || "—"}
          </div>
        )}

        {isOwner ? (
          <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={() => navigate(`/projects/${id}/progress`)}>
            Add progress report
          </button>
        ) : null}
      </div>

      <ProjectWorkflowPanel
        projectId={id}
        proposalId={project.proposalId || null}
        workflow={{
          ...(project.workflow || {}),
          projectStatus: project.status,
          awardsVisible: project.awardsVisible,
          isVoluntary: project.isVoluntary || project.proposalKind === "voluntary",
        }}
      />

      <ProjectOutputsHub
        projectId={id}
        accessToken={accessToken}
        canAddOutput={isOwner}
        canDeleteOutput={isOwner || user?.role === "research_director"}
        canManage={["faculty_coordinator", "research_director"].includes(user?.role)}
        departmentLabel={project.title}
      />

      {isOwner ? (
        <div className="card" style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span className="muted" style={{ width: "100%", fontSize: 13, marginBottom: 4 }}>
            Add other records for this project (same project context):
          </span>
          <Link className="btn" to={`/repository?projectId=${id}`}>
            + Repository file
          </Link>
          <Link className="btn" to={`/budgets?projectId=${id}`}>
            Budgets
          </Link>
          {!(project.isVoluntary || project.proposalKind === "voluntary") ? (
            <>
              <Link className="btn" to={`/grants?projectId=${id}`}>
                Grants
              </Link>
              <Link className="btn" to={`/funding-calls?projectId=${id}`}>
                Funding Calls
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Milestones</div>
        {milestones.map((m, idx) => (
          <div key={idx} className="row" style={{ alignItems: "end", marginBottom: 8 }}>
            <div className="field" style={{ flex: 2 }}>
              <label>Title</label>
              <input
                value={m.title}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...milestones];
                  next[idx] = { ...next[idx], title: e.target.value };
                  setMilestones(next);
                }}
              />
            </div>
            <div className="field">
              <label>Due</label>
              <input
                type="date"
                disabled={!canEdit}
                value={m.dueDate ? String(m.dueDate).slice(0, 10) : ""}
                onChange={(e) => {
                  const next = [...milestones];
                  next[idx] = { ...next[idx], dueDate: e.target.value };
                  setMilestones(next);
                }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={Boolean(m.completed)}
                onChange={(e) => {
                  const next = [...milestones];
                  next[idx] = { ...next[idx], completed: e.target.checked };
                  setMilestones(next);
                }}
              />
              Done
            </label>
          </div>
        ))}
        {canEdit ? (
          <button className="btn" type="button" onClick={() => setMilestones([...milestones, { ...emptyMilestone }])}>
            + Milestone
          </button>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Research team</div>
        {teamMembers.map((m, idx) => (
          <div key={idx} className="row" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Name</label>
              <input
                value={m.name}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...teamMembers];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setTeamMembers(next);
                }}
              />
            </div>
            <div className="field">
              <label>Role</label>
              <input
                value={m.role}
                disabled={!canEdit}
                onChange={(e) => {
                  const next = [...teamMembers];
                  next[idx] = { ...next[idx], role: e.target.value };
                  setTeamMembers(next);
                }}
              />
            </div>
          </div>
        ))}
        {canEdit ? (
          <button className="btn" type="button" onClick={() => setTeamMembers([...teamMembers, { ...emptyMember }])}>
            + Team member
          </button>
        ) : null}
      </div>

      {canEdit ? (
        <button
          type="button"
          className="btn primary"
          style={{ marginTop: 12 }}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            setMessage("");
            try {
              await projectApi.updateProject(accessToken, id, {
                milestones: milestones.filter((m) => m.title.trim()),
                teamMembers: teamMembers.filter((m) => m.name.trim()),
                startDate: startDate || undefined,
                endDate: endDate || null,
              });
              setMessage("Project updated.");
              await load();
            } catch (e) {
              setError(e?.response?.data?.message || "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save timeline, milestones & team"}
        </button>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Progress reports</div>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                const blob = await analyticsApi.downloadTechnicalReportPdf(accessToken, id);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `technical-report-${project.title || "project"}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError(e?.response?.data?.message || "Failed to download technical report");
              }
            }}
          >
            Download technical report (PDF)
          </button>
        </div>
        {(project.progressReports || []).length === 0 ? (
          <div className="muted">No progress reports yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {project.progressReports.map((r, idx) => (
              <div className="card" key={idx}>
                <div className="muted">
                  {new Date(r.createdAt).toLocaleString()} • {r.progressPercent ?? 0}%
                </div>
                <div style={{ marginTop: 6 }}>{r.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProjectExecutionPanel
        project={project}
        canEdit={canEdit || isOwner}
        onSave={saveExecution}
        onLogCommunication={logCommunication}
      />

      <div className="card" style={{ marginTop: 12 }} id="closure">
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Project closure (Phase 6) — Complete project</div>
        <p className="muted" style={{ fontSize: 13 }}>
          Status: {project.closure?.status || "none"} · Project: {project.status}
          {["completed", "closed"].includes(project.status) ? " · Done" : ""}
        </p>
        {isOwner && (!project.closure?.status || project.closure.status === "none") ? (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Closure checklist (all required)</div>
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {closureItems.map((item) => (
                <label key={item.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={closureForm.checklist[item.key]}
                    onChange={(e) => setClosureForm({
                      ...closureForm,
                      checklist: { ...closureForm.checklist, [item.key]: e.target.checked },
                    })}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <textarea
              rows={4}
              placeholder="Final report summary *"
              value={closureForm.finalReport}
              onChange={(e) => setClosureForm({ ...closureForm, finalReport: e.target.value })}
              style={{ width: "100%" }}
            />
            <textarea
              rows={2}
              placeholder="Asset handover notes"
              value={closureForm.assetHandover}
              onChange={(e) => setClosureForm({ ...closureForm, assetHandover: e.target.value })}
              style={{ width: "100%", marginTop: 8 }}
            />
            <textarea
              rows={3}
              placeholder="Lessons learned"
              value={closureForm.lessonsLearned}
              onChange={(e) => setClosureForm({ ...closureForm, lessonsLearned: e.target.value })}
              style={{ width: "100%", marginTop: 8 }}
            />
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 8 }}
              onClick={async () => {
                setError("");
                setMessage("");
                if (!closureForm.finalReport?.trim()) {
                  setError("Final report required to complete the project.");
                  return;
                }
                const missing = closureItems.filter((item) => !closureForm.checklist[item.key]);
                if (missing.length) {
                  setError(`Tick all checklist items before submit: ${missing.map((m) => m.label).join("; ")}`);
                  return;
                }
                try {
                  await projectApi.submitClosure(accessToken, id, closureForm);
                  setMessage("Closure submitted — Director will review. Project is now Closing.");
                  // #region agent log
                  fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
                    body: JSON.stringify({
                      sessionId: "f558f7",
                      runId: "project-complete",
                      hypothesisId: "PC1",
                      location: "ProjectDetails.jsx:submitClosure",
                      message: "UI closure submit ok",
                      data: { projectId: id },
                      timestamp: Date.now(),
                    }),
                  }).catch(() => {});
                  // #endregion
                  await load();
                } catch (e) {
                  setError(e?.response?.data?.message || "Submit failed");
                }
              }}
            >
              Submit closure (complete project)
            </button>
          </>
        ) : null}
        {project.closure?.finalReport ? <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{project.closure.finalReport}</div> : null}
        {project.closure?.lessonsLearned ? (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 12 }}>Lessons learned</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{project.closure.lessonsLearned}</div>
          </div>
        ) : null}
        {user?.role === "research_director" && project.closure?.status === "submitted" ? (
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 8 }}
            onClick={async () => {
              try {
                setError("");
                await projectApi.directorClosureApproval(accessToken, id, "Approved");
                setMessage(
                  isVoluntary
                    ? "Director approved — ready to archive (finance skipped for voluntary)."
                    : "Director approved — if grant was already finance-authorized, archive is ready; otherwise waiting for Finance closure."
                );
                await load();
              } catch (e) {
                setError(e?.response?.data?.message || "Director approval failed");
              }
            }}
          >
            Director approve closure
          </button>
        ) : null}
        {user?.role === "research_director" &&
        !isVoluntary &&
        project.closure?.status === "director_approved" ? (
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Waiting for Finance → <strong>Project closure (Finance)</strong> queue.
          </p>
        ) : null}
        {user?.role === "research_director" && project.closure?.status === "finance_approved" ? (
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 8 }}
            onClick={async () => {
              try {
                setError("");
                await projectApi.archiveProject(accessToken, id);
                setMessage("Project completed and archived.");
                // #region agent log
                fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
                  body: JSON.stringify({
                    sessionId: "f558f7",
                    runId: "project-complete",
                    hypothesisId: "PC1",
                    location: "ProjectDetails.jsx:archive",
                    message: "UI archive ok",
                    data: { projectId: id },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion
                await load();
              } catch (e) {
                setError(e?.response?.data?.message || "Archive failed");
              }
            }}
          >
            Archive / mark project completed
          </button>
        ) : null}
        {["completed", "closed"].includes(project.status) ? (
          <div className="card" style={{ marginTop: 10, borderColor: "rgba(34,197,94,0.45)" }}>
            <strong>Project completed.</strong>
            <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
              Closure: {project.closure?.status || "—"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
