import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as userApi from "../services/userApi";
import { formatRole } from "../utils/roleLabels";

const CREATE_ROLES = [
  { value: "researcher", label: "Researcher" },
  { value: "faculty_coordinator", label: "Faculty Coordinator" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "ethics_committee", label: "Ethics Committee" },
  { value: "procurement_officer", label: "Procurement Officer" },
];

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  role: "researcher",
  department: "",
  rank: "",
  status: "active",
};

export function PendingUsersPage() {
  const { accessToken } = useAuth();
  const { programTierLabel } = useProgramTier();
  const [pending, setPending] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setError("");
    const [pendingRes, usersRes] = await Promise.all([
      userApi.listPendingUsers(accessToken),
      userApi.listUsers(accessToken),
    ]);
    setPending(pendingRes.users || []);
    setAllUsers(usersRes.users || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load users"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        Only the Research Director can create accounts and switch both portals. Each user is assigned to{" "}
        <strong>one portal only</strong> — currently viewing <strong>{programTierLabel}</strong> users.
      </p>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginTop: 12 }}>{error}</div> : null}
      {success ? (
        <div className="card" style={{ borderColor: "rgba(45, 212, 191, 0.35)", marginTop: 12 }}>
          {success}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Create user</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          New user will be assigned to the <strong>{programTierLabel}</strong> portal. Switch portal in the top bar to
          create UG or PG users separately.
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
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>Initial status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active (can sign in immediately)</option>
              <option value="pending">Pending (approve later)</option>
            </select>
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
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
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
        <table className="dashTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Portal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td>{formatRole(u.role)}</td>
                <td>{u.programTierLabel || u.programTier || "—"}</td>
                <td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
