import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";

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

  const stats = useMemo(() => {
    const by = (s) => projects.filter((p) => p.status === s).length;
    return [
      { label: "Total", value: projects.length },
      { label: "Active", value: by("active"), accent: "#38bdf8" },
      { label: "Completed", value: by("completed"), accent: "#1d4ed8" },
      { label: "On hold", value: by("on_hold") },
    ];
  }, [projects]);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Track project progress, milestones, and outputs."
        stats={stats}
        actions={
          <>
            <Link className="btn primary" to="/proposals">+ Start from Proposal</Link>
            <Link className="btn" to="/budgets">Budgets</Link>
            <Link className="btn" to="/publications">Publications</Link>
          </>
        }
      />
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

