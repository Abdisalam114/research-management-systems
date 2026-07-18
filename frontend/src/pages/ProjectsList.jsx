import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { ProjectWorkflowSummary } from "../components/ProjectWorkflowPanel";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

export function ProjectsListPage({
  pageTitle,
  pageSubtitle,
  showExtraActions = true,
} = {}) {
  const { accessToken, user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  async function load() {
    setError("");
    const res = await projectApi.listProjects(accessToken);
    setProjects(res.projects || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load projects"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    pageTitle || (user?.role === "researcher" ? "My Projects" : "Projects");
  const subtitle =
    pageSubtitle ||
    "Fur project — arag meesha workflow-ku joogo (current step) iyo progress.";

  const stats = useMemo(() => {
    const by = (s) => projects.filter((p) => p.status === s).length;
    return [
      { label: "Total", value: projects.length, filterKey: "all" },
      { label: "Active", value: by("active"), filterKey: "active", accent: "#38bdf8" },
      { label: "Completed", value: by("completed"), filterKey: "completed", accent: "#1d4ed8" },
      { label: "On hold", value: by("on_hold"), filterKey: "on_hold" },
    ];
  }, [projects]);

  const filtered = useMemo(() => filterByStatKey(projects, statusFilter), [projects, statusFilter]);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          showExtraActions ? (
            <>
              <Link className="btn primary" to="/proposals">+ Start from Proposal</Link>
              <Link className="btn" to="/publications">Publications</Link>
              <Link className="btn" to="/funding-calls">Funding Calls</Link>
            </>
          ) : (
            <Link className="btn" to="/projects">
              All projects
            </Link>
          )
        }
      />
      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filtered.length})
        </p>
      ) : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        {filtered.length === 0 ? (
          <div className="muted">{projects.length === 0 ? "No projects found." : "No projects match this filter."}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((p) => (
              <div key={p.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/projects/${p.id}#workflow`}
                      style={{ fontWeight: 800, fontSize: 16, color: "inherit", textDecoration: "none" }}
                    >
                      {p.title}
                    </Link>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Status: {p.status}
                      {p.principalInvestigatorName || p.principalInvestigator?.fullName ? (
                        <>
                          {" "}
                          • PI:{" "}
                          <strong>{p.principalInvestigatorName || p.principalInvestigator?.fullName}</strong>
                          {p.principalInvestigator?.department ? ` (${p.principalInvestigator.department})` : ""}
                        </>
                      ) : null}
                    </div>
                    <ProjectWorkflowSummary workflow={p.workflow} projectId={p.id} />
                  </div>
                  <Link className="btn primary" to={`/projects/${p.id}#workflow`}>
                    Open workflow
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
