import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as userApi from "../services/userApi";
import { formatRole } from "../utils/roleLabels";
import { SYSTEM_ROLES } from "../constants/systemRoles";

const CREATE_ROLES = SYSTEM_ROLES.filter((r) => r !== "research_director").map((value) => ({
  value,
  label: formatRole(value),
}));

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected / deactivated" },
];

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  role: "researcher",
  department: "",
  rank: "",
  status: "active",
  programTier: "undergraduate",
};

export function PendingUsersPage() {
  const { accessToken, user: me } = useAuth();
  const { programTier, programTierLabel } = useProgramTier();
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  async function handleDeleteUser(u) {
    if (u.isProtected) {
      setError("Protected accounts cannot be deleted.");
      return;
    }
    if (String(u.id) === String(me?.id)) {
      setError("You cannot delete your own account.");
      return;
    }
    const ok = window.confirm(
      `Delete user permanently?\n\n${u.fullName}\n${u.email}\n\nOnly the Research Director can delete users. This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(u.id);
    setError("");
    setSuccess("");
    try {
      await userApi.deleteUser(accessToken, u.id);
      setSuccess(`Deleted ${u.fullName}`);
      if (edit?.id === u.id) setEdit(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Delete failed");
    } finally {
      setBusyId("");
    }
  }

  function openEdit(u) {
    setError("");
    setSuccess("");
    setEdit({
      id: u.id,
      fullName: u.fullName || "",
      department: u.department || "",
      rank: u.rank || "",
      role: u.role || "researcher",
      status: u.status || "active",
      isProtected: Boolean(u.isProtected),
      email: u.email || "",
      isSelf: String(u.id) === String(me?.id),
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!edit?.id) return;
    setSavingEdit(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        fullName: edit.fullName.trim(),
        department: edit.department.trim(),
        rank: edit.rank.trim(),
      };
      // Role / status / protection cannot be changed on your own account (backend also blocks).
      if (!edit.isSelf) {
        body.role = edit.role;
        body.status = edit.status;
        body.isProtected = Boolean(edit.isProtected);
      }
      const res = await userApi.updateUser(accessToken, edit.id, body);
      setSuccess(res.message || `Updated ${edit.fullName}`);
      setEdit(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  async function load() {
    setError("");
    let firstErr = "";
    try {
      const pendingRes = await userApi.listPendingUsers(accessToken);
      setPending(pendingRes.users || []);
    } catch (e) {
      setPending([]);
      firstErr = e?.response?.data?.message || "Failed to load pending users";
    }
    try {
      const usersRes = await userApi.listUsers(accessToken);
      setAllUsers(usersRes.users || []);
    } catch (e) {
      setAllUsers([]);
      if (!firstErr) firstErr = e?.response?.data?.message || "Failed to load users";
    }
    if (firstErr) setError(firstErr);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load users"));
  }, [accessToken, programTier]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const res = await userApi.createUser(accessToken, form);
      setSuccess(res.message || "User created");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Create user failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Director — Users</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        Only the Research Director can <strong>create</strong>, <strong>edit</strong>, and <strong>delete</strong>{" "}
        accounts. Coordinator, Finance, and Leadership are <strong>one account each</strong> for the whole system
        (UG + PG). Researchers must be assigned to <strong>Undergraduate</strong> or <strong>Postgraduate</strong>.
      </p>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginTop: 12 }}>{error}</div> : null}
      {success ? (
        <div className="card" style={{ borderColor: "rgba(45, 212, 191, 0.35)", marginTop: 12 }}>
          {success}
        </div>
      ) : null}

      {edit ? (
        <div className="card" style={{ marginTop: 16, borderColor: "rgba(14,165,233,0.45)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Edit user (Director only)</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            {edit.email}
            {edit.isSelf ? " — you can update your name/department/rank only (not role or status)." : null}
          </p>
          <form onSubmit={handleSaveEdit}>
            <div className="row">
              <div className="field">
                <label>Full name</label>
                <input
                  value={edit.fullName}
                  onChange={(e) => setEdit({ ...edit, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Department</label>
                <input
                  value={edit.department}
                  onChange={(e) => setEdit({ ...edit, department: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Rank</label>
                <input
                  value={edit.rank}
                  onChange={(e) => setEdit({ ...edit, rank: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  value={edit.role}
                  disabled={edit.isSelf}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                >
                  {CREATE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Status</label>
                <select
                  value={edit.status}
                  disabled={edit.isSelf}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Protection</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(edit.isProtected)}
                    disabled={edit.isSelf}
                    onChange={(e) => setEdit({ ...edit, isProtected: e.target.checked })}
                  />
                  Protected (cannot be deleted)
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className="btn primary" type="submit" disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
              <button className="btn" type="button" disabled={savingEdit} onClick={() => setEdit(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Create user</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          Staff roles (Coordinator / Finance / Leadership) are system-wide. Researchers need an UG or PG assignment
          below.
        </p>
        <form onSubmit={handleCreate}>
          <div className="row">
            <div className="field">
              <label>Full name</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Rank</label>
              <input
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {CREATE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                {form.role === "researcher" ? "Program (UG / PG)" : "Program note"}
              </label>
              {form.role === "researcher" ? (
                <select
                  value={form.programTier}
                  onChange={(e) => setForm({ ...form, programTier: e.target.value })}
                  required
                >
                  <option value="undergraduate">Undergraduate (UG)</option>
                  <option value="postgraduate">Postgraduate (PG)</option>
                </select>
              ) : (
                <input value="System-wide (UG + PG)" disabled readOnly />
              )}
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <div className="field">
              <label>Initial status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active (can sign in immediately)</option>
                <option value="pending">Pending (approve later)</option>
              </select>
            </div>
          </div>
          <button className="btn primary" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create user"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Pending approval ({pending.length})</div>
        {pending.length === 0 ? (
          <div className="muted">No pending users.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {pending.map((u) => (
              <div key={u.id} className="card">
                <div style={{ fontWeight: 700 }}>{u.fullName}</div>
                <div className="muted">
                  {u.email} • {formatRole(u.role)} • {u.department} • {u.programTierLabel || u.programTier || "—"}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => openEdit(u)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={busyId === u.id}
                    onClick={async () => {
                      setBusyId(u.id);
                      try {
                        await userApi.approveUser(accessToken, u.id);
                        await load();
                      } catch (err) {
                        setError(err?.response?.data?.message || "Approve failed");
                      } finally {
                        setBusyId("");
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={busyId === u.id}
                    onClick={async () => {
                      setBusyId(u.id);
                      try {
                        await userApi.rejectUser(accessToken, u.id);
                        await load();
                      } catch (err) {
                        setError(err?.response?.data?.message || "Reject failed");
                      } finally {
                        setBusyId("");
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>All users ({allUsers.length})</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Edit and Delete are Research Director only. You cannot change your own role/status or delete yourself.
          Protected accounts cannot be deleted.
        </p>
        <table className="dashTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Portal</th>
              <th>Status</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => {
              const isSelf = String(u.id) === String(me?.id);
              const canDelete = !u.isProtected && !isSelf;
              return (
                <tr key={u.id}>
                  <td>
                    {u.fullName}
                    {u.isProtected ? (
                      <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                        (protected)
                      </span>
                    ) : null}
                  </td>
                  <td>{u.email}</td>
                  <td>{formatRole(u.role)}</td>
                  <td>{u.programTierLabel || u.programTier || "—"}</td>
                  <td>{u.status}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        disabled={busyId === u.id}
                        onClick={() => openEdit(u)}
                      >
                        Edit
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            borderColor: "rgba(239,68,68,0.55)",
                            color: "#fecaca",
                            padding: "4px 10px",
                            fontSize: 12,
                          }}
                          disabled={busyId === u.id}
                          onClick={() => handleDeleteUser(u)}
                        >
                          {busyId === u.id ? "…" : "Delete"}
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                          {isSelf ? "You" : "Locked"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
