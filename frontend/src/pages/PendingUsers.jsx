import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";

export function PendingUsersPage() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    setError("");
    const { data } = await api.get("/api/users/pending", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setUsers(data.users || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load pending users"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Pending Users</h2>
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {users.length === 0 ? (
          <div className="muted">No pending users.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {users.map((u) => (
              <div key={u.id} className="card">
                <div style={{ fontWeight: 700 }}>{u.fullName}</div>
                <div className="muted">
                  {u.email} • {u.role} • {u.department}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    className="btn primary"
                    disabled={busyId === u.id}
                    onClick={async () => {
                      setBusyId(u.id);
                      try {
                        await api.post(
                          `/api/users/${u.id}/approve`,
                          {},
                          { headers: { Authorization: `Bearer ${accessToken}` } }
                        );
                        await load();
                      } catch (e) {
                        setError(e?.response?.data?.message || "Approve failed");
                      } finally {
                        setBusyId("");
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn"
                    disabled={busyId === u.id}
                    onClick={async () => {
                      setBusyId(u.id);
                      try {
                        await api.post(
                          `/api/users/${u.id}/reject`,
                          {},
                          { headers: { Authorization: `Bearer ${accessToken}` } }
                        );
                        await load();
                      } catch (e) {
                        setError(e?.response?.data?.message || "Reject failed");
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
    </div>
  );
}

