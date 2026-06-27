import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as thesisApi from "../services/thesisGroupApi";
import * as userApi from "../services/userApi";
import { PageHeader } from "../components/PageHeader";
import { GroupsModuleNav } from "../components/GroupsModuleNav";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";
import { FACULTIES } from "../constants/faculties";
import "./groups.css";

const MANAGE_ROLES = ["faculty_coordinator", "research_director"];

const THESIS_STATUSES = [
  { value: "proposed", label: "Proposed" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "defended", label: "Defended" },
  { value: "completed", label: "Completed" },
];

const EMPTY_FORM = {
  title: "",
  department: "",
  faculty: FACULTIES[0].value,
  facultyResearchArea: "",
  supervisorId: "",
  meetingSchedule: "",
  status: "proposed",
  students: [{ fullName: "", studentId: "", email: "" }],
};

const EMPTY_MEETING = { date: "", location: "", agenda: "", notes: "" };

export function ThesisGroupsPage() {
  const { accessToken, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [meetingForm, setMeetingForm] = useState(EMPTY_MEETING);
  const [statusFilter, setStatusFilter] = useState("all");

  const canManage = MANAGE_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    const res = await thesisApi.listThesisGroups(accessToken);
    setGroups(res.groups || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await userApi.listUsers(accessToken, { role: "researcher", status: "active" });
        setResearchers(res.users || []);
      } catch (_) {
        setResearchers([]);
      }
    })();
  }, [accessToken]);

  const stats = useMemo(() => {
    const titled = groups.filter((g) => g.title).length;
    const supervised = groups.filter((g) => g.supervisorId).length;
    const totalStudents = groups.reduce((acc, g) => acc + (g.students?.length || 0), 0);
    return [
      { label: "Thesis groups", value: groups.length, filterKey: "all", accent: "#0ea5e9" },
      { label: "With title", value: titled, filterKey: "hasTitle", accent: "#38bdf8" },
      { label: "With supervisor", value: supervised, filterKey: "hasSupervisor", accent: "#1d4ed8" },
      { label: "Total students", value: totalStudents, filterKey: "hasStudents", accent: "#7dd3fc" },
    ];
  }, [groups]);

  const filteredGroups = useMemo(
    () =>
      filterByStatKey(groups, statusFilter, {
        customFilters: {
          hasTitle: (g) => Boolean(g.title?.trim()),
          hasSupervisor: (g) => Boolean(g.supervisorId),
          hasStudents: (g) => (g.students?.length || 0) > 0,
        },
      }),
    [groups, statusFilter]
  );

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(g) {
    setEditingId(g.id);
    setForm({
      title: g.title || "",
      department: g.department || "",
      faculty: g.faculty || FACULTIES[0].value,
      facultyResearchArea: g.facultyResearchArea || "",
      supervisorId: g.supervisorId?._id || g.supervisorId || "",
      meetingSchedule: g.meetingSchedule || "",
      status: g.status || "proposed",
      students: g.students && g.students.length ? g.students.map((s) => ({ ...s })) : [{ fullName: "", studentId: "", email: "" }],
    });
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      setError("");
      const cleanStudents = form.students
        .map((s) => ({ fullName: s.fullName?.trim(), studentId: s.studentId?.trim(), email: s.email?.trim() }))
        .filter((s) => s.fullName);
      if (cleanStudents.length === 0) {
        setError("At least one student name is required");
        return;
      }
      const body = { ...form, students: cleanStudents };
      if (editingId) {
        await thesisApi.updateThesisGroup(accessToken, editingId, body);
      } else {
        await thesisApi.createThesisGroup(accessToken, body);
      }
      resetForm();
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save thesis group");
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this thesis group?")) return;
    try {
      await thesisApi.deleteThesisGroup(accessToken, id);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete");
    }
  }

  async function submitMeeting(e, groupId) {
    e.preventDefault();
    try {
      setError("");
      if (!meetingForm.date) {
        setError("Meeting date is required");
        return;
      }
      await thesisApi.addThesisMeeting(accessToken, groupId, meetingForm);
      setMeetingForm(EMPTY_MEETING);
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to log meeting");
    }
  }

  function updateStudent(idx, field, value) {
    const next = form.students.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    setForm({ ...form, students: next });
  }

  function addStudentRow() {
    setForm({ ...form, students: [...form.students, { fullName: "", studentId: "", email: "" }] });
  }

  function removeStudentRow(idx) {
    if (form.students.length === 1) return;
    setForm({ ...form, students: form.students.filter((_, i) => i !== idx) });
  }

  function supervisorLabel(g) {
    if (!g.supervisorId) return "—";
    if (typeof g.supervisorId === "object") return `${g.supervisorId.fullName} (${g.supervisorId.department || ""})`;
    return String(g.supervisorId);
  }

  function researchGroupLabel(g) {
    if (!g.researchGroupId) return "—";
    if (typeof g.researchGroupId === "object") return g.researchGroupId.name || "—";
    return "—";
  }

  function statusLabel(s) {
    return THESIS_STATUSES.find((x) => x.value === s)?.label || s || "—";
  }

  return (
    <div className="groupsPage">
      <GroupsModuleNav />

      <PageHeader
        title="Thesis"
        subtitle="Thesis supervision: students, titles, supervisor assignment, faculty research area, and meeting logs (date, location, agenda)."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          canManage ? (
            <button type="button" className="btn primary" onClick={showForm ? resetForm : openCreate}>
              {showForm ? "Close form" : "+ New thesis group"}
            </button>
          ) : null
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filteredGroups.length})
        </p>
      ) : null}
      {loading ? <p className="muted">Loading thesis groups…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.55)", marginBottom: 10 }}>{error}</div>
      ) : null}

      {canManage && showForm ? (
        <form className="card" onSubmit={submit} style={{ marginBottom: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{editingId ? "Update thesis group" : "Create thesis group"}</div>

          <div className="row">
            <div className="field">
              <label>Thesis title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Machine Learning for Disease Detection" />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {THESIS_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Faculty</label>
              <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })}>
                {FACULTIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.icon} {f.value}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Department</label>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science" />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Supervisor (researcher)</label>
              <select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {researchers.map((r) => (
                  <option key={r.id || r._id} value={r.id || r._id}>
                    {r.fullName} — {r.department}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Faculty research area</label>
              <input value={form.facultyResearchArea} onChange={(e) => setForm({ ...form, facultyResearchArea: e.target.value })} placeholder="e.g. AI, Renewable Energy" />
            </div>
          </div>

          <div className="field">
            <label>Meeting status / schedule (when and where you meet)</label>
            <input value={form.meetingSchedule} onChange={(e) => setForm({ ...form, meetingSchedule: e.target.value })} placeholder="e.g. Weekly on Wednesdays 14:00 at Lab 201" />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>Students</div>
              <button type="button" className="btn" onClick={addStudentRow}>+ Add student</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {form.students.map((s, idx) => (
                <div key={idx} className="card" style={{ background: "rgba(14,165,233,0.05)" }}>
                  <div className="row">
                    <div className="field">
                      <label>Full name</label>
                      <input value={s.fullName} onChange={(e) => updateStudent(idx, "fullName", e.target.value)} required placeholder="Student full name" />
                    </div>
                    <div className="field">
                      <label>Student ID</label>
                      <input value={s.studentId} onChange={(e) => updateStudent(idx, "studentId", e.target.value)} placeholder="Reg / matric no." />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label>Email</label>
                      <input value={s.email} onChange={(e) => updateStudent(idx, "email", e.target.value)} placeholder="student@university.edu" />
                    </div>
                    <div className="field" style={{ justifyContent: "flex-end" }}>
                      <label>&nbsp;</label>
                      {form.students.length > 1 ? (
                        <button type="button" className="btn" onClick={() => removeStudentRow(idx)}>Remove</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" type="submit">{editingId ? "Update" : "Create"}</button>
            <button type="button" className="btn" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {filteredGroups.map((g) => {
          const open = expandedId === g.id;
          const supervisorIdValue = g.supervisorId?._id || g.supervisorId || null;
          const canLogMeeting =
            canManage ||
            (user?.role === "researcher" && supervisorIdValue && String(supervisorIdValue) === String(user?.id));
          return (
            <div key={g.id} className="card" style={{ borderColor: "rgba(56,189,248,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    🎓 {g.title || <span className="muted">Untitled thesis</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {g.faculty || "—"} • {g.department || "—"} • Status: {statusLabel(g.status)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    Supervisor: <strong>{supervisorLabel(g)}</strong> • Students: <strong>{g.students?.length || 0}</strong> • Meetings: <strong>{g.meetings?.length || 0}</strong>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    Linked research group: <strong>{researchGroupLabel(g)}</strong> (counted in Groups stats as thesis)
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn" onClick={() => setExpandedId(open ? null : g.id)}>
                    {open ? "Hide" : "View"}
                  </button>
                  {canManage ? (
                    <>
                      <button type="button" className="btn" onClick={() => openEdit(g)}>Edit</button>
                      {user?.role === "research_director" ? (
                        <button type="button" className="btn" onClick={() => remove(g.id)}>Delete</button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              {open ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {g.facultyResearchArea ? (
                    <div className="card" style={{ background: "rgba(14,165,233,0.05)" }}>
                      <div className="muted" style={{ fontSize: 12 }}>Faculty research area</div>
                      <div style={{ fontWeight: 700 }}>{g.facultyResearchArea}</div>
                    </div>
                  ) : null}

                  {g.meetingSchedule ? (
                    <div className="card" style={{ background: "rgba(14,165,233,0.05)" }}>
                      <div className="muted" style={{ fontSize: 12 }}>Meeting schedule</div>
                      <div style={{ fontWeight: 700 }}>{g.meetingSchedule}</div>
                    </div>
                  ) : null}

                  <div className="card">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Students ({g.students?.length || 0})</div>
                    {g.students?.length ? (
                      <table className="dashTable">
                        <thead>
                          <tr>
                            <th>Full name</th>
                            <th>Student ID</th>
                            <th>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.students.map((s, i) => (
                            <tr key={i}>
                              <td>{s.fullName}</td>
                              <td>{s.studentId || "—"}</td>
                              <td>{s.email || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <span className="muted">No students.</span>}
                  </div>

                  <div className="card">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Meetings ({g.meetings?.length || 0})</div>
                    {g.meetings?.length ? (
                      <table className="dashTable">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Location</th>
                            <th>Agenda</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.meetings
                            .slice()
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((m, i) => (
                              <tr key={i}>
                                <td>{new Date(m.date).toLocaleDateString()}</td>
                                <td>{m.location || "—"}</td>
                                <td>{m.agenda || "—"}</td>
                                <td>{m.notes || "—"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    ) : <span className="muted">No meetings logged yet.</span>}

                    {canLogMeeting ? (
                      <form onSubmit={(e) => submitMeeting(e, g.id)} style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Log a meeting</div>
                        <div className="row">
                          <div className="field">
                            <label>Date</label>
                            <input type="date" value={meetingForm.date} onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })} required />
                          </div>
                          <div className="field">
                            <label>Location</label>
                            <input value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} placeholder="e.g. Lab 201" />
                          </div>
                        </div>
                        <div className="field">
                          <label>Agenda</label>
                          <input value={meetingForm.agenda} onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })} placeholder="What was discussed" />
                        </div>
                        <div className="field">
                          <label>Notes</label>
                          <input value={meetingForm.notes} onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })} placeholder="Decisions, next steps" />
                        </div>
                        <div>
                          <button type="submit" className="btn primary">+ Log meeting</button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {groups.length === 0 ? (
          <div className="card muted">No thesis groups yet.{canManage ? " Click + New thesis group to create one." : ""}</div>
        ) : null}
      </div>
    </div>
  );
}
