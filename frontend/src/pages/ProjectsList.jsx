import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";

export function ProjectsListPage() {
  const { accessToken, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await projectApi.listProjects(accessToken);
    setProjects(res.projects || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load projects"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = user?.role === "researcher" ? "My Projects" : "Projects";

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {projects.length === 0 ? (
          <div className="muted">No projects found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {projects.map((p) => (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.title}</div>
                    <div className="muted">Status: {p.status}</div>
                  </div>
                  <Link className="btn" to={`/projects/${p.id}`}>
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

