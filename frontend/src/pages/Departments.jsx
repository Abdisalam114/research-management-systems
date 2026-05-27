import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import * as departmentApi from "../services/departmentApi";
import { PageHeader } from "../components/PageHeader";
import { FACULTIES, DEFAULT_FACULTY, matchFacultyByName } from "../constants/faculties";

export function DepartmentsPage() {
  const { accessToken } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", faculty: FACULTIES[0].value });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      setError("");
      const res = await departmentApi.listDepartments(accessToken);
      setDepartments(res.departments || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load departments");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await departmentApi.updateDepartment(accessToken, editingId, form);
      } else {
        await departmentApi.createDepartment(accessToken, form);
      }
      setForm({ name: "", code: "", faculty: FACULTIES[0].value });
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save department");
    }
  }

  function startEdit(dept) {
    setEditingId(dept.id);
    setForm({
      name: dept.name || "",
      code: dept.code || "",
      faculty: dept.faculty || FACULTIES[0].value,
    });
    setShowForm(true);
  }

  function startAddForFaculty(faculty) {
    setEditingId(null);
    setForm({ name: "", code: "", faculty });
    setShowForm(true);
  }

  async function remove(id) {
    if (!window.confirm("Delete this department?")) return;
    try {
      await departmentApi.deleteDepartment(accessToken, id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete");
    }
  }

  const departmentsByFaculty = useMemo(() => {
    const map = {};
    FACULTIES.forEach((f) => {
      map[f.value] = [];
    });
    departments.forEach((d) => {
      let key = d.faculty && map[d.faculty] !== undefined ? d.faculty : null;
      if (!key) {
        const inferred = matchFacultyByName(d.name);
        if (inferred && map[inferred] !== undefined) {
          key = inferred;
        }
      }
      if (!key) key = DEFAULT_FACULTY;
      map[key].push(d);
    });
    return map;
  }, [departments]);

  const stats = useMemo(() => {
    const facultiesWithDepts = FACULTIES.filter((f) => (departmentsByFaculty[f.value] || []).length > 0).length;
    return [
      { label: "Faculties", value: FACULTIES.length, accent: "#0ea5e9" },
      { label: "With departments", value: facultiesWithDepts, accent: "#38bdf8" },
      { label: "Departments", value: departments.length, accent: "#1d4ed8" },
    ];
  }, [departments, departmentsByFaculty]);

  return (
    <div>
      <PageHeader
        title="Faculties & Departments"
        subtitle="6 faculties of Jamhuriya University; each faculty contains its departments."
        stats={stats}
        actions={
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) {
                setEditingId(null);
                setForm({ name: "", code: "", faculty: FACULTIES[0].value });
              }
            }}
          >
            {showForm ? "Close form" : "+ Add department"}
          </button>
        }
      />
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginBottom: 12 }}>{error}</div>
      ) : null}

      {showForm ? (
        <form className="card" onSubmit={submit} style={{ marginBottom: 12, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{editingId ? "Update department" : "Add department"}</div>
          <div className="row">
            <div className="field">
              <label>Faculty</label>
              <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} required>
                {FACULTIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.icon} {f.value}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Department name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" type="submit">{editingId ? "Update" : "Create"}</button>
            {editingId ? (
              <button type="button" className="btn" onClick={() => { setEditingId(null); setForm({ name: "", code: "", faculty: FACULTIES[0].value }); setShowForm(false); }}>Cancel</button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {FACULTIES.map((f) => (
          <FacultyCard
            key={f.value}
            faculty={f}
            departments={departmentsByFaculty[f.value]}
            onAdd={() => startAddForFaculty(f.value)}
            onEdit={startEdit}
            onDelete={remove}
          />
        ))}
      </div>
    </div>
  );
}

function FacultyCard({ faculty, departments, onAdd, onEdit, onDelete }) {
  return (
    <div className="card" style={{ borderColor: "rgba(56,189,248,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            <span style={{ marginRight: 6 }}>{faculty.icon}</span>
            {faculty.value}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {departments.length} department{departments.length === 1 ? "" : "s"}
          </div>
        </div>
        {onAdd ? (
          <button type="button" className="btn" onClick={onAdd}>+ Add department to this faculty</button>
        ) : null}
      </div>

      {departments.length ? (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {departments.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{ background: "rgba(14,165,233,0.06)", borderColor: "rgba(56,189,248,0.15)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Code: {d.code}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn" onClick={() => onEdit(d)}>Edit</button>
                  <button type="button" className="btn" onClick={() => onDelete(d.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 10, fontStyle: "italic" }}>
          No departments yet for this faculty.
        </div>
      )}
    </div>
  );
}
