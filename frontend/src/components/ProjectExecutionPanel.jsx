import { useState } from "react";

const ACTIVITY_STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const COMM_TYPES = [
  { value: "note", label: "Note" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "decision", label: "Decision" },
  { value: "other", label: "Other" },
];

const emptyWorkPlan = { phase: "", description: "", startDate: "", endDate: "", owner: "", status: "planned" };
const emptyActivity = { title: "", description: "", dueDate: "", status: "todo", assignedTo: "" };

export function ProjectExecutionPanel({ project, canEdit, onSave, onLogCommunication }) {
  const [workPlan, setWorkPlan] = useState(project.workPlan?.length ? project.workPlan : [emptyWorkPlan]);
  const [activities, setActivities] = useState(project.activities?.length ? project.activities : [emptyActivity]);
  const [commForm, setCommForm] = useState({ type: "note", subject: "", body: "" });
  const [busy, setBusy] = useState(false);

  async function saveExecution() {
    setBusy(true);
    try {
      await onSave({ workPlan, activities });
    } finally {
      setBusy(false);
    }
  }

  async function submitComm(e) {
    e.preventDefault();
    if (!commForm.body?.trim()) return;
    setBusy(true);
    try {
      await onLogCommunication(commForm);
      setCommForm({ type: "note", subject: "", body: "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Work plan</div>
        {workPlan.map((row, idx) => (
          <div key={idx} className="card" style={{ marginBottom: 8, background: "rgba(14,165,233,0.04)" }}>
            <div className="row">
              <div className="field">
                <label>Phase</label>
                <input disabled={!canEdit} value={row.phase || ""} onChange={(e) => {
                  const next = [...workPlan];
                  next[idx] = { ...next[idx], phase: e.target.value };
                  setWorkPlan(next);
                }} />
              </div>
              <div className="field">
                <label>Owner</label>
                <input disabled={!canEdit} value={row.owner || ""} onChange={(e) => {
                  const next = [...workPlan];
                  next[idx] = { ...next[idx], owner: e.target.value };
                  setWorkPlan(next);
                }} />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <input disabled={!canEdit} value={row.description || ""} onChange={(e) => {
                const next = [...workPlan];
                next[idx] = { ...next[idx], description: e.target.value };
                setWorkPlan(next);
              }} />
            </div>
            <div className="row">
              <div className="field">
                <label>Start</label>
                <input type="date" disabled={!canEdit} value={row.startDate ? String(row.startDate).slice(0, 10) : ""} onChange={(e) => {
                  const next = [...workPlan];
                  next[idx] = { ...next[idx], startDate: e.target.value };
                  setWorkPlan(next);
                }} />
              </div>
              <div className="field">
                <label>End</label>
                <input type="date" disabled={!canEdit} value={row.endDate ? String(row.endDate).slice(0, 10) : ""} onChange={(e) => {
                  const next = [...workPlan];
                  next[idx] = { ...next[idx], endDate: e.target.value };
                  setWorkPlan(next);
                }} />
              </div>
            </div>
          </div>
        ))}
        {canEdit ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={() => setWorkPlan([...workPlan, { ...emptyWorkPlan }])}>+ Phase</button>
            <button type="button" className="btn primary" disabled={busy} onClick={saveExecution}>Save work plan & activities</button>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Activities / tasks</div>
        {activities.map((act, idx) => (
          <div key={idx} className="card" style={{ marginBottom: 8, background: "rgba(34,197,94,0.04)" }}>
            <div className="row">
              <div className="field">
                <label>Title</label>
                <input disabled={!canEdit} value={act.title || ""} onChange={(e) => {
                  const next = [...activities];
                  next[idx] = { ...next[idx], title: e.target.value };
                  setActivities(next);
                }} />
              </div>
              <div className="field">
                <label>Assigned to</label>
                <input disabled={!canEdit} value={act.assignedTo || ""} onChange={(e) => {
                  const next = [...activities];
                  next[idx] = { ...next[idx], assignedTo: e.target.value };
                  setActivities(next);
                }} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Due date</label>
                <input type="date" disabled={!canEdit} value={act.dueDate ? String(act.dueDate).slice(0, 10) : ""} onChange={(e) => {
                  const next = [...activities];
                  next[idx] = { ...next[idx], dueDate: e.target.value };
                  setActivities(next);
                }} />
              </div>
              <div className="field">
                <label>Status</label>
                <select disabled={!canEdit} value={act.status || "todo"} onChange={(e) => {
                  const next = [...activities];
                  next[idx] = { ...next[idx], status: e.target.value };
                  setActivities(next);
                }}>
                  {ACTIVITY_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
        {canEdit ? (
          <button type="button" className="btn" onClick={() => setActivities([...activities, { ...emptyActivity }])}>+ Activity</button>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Communication log</div>
        {project.communicationLog?.length ? (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {project.communicationLog.map((entry) => (
              <div key={entry.id} style={{ padding: 10, borderRadius: 8, background: "rgba(148,163,184,0.08)", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{entry.subject || entry.type}</strong>
                  <span className="muted">{entry.loggedAt ? new Date(entry.loggedAt).toLocaleString() : ""}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>{entry.authorName || "Staff"} · {entry.type}</div>
                <div style={{ marginTop: 6 }}>{entry.body}</div>
              </div>
            ))}
          </div>
        ) : <p className="muted">No communications logged yet.</p>}

        <form onSubmit={submitComm} style={{ display: "grid", gap: 8 }}>
          <div className="row">
            <div className="field">
              <label>Type</label>
              <select value={commForm.type} onChange={(e) => setCommForm({ ...commForm, type: e.target.value })}>
                {COMM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Subject</label>
              <input value={commForm.subject} onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Message</label>
            <textarea rows={3} value={commForm.body} onChange={(e) => setCommForm({ ...commForm, body: e.target.value })} required />
          </div>
          <button type="submit" className="btn primary" disabled={busy}>Log communication</button>
        </form>
      </div>
    </>
  );
}

export const CLOSURE_CHECKLIST_ITEMS = [
  { key: "publicationsArchived", label: "Publications archived in repository" },
  { key: "assetsHandedOver", label: "Assets handed over to university" },
  { key: "dataArchived", label: "Research data archived securely" },
  { key: "financialCleared", label: "Financial accounts cleared" },
  { key: "ethicsClosed", label: "Ethics obligations closed" },
];
