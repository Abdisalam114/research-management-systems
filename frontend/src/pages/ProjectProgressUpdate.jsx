import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";

export function ProjectProgressUpdatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [note, setNote] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Project Progress Update</h2>
        <Link className="btn" to={`/projects/${id}`}>
          Back
        </Link>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Progress note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed since last report?" />
        </div>
        <div className="field">
          <label>Progress (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => setProgressPercent(Number(e.target.value))}
          />
        </div>

        <button
          type="button"
          className="btn primary"
          disabled={busy || !note.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await projectApi.addProgress(accessToken, id, note.trim(), progressPercent);
              navigate(`/projects/${id}`, { replace: true });
            } catch (e) {
              setError(e?.response?.data?.message || "Failed to add progress report");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Save progress update"}
        </button>
      </div>
    </div>
  );
}

