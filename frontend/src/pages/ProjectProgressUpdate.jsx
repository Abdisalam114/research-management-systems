import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useScrollToTop } from "../hooks/useScrollToTop";
import * as projectApi from "../services/projectApi";

export function ProjectProgressUpdatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [note, setNote] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useScrollToTop([id, loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await projectApi.getProject(accessToken, id);
        if (cancelled) return;
        const reports = res.project?.progressReports || [];
        const latest = reports[0];
        if (typeof latest?.progressPercent === "number") {
          setProgressPercent(latest.progressPercent);
        } else if (typeof res.project?.progressPercent === "number") {
          setProgressPercent(res.project.progressPercent);
        }
      } catch {
        /* keep default 0 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

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
        {loading ? <p className="muted">Loading current progress…</p> : null}
        <div className="field">
          <label>Progress note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed since last report?" />
        </div>
        <div className="field">
          <label>Progress ({progressPercent}%)</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={progressPercent}
            onChange={(e) => setProgressPercent(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <input
            type="number"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setProgressPercent(Math.min(100, Math.max(0, n)));
            }}
            style={{ marginTop: 8, width: 80 }}
          />
        </div>

        <button
          type="button"
          className="btn primary"
          disabled={busy || loading || !note.trim()}
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
