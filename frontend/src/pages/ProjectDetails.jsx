import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useScrollToTop } from "../hooks/useScrollToTop";
import * as projectApi from "../services/projectApi";
import * as analyticsApi from "../services/analyticsApi";
import { ProjectWorkflowPanel } from "../components/ProjectWorkflowPanel";
import { ProjectExecutionPanel, CLOSURE_CHECKLIST_ITEMS } from "../components/ProjectExecutionPanel";
import { ProjectOutputsHub } from "../components/ProjectOutputsHub";
import { ProgramTierBadge } from "../components/ProgramTierBadge";
import { triggerBlobDownload } from "../utils/downloadBlob";
import { dateIso, isDateInPast, minSelectableDate, pastDateMessage } from "../utils/dateConstraints";

const emptyMilestone = { title: "", dueDate: "", completed: false };
const emptyMember = { name: "", role: "member" };

export function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([emptyMilestone]);
  const [teamMembers, setTeamMembers] = useState([emptyMember]);
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

  useScrollToTop([id, project?.id]);

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
    setEndDate(p.endDate ? String(p.endDate).slice(0, 10) : "");
  }

  useEffect(() => {
    setProject(null);
    setError("");
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load project"));
  }, [id, accessToken, programTier]);

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
    const scrollToAnchor = () => {
      const el =
        document.getElementById(id) ||
        (id === "workflow" ? document.getElementById("project-workflow") : null);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollToAnchor();
    const t = window.setTimeout(scrollToAnchor, 120);
    return () => window.clearTimeout(t);
  }, [location.hash, project?.id]);

  if (!project) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>{error ? "Could not open project" : "Loading project…"}</div>
        {error ? (
          <>
            <p className="muted" style={{ marginTop: 8 }}>{error}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" className="btn primary" onClick={() => load().catch((e) => setError(e?.response?.data?.message || "Failed to load project"))}>
                Retry
              </button>
              <Link className="btn" to="/projects">
                Back to projects
              </Link>
              <Link className="btn" to="/notifications">
                Notifications
              </Link>
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>Fetching project details and workflow…</p>
        )}
      </div>
    );
  }

  const isOwner = String(project.researcherId) === String(user?.id);
  const canEdit = isOwner || user?.role === "research_director";
  const isVoluntary =
    typeof project.isVoluntary === "boolean"
      ? project.isVoluntary
      : project.proposalKind !== "grant_fund_call" && !project.fundingCallId;
  // Finance clears money on Project closure (Finance) — PI never self-certifies financialCleared
  const closureItems = CLOSURE_CHECKLIST_ITEMS.filter((item) => item.key !== "financialCleared");

  const projectStartDate = project.startDate
    ? String(project.startDate).slice(0, 10)
    : project.createdAt
      ? String(project.createdAt).slice(0, 10)
      : "";
  const minPlanDate = minSelectableDate(projectStartDate);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Project Management</h2>
          {project?.programTier || project?.programTierLabel ? (
            <ProgramTierBadge tier={project.programTier} label={project.programTierLabel} />
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isOwner || user?.role === "research_director" ? (
            <button
              type="button"
              className="btn"
              style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171" }}
              onClick={async () => {
                const ok = window.confirm(`Delete project "${project.title}"?`);
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
        {project.budgetSummary?.totalAllocated > 0 ? (
          <div className="muted" style={{ marginTop: 6 }}>
            Budget allocated:{" "}
            <strong>
              {project.budgetSummary.currency || "USD"}{" "}
              {Number(project.budgetSummary.totalAllocated).toLocaleString()}
            </strong>
            {project.budgetSummary.totalDisbursed != null ? (
              <span>
                {" "}
                · Paid: {project.budgetSummary.currency || "USD"}{" "}
                {Number(project.budgetSummary.totalDisbursed || 0).toLocaleString()}
              </span>
            ) : null}
          </div>
        ) : null}
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
        ) : isVoluntary ? null : project.grantsVisible ? (
          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            No funding-call grants linked to this project yet.
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Linked funding will appear here when a grant is accepted for this project.
          </div>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          <div className="field">
            <label>Start date</label>
            <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--rms-border)", background: "rgba(255,255,255,0.02)" }}>
              {projectStartDate ? new Date(projectStartDate).toLocaleDateString() : "—"}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Set automatically when the project was created (proposal approval).
            </div>
          </div>
          {canEdit ? (
            <div className="field">
              <label>End date</label>
              <input
                type="date"
                min={minPlanDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label>End date</label>
              <div style={{ padding: "10px 12px" }}>{endDate || "—"}</div>
            </div>
          )}
        </div>
        {!canEdit ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Timeline: {projectStartDate || "—"} → {endDate || "—"}
          </div>
        ) : null}

        {project.workflow?.progressPercent != null ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Progress: {project.workflow.progressPercent}% (automatic from workflow)
          </div>
        ) : project.progressPercent != null ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Progress: {project.progressPercent}% (automatic from workflow)
          </div>
        ) : null}
      </div>

      <ProjectWorkflowPanel
        projectId={id}
        proposalId={project.proposalId || null}
        workflow={{
          ...(project.workflow || {}),
          projectStatus: project.status,
          awardsVisible: project.awardsVisible,
          isVoluntary,
        }}
      />
      {!project.workflow && project.workflowError ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(245,158,11,0.45)" }}>
          <div style={{ fontWeight: 700 }}>Workflow temporarily unavailable</div>
          <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>{project.workflowError}</p>
        </div>
      ) : null}

      <ProjectOutputsHub
        projectId={id}
        accessToken={accessToken}
        canAddOutput={isOwner}
        canDeleteOutput={isOwner || user?.role === "research_director"}
        canManage={["faculty_coordinator", "research_director"].includes(user?.role)}
        canComment={isOwner || ["faculty_coordinator", "research_director", "leadership"].includes(user?.role)}
        departmentLabel={project.title}
        onPublicationValidated={() => load().catch(() => {})}
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
          {!isVoluntary ? (
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
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Milestones</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 10 }}>
          Planned research checkpoints / deadlines for the project team.{" "}
          <span style={{ opacity: 0.9 }}>SO: Qodobada qorshaysan ee mashruuca (waqtiyada muhiimka ah).</span>
        </p>
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
                min={minPlanDate}
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
              const origEnd = dateIso(project.endDate);
              if (endDate && isDateInPast(endDate) && dateIso(endDate) !== origEnd) {
                setError(pastDateMessage("End date"));
                return;
              }
              const pastMilestone = milestones.find((m, idx) => {
                if (!m.title.trim() || !isDateInPast(m.dueDate)) return false;
                return dateIso(m.dueDate) !== dateIso(project.milestones?.[idx]?.dueDate);
              });
              if (pastMilestone) {
                setError(pastDateMessage("Milestone due date"));
                return;
              }
              await projectApi.updateProject(accessToken, id, {
                milestones: milestones.filter((m) => m.title.trim()),
                teamMembers: teamMembers.filter((m) => m.name.trim()),
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
          <div style={{ fontWeight: 800 }}>Project progress</div>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                const blob = await analyticsApi.downloadTechnicalReportPdf(accessToken, id);
                triggerBlobDownload(blob, `technical-report-${project.title || "project"}.pdf`);
              } catch (e) {
                setError(e?.response?.data?.message || "Failed to download technical report");
              }
            }}
          >
            Download technical report (PDF)
          </button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Progress % is calculated automatically. Team, milestones, repository, publications, and closure are updated manually by you.
          {project.workflow?.currentStepLabel ? (
            <span> Current step: {project.workflow.currentStepLabel}.</span>
          ) : null}
          {project.workflow?.progressPercent != null || project.progressPercent != null ? (
            <span> • {project.workflow?.progressPercent ?? project.progressPercent}% complete</span>
          ) : null}
        </div>
      </div>

      <ProjectExecutionPanel
        project={project}
        canEdit={canEdit || isOwner}
        onSave={saveExecution}
        onLogCommunication={logCommunication}
      />

      <div
        className="card"
        style={{
          marginTop: 12,
          borderColor:
            user?.role === "research_director" && project.closure?.status === "submitted"
              ? "rgba(56,189,248,0.55)"
              : undefined,
        }}
        id="closure"
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Project closure (Phase 6) — Complete project</div>
        {user?.role === "research_director" && project.closure?.status === "submitted" ? (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              background: "rgba(14,165,233,0.12)",
              border: "1px solid rgba(56,189,248,0.4)",
            }}
          >
            <strong>Action needed:</strong> PI submitted project closure — use{" "}
            <strong>Director approve closure</strong> below. It will then appear in Finance automatically
            (grant-funded).
          </div>
        ) : null}
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
            style={{ marginTop: 12, padding: "10px 18px", fontWeight: 800 }}
            onClick={async () => {
              try {
                setError("");
                await projectApi.directorClosureApproval(accessToken, id, "Approved");
                setMessage(
                  isVoluntary
                    ? "Director approved — project closed."
                    : "Director approved — waiting for Finance clearance. After Finance approves, the project closes automatically."
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
            Waiting for Finance clearance. When Finance approves, this project will close automatically.
          </p>
        ) : null}
        {["completed", "closed"].includes(project.status) || project.closure?.status === "archived" ? (
          <div className="card" style={{ marginTop: 10, borderColor: "rgba(34,197,94,0.45)" }}>
            <strong>Project closed.</strong>
            <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
              Closure: {project.closure?.status || "—"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
