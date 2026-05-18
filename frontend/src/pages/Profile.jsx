import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";

export function ProfilePage() {
  const { user, accessToken, loadMe } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [rank, setRank] = useState(user?.rank || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Profile</h2>
      <div className="card">
        {message ? (
          <div className="card" style={{ borderColor: "rgba(45, 212, 191, 0.35)", marginBottom: 12 }}>
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="row">
          <div className="field">
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label>Department</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Rank</label>
          <input value={rank} onChange={(e) => setRank(e.target.value)} />
        </div>

        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await api.put(
                "/api/users/me",
                { fullName, department, rank },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              await loadMe(accessToken);
              setMessage("Profile updated.");
            } catch (e) {
              setError(e?.response?.data?.message || "Update failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

