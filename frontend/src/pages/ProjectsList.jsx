import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { ProjectWorkflowSummary } from "../components/ProjectWorkflowPanel";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";

function projectKind(p) {
  if (p?.isVoluntary === false) return "grant_fund_call";
  if (p?.proposalKind === "grant_fund_call" || p?.fundingCallId) return "grant_fund_call";
  return "voluntary";
}

function kindLabel(p) {
  return projectKind(p) === "grant_fund_call" ? "Grant Fund Call" : "Voluntary";
}

function statusBadgeStyle(status) {
  if (["completed", "closed"].includes(status)) {
    return { background: "rgba(29, 78, 216, 0.18)", color: "#93c5fd" };
  }
  if (status === "closing") {
    return { background: "rgba(252, 211, 77, 0.2)", color: "#fcd34d" };
  }
  if (status === "active") {
    return { background: "rgba(56, 189, 248, 0.15)", color: "#7dd3fc" };
  }
  return { background: "rgba(148, 163, 184, 0.18)", color: "#cbd5e1" };
}

function statusLabel(status) {
  if (status === "completed" || status === "closed") return "Completed / Closed";
  if (status === "closing") return "Closing";
  if (status === "on_hold") return "On hold";
  if (status === "active") return "Active";
  return status || "—";
}

function ProjectCard({ p }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/projects/${p.id}#workflow`}
            style={{ fontWeight: 800, fontSize: 16, color: "inherit", textDecoration: "none" }}
          >
            {p.title}
          </Link>
          <div className="muted" style={{ marginTop: 4 }}>
            <span
              style={{
                display: "inline-block",
                marginRight: 8,
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background:
                  kindLabel(p) === "Voluntary"
                    ? "rgba(56, 189, 248, 0.15)"
                    : "rgba(250, 204, 21, 0.18)",
                color: kindLabel(p) === "Voluntary" ? "#7dd3fc" : "#fde047",
              }}
            >
              {kindLabel(p)}
            </span>
            <span
              style={{
                display: "inline-block",
                marginRight: 8,
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                ...statusBadgeStyle(p.status),
              }}
            >
              {statusLabel(p.status)}
            </span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <Link className="btn primary" to={`/projects/${p.id}#workflow`}>
            Open workflow
          </Link>
          <Link className="btn" to={`/research-workflow?projectId=${p.id}`}>
            Workflow status
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProjectSection({ title, hint, items, emptyText }) {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
        {hint ? (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {hint}
          </div>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

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
    const list = res.projects || [];
    setProjects(list);
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        runId: "project-kind-split",
        hypothesisId: "K2",
        location: "ProjectsList.jsx:load",
        message: "frontend received project kinds",
        data: {
          total: list.length,
          voluntary: list.filter((p) => projectKind(p) === "voluntary").length,
          grantFund: list.filter((p) => projectKind(p) === "grant_fund_call").length,
          completed: list.filter((p) => ["completed", "closed"].includes(p.status)).map((p) => p.title),
          campus: list
            .filter((p) => /Campus Sustainability/i.test(p.title || ""))
            .map((p) => ({ title: p.title, status: p.status, kind: projectKind(p) })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load projects"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    pageTitle || (user?.role === "researcher" ? "My Projects" : "Projects");
  const subtitle =
    pageSubtitle ||
    "Labada nooc: Voluntary research iyo Grant Fund Call — mid walba gooni ayaa loo liistaa.";

  const stats = useMemo(() => {
    const byStatus = (s) => projects.filter((p) => p.status === s).length;
    const completedCount = projects.filter((p) =>
      ["completed", "closed"].includes(p.status)
    ).length;
    const voluntaryCount = projects.filter((p) => projectKind(p) === "voluntary").length;
    const grantCount = projects.filter((p) => projectKind(p) === "grant_fund_call").length;
    return [
      { label: "Total", value: projects.length, filterKey: "all" },
      { label: "Voluntary", value: voluntaryCount, filterKey: "kind:voluntary", accent: "#38bdf8" },
      { label: "Grant Fund", value: grantCount, filterKey: "kind:grant_fund_call", accent: "#eab308" },
      { label: "Active", value: byStatus("active"), filterKey: "active", accent: "#38bdf8" },
      { label: "Closing", value: byStatus("closing"), filterKey: "closing", accent: "#fcd34d" },
      { label: "Completed", value: completedCount, filterKey: "completed", accent: "#1d4ed8" },
      { label: "On hold", value: byStatus("on_hold"), filterKey: "on_hold" },
    ];
  }, [projects]);

  const filtered = useMemo(
    () =>
      filterByStatKey(projects, statusFilter, {
        customFilters: {
          completed: (p) => ["completed", "closed"].includes(p.status),
          "kind:voluntary": (p) => projectKind(p) === "voluntary",
          "kind:grant_fund_call": (p) => projectKind(p) === "grant_fund_call",
        },
      }),
    [projects, statusFilter]
  );

  const voluntaryProjects = useMemo(
    () => filtered.filter((p) => projectKind(p) === "voluntary"),
    [filtered]
  );
  const grantProjects = useMemo(
    () => filtered.filter((p) => projectKind(p) === "grant_fund_call"),
    [filtered]
  );

  const kindOnlyFilter =
    statusFilter === "kind:voluntary" || statusFilter === "kind:grant_fund_call";

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
              <Link className="btn primary" to="/proposals">
                + Voluntary from Proposal
              </Link>
              <Link className="btn" to="/funding-calls">
                Grant via Funding Call
              </Link>
              <Link className="btn" to="/publications">
                Publications
              </Link>
            </>
          ) : (
            <Link className="btn" to="/projects">
              All projects
            </Link>
          )
        }
      />

      <div className="card" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
        <strong>Voluntary</strong> — research project ka yimid voluntary proposal (ethics + workflow).
        <br />
        <strong>Grant Fund Call</strong> — project ka yimid funding call / grant la aqbalay.
      </div>

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filtered.length})
        </p>
      ) : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      {filtered.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="muted">
            {projects.length === 0 ? "No projects found." : "No projects match this filter."}
          </div>
        </div>
      ) : kindOnlyFilter ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {(statusFilter === "all" || voluntaryProjects.length > 0) &&
          statusFilter !== "kind:grant_fund_call" ? (
            <ProjectSection
              title={`Voluntary research (${voluntaryProjects.length})`}
              hint="Projects from voluntary proposals — no funding-call award."
              items={voluntaryProjects}
              emptyText="No voluntary projects in this filter."
            />
          ) : null}
          {(statusFilter === "all" || grantProjects.length > 0) &&
          statusFilter !== "kind:voluntary" ? (
            <ProjectSection
              title={`Grant Fund Call (${grantProjects.length})`}
              hint="Projects linked to an accepted funding-call grant or fund-call proposal."
              items={grantProjects}
              emptyText="No grant-funded projects in this filter."
            />
          ) : null}
        </>
      )}
    </div>
  );
}
