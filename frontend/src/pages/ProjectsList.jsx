import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { ProjectWorkflowSummary } from "../components/ProjectWorkflowPanel";
import { StatusBadge } from "../components/StatusBadge";
import { ProgramTierBadge } from "../components/ProgramTierBadge";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";
import { SubmitSuccessAlert } from "../components/SubmitValidationAlert";

function projectKind(p) {
  if (p?.isVoluntary === false) return "grant_fund_call";
  if (p?.proposalKind === "grant_fund_call" || p?.fundingCallId) return "grant_fund_call";
  if (p?.isVoluntary === true || p?.proposalKind === "voluntary") return "voluntary";
  return "voluntary";
}

function isKindFilter(key) {
  return (
    key === "kind:voluntary" ||
    key === "voluntary" ||
    key === "kind:grant_fund_call" ||
    key === "grant_fund_call"
  );
}

function kindFilterValue(key) {
  if (key === "kind:voluntary" || key === "voluntary") return "voluntary";
  if (key === "kind:grant_fund_call" || key === "grant_fund_call") return "grant_fund_call";
  return null;
}

function kindLabel(p) {
  return projectKind(p) === "grant_fund_call" ? "Grant Fund Call" : "Voluntary";
}

function ProjectCard({ p, isDirector, canDelete, onApproveClosure, onDelete, busyId }) {
  const needsDirectorClosure = isDirector && p.closure?.status === "submitted";
  return (
    <div
      className="card"
      style={
        needsDirectorClosure
          ? { borderColor: "rgba(56,189,248,0.55)", boxShadow: "0 0 0 1px rgba(14,165,233,0.2)" }
          : undefined
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/projects/${p.id}#${needsDirectorClosure ? "closure" : "workflow"}`}
            style={{ fontWeight: 800, fontSize: 16, color: "inherit", textDecoration: "none" }}
          >
            {p.title}
          </Link>
          <div className="muted" style={{ marginTop: 4 }}>
            <ProgramTierBadge tier={p.programTier} label={p.programTierLabel} />
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
                    : "rgba(245, 158, 11, 0.16)",
                color: kindLabel(p) === "Voluntary" ? "#7dd3fc" : "#fbbf24",
              }}
            >
              {kindLabel(p)}
            </span>
            {needsDirectorClosure ? (
              <span
                style={{
                  display: "inline-block",
                  marginRight: 8,
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  background: "rgba(14,165,233,0.2)",
                  color: "#7dd3fc",
                }}
              >
                Closure awaiting Director
              </span>
            ) : null}
            {p.principalInvestigatorName || p.principalInvestigator?.fullName ? (
              <>
                PI:{" "}
                <strong>{p.principalInvestigatorName || p.principalInvestigator?.fullName}</strong>
                {p.principalInvestigator?.department ? ` (${p.principalInvestigator.department})` : ""}
              </>
            ) : null}
          </div>
          <ProjectWorkflowSummary workflow={p.workflow} projectId={p.id} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
          <StatusBadge
            status={p.status === "closed" ? "completed" : p.status === "active" ? "open" : p.status}
            label={
              p.status === "completed" || p.status === "closed"
                ? "Completed / Closed"
                : p.status === "active"
                  ? "Open"
                  : undefined
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {needsDirectorClosure ? (
              <button
                type="button"
                className="btn primary"
                disabled={busyId === p.id}
                onClick={() => onApproveClosure?.(p)}
              >
                {busyId === p.id ? "Saving…" : "Director approve closure"}
              </button>
            ) : null}
            <Link className="btn primary" to={`/projects/${p.id}#${needsDirectorClosure ? "closure" : "workflow"}`}>
              {needsDirectorClosure ? "Open closure" : "Open workflow"}
            </Link>
            {canDelete ? (
              <button
                type="button"
                className="btn"
                style={{ borderColor: "rgba(248,113,113,0.6)", color: "#f87171" }}
                disabled={busyId === p.id}
                onClick={() => onDelete?.(p)}
              >
                {busyId === p.id ? "Deleting…" : "Delete"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectSection({ title, hint, items, emptyText, isDirector, canDeleteProject, onApproveClosure, onDelete, busyId }) {
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
            <ProjectCard
              key={p.id}
              p={p}
              isDirector={isDirector}
              canDelete={canDeleteProject?.(p)}
              onApproveClosure={onApproveClosure}
              onDelete={onDelete}
              busyId={busyId}
            />
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
  const { programTier } = useProgramTier();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [acceptedBanner, setAcceptedBanner] = useState("");
  const [busyId, setBusyId] = useState("");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");
  const isDirector = user?.role === "research_director";
  const isResearcher = user?.role === "researcher";

  function canDeleteProject(p) {
    if (isDirector) return true;
    if (!isResearcher || !p) return false;
    return String(p.researcherId || "") === String(user?.id || "");
  }

  async function load() {
    setError("");
    const res = await projectApi.listProjects(accessToken);
    const list = res.projects || [];
    setProjects(list);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load projects"));
  }, [accessToken, programTier]);

  useEffect(() => {
    if (location.state?.proposalAccepted) {
      setAcceptedBanner(
        location.state.message ||
          "Congratulations — the proposal was accepted and the project is Open. Please continue your work."
      );
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.proposalAccepted]);

  const pendingDirectorClosures = useMemo(() => {
    if (!isDirector) return [];
    const kind = kindFilterValue(statusFilter);
    return projects.filter((p) => {
      if (p.closure?.status !== "submitted") return false;
      if (kind && projectKind(p) !== kind) return false;
      return true;
    });
  }, [projects, isDirector, statusFilter]);


  async function approveClosure(p) {
    if (!p?.id || busyId) return;
    setBusyId(p.id);
    setError("");
    setMessage("");
    try {
      await projectApi.directorClosureApproval(accessToken, p.id, "Director approved");
      setMessage(
        projectKind(p) === "voluntary"
          ? `${p.title}: approved — project closed.`
          : `${p.title}: Director approved — waiting for Finance. After Finance clears, the project closes automatically.`
      );
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Director approval failed");
    } finally {
      setBusyId("");
    }
  }

  async function deleteProject(p) {
    if (!p?.id || busyId) return;
    const ok = window.confirm(`Delete project "${p.title}"?`);
    if (!ok) return;
    setBusyId(p.id);
    setError("");
    setMessage("");
    try {
      await projectApi.deleteProject(accessToken, p.id);
      setProjects((prev) => prev.filter((row) => String(row.id) !== String(p.id)));
      setMessage(`${p.title}: deleted.`);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete project");
    } finally {
      setBusyId("");
    }
  }

  const title =
    pageTitle || (user?.role === "researcher" ? "My Projects" : "Projects");
  const subtitle = pageSubtitle || "";

  const stats = useMemo(() => {
    const byStatus = (s) => projects.filter((p) => p.status === s).length;
    const activeCount = byStatus("active");
    const closingCount = byStatus("closing");
    const completedCount = projects.filter((p) =>
      ["completed", "closed"].includes(p.status)
    ).length;
    const onHoldCount = byStatus("on_hold");
    const voluntaryCount = projects.filter((p) => projectKind(p) === "voluntary").length;
    const grantCount = projects.filter((p) => projectKind(p) === "grant_fund_call").length;
    return [
      { label: "Total", value: projects.length, filterKey: "all" },
      { label: "Voluntary", value: voluntaryCount, filterKey: "kind:voluntary", accent: "#38bdf8" },
      { label: "Grant Fund", value: grantCount, filterKey: "kind:grant_fund_call", accent: "#eab308" },
      { label: "Open", value: activeCount, filterKey: "active", accent: "#38bdf8" },
      { label: "Closing", value: closingCount, filterKey: "closing", accent: "#f59e0b" },
      { label: "Completed", value: completedCount, filterKey: "completed", accent: "#16a34a" },
      ...(onHoldCount > 0 ? [{ label: "On hold", value: onHoldCount, filterKey: "on_hold" }] : []),
    ];
  }, [projects]);

  const filtered = useMemo(() => {
    const list = filterByStatKey(projects, statusFilter, {
      customFilters: {
        active: (p) => p.status === "active",
        open: (p) => p.status === "active",
        closing: (p) => p.status === "closing",
        completed: (p) => ["completed", "closed"].includes(p.status),
        "kind:voluntary": (p) => projectKind(p) === "voluntary",
        voluntary: (p) => projectKind(p) === "voluntary",
        "kind:grant_fund_call": (p) => projectKind(p) === "grant_fund_call",
        grant_fund_call: (p) => projectKind(p) === "grant_fund_call",
      },
    });
    if (!isDirector) return list;
    const closureIds = new Set(
      projects.filter((p) => p.closure?.status === "submitted").map((p) => String(p.id))
    );
    if (!closureIds.size) return list;
    return list.filter((p) => !closureIds.has(String(p.id)));
  }, [projects, statusFilter, isDirector]);

  const voluntaryProjects = useMemo(
    () => filtered.filter((p) => projectKind(p) === "voluntary"),
    [filtered]
  );
  const grantProjects = useMemo(
    () => filtered.filter((p) => projectKind(p) === "grant_fund_call"),
    [filtered]
  );

  const kindOnlyFilter = isKindFilter(statusFilter);

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

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing: <strong>{statFilterLabel(stats, statusFilter)}</strong> ({filtered.length})
        </p>
      ) : null}
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}
      <SubmitSuccessAlert
        title="Congratulations"
        message={acceptedBanner}
        onDismiss={() => setAcceptedBanner("")}
      />
      {message ? (
        <div className="card" style={{ borderColor: "rgba(45,212,191,0.35)", marginTop: 12 }}>
          {message}
        </div>
      ) : null}

      {isDirector && pendingDirectorClosures.length > 0 ? (
        <div
          className="card"
          style={{
            marginTop: 12,
            borderColor: "rgba(56,189,248,0.55)",
            background: "rgba(14,165,233,0.08)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            Closures awaiting Director approval ({pendingDirectorClosures.length})
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Appears automatically when a PI submits project closure.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {pendingDirectorClosures.map((p) => (
              <ProjectCard
                key={`closure-${p.id}`}
                p={p}
                isDirector
                canDelete={canDeleteProject(p)}
                onApproveClosure={approveClosure}
                onDelete={deleteProject}
                busyId={busyId}
              />
            ))}
          </div>
        </div>
      ) : null}

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
              <ProjectCard
                key={p.id}
                p={p}
                isDirector={isDirector}
                canDelete={canDeleteProject(p)}
                onApproveClosure={approveClosure}
                onDelete={deleteProject}
                busyId={busyId}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {(statusFilter === "all" || (!kindOnlyFilter && voluntaryProjects.length > 0)) ? (
            <ProjectSection
              title={`Voluntary research (${voluntaryProjects.length})`}
              items={voluntaryProjects}
              emptyText="No voluntary projects in this filter."
              isDirector={isDirector}
              canDeleteProject={canDeleteProject}
              onApproveClosure={approveClosure}
              onDelete={deleteProject}
              busyId={busyId}
            />
          ) : null}
          {(statusFilter === "all" || (!kindOnlyFilter && grantProjects.length > 0)) ? (
            <ProjectSection
              title={`Grant Fund Call (${grantProjects.length})`}
              items={grantProjects}
              emptyText="No grant-funded projects in this filter."
              isDirector={isDirector}
              canDeleteProject={canDeleteProject}
              onApproveClosure={approveClosure}
              onDelete={deleteProject}
              busyId={busyId}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
