import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";

export function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await projectApi.getProject(accessToken, id);
    setProject(res.project);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load project"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!project) return <div style={{ padding: 8 }}>{error ? error : "Loading..."}</div>;

  const isOwner = String(project.researcherId) === String(user?.id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Project Details</h2>
        <Link className="btn" to="/projects">
          Back
        </Link>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{project.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Status: {project.status}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          Proposal link: {project.proposalId}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {isOwner ? (
            <button className="btn primary" onClick={() => navigate(`/projects/${id}/progress`)}>
              Add progress update
            </button>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Progress Reports</div>
        {(project.progressReports || []).length === 0 ? (
          <div className="muted">No progress reports yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {project.progressReports.map((r, idx) => (
              <div className="card" key={idx}>
                <div className="muted">
                  {new Date(r.createdAt).toLocaleString()} • {r.progressPercent ?? 0}%
                </div>
                <div style={{ marginTop: 6 }}>{r.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

