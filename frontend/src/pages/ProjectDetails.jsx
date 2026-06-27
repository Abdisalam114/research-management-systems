import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";

const emptyMilestone = { title: "", dueDate: "", completed: false };
const emptyMember = { name: "", role: "member" };

export function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([emptyMilestone]);
  const [teamMembers, setTeamMembers] = useState([emptyMember]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (!project) return <div>{error || "Loading..."}</div>;

  const isOwner = String(project.researcherId) === String(user?.id);
  const canEdit = isOwner || user?.role === "research_director";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Project Management</h2>
        <Link className="btn" to="/projects">
          Back
        </Link>
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
                      {Number(g.amountAwarded || 0) > 0
                        ? ` • Awarded ${g.currency} ${Number(g.amountAwarded).toLocaleString()}`
                        : ` • Requested ${g.currency} ${Number(g.amountRequested || 0).toLocaleString()}`}
                    </div>
                  </div>
                  <Link className="btn" to={`/grants/${g.id}`}>
                    View grant
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            No grants linked to this project yet.
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
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Progress reports</div>
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
    </div>
  );
}
