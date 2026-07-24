import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as thesisApi from "../services/thesisGroupApi";
import * as userApi from "../services/userApi";
import * as departmentApi from "../services/departmentApi";
import { PageHeader } from "../components/PageHeader";
import { GroupsModuleNav } from "../components/GroupsModuleNav";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";
import { FACULTIES, DEFAULT_FACULTY, matchFacultyByName } from "../constants/faculties";
import { apiOrigin } from "../config/apiBase";
import "./groups.css";

const MANAGE_ROLES = ["faculty_coordinator", "research_director"];
const MIN_THESIS_GROUP_STUDENTS = 4;

const emptyStudentRow = () => ({ fullName: "", studentId: "", email: "" });
const defaultStudentRows = () => Array.from({ length: MIN_THESIS_GROUP_STUDENTS }, emptyStudentRow);

const THESIS_STATUSES = [
  { value: "proposed", label: "Proposed" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "defended", label: "Defended" },
  { value: "completed", label: "Completed" },
];

const TITLE_PROPOSAL_LABELS = {
  none: "No title yet",
  pending: "Title pending acceptance",
  accepted: "Title accepted",
  rejected: "Title rejected",
};

const CHAPTER_STATUSES = [
  { value: "pending", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "reviewed", label: "Reviewed" },
];

const EMPTY_FORM = {
  department: "",
  departmentId: "",
  faculty: FACULTIES[0].value,
  facultyResearchArea: "",
  supervisorId: "",
  meetingSchedule: "",
  status: "proposed",
  students: defaultStudentRows(),
};

function facultyKeyForDepartment(d) {
  if (d?.faculty && FACULTIES.some((f) => f.value === d.faculty)) return d.faculty;
  const inferred = matchFacultyByName(d?.name || d?.faculty || "");
  if (inferred && FACULTIES.some((f) => f.value === inferred)) return inferred;
  return DEFAULT_FACULTY;
}

function departmentFieldsFromGroup(g, departments) {
  const match =
    departments.find((d) => String(d.id) === String(g.departmentId)) ||
    departments.find((d) => d.name === g.department);
  const faculty =
    (g.faculty && FACULTIES.some((f) => f.value === g.faculty) ? g.faculty : null) ||
    (match ? facultyKeyForDepartment(match) : null) ||
    matchFacultyByName(g.department) ||
    FACULTIES[0].value;
  return {
    faculty,
    departmentId: match?.id || g.departmentId || "",
    department: match?.name || g.department || "",
  };
}

function defaultFacultyForUser(user) {
  if (user?.role === "faculty_coordinator" && user?.department) {
    return matchFacultyByName(user.department);
  }
  return FACULTIES[0].value;
}

const EMPTY_MEETING = { date: "", location: "", agenda: "", notes: "", chaptersDiscussed: [] };

function titleProposalBadge(status) {
  const colors = {
    none: { bg: "rgba(148,163,184,0.15)", color: "#64748b" },
    pending: { bg: "rgba(251,191,36,0.15)", color: "#b45309" },
    accepted: { bg: "rgba(34,197,94,0.15)", color: "#15803d" },
    rejected: { bg: "rgba(239,68,68,0.15)", color: "#b91c1c" },
  };
  const c = colors[status] || colors.none;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.color }}>
      {TITLE_PROPOSAL_LABELS[status] || status}
    </span>
  );
}

function chapterStatusLabel(s) {
  return CHAPTER_STATUSES.find((x) => x.value === s)?.label || s;
}

function displayTitle(g) {
  const status = g.titleProposal?.status;
  if (status === "pending" || status === "rejected") {
    if (g.titleProposal?.title?.trim()) return g.titleProposal.title;
  }
  if (g.title?.trim()) return g.title;
  if (g.titleProposal?.title?.trim()) return g.titleProposal.title;
  return null;
}

function formTitleValue(g) {
  return g.titleProposal?.title?.trim() || g.title?.trim() || "";
}

function isTitleAccepted(g) {
  return g.titleProposal?.status === "accepted";
}

function isValidThesisGroup(g) {
  return (g.students?.length || 0) >= MIN_THESIS_GROUP_STUDENTS;
}

function titleProposalStatus(g) {
  return g.titleProposal?.status || "none";
}

export function ThesisGroupsPage() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [searchParams] = useSearchParams();
  const groupIdFromUrl = searchParams.get("groupId") || "";
  const [groups, setGroups] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [meetingForm, setMeetingForm] = useState(EMPTY_MEETING);
  const [titleForm, setTitleForm] = useState({ title: "", reviewNote: "" });
  const [finalDocFile, setFinalDocFile] = useState(null);
  const [markThesisCompleted, setMarkThesisCompleted] = useState(true);
  const [uploadingFinalDoc, setUploadingFinalDoc] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const [message, setMessage] = useState("");

  const canManage = MANAGE_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    const res = await thesisApi.listThesisGroups(accessToken);
    const list = res.groups || [];
    setGroups(list);
}, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  // Deep-link from notification → expand that thesis group
  useEffect(() => {
    if (!groupIdFromUrl || loading || !groups.length) return;
    const match = groups.find((g) => String(g.id) === String(groupIdFromUrl));
    if (!match) return;
    setExpandedId(String(match.id));
    setTitleForm({ title: formTitleValue(match), reviewNote: "" });
    const t = window.setTimeout(() => {
      const el = document.getElementById(`thesis-group-${match.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [groupIdFromUrl, groups, loading]);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      // Load separately so a users 403 does not wipe departments
      try {
        const deptRes = await departmentApi.listDepartments(accessToken);
        setDepartments(deptRes.departments || []);
      } catch (_) {
        setDepartments([]);
      }
      try {
        const usersRes = await userApi.listUsers(accessToken, { role: "researcher", status: "active" });
        setResearchers(usersRes.users || []);
        // #region agent log
        fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
          body: JSON.stringify({
            sessionId: "f558f7",
            runId: "thesis-fix",
            hypothesisId: "H1",
            location: "ThesisGroups.jsx:loadMeta",
            message: "thesis meta loaded",
            data: {
              role: user?.role,
              researchers: (usersRes.users || []).length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      } catch (err) {
        setResearchers([]);
        // #region agent log
        fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
          body: JSON.stringify({
            sessionId: "f558f7",
            runId: "thesis-fix",
            hypothesisId: "H1",
            location: "ThesisGroups.jsx:loadMeta",
            message: "researchers load failed",
            data: {
              role: user?.role,
              status: err?.response?.status || null,
              msg: err?.response?.data?.message || String(err?.message || ""),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      }
    })();
  }, [accessToken, user?.role, programTier]);

  const departmentsByFaculty = useMemo(() => {
    const map = {};
    FACULTIES.forEach((f) => {
      map[f.value] = [];
    });
    departments.forEach((d) => {
      const key = facultyKeyForDepartment(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    return map;
  }, [departments]);

  const departmentsForFaculty = useMemo(
    () => departmentsByFaculty[form.faculty] || [],
    [departmentsByFaculty, form.faculty]
  );

  const stats = useMemo(() => {
    const validGroups = groups.filter(isValidThesisGroup);
    const titleAccepted = validGroups.filter(isTitleAccepted).length;
    const titlePending = validGroups.filter((g) => titleProposalStatus(g) === "pending").length;
    const totalStudents = validGroups.reduce((acc, g) => acc + (g.students?.length || 0), 0);
    return [
      { label: "Thesis groups", value: validGroups.length, filterKey: "validGroups", accent: "#0ea5e9" },
      { label: "Titles pending", value: titlePending, filterKey: "titlePending", accent: "#f59e0b" },
      { label: "Title accepted", value: titleAccepted, filterKey: "titleAccepted", accent: "#22c55e" },
      {
        label: "With supervisor",
        value: validGroups.filter((g) => g.supervisorId).length,
        filterKey: "hasSupervisor",
        accent: "#0284c7",
      },
      { label: "Total students", value: totalStudents, filterKey: "hasStudents", accent: "#7dd3fc" },
    ];
  }, [groups]);

  const filteredGroups = useMemo(
    () =>
      filterByStatKey(groups, statusFilter, {
        customFilters: {
          validGroups: isValidThesisGroup,
          hasTitle: (g) => Boolean(g.title?.trim()),
          hasSupervisor: (g) => Boolean(g.supervisorId) && isValidThesisGroup(g),
          hasStudents: isValidThesisGroup,
          titleAccepted: (g) => isTitleAccepted(g) && isValidThesisGroup(g),
          titlePending: (g) => titleProposalStatus(g) === "pending" && isValidThesisGroup(g),
        },
      }),
    [groups, statusFilter]
  );

  function resetForm() {
    setForm({ ...EMPTY_FORM, faculty: defaultFacultyForUser(user) });
    setEditingId(null);
    setShowForm(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, faculty: defaultFacultyForUser(user) });
    setShowForm(true);
  }

  function studentRowsForForm(existing) {
    const rows = existing?.length ? existing.map((s) => ({ ...s })) : [];
    while (rows.length < MIN_THESIS_GROUP_STUDENTS) rows.push(emptyStudentRow());
    return rows;
  }

  function openEdit(g) {
    setEditingId(g.id);
    const deptFields = departmentFieldsFromGroup(g, departments);
    setForm({
      ...deptFields,
      facultyResearchArea: g.facultyResearchArea || "",
      supervisorId: g.supervisorId?._id || g.supervisorId || "",
      meetingSchedule: g.meetingSchedule || "",
      status: g.status || "proposed",
      students: studentRowsForForm(g.students),
    });
    setShowForm(true);
  }

  function onFacultyChange(faculty) {
    setForm((prev) => ({
      ...prev,
      faculty,
      department: "",
      departmentId: "",
    }));
  }

  function onDepartmentChange(departmentId) {
    const dept = departmentsForFaculty.find((d) => d.id === departmentId);
    setForm((prev) => ({
      ...prev,
      departmentId,
      department: dept?.name || "",
    }));
  }

  function toggleView(g) {
    const opening = expandedId !== g.id;
    setExpandedId(opening ? g.id : null);
    if (opening) {
      setMeetingForm(EMPTY_MEETING);
      setTitleForm({ title: formTitleValue(g), reviewNote: "" });
    }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      setError("");
      const cleanStudents = form.students
        .map((s) => ({ fullName: s.fullName?.trim(), studentId: s.studentId?.trim(), email: s.email?.trim() }))
        .filter((s) => s.fullName);
      if (cleanStudents.length < MIN_THESIS_GROUP_STUDENTS) {
        setError(`Each thesis group requires at least ${MIN_THESIS_GROUP_STUDENTS} students`);
        return;
      }
      if (!form.departmentId && !form.department?.trim()) {
        setError("Select a department under the chosen faculty.");
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
      setMessage("");
      if (!meetingForm.date) {
        setError("Meeting date is required");
        return;
      }
      const res = await thesisApi.addThesisMeeting(accessToken, groupId, meetingForm);
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          runId: "thesis-meetings-ui",
          hypothesisId: "M6",
          location: "ThesisGroups.jsx:submitMeeting",
          message: "meeting logged from UI",
          data: {
            groupId: String(groupId),
            meetingsInResponse: res?.group?.meetings?.length ?? null,
            date: meetingForm.date,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      // Keep meetings visible immediately (avoid “disappeared” flash on reload)
      if (res?.group) {
        setGroups((prev) => prev.map((g) => (String(g.id) === String(groupId) ? res.group : g)));
      }
      setMeetingForm(EMPTY_MEETING);
      setExpandedId(groupId);
      setMessage("Meeting saved — it stays on this thesis group.");
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to log meeting");
    }
  }

  async function submitTitleProposal(groupId) {
    try {
      setError("");
      setMessage("");
      if (!titleForm.title?.trim()) {
        setError("Student thesis title is required");
        return;
      }
      const res = await thesisApi.proposeThesisTitle(accessToken, groupId, { title: titleForm.title.trim() });
      if (res?.group) {
        setGroups((prev) => prev.map((g) => (String(g.id) === String(groupId) ? res.group : g)));
      }
      setMessage("Title submitted for coordinator/director approval.");
      setExpandedId(groupId);
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save title proposal");
    }
  }

  async function reviewTitle(groupId, decision) {
    try {
      setError("");
      setMessage("");
      const res = await thesisApi.reviewThesisTitle(accessToken, groupId, {
        decision,
        note: titleForm.reviewNote?.trim(),
      });
      if (res?.group) {
        setGroups((prev) => prev.map((g) => (String(g.id) === String(groupId) ? res.group : g)));
      }
      setMessage(
        decision === "unlock"
          ? "Title unlocked — supervisor can enter a new title."
          : decision === "accept" || decision === "accepted"
            ? "Title accepted."
            : "Title rejected."
      );
      setExpandedId(groupId);
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to review title");
    }
  }

  async function updateChapter(groupId, chapterKey, status) {
    try {
      setError("");
      const res = await thesisApi.updateThesisChapter(accessToken, groupId, chapterKey, { status });
      if (res?.group) {
        setGroups((prev) => prev.map((g) => (String(g.id) === String(groupId) ? res.group : g)));
      }
      setExpandedId(groupId);
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to update chapter");
    }
  }

  async function submitFinalDocument(e, groupId) {
    e.preventDefault();
    if (!finalDocFile) {
      setError("Choose a PDF or Word (.doc / .docx) file");
      return;
    }
    try {
      setError("");
      setMessage("");
      setUploadingFinalDoc(true);
      const res = await thesisApi.uploadFinalThesisDocument(accessToken, groupId, {
        file: finalDocFile,
        markCompleted: markThesisCompleted,
      });
      if (res?.group) {
        setGroups((prev) => prev.map((g) => (String(g.id) === String(groupId) ? res.group : g)));
      }
      setFinalDocFile(null);
      setMarkThesisCompleted(true);
      setExpandedId(groupId);
      setMessage(
        markThesisCompleted
          ? "Final thesis uploaded and marked completed."
          : "Final thesis document uploaded."
      );
      await reload();
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to upload final thesis");
    } finally {
      setUploadingFinalDoc(false);
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
    if (form.students.length <= MIN_THESIS_GROUP_STUDENTS) return;
    setForm({ ...form, students: form.students.filter((_, i) => i !== idx) });
  }

  function toggleMeetingChapter(key) {
    const set = new Set(meetingForm.chaptersDiscussed || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setMeetingForm({ ...meetingForm, chaptersDiscussed: Array.from(set) });
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

  function formatMeetingDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    // Use UTC calendar date so YYYY-MM-DD stored at noon UTC does not shift day
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatTimelineDate(at) {
    if (!at) return "—";
    return new Date(at).toLocaleString();
  }

  return (
    <div className="groupsPage">
      <GroupsModuleNav />

      <PageHeader
        title="Thesis"
        subtitle="Students choose the title; the supervisor enters it; the Faculty Coordinator accepts or rejects it."
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
      {message ? (
        <div className="card" style={{ borderColor: "rgba(34,197,94,0.45)", marginBottom: 10 }}>{message}</div>
      ) : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.55)", marginBottom: 10 }}>{error}</div>
      ) : null}

      {canManage && showForm ? (
        <form className="card" onSubmit={submit} style={{ marginBottom: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{editingId ? "Update thesis group" : "Create thesis group"}</div>

          <div className="row">
            <div className="field">
              <label>Faculty *</label>
              <select value={form.faculty} onChange={(e) => onFacultyChange(e.target.value)} required>
                {FACULTIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.icon} {f.value}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Department *</label>
              <select
                value={form.departmentId}
                onChange={(e) => onDepartmentChange(e.target.value)}
                required
                disabled={!departmentsForFaculty.length}
              >
                <option value="">
                  {departmentsForFaculty.length ? "— Select department —" : "No departments for this faculty"}
                </option>
                {departmentsForFaculty.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.code ? ` (${d.code})` : ""}
                  </option>
                ))}
              </select>
              {!departmentsForFaculty.length ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Add departments under this faculty on the Faculties &amp; Departments page first.
                </p>
              ) : null}
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {THESIS_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
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
          </div>

          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Thesis title is entered later by the assigned supervisor after students choose it.
            {researchers.length === 0 ? (
              <>
                {" "}
                <strong style={{ color: "#b45309" }}>
                  No researchers loaded — you cannot assign a supervisor until researchers are available on this portal.
                </strong>
              </>
            ) : null}
          </p>

          <div className="row">
            <div className="field">
              <label>Faculty research area</label>
              <input value={form.facultyResearchArea} onChange={(e) => setForm({ ...form, facultyResearchArea: e.target.value })} placeholder="e.g. AI, Renewable Energy" />
            </div>
            <div className="field">
              <label>Meeting schedule</label>
              <input value={form.meetingSchedule} onChange={(e) => setForm({ ...form, meetingSchedule: e.target.value })} placeholder="e.g. Weekly on Wednesdays 14:00" />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>Students (minimum {MIN_THESIS_GROUP_STUDENTS})</div>
              <button type="button" className="btn" onClick={addStudentRow}>+ Add student</button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {form.students.map((s, idx) => (
                <div key={idx} className="card" style={{ background: "rgba(14,165,233,0.05)" }}>
                  <div className="row">
                    <div className="field">
                      <label>Full name</label>
                      <input
                        value={s.fullName}
                        onChange={(e) => updateStudent(idx, "fullName", e.target.value)}
                        required={idx < MIN_THESIS_GROUP_STUDENTS}
                        placeholder="Student full name"
                      />
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
                      {form.students.length > MIN_THESIS_GROUP_STUDENTS ? (
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
          const titleStatus = titleProposalStatus(g);
          const isAssignedSupervisor =
            user?.role === "researcher" && supervisorIdValue && String(supervisorIdValue) === String(user?.id);
          const canLogMeeting = canManage || isAssignedSupervisor;
          const canUpdateChapters = canManage || isAssignedSupervisor;
          const canUploadFinalDoc = canManage || isAssignedSupervisor;
          const canEnterTitle = isAssignedSupervisor && titleStatus !== "accepted";
          const canReviewTitle = canManage && titleStatus === "pending";
          const shownTitle = displayTitle(g);
          const finalDoc = g.finalDocument;

          return (
            <div
              key={g.id}
              id={`thesis-group-${g.id}`}
              className="card"
              style={{
                borderColor: "rgba(56,189,248,0.25)",
                ...(expandedId === g.id && groupIdFromUrl === String(g.id)
                  ? { outline: "2px solid #38bdf8", boxShadow: "0 0 0 4px rgba(56,189,248,0.2)" }
                  : null),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      🎓 {shownTitle || <span className="muted">Untitled thesis</span>}
                    </div>
                    {titleProposalBadge(titleStatus)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {g.faculty || "—"} • {g.department || "—"} • Status: {statusLabel(g.status)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    Supervisor: <strong>{supervisorLabel(g)}</strong> • Students:{" "}
                    <strong>{g.students?.length || 0}</strong> • Meetings:{" "}
                    <strong>{g.meetings?.length || 0}</strong>
                    {finalDoc?.path ? (
                      <>
                        {" "}
                        • Final doc: <strong>uploaded</strong>
                      </>
                    ) : null}
                    {g.meetings?.length ? (
                      <>
                        {" "}
                        (last: {formatMeetingDate(
                          [...g.meetings].sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date
                        )})
                      </>
                    ) : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    Linked research group: <strong>{researchGroupLabel(g)}</strong>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {canReviewTitle ? (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => reviewTitle(g.id, "accept")}
                        title="Accept thesis title"
                      >
                        Accept title
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setExpandedId(g.id);
                          setTitleForm({ title: "", reviewNote: "" });
                        }}
                        title="Open reject form"
                      >
                        Reject title
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="btn" onClick={() => toggleView(g)}>
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
                  {canEnterTitle ? (
                    <div className="card" style={{ background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.35)" }}>
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>Enter student thesis title</div>
                      <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                        After students choose their title, enter it here. The coordinator will review and accept it.
                      </p>
                      <div className="field" style={{ marginBottom: 8 }}>
                        <label>Thesis title</label>
                        <input
                          value={titleForm.title}
                          onChange={(e) => setTitleForm({ ...titleForm, title: e.target.value })}
                          placeholder="Title chosen by students"
                        />
                      </div>
                      <button type="button" className="btn primary" onClick={() => submitTitleProposal(g.id)}>
                        Submit title for approval
                      </button>
                    </div>
                  ) : null}

                  {canReviewTitle ? (
                    <div className="card" style={{ background: "rgba(14,165,233,0.06)" }}>
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>
                        Faculty Coordinator — Accept or Reject title
                      </div>
                      <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                        Supervisor submitted: <strong>{g.titleProposal?.title}</strong>
                      </p>
                      <div className="field" style={{ marginBottom: 8 }}>
                        <label>Review note (optional — useful when rejecting)</label>
                        <input
                          value={titleForm.reviewNote}
                          onChange={(e) => setTitleForm({ ...titleForm, reviewNote: e.target.value })}
                          placeholder="Comments if rejecting"
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn primary" onClick={() => reviewTitle(g.id, "accept")}>
                          Accept title
                        </button>
                        <button type="button" className="btn" onClick={() => reviewTitle(g.id, "reject")}>
                          Reject title
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {titleStatus === "accepted" ? (
                    <div className="card" style={{ background: "rgba(34,197,94,0.06)" }}>
                      <div className="muted" style={{ fontSize: 12 }}>Accepted thesis title</div>
                      <div style={{ fontWeight: 700 }}>{g.title}</div>
                      {g.titleProposal?.reviewedAt ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Accepted: {formatTimelineDate(g.titleProposal.reviewedAt)}
                        </div>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          className="btn"
                          style={{ marginTop: 8 }}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Unlock this title so the supervisor can enter a new student-chosen title?"
                              )
                            ) {
                              reviewTitle(g.id, "unlock");
                            }
                          }}
                        >
                          Unlock title
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {titleStatus === "rejected" ? (
                    <div className="card" style={{ background: "rgba(239,68,68,0.06)" }}>
                      <div className="muted" style={{ fontSize: 12 }}>Rejected title proposal</div>
                      <div style={{ fontWeight: 600 }}>{g.titleProposal?.title}</div>
                      {g.titleProposal?.reviewNote ? (
                        <div className="muted" style={{ marginTop: 4 }}>{g.titleProposal.reviewNote}</div>
                      ) : null}
                    </div>
                  ) : null}

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
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Chapter progress</div>
                    {g.chapters?.length ? (
                      <table className="dashTable">
                        <thead>
                          <tr>
                            <th>Chapter</th>
                            <th>Status</th>
                            {canUpdateChapters ? <th>Update</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {g.chapters.map((ch) => (
                            <tr key={ch.key}>
                              <td>{ch.title}</td>
                              <td>{chapterStatusLabel(ch.status)}</td>
                              {canUpdateChapters ? (
                                <td>
                                  <select
                                    value={ch.status}
                                    onChange={(e) => updateChapter(g.id, ch.key, e.target.value)}
                                    style={{ fontSize: 13 }}
                                  >
                                    {CHAPTER_STATUSES.map((s) => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <span className="muted">No chapters configured.</span>}
                  </div>

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
                            <th>Chapters</th>
                            <th>Agenda</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.meetings
                            .slice()
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .map((m) => {
                              const chapterNames = (m.chaptersDiscussed || [])
                                .map((key) => g.chapters?.find((c) => c.key === key)?.title || key)
                                .join(", ");
                              const loggedBy =
                                typeof m.loggedBy === "object" && m.loggedBy
                                  ? m.loggedBy.fullName
                                  : null;
                              return (
                                <tr key={m._id || m.id || `${m.date}-${m.agenda}`}>
                                  <td>{formatMeetingDate(m.date)}</td>
                                  <td>{m.location || "—"}</td>
                                  <td>{chapterNames || "—"}</td>
                                  <td>
                                    {m.agenda || "—"}
                                    {loggedBy ? (
                                      <div className="muted" style={{ fontSize: 11 }}>
                                        by {loggedBy}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td>{m.notes || "—"}</td>
                                </tr>
                              );
                            })}
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
                          <label>Chapters discussed</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {(g.chapters || []).map((ch) => (
                              <label key={ch.key} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                                <input
                                  type="checkbox"
                                  checked={(meetingForm.chaptersDiscussed || []).includes(ch.key)}
                                  onChange={() => toggleMeetingChapter(ch.key)}
                                />
                                {ch.title.replace(/^Chapter \d+: /, "Ch")}
                              </label>
                            ))}
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

                  <div className="card">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Final thesis document</div>
                    <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                      When the thesis is finished, the supervisor uploads the full manuscript as PDF or Word.
                    </p>
                    {finalDoc?.path ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          alignItems: "center",
                          marginBottom: canUploadFinalDoc ? 12 : 0,
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "rgba(22,163,74,0.08)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontWeight: 700 }}>{finalDoc.originalName || "Thesis document"}</div>
                          {finalDoc.uploadedAt ? (
                            <div className="muted" style={{ fontSize: 12 }}>
                              Uploaded {formatTimelineDate(finalDoc.uploadedAt)}
                            </div>
                          ) : null}
                        </div>
                        <a
                          className="btn"
                          href={`${apiOrigin()}${finalDoc.path}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View / Download
                        </a>
                      </div>
                    ) : (
                      <div className="muted" style={{ marginBottom: canUploadFinalDoc ? 12 : 0 }}>
                        No final document uploaded yet.
                      </div>
                    )}
                    {canUploadFinalDoc ? (
                      <form onSubmit={(e) => submitFinalDocument(e, g.id)} style={{ display: "grid", gap: 8 }}>
                        <div className="field">
                          <label>{finalDoc?.path ? "Replace with new file (PDF / DOC / DOCX)" : "Upload PDF or Word"}</label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => setFinalDocFile(e.target.files?.[0] || null)}
                          />
                        </div>
                        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={markThesisCompleted}
                            onChange={(e) => setMarkThesisCompleted(e.target.checked)}
                          />
                          Mark thesis as completed
                        </label>
                        <div>
                          <button type="submit" className="btn primary" disabled={uploadingFinalDoc || !finalDocFile}>
                            {uploadingFinalDoc ? "Uploading…" : finalDoc?.path ? "Replace final document" : "Upload final thesis"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>

                  <div className="card">
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Activity log</div>
                    {g.activityTimeline?.length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {g.activityTimeline.map((item, i) => (
                          <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(14,165,233,0.05)", fontSize: 13 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <strong>{item.label}</strong>
                              <span className="muted">{formatTimelineDate(item.at)}</span>
                            </div>
                            {item.detail ? <div className="muted" style={{ marginTop: 4 }}>{item.detail}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : <span className="muted">No activity yet.</span>}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {groups.length === 0 ? (
          <div className="card muted">No thesis groups yet.{canManage ? " Click + New thesis group to create one." : ""}</div>
        ) : null}
        {!loading && groups.length > 0 && filteredGroups.length === 0 ? (
          <div className="card muted">No thesis groups match this filter.</div>
        ) : null}
      </div>
    </div>
  );
}
